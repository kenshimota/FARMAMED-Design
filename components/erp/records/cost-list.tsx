"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { CurrencyChip, CurrencySelect } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { useServerList } from "@/components/erp/ui/use-server-list";
import { CostDeleteDialog } from "@/components/erp/records/cost-delete-dialog";
import {
  fetchCostPage,
  type CostCurrency,
  type CostRecord,
} from "@/components/erp/records/costs-api";
import { DateField, SelectField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
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
  fetchProduct,
  fetchProductPage,
  findById,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import {
  fetchItemStates,
  type ItemStateRecord,
} from "@/components/erp/records/item-states-api";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger, formatMoney } from "@/lib/format";

export type CostListFilters = {
  productId: string;
  itemStateId: string;
  currencyId: string;
};

const NO_ITEM_STATES: ItemStateRecord[] = [];

function productNameFor(product: ProductRecord | null, productId: CostRecord["product_id"]) {
  return product?.name ?? `Producto #${productId}`;
}

function productReferenceFor(product: ProductRecord | null) {
  return product?.reference ?? null;
}

export function CostListPage({ initialFilters }: { initialFilters: CostListFilters }) {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const canWrite = canWriteModule(user.role, "costos");

  const list = useServerList<CostRecord>({
    loader: (request) => fetchCostPage(request),
    filterKeys: ["product_id", "item_state_id", "currency_id", "from", "to"],
    initial: {
      filters: {
        product_id: initialFilters.productId,
        item_state_id: initialFilters.itemStateId,
        currency_id: initialFilters.currencyId,
      },
    },
  });
  const [deleteTarget, setDeleteTarget] = useState<CostRecord | null>(null);
  const itemStatesResource = useAsyncResource(fetchItemStates);

  const productId = list.filters.product_id ?? "";
  const itemStateId = list.filters.item_state_id ?? "";
  const currencyId = list.filters.currency_id ?? "";
  const fromDate = list.filters.from ?? "";
  const toDate = list.filters.to ?? "";
  const costs = list.items;
  const itemStates = itemStatesResource.data ?? NO_ITEM_STATES;
  const currencies = useMemo(
    () => currencyStatus?.currencies ?? [],
    [currencyStatus?.currencies],
  );

  const productIds = useMemo(
    () => [
      ...(productId ? [productId] : []),
      ...costs.map((cost) => String(cost.product_id)),
    ],
    [costs, productId],
  );
  const productsById = useRecordsById<ProductRecord>({
    ids: productIds,
    load: fetchProduct,
    getId: (product) => product.id,
  }).records;

  const productLabel = productId
    ? productsById[productId]
      ? `${productsById[productId].name} (${productsById[productId].reference})`
      : `Producto #${productId}`
    : "";
  const [productDraft, setProductDraft] = useState(productLabel);
  const [appliedProductLabel, setAppliedProductLabel] = useState(productLabel);
  if (productLabel !== appliedProductLabel) {
    setAppliedProductLabel(productLabel);
    setProductDraft(productLabel);
  }

  const filtersActive = Boolean(
    productId || itemStateId || currencyId || fromDate || toDate,
  );

  const itemStateOptions = useMemo(
    () =>
      itemStates.map((itemState) => ({
        value: String(itemState.id),
        label: itemState.label,
      })),
    [itemStates],
  );

  const chips: FilterChip[] = [];
  if (productId) {
    chips.push({
      id: "product_id",
      label: `Producto: ${productLabel || `#${productId}`}`,
      onRemove: () => list.setFilter("product_id", ""),
    });
  }
  if (itemStateId) {
    chips.push({
      id: "item_state_id",
      label: `Estado: ${
        itemStateOptions.find((option) => option.value === itemStateId)?.label ??
        `#${itemStateId}`
      }`,
      onRemove: () => list.setFilter("item_state_id", ""),
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
  if (fromDate) {
    chips.push({
      id: "from",
      label: `Desde: ${fromDate}`,
      onRemove: () => list.setFilter("from", ""),
    });
  }
  if (toDate) {
    chips.push({
      id: "to",
      label: `Hasta: ${toDate}`,
      onRemove: () => list.setFilter("to", ""),
    });
  }

  function productFor(productId: CostRecord["product_id"]) {
    return productsById[String(productId)] ?? null;
  }

  function itemStateLabelFor(cost: CostRecord) {
    if (cost.item_state?.label) return cost.item_state.label;
    return findById(itemStates, cost.item_state_id)?.label ?? `Estado #${cost.item_state_id}`;
  }

  function currencyFor(cost: CostRecord): CostCurrency | null {
    if (cost.currency) return cost.currency;
    if (cost.currency_id === null) return null;
    const currency = currencies.find(
      (item) => item.id !== null && String(item.id) === String(cost.currency_id),
    );
    if (!currency || currency.id === null) return null;
    return {
      id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    };
  }

  function currencyChipFor(cost: CostRecord) {
    const currency = currencyFor(cost);
    if (!currency) return null;
    return (
      currencies.find(
        (item) => item.id !== null && String(item.id) === String(currency.id),
      ) ?? currency
    );
  }

  const columns: RecordsTableColumn<CostRecord>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (cost) => {
        const product = productFor(cost.product_id);
        const reference = productReferenceFor(product);
        return (
          <div>
            <Link
              className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
              href={`/app/costos/producto/${cost.product_id}`}
            >
              {productNameFor(product, cost.product_id)}
            </Link>
            {reference && (
              <span className="mt-1 block font-mono text-[11px] text-muted">
                Ref. {reference}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "estado",
      header: "Estado del ítem",
      render: (cost) => (
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {itemStateLabelFor(cost)}
        </span>
      ),
    },
    {
      key: "costo",
      header: "Costo",
      className: "whitespace-nowrap",
      render: (cost) => {
        const currency = currencyFor(cost);
        return (
          <span className="font-semibold tabular-nums text-ink">
            {cost.cost === null
              ? "—"
              : formatMoney(cost.cost, {
                  code: currency?.code,
                  symbol: currency?.symbol,
                })}
          </span>
        );
      },
    },
    {
      key: "moneda",
      header: "Moneda",
      className: "whitespace-nowrap",
      render: (cost) => {
        const currency = currencyChipFor(cost);
        if (!currency) {
          return <span className="text-muted">Sin moneda</span>;
        }
        return <CurrencyChip currency={currency} />;
      },
    },
  ];

  function renderActions(cost: CostRecord) {
    const product = productFor(cost.product_id);
    const productName = productNameFor(product, cost.product_id);
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Por producto: ver los costos de ${productName}`}
          href={`/app/costos/producto/${cost.product_id}`}
          icon="arrow-right"
        >
          Por producto
        </RecordActionLink>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar el costo de ${productName} en estado ${itemStateLabelFor(cost)}`}
            href={`/app/costos/${cost.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar el costo de ${productName} en estado ${itemStateLabelFor(cost)}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(cost)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(cost: CostRecord) {
    const product = productFor(cost.product_id);
    const currency = currencyFor(cost);
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">
              {productNameFor(product, cost.product_id)}
            </p>
            {productReferenceFor(product) && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                Ref. {productReferenceFor(product)}
              </p>
            )}
          </div>
          <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
            {itemStateLabelFor(cost)}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Costo
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {cost.cost === null
                ? "—"
                : formatMoney(cost.cost, {
                    code: currency?.code,
                    symbol: currency?.symbol,
                  })}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1">
              {currency ? (
                <CurrencyChip currency={currencyChipFor(cost) ?? currency} />
              ) : (
                <span className="font-semibold text-ink">Sin moneda</span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const deleteProduct = deleteTarget ? productFor(deleteTarget.product_id) : null;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/costos/nuevo"
            >
              Nuevo costo
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta el costo vigente por producto y estado. La moneda forma parte del registro y no se convierte automáticamente."
        eyebrow="Inventario"
        title="Costos"
      />

      <CurrencyNoticeBanner />

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        id="costos-filtros"
        loading={list.status === "loading"}
        onClear={list.clearFilters}
        results={
          list.status === "loading"
            ? "Cargando costos…"
            : list.status === "error" && costs.length === 0
              ? "No se pudieron cargar los costos"
              : list.meta.total === 0
                ? "Sin costos"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="Busca el producto por nombre o referencia. El filtro se aplica en el servidor."
            id="filtro-costo-producto"
            label="Producto"
            loadOptions={async (query) => {
              const page = await fetchProductPage({ q: query, pageSize: 10 });
              return page.data.map((product) => ({
                value: String(product.id),
                label: `${product.name} (${product.reference})`,
              }));
            }}
            onSelect={(option) => {
              setProductDraft(option.label);
              list.setFilter("product_id", option.value);
            }}
            onValueChange={(value) => {
              setProductDraft(value);
              if (value !== productLabel) {
                list.setFilter("product_id", "");
              }
            }}
            placeholder="Buscar producto"
            value={productDraft}
          />
        }
      >
        <SelectField
          emptyLabel="No hay estados de ítem registrados."
          id="filtro-costo-estado"
          label="Estado del ítem"
          loading={itemStatesResource.status === "loading"}
          loadingLabel="Cargando estados…"
          loadError={
            itemStatesResource.status === "error"
              ? itemStatesResource.error?.message ??
                "No pudimos cargar los estados de ítem."
              : null
          }
          onChange={(value) => list.setFilter("item_state_id", value)}
          onRetry={itemStatesResource.reload}
          options={itemStateOptions}
          placeholder="Todos los estados"
          value={itemStateId}
        />
        <CurrencySelect
          allOptionLabel="Todas las monedas"
          filter
          help="Busca por código o nombre."
          id="filtro-costo-moneda"
          label="Moneda"
          onChange={(value) => list.setFilter("currency_id", value)}
          value={currencyId}
        />
        <DateField
          id="filtro-costo-desde"
          label="Desde"
          max={toDate || undefined}
          onChange={(value) => list.setFilter("from", value)}
          value={fromDate}
        />
        <DateField
          id="filtro-costo-hasta"
          label="Hasta"
          min={fromDate || undefined}
          onChange={(value) => list.setFilter("to", value)}
          value={toDate}
        />
      </FilterBar>

      {list.status === "loading" && (
        <RecordsTableSkeleton columns={5} label="Cargando costos…" rows={6} />
      )}

      {list.status === "error" && costs.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={list.error?.message ?? "No pudimos cargar los costos."}
          onRetry={list.reload}
          title="No pudimos cargar los costos"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && costs.length === 0) && (
          <section aria-label="Listado de costos" className="space-y-4">
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && costs.length > 0 && (
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
                {list.error?.message ??
                  "No pudimos actualizar los costos. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {costs.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={
                    canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/costos/nuevo"
                      >
                        Nuevo costo
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description="Se crean manualmente o al confirmar una compra."
                  title="Todavía no hay costos registrados."
                />
              ) : (
                <EmptyState
                  action={
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={
                        list.isPageOutOfRange
                          ? list.goToFirstPage
                          : list.clearFilters
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
                        )} costos en total, pero esta página no tiene filas.`
                      : "No hay resultados con estos filtros. Ajusta los criterios."
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : "Sin resultados con estos filtros."
                  }
                />
              )
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  busy={list.status === "refreshing"}
                  caption="Costos vigentes por producto y estado de ítem, con su moneda y acciones"
                  columns={columns}
                  getRowKey={(cost) => String(cost.id)}
                  getRowLabel={(cost) =>
                    `${productNameFor(productFor(cost.product_id), cost.product_id)} en estado ${itemStateLabelFor(cost)}`
                  }
                  renderCard={renderCard}
                  rowActions={renderActions}
                  rows={costs}
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

      <CostDeleteDialog
        cost={deleteTarget}
        itemStateLabel={deleteTarget ? itemStateLabelFor(deleteTarget) : ""}
        onClose={() => setDeleteTarget(null)}
        onDeleted={list.reload}
        productName={
          deleteTarget
            ? productNameFor(deleteProduct, deleteTarget.product_id)
            : ""
        }
      />
    </div>
  );
}
