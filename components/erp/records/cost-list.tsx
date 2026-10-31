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
import { useSession } from "@/components/erp/session-context";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { CurrencyChip, CurrencySelect } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { CostDeleteDialog } from "@/components/erp/records/cost-delete-dialog";
import {
  fetchCosts,
  type CostCurrency,
  type CostRecord,
} from "@/components/erp/records/costs-api";
import { SelectField } from "@/components/erp/records/form-controls";
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
  fetchProducts,
  findById,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import {
  fetchItemStates,
  type ItemStateRecord,
} from "@/components/erp/records/item-states-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger, formatMoney } from "@/lib/format";

export type CostListFilters = {
  productId: string;
  itemStateId: string;
  currencyId: string;
};

const EMPTY_FILTERS: CostListFilters = {
  productId: "",
  itemStateId: "",
  currencyId: "",
};

const NO_COSTS: CostRecord[] = [];
const NO_PRODUCTS: ProductRecord[] = [];
const NO_ITEM_STATES: ItemStateRecord[] = [];

function filtersKey(filters: CostListFilters) {
  return `${filters.productId}|${filters.itemStateId}|${filters.currencyId}`;
}

function hasActiveFilters(filters: CostListFilters) {
  return Boolean(filters.productId || filters.itemStateId || filters.currencyId);
}

function costCountLabel(count: number) {
  return count === 1 ? "1 costo" : `${formatInteger(count)} costos`;
}

function productNameFor(product: ProductRecord | null, productId: CostRecord["product_id"]) {
  return product?.name ?? `Producto #${productId}`;
}

function productReferenceFor(product: ProductRecord | null) {
  return product?.reference ?? null;
}

export function CostListPage({ initialFilters }: { initialFilters: CostListFilters }) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const currencyStatus = useCurrencyStatusContext();
  const canWrite = canWriteModule(user.role, "costos");

  const [filters, setFilters] = useState<CostListFilters>(initialFilters);
  const [deleteTarget, setDeleteTarget] = useState<CostRecord | null>(null);

  const productsResource = useAsyncResource(fetchProducts);
  const itemStatesResource = useAsyncResource(fetchItemStates);

  const products = productsResource.data ?? NO_PRODUCTS;
  const itemStates = itemStatesResource.data ?? NO_ITEM_STATES;
  const currencies = useMemo(
    () => currencyStatus?.currencies ?? [],
    [currencyStatus?.currencies],
  );

  const costLoader = useCallback(
    () =>
      fetchCosts({
        product_id: filters.productId || undefined,
        item_state_id: filters.itemStateId || undefined,
        currency_id: filters.currencyId || undefined,
      }),
    [filters.currencyId, filters.itemStateId, filters.productId],
  );
  const costsResource = useAsyncResource(costLoader);
  const reloadCosts = costsResource.reload;
  const costs = costsResource.data ?? NO_COSTS;

  const activeFilterKey = filtersKey(filters);
  const appliedFilterKey = useRef(activeFilterKey);

  useEffect(() => {
    if (appliedFilterKey.current === activeFilterKey) return;
    appliedFilterKey.current = activeFilterKey;
    reloadCosts();
  }, [activeFilterKey, reloadCosts]);

  const filtersActive = hasActiveFilters(filters);
  const countLabel = costsResource.data
    ? costCountLabel(costs.length)
    : costsResource.status === "error"
      ? "No se pudieron cargar los costos"
      : "Cargando costos…";

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: String(product.id),
        label: `${product.name} (${product.reference})`,
      })),
    [products],
  );

  const itemStateOptions = useMemo(
    () =>
      itemStates.map((itemState) => ({
        value: String(itemState.id),
        label: itemState.label,
      })),
    [itemStates],
  );

  function productFor(productId: CostRecord["product_id"]) {
    return findById(products, productId);
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

  function updateFilter(key: keyof CostListFilters, value: string) {
    const next = { ...filters, [key]: value };
    setFilters(next);

    const params = new URLSearchParams();
    if (next.productId) params.set("product_id", next.productId);
    if (next.itemStateId) params.set("item_state_id", next.itemStateId);
    if (next.currencyId) params.set("currency_id", next.currencyId);
    const query = params.toString();

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    router.replace(pathname, { scroll: false });
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

      <section
        aria-label="Filtros de costos"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField
            emptyLabel="No hay productos registrados."
            id="filtro-costo-producto"
            label="Producto"
            loading={productsResource.status === "loading"}
            loadingLabel="Cargando productos…"
            loadError={
              productsResource.status === "error"
                ? productsResource.error?.message ??
                  "No pudimos cargar los productos."
                : null
            }
            onChange={(value) => updateFilter("productId", value)}
            onRetry={productsResource.reload}
            options={productOptions}
            placeholder="Todos los productos"
            value={filters.productId}
          />
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
            onChange={(value) => updateFilter("itemStateId", value)}
            onRetry={itemStatesResource.reload}
            options={itemStateOptions}
            placeholder="Todos los estados"
            value={filters.itemStateId}
          />
          <CurrencySelect
            allOptionLabel="Todas las monedas"
            filter
            help="Busca por código o nombre."
            id="filtro-costo-moneda"
            label="Moneda"
            onChange={(value) => updateFilter("currencyId", value)}
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

      {costsResource.status === "loading" && (
        <RecordsTableSkeleton columns={5} label="Cargando costos…" rows={6} />
      )}

      {costsResource.status === "error" && costs.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={
            costsResource.error?.message ?? "No pudimos cargar los costos."
          }
          onRetry={reloadCosts}
          title="No pudimos cargar los costos"
        />
      )}

      {costsResource.status !== "loading" &&
        !(costsResource.status === "error" && costs.length === 0) && (
          <section aria-label="Listado de costos" className="space-y-4">
            {costsResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {costsResource.status === "error" && costs.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={reloadCosts}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {costsResource.error?.message ??
                  "No pudimos actualizar los costos. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {costs.length === 0 ? (
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
                      href="/app/costos/nuevo"
                    >
                      Nuevo costo
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description={
                  filtersActive
                    ? "Ajusta los filtros para ver otros resultados."
                    : "Se crean manualmente o al confirmar una compra."
                }
                title={
                  filtersActive
                    ? "No hay costos que coincidan con los filtros."
                    : "Todavía no hay costos registrados."
                }
              />
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
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
          </section>
        )}

      <CostDeleteDialog
        cost={deleteTarget}
        itemStateLabel={deleteTarget ? itemStateLabelFor(deleteTarget) : ""}
        onClose={() => setDeleteTarget(null)}
        onDeleted={reloadCosts}
        productName={
          deleteTarget
            ? productNameFor(deleteProduct, deleteTarget.product_id)
            : ""
        }
      />
    </div>
  );
}
