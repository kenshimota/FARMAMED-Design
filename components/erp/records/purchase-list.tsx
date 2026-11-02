"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { CurrencyChip, CurrencySelect } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useServerList } from "@/components/erp/ui/use-server-list";
import {
  PURCHASE_COPY,
} from "@/components/erp/records/purchase-errors";
import {
  fetchPurchasePage,
  type PurchaseCurrency,
  type PurchaseRecord,
} from "@/components/erp/records/purchases-api";
import {
  PurchaseStatusBadge,
  purchaseMoney,
  purchaseNumberLabel,
  PURCHASE_STATUS_OPTIONS,
  resolvePurchaseCurrency,
} from "@/components/erp/records/purchase-shared";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import {
  RecordsLoadError,
  RecordsTableSkeleton,
} from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  fetchSupplier,
  fetchSupplierPage,
  type SupplierRecord,
} from "@/components/erp/records/suppliers-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatDateTime, formatInteger } from "@/lib/format";
import type { UiError } from "@/lib/api-errors";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";

export type PurchaseListFilters = {
  supplierId: string;
  status: string;
  number: string;
  currencyId: string;
};

function purchaseErrorMessage(error: UiError | null, fallback: string) {
  if (!error) return fallback;
  if (error.kind === "validation") {
    return "Los filtros ingresados no son válidos. Ajusta la selección e intenta de nuevo.";
  }
  return error.message;
}

export function PurchaseListPage({
  initialFilters,
}: {
  initialFilters: PurchaseListFilters;
}) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  if (!canReadModule(user.role, "compras")) {
    return activityVisible ? (
      <AccessState description="Tu rol no tiene acceso al módulo de compras. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }
  return <PurchaseListContent initialFilters={initialFilters} />;
}

function PurchaseListContent({
  initialFilters,
}: {
  initialFilters: PurchaseListFilters;
}) {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const activityVisible = useActivityVisible();
  const canWrite = canWriteModule(user.role, "compras");

  const list = useServerList<PurchaseRecord>({
    loader: (request) => fetchPurchasePage(request),
    filterKeys: ["supplier_id", "status", "number", "currency_id"],
    defaultSort: "number",
    defaultOrder: "desc",
    initial: {
      filters: {
        supplier_id: initialFilters.supplierId,
        status: initialFilters.status,
        number: initialFilters.number,
        currency_id: initialFilters.currencyId,
      },
    },
  });
  const [numberDraft, setNumberDraft] = useState(initialFilters.number);
  const [supplierDraft, setSupplierDraft] = useState("");
  const numberTimer = useRef<number | null>(null);

  const supplierId = list.filters.supplier_id ?? "";
  const status = list.filters.status ?? "";
  const number = list.filters.number ?? "";
  const currencyId = list.filters.currency_id ?? "";
  const purchases = list.items;

  const currencies = useMemo<PurchaseCurrency[]>(() => {
    return (currencyStatus?.currencies ?? [])
      .filter((currency) => currency.id !== null)
      .map((currency) => ({
        id: currency.id as number,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      }));
  }, [currencyStatus?.currencies]);

  const supplierIds = useMemo(
    () => [
      ...(supplierId ? [supplierId] : []),
      ...purchases
        .filter((purchase) => !purchase.supplier)
        .map((purchase) => String(purchase.supplier_id)),
    ],
    [purchases, supplierId],
  );
  const suppliersById = useRecordsById<SupplierRecord>({
    ids: supplierIds,
    load: fetchSupplier,
    getId: (supplier) => supplier.id,
  }).records;

  const supplierLabel = supplierId
    ? suppliersById[supplierId]
      ? suppliersById[supplierId].name
      : `Proveedor #${supplierId}`
    : "";
  const [appliedSupplierLabel, setAppliedSupplierLabel] =
    useState(supplierLabel);
  if (supplierLabel !== appliedSupplierLabel) {
    setAppliedSupplierLabel(supplierLabel);
    setSupplierDraft(supplierLabel);
  }

  const [appliedNumber, setAppliedNumber] = useState(number);
  if (number !== appliedNumber) {
    setAppliedNumber(number);
    setNumberDraft(number);
  }

  useEffect(() => {
    return () => {
      if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    };
  }, []);

  const filtersActive = Boolean(supplierId || status || number || currencyId);
  const chips: FilterChip[] = [];
  if (supplierId) {
    chips.push({
      id: "supplier_id",
      label: `Proveedor: ${supplierLabel || `#${supplierId}`}`,
      onRemove: () => list.setFilter("supplier_id", ""),
    });
  }
  if (status) {
    chips.push({
      id: "status",
      label: `Estado: ${
        PURCHASE_STATUS_OPTIONS.find((option) => option.value === status)
          ?.label ?? status
      }`,
      onRemove: () => list.setFilter("status", ""),
    });
  }
  if (number) {
    chips.push({
      id: "number",
      label: `Número: ${number}`,
      onRemove: () => {
        setNumberDraft("");
        list.setFilter("number", "");
      },
    });
  }
  if (currencyId) {
    chips.push({
      id: "currency_id",
      label: `Moneda: ${
        currencies.find((currency) => String(currency.id) === currencyId)?.code ??
        `#${currencyId}`
      }`,
      onRemove: () => list.setFilter("currency_id", ""),
    });
  }

  if (!activityVisible) return null;

  function supplierFor(purchase: PurchaseRecord) {
    return purchase.supplier ?? suppliersById[String(purchase.supplier_id)] ?? null;
  }

  function supplierNameFor(purchase: PurchaseRecord) {
    const supplier = supplierFor(purchase);
    return supplier?.name ?? `Proveedor #${purchase.supplier_id}`;
  }

  function currencyFor(purchase: PurchaseRecord) {
    return resolvePurchaseCurrency(
      purchase.currency,
      currencies,
      purchase.currency_id,
      currencyStatus?.defaultCurrency ?? null,
    );
  }

  function currencyChipFor(purchase: PurchaseRecord) {
    const currency = currencyFor(purchase);
    const currencyId = purchase.currency_id ?? purchase.currency?.id ?? null;
    return (
      (currencyStatus?.currencies ?? []).find(
        (item) =>
          item.id !== null &&
          (String(item.id) === String(currencyId) ||
            item.code === currency?.code),
      ) ?? currency
    );
  }

  function handleNumberChange(value: string) {
    setNumberDraft(value);
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    numberTimer.current = window.setTimeout(() => {
      list.setFilter("number", value.trim());
    }, 300);
  }

  function clearFilters() {
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    setNumberDraft("");
    list.clearFilters();
  }

  const columns: RecordsTableColumn<PurchaseRecord>[] = [
    {
      key: "numero",
      header: "Número",
      className: "whitespace-nowrap",
      render: (purchase) => (
        <Link
          className="font-mono text-[13px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/compras/${purchase.id}`}
        >
          {purchaseNumberLabel(purchase.number)}
        </Link>
      ),
    },
    {
      key: "proveedor",
      header: "Proveedor",
      render: (purchase) => (
        <span className="font-semibold text-ink">{supplierNameFor(purchase)}</span>
      ),
    },
    {
      key: "moneda",
      header: "Moneda",
      className: "whitespace-nowrap",
      render: (purchase) => (
        <CurrencyChip currency={currencyChipFor(purchase)} />
      ),
    },
    {
      key: "estado",
      header: "Estado",
      className: "whitespace-nowrap",
      render: (purchase) => <PurchaseStatusBadge status={purchase.status} />,
    },
    {
      key: "subtotal",
      header: "Subtotal",
      className: "whitespace-nowrap",
      render: (purchase) => (
        <span className="tabular-nums text-ink">
          {purchaseMoney(purchase.subtotal, currencyFor(purchase))}
        </span>
      ),
    },
    {
      key: "impuesto",
      header: "Impuesto",
      className: "whitespace-nowrap",
      render: (purchase) => (
        <span className="tabular-nums text-ink">
          {purchaseMoney(purchase.tax_amount, currencyFor(purchase))}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      className: "whitespace-nowrap",
      render: (purchase) => (
        <span className="font-semibold tabular-nums text-ink">
          {purchaseMoney(purchase.total, currencyFor(purchase))}
        </span>
      ),
    },
    {
      key: "confirmada",
      header: "Fecha de confirmación",
      className: "whitespace-nowrap",
      render: (purchase) => (
        <span className="tabular-nums text-muted">
          {purchase.confirmed_at ? formatDateTime(purchase.confirmed_at) : "—"}
        </span>
      ),
    },
  ];

  function renderActions(purchase: PurchaseRecord) {
    const label = purchaseNumberLabel(purchase.number);
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver el detalle de la ${label}`}
          href={`/app/compras/${purchase.id}`}
          icon="arrow-right"
        >
          Ver detalle
        </RecordActionLink>
        {canWrite && purchase.status === "draft" && (
          <RecordActionLink
            ariaLabel={`Editar el borrador de la ${label}`}
            href={`/app/compras/${purchase.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
      </RecordActions>
    );
  }

  function renderCard(purchase: PurchaseRecord) {
    const currency = currencyFor(purchase);
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-semibold text-ink">
              {purchaseNumberLabel(purchase.number)}
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {supplierNameFor(purchase)}
            </p>
          </div>
          <PurchaseStatusBadge status={purchase.status} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1">
              <CurrencyChip currency={currencyChipFor(purchase)} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Total
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {purchaseMoney(purchase.total, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Subtotal
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {purchaseMoney(purchase.subtotal, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Impuesto
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {purchaseMoney(purchase.tax_amount, currency)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Fecha de confirmación
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {purchase.confirmed_at ? formatDateTime(purchase.confirmed_at) : "—"}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/compras/nueva"
            >
              Nueva compra
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta y administra las compras a proveedores. Al confirmar una compra se actualizan costos y existencias de forma irreversible."
        eyebrow="Inventario"
        title="Compras"
      />

      <CurrencyNoticeBanner />

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        id="compras-filtros"
        loading={list.status === "loading"}
        onClear={clearFilters}
        results={
          list.status === "loading"
            ? "Cargando compras…"
            : list.status === "error" && purchases.length === 0
              ? "No se pudieron cargar las compras"
              : list.meta.total === 0
                ? "Sin compras"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="Busca el proveedor por nombre. El filtro se aplica en el servidor."
            id="filtro-compra-proveedor"
            label="Proveedor"
            loadOptions={async (query) => {
              const page = await fetchSupplierPage({ q: query, pageSize: 10 });
              return page.data.map((supplier) => ({
                value: String(supplier.id),
                label: supplier.name,
                description: supplier.identification,
              }));
            }}
            onSelect={(option) => {
              setSupplierDraft(option.label);
              list.setFilter("supplier_id", option.value);
            }}
            onValueChange={(value) => {
              setSupplierDraft(value);
              if (value !== supplierLabel) {
                list.setFilter("supplier_id", "");
              }
            }}
            placeholder="Buscar proveedor"
            value={supplierDraft}
          />
        }
      >
        <SelectField
          id="filtro-compra-estado"
          label="Estado"
          onChange={(value) => list.setFilter("status", value)}
          options={PURCHASE_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
          placeholder="Todos los estados"
          value={status}
        />
        <TextField
          help="Filtra por número de compra. Se aplica automáticamente al escribir."
          id="filtro-compra-numero"
          inputType="search"
          label="Número"
          onChange={handleNumberChange}
          placeholder="Ej. 12"
          value={numberDraft}
        />
        <CurrencySelect
          allOptionLabel="Todas las monedas"
          filter
          help="Busca por código o nombre."
          id="filtro-compra-moneda"
          label="Moneda"
          onChange={(value) => list.setFilter("currency_id", value)}
          value={currencyId}
        />
      </FilterBar>

      {list.status === "loading" && (
        <RecordsTableSkeleton columns={8} label="Cargando compras…" rows={6} />
      )}

      {list.status === "error" && purchases.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={purchaseErrorMessage(
            list.error,
            "No pudimos cargar las compras.",
          )}
          onRetry={list.reload}
          title="No pudimos cargar las compras"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && purchases.length === 0) && (
          <section aria-label="Listado de compras" className="space-y-4">
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && purchases.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={list.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {purchaseErrorMessage(
                  list.error,
                  "No pudimos actualizar las compras. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {purchases.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={
                    canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/compras/nueva"
                      >
                        Nueva compra
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description="Se crean como borrador y se confirman cuando los productos llegan a la droguería."
                  title={PURCHASE_COPY.empty}
                />
              ) : (
                <EmptyState
                  action={
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={
                        list.isPageOutOfRange
                          ? list.goToFirstPage
                          : clearFilters
                      }
                      type="button"
                    >
                      {list.isPageOutOfRange
                        ? "Ir a la primera página"
                        : "Limpiar filtros"}
                    </button>
                  }
                  description={
                    list.isPageOutOfRange
                      ? `Hay ${formatInteger(
                          list.meta.total,
                        )} compras en total, pero esta página no tiene filas.`
                      : PURCHASE_COPY.emptyFilteredHelp
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : PURCHASE_COPY.emptyFiltered
                  }
                />
              )
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  busy={list.status === "refreshing"}
                  caption="Compras registradas con su proveedor, moneda, estado, montos y fecha de confirmación"
                  columns={columns}
                  getRowKey={(purchase) => String(purchase.id)}
                  getRowLabel={(purchase) => purchaseNumberLabel(purchase.number)}
                  renderCard={renderCard}
                  rowActions={renderActions}
                  rows={purchases}
                />
              </div>
            )}

            <PaginationControls
              meta={list.meta}
              onFirstPage={list.goToFirstPage}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
          </section>
        )}
    </div>
  );
}
