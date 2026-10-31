"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  PURCHASE_COPY,
} from "@/components/erp/records/purchase-errors";
import {
  fetchPurchases,
  type PurchaseCurrency,
  type PurchaseRecord,
  type PurchaseStatus,
} from "@/components/erp/records/purchases-api";
import {
  PurchaseStatusBadge,
  purchaseCountLabel,
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
import { findById } from "@/components/erp/records/records-api";
import {
  fetchSuppliers,
  type SupplierRecord,
} from "@/components/erp/records/suppliers-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import type { UiError } from "@/lib/api-errors";

export type PurchaseListFilters = {
  supplierId: string;
  status: string;
  number: string;
  currencyId: string;
};

const EMPTY_FILTERS: PurchaseListFilters = {
  supplierId: "",
  status: "",
  number: "",
  currencyId: "",
};

const NO_PURCHASES: PurchaseRecord[] = [];
const NO_SUPPLIERS: SupplierRecord[] = [];

function isPurchaseStatus(value: string): value is PurchaseStatus {
  return (PURCHASE_STATUS_OPTIONS as readonly { value: string }[]).some(
    (option) => option.value === value,
  );
}

function filtersKey(filters: PurchaseListFilters) {
  return [filters.supplierId, filters.status, filters.number, filters.currencyId].join(
    "|",
  );
}

function hasActiveFilters(filters: PurchaseListFilters) {
  return Boolean(
    filters.supplierId || filters.status || filters.number.trim() || filters.currencyId,
  );
}

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
  const router = useRouter();
  const pathname = usePathname();
  const currencyStatus = useCurrencyStatusContext();
  const activityVisible = useActivityVisible();
  const canWrite = canWriteModule(user.role, "compras");

  const [filters, setFilters] = useState<PurchaseListFilters>(initialFilters);
  const [numberDraft, setNumberDraft] = useState(initialFilters.number);
  const filtersRef = useRef(filters);
  const numberTimer = useRef<number | null>(null);

  const initialFiltersKey = filtersKey(initialFilters);
  const [appliedInitialFiltersKey, setAppliedInitialFiltersKey] =
    useState(initialFiltersKey);
  if (initialFiltersKey !== appliedInitialFiltersKey) {
    setAppliedInitialFiltersKey(initialFiltersKey);
    setFilters(initialFilters);
    if (numberDraft === filters.number) setNumberDraft(initialFilters.number);
  }

  const suppliersResource = useAsyncResource(fetchSuppliers);
  const suppliers = suppliersResource.data ?? NO_SUPPLIERS;

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
  const currencyLoading =
    currencyStatus?.status === "loading" || currencyStatus?.status === "idle";
  const currencyError =
    currencyStatus?.status === "error"
      ? currencyStatus.errorMessage ?? "No pudimos cargar las monedas."
      : null;

  const purchasesLoader = useCallback(
    () =>
      fetchPurchases({
        supplier_id: filters.supplierId || undefined,
        status:
          filters.status && isPurchaseStatus(filters.status)
            ? filters.status
            : undefined,
        number: filters.number.trim() || undefined,
        currency_id: filters.currencyId || undefined,
      }),
    [filters.currencyId, filters.number, filters.status, filters.supplierId],
  );
  const purchasesResource = useAsyncResource(purchasesLoader);
  const reloadPurchases = purchasesResource.reload;
  const purchases = useMemo(() => {
    const list = purchasesResource.data ?? NO_PURCHASES;
    return [...list].sort((first, second) => second.number - first.number);
  }, [purchasesResource.data]);

  const activeFilterKey = filtersKey(filters);
  const appliedFilterKey = useRef(activeFilterKey);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (appliedFilterKey.current === activeFilterKey) return;
    appliedFilterKey.current = activeFilterKey;
    reloadPurchases();
  }, [activeFilterKey, reloadPurchases]);

  useEffect(() => {
    return () => {
      if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    };
  }, []);

  const filtersActive = hasActiveFilters(filters);
  const countLabel = purchasesResource.data
    ? purchaseCountLabel(purchases.length)
    : purchasesResource.status === "error"
      ? "No se pudieron cargar las compras"
      : "Cargando compras…";

  const supplierOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        value: String(supplier.id),
        label: supplier.name,
      })),
    [suppliers],
  );

  const currencyOptions = useMemo(
    () =>
      currencies.map((currency) => ({
        value: String(currency.id),
        label: `${currency.code} — ${currency.name}`,
      })),
    [currencies],
  );

  if (!activityVisible) return null;

  function supplierFor(purchase: PurchaseRecord) {
    return purchase.supplier ?? findById(suppliers, purchase.supplier_id);
  }

  function supplierNameFor(purchase: PurchaseRecord) {
    const supplier = supplierFor(purchase);
    return supplier?.name ?? `Proveedor #${purchase.supplier_id}`;
  }

  function currencyFor(purchase: PurchaseRecord) {
    return resolvePurchaseCurrency(purchase.currency, currencies, purchase.currency_id);
  }

  function commitFilters(next: PurchaseListFilters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.supplierId) params.set("supplier_id", next.supplierId);
    if (next.status) params.set("status", next.status);
    if (next.number.trim()) params.set("number", next.number.trim());
    if (next.currencyId) params.set("currency_id", next.currencyId);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateFilter(key: keyof PurchaseListFilters, value: string) {
    commitFilters({ ...filters, [key]: value });
  }

  function handleNumberChange(value: string) {
    setNumberDraft(value);
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    numberTimer.current = window.setTimeout(() => {
      commitFilters({ ...filtersRef.current, number: value.trim() });
    }, 450);
  }

  function clearFilters() {
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    setNumberDraft("");
    commitFilters(EMPTY_FILTERS);
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
      render: (purchase) => {
        const currency = currencyFor(purchase);
        return (
          <span className="font-semibold text-ink">{currency.code}</span>
        );
      },
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
            <dd className="mt-1 font-semibold text-ink">{currency.code}</dd>
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

      <section
        aria-label="Filtros de compras"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            emptyLabel="No hay proveedores registrados."
            id="filtro-compra-proveedor"
            label="Proveedor"
            loading={suppliersResource.status === "loading"}
            loadingLabel="Cargando proveedores…"
            loadError={
              suppliersResource.status === "error"
                ? suppliersResource.error?.message ??
                  "No pudimos cargar los proveedores."
                : null
            }
            onChange={(value) => updateFilter("supplierId", value)}
            onRetry={suppliersResource.reload}
            options={supplierOptions}
            placeholder="Todos los proveedores"
            value={filters.supplierId}
          />
          <SelectField
            id="filtro-compra-estado"
            label="Estado"
            onChange={(value) => updateFilter("status", value)}
            options={PURCHASE_STATUS_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            placeholder="Todos los estados"
            value={filters.status}
          />
          <TextField
            help="Filtra por número de compra. Se aplica automáticamente al escribir."
            id="filtro-compra-numero"
            label="Número"
            onChange={handleNumberChange}
            placeholder="Ej. 12"
            value={numberDraft}
          />
          <SelectField
            emptyLabel="No hay monedas activas registradas."
            id="filtro-compra-moneda"
            label="Moneda"
            loading={currencyLoading}
            loadingLabel="Cargando monedas…"
            loadError={currencyError}
            onChange={(value) => updateFilter("currencyId", value)}
            onRetry={currencyStatus?.reload}
            options={currencyOptions}
            placeholder="Todas las monedas"
            value={filters.currencyId}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p aria-live="polite" className="text-[12px] font-semibold text-muted">
            {countLabel}
          </p>
          {filtersActive && (
            <button
              className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              onClick={clearFilters}
              type="button"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {purchasesResource.status === "loading" && (
        <RecordsTableSkeleton columns={8} label="Cargando compras…" rows={6} />
      )}

      {purchasesResource.status === "error" && purchases.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={purchaseErrorMessage(
            purchasesResource.error,
            "No pudimos cargar las compras.",
          )}
          onRetry={reloadPurchases}
          title="No pudimos cargar las compras"
        />
      )}

      {purchasesResource.status !== "loading" &&
        !(purchasesResource.status === "error" && purchases.length === 0) && (
          <section aria-label="Listado de compras" className="space-y-4">
            {purchasesResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {purchasesResource.status === "error" && purchases.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={reloadPurchases}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {purchaseErrorMessage(
                  purchasesResource.error,
                  "No pudimos actualizar las compras. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {purchases.length === 0 ? (
              <EmptyState
                action={
                  filtersActive ? (
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={clearFilters}
                      type="button"
                    >
                      Limpiar filtros
                    </button>
                  ) : canWrite ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href="/app/compras/nueva"
                    >
                      Nueva compra
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description={
                  filtersActive
                    ? PURCHASE_COPY.emptyFilteredHelp
                    : "Se crean como borrador y se confirman cuando los productos llegan a la droguería."
                }
                title={
                  filtersActive ? PURCHASE_COPY.emptyFiltered : PURCHASE_COPY.empty
                }
              />
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
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
          </section>
        )}
    </div>
  );
}
