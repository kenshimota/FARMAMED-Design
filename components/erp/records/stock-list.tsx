"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import {
  Tabs,
  getTabId,
  getTabPanelId,
} from "@/components/erp/ui/tabs";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { useServerList } from "@/components/erp/ui/use-server-list";
import { SelectField } from "@/components/erp/records/form-controls";
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
  fetchProduct,
  fetchProductPage,
  isPositiveRecordId,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import {
  fetchItemStates,
  type ItemStateRecord,
} from "@/components/erp/records/item-states-api";
import {
  fetchAvailableStocks,
  fetchStockPage,
  type AvailableStockRecord,
  type StockRecord,
} from "@/components/erp/records/stocks-api";
import {
  StockAvailabilityNotice,
  StockLocatedQuantity,
  StockNonSellableQuantity,
  StockQuantity,
  StockSyncNotice,
  stockCountLabel,
  stockItemStateLabel,
  stockNonSellableQuantity,
  stockProductName,
} from "@/components/erp/records/stock-shared";
import { formatInteger, formatMoney } from "@/lib/format";
import { canReadModule } from "@/lib/permissions";
import type { UiError } from "@/lib/api-errors";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";

export type StockListTab = "agregadas" | "disponibles";
export type StockInStockFilter = "" | "true" | "false";

export type StockListFilters = {
  productId: string;
  itemStateId: string;
  inStock: StockInStockFilter;
};

const TABS_ID = "existencias-vistas";
const AGGREGATED_PATH = "/app/existencias";
const AVAILABLE_PATH = "/app/existencias/disponibles";

const NO_ITEM_STATES: ItemStateRecord[] = [];
const NO_AVAILABLE_STOCKS: AvailableStockRecord[] = [];

function stockErrorMessage(error: UiError | null, fallback: string) {
  if (!error) return fallback;
  if (error.kind === "validation") {
    return "Los filtros ingresados no son válidos. Ajusta la selección e intenta de nuevo.";
  }
  return error.message;
}

function productOptionLabel(product: ProductRecord) {
  return `${product.name} (${product.reference})`;
}

type StockListPageProps = {
  initialFilters: StockListFilters;
  initialAvailableProductId: string;
};

export function StockListPage({
  initialFilters,
  initialAvailableProductId,
}: StockListPageProps) {
  const { user } = useSession();
  if (!canReadModule(user.role, "existencias")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de existencias. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }
  return (
    <StockListContent
      initialAvailableProductId={initialAvailableProductId}
      initialFilters={initialFilters}
    />
  );
}

function StockListContent({
  initialFilters,
  initialAvailableProductId,
}: StockListPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const normalizedPathname =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const activeTab: StockListTab =
    normalizedPathname === AVAILABLE_PATH ? "disponibles" : "agregadas";

  const [availableProductId, setAvailableProductId] = useState(
    initialAvailableProductId,
  );
  const lastAggregatedFilters = useRef<StockListFilters>({
    productId: initialFilters.productId,
    itemStateId: initialFilters.itemStateId,
    inStock: initialFilters.inStock,
  });
  const [productDraft, setProductDraft] = useState("");
  const [availableProductDraft, setAvailableProductDraft] = useState("");

  const [appliedInitialProductId, setAppliedInitialProductId] = useState(
    initialAvailableProductId,
  );
  if (initialAvailableProductId !== appliedInitialProductId) {
    setAppliedInitialProductId(initialAvailableProductId);
    setAvailableProductId(initialAvailableProductId);
  }

  const aggregatedActive = activeTab === "agregadas";
  const availableActive = activeTab === "disponibles";

  const list = useServerList<StockRecord>({
    loader: (request) => fetchStockPage(request),
    filterKeys: ["product_id", "item_state_id", "in_stock"],
    enabled: aggregatedActive,
    initial: {
      filters: {
        product_id: initialFilters.productId,
        item_state_id: initialFilters.itemStateId,
        in_stock: initialFilters.inStock,
      },
    },
  });
  const itemStatesResource = useAsyncResource(fetchItemStates, {
    enabled: aggregatedActive,
  });

  const productId = list.filters.product_id ?? "";
  const itemStateId = list.filters.item_state_id ?? "";
  const inStockValue = list.filters.in_stock ?? "";
  const inStock: StockInStockFilter =
    inStockValue === "true" || inStockValue === "false" ? inStockValue : "";
  const stocks = list.items;
  const itemStates = itemStatesResource.data ?? NO_ITEM_STATES;

  const productIds = useMemo(
    () => [
      ...(productId ? [productId] : []),
      ...(availableProductId ? [availableProductId] : []),
      ...stocks.map((stock) => String(stock.product_id)),
    ],
    [availableProductId, productId, stocks],
  );
  const productsById = useRecordsById<ProductRecord>({
    ids: productIds,
    load: fetchProduct,
    getId: (product) => product.id,
  }).records;

  const productLabel = productId
    ? productsById[productId]
      ? productOptionLabel(productsById[productId])
      : `Producto #${productId}`
    : "";
  const [appliedProductLabel, setAppliedProductLabel] = useState(productLabel);
  if (productLabel !== appliedProductLabel) {
    setAppliedProductLabel(productLabel);
    setProductDraft(productLabel);
  }

  const availableProductLabel = availableProductId
    ? productsById[availableProductId]
      ? productOptionLabel(productsById[availableProductId])
      : `Producto #${availableProductId}`
    : "";
  const [appliedAvailableProductLabel, setAppliedAvailableProductLabel] =
    useState(availableProductLabel);
  if (availableProductLabel !== appliedAvailableProductLabel) {
    setAppliedAvailableProductLabel(availableProductLabel);
    setAvailableProductDraft(availableProductLabel);
  }

  const itemStateOptions = useMemo(
    () =>
      itemStates.map((itemState) => ({
        value: String(itemState.id),
        label: itemState.label,
      })),
    [itemStates],
  );

  const availableProduct = productsById[availableProductId] ?? null;
  const availableProductValid = isPositiveRecordId(availableProductId);
  const availableProductName = stockProductName(
    availableProduct,
    availableProductId,
  );

  const filtersActive = Boolean(productId || itemStateId || inStock);
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
  if (inStock) {
    chips.push({
      id: "in_stock",
      label: inStock === "true" ? "Disponibilidad: con stock" : "Disponibilidad: sin stock",
      onRemove: () => list.setFilter("in_stock", ""),
    });
  }

  function replaceQuery(path: string, params: URLSearchParams) {
    const query = params.toString();
    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  }

  function aggregatedQuery(filters: StockListFilters) {
    const params = new URLSearchParams();
    if (filters.productId) params.set("product_id", filters.productId);
    if (filters.itemStateId) params.set("item_state_id", filters.itemStateId);
    if (filters.inStock) params.set("in_stock", filters.inStock);
    return params;
  }

  function availableQuery(productIdValue: string) {
    const params = new URLSearchParams();
    if (productIdValue) params.set("product_id", productIdValue);
    return params;
  }

  function selectAvailableProduct(value: string) {
    setAvailableProductId(value);
    replaceQuery(AVAILABLE_PATH, availableQuery(value));
  }

  function changeTab(tab: string) {
    const nextTab: StockListTab =
      tab === "disponibles" ? "disponibles" : "agregadas";
    if (nextTab === activeTab) return;

    if (nextTab === "disponibles") {
      lastAggregatedFilters.current = {
        productId,
        itemStateId,
        inStock,
      };
      const params = availableQuery(availableProductId);
      const query = params.toString();
      router.push(query ? `${AVAILABLE_PATH}?${query}` : AVAILABLE_PATH);
      return;
    }

    const params = aggregatedQuery(lastAggregatedFilters.current);
    const query = params.toString();
    router.push(query ? `${AGGREGATED_PATH}?${query}` : AGGREGATED_PATH);
  }

  const aggregatedTabId = getTabId(TABS_ID, "agregadas");
  const availableTabId = getTabId(TABS_ID, "disponibles");
  const aggregatedPanelId = getTabPanelId(TABS_ID, "agregadas");
  const availablePanelId = getTabPanelId(TABS_ID, "disponibles");

  const aggregatedColumns: RecordsTableColumn<StockRecord>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (stock) => {
        const product = productsById[String(stock.product_id)] ?? null;
        return (
          <div>
            <Link
              className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
              href={`/app/existencias/producto/${stock.product_id}`}
            >
              {stockProductName(product, stock.product_id)}
            </Link>
            {product?.reference && (
              <span className="mt-1 block font-mono text-[11px] text-muted">
                Ref. {product.reference}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "estado",
      header: "Estado del ítem",
      render: (stock) => (
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {stockItemStateLabel(stock, itemStates)}
        </span>
      ),
    },
    {
      key: "cantidad",
      header: "Existencia física",
      className: "whitespace-nowrap",
      render: (stock) => <StockQuantity quantity={stock.quantity} />,
    },
  ];

  function renderAggregatedActions(stock: StockRecord) {
    const product = productsById[String(stock.product_id)] ?? null;
    const productName = stockProductName(product, stock.product_id);
    const itemStateLabel = stockItemStateLabel(stock, itemStates);
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver el detalle de la existencia de ${productName} en estado ${itemStateLabel}`}
          href={`/app/existencias/${stock.id}`}
          icon="eye"
        >
          Ver detalle
        </RecordActionLink>
        <RecordActionLink
          ariaLabel={`Ver los lotes del producto ${productName}`}
          href={`/app/lotes?product_id=${stock.product_id}`}
          icon="layers"
        >
          Ver lotes
        </RecordActionLink>
      </RecordActions>
    );
  }

  function renderAggregatedCard(stock: StockRecord) {
    const product = productsById[String(stock.product_id)] ?? null;
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
              href={`/app/existencias/producto/${stock.product_id}`}
            >
              {stockProductName(product, stock.product_id)}
            </Link>
            {product?.reference && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                Ref. {product.reference}
              </p>
            )}
          </div>
          <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
            {stockItemStateLabel(stock, itemStates)}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Existencia física
            </dt>
            <dd className="mt-1">
              <StockQuantity quantity={stock.quantity} />
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
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/compras"
          >
            Ver compras confirmadas
            <Icon name="clipboard" size={16} />
          </Link>
        }
        description="Consulta la existencia física agregada y la disponibilidad vendible real por producto y estado de ítem. Solo los lotes ubicados, no vencidos y con estado de ítem vendible cuentan para la venta. Este módulo es de solo lectura."
        eyebrow="Inventario"
        title="Existencias"
      />

      <StockSyncNotice />

      <Tabs
        idPrefix={TABS_ID}
        label="Vistas de existencias"
        onChange={changeTab}
        tabs={[
          { id: "agregadas", label: "Agregadas" },
          { id: "disponibles", label: "Disponibles" },
        ]}
        value={activeTab}
      />

      <section
        aria-labelledby={aggregatedTabId}
        className="space-y-4"
        hidden={!aggregatedActive}
        id={aggregatedPanelId}
        role="tabpanel"
        tabIndex={0}
      >
        <h2 className="sr-only">Existencias agregadas</h2>

        <FilterBar
          activeCount={chips.length}
          chips={chips}
          id="existencias-filtros"
          loading={list.status === "loading"}
          onClear={list.clearFilters}
          results={
            list.status === "loading"
              ? "Cargando existencias…"
              : list.status === "error" && stocks.length === 0
                ? "No se pudieron cargar las existencias"
                : list.meta.total === 0
                  ? "Sin existencias"
                  : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                      list.range.to,
                    )} de ${formatInteger(list.meta.total)}`
          }
          search={
            <AutocompleteField
              help="Busca el producto por nombre o referencia. El filtro se aplica en el servidor."
              id="filtro-existencias-producto"
              label="Producto"
              loadOptions={async (query) => {
                const page = await fetchProductPage({ q: query, pageSize: 10 });
                return page.data.map((product) => ({
                  value: String(product.id),
                  label: productOptionLabel(product),
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
            id="filtro-existencias-estado"
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
          <SelectField
            id="filtro-existencias-disponibilidad"
            label="Disponibilidad"
            onChange={(value) => list.setFilter("in_stock", value)}
            options={[
              { value: "true", label: "Solo con stock" },
              { value: "false", label: "Solo sin stock" },
            ]}
            placeholder="Todas las existencias"
            value={inStock}
          />
        </FilterBar>

        {list.status === "loading" && (
          <RecordsTableSkeleton
            columns={4}
            label="Cargando existencias…"
            rows={6}
          />
        )}

        {list.status === "error" && stocks.length === 0 && (
          <RecordsLoadError
            backHref="/app"
            backLabel="Volver al inicio"
            description={stockErrorMessage(
              list.error,
              "No pudimos cargar las existencias.",
            )}
            onRetry={list.error?.canRetry ? list.reload : undefined}
            title="No pudimos cargar las existencias"
          />
        )}

        {list.status !== "loading" &&
          !(list.status === "error" && stocks.length === 0) && (
            <section aria-label="Listado de existencias agregadas" className="space-y-4">
              {list.status === "refreshing" && (
                <div aria-hidden="true" className="reload-bar" />
              )}

              {list.status === "error" && stocks.length > 0 && (
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
                  {stockErrorMessage(
                    list.error,
                    "No pudimos actualizar las existencias. Mostramos los datos disponibles.",
                  )}
                </NoticeBanner>
              )}

              {stocks.length === 0 ? (
                list.meta.total === 0 && !filtersActive ? (
                  <EmptyState
                    action={
                      <Link
                        className="button-base button-secondary min-h-11 px-5"
                        href="/app/compras"
                      >
                        Ver compras
                        <Icon name="clipboard" size={16} />
                      </Link>
                    }
                    description="Se crean al confirmar una compra."
                    title="Todavía no hay existencias registradas."
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
                          )} existencias en total, pero esta página no tiene filas.`
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
                    caption="Existencias físicas agregadas por producto y estado de ítem, con enlace a lotes y a la disponibilidad vendible"
                    columns={aggregatedColumns}
                    getRowKey={(stock) => String(stock.id)}
                    getRowLabel={(stock) =>
                      `${stockProductName(productsById[String(stock.product_id)] ?? null, stock.product_id)} en estado ${stockItemStateLabel(stock, itemStates)}`
                    }
                    renderCard={renderAggregatedCard}
                    rowActions={renderAggregatedActions}
                    rows={stocks}
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

        <p className="text-[12px] leading-6 text-muted">
          El detalle de compras confirmadas estará disponible cuando se habilite
          el módulo de compras.{" "}
          <Link
            className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href="/app/compras"
          >
            Ver compras confirmadas
          </Link>
        </p>
      </section>

      <section
        aria-labelledby={availableTabId}
        className="space-y-4"
        hidden={!availableActive}
        id={availablePanelId}
        role="tabpanel"
        tabIndex={0}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">
              Disponibilidad vendible
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              Consulta la existencia física y la cantidad realmente vendible
              por estado de ítem.
            </p>
          </div>
          <span className="inline-flex rounded-full border border-ink/15 bg-background px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Solo lectura
          </span>
        </div>

        <StockAvailabilityNotice />

        <section
          aria-label="Selector de producto para disponibilidad"
          className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
        >
          <div className="max-w-xl">
            <AutocompleteField
              help="Busca el producto por nombre o referencia. La disponibilidad se consulta por producto."
              id="producto-disponible"
              label="Producto"
              loadOptions={async (query) => {
                const page = await fetchProductPage({ q: query, pageSize: 10 });
                return page.data.map((product) => ({
                  value: String(product.id),
                  label: productOptionLabel(product),
                }));
              }}
              onSelect={(option) => {
                setAvailableProductDraft(option.label);
                selectAvailableProduct(option.value);
              }}
              onValueChange={(value) => {
                setAvailableProductDraft(value);
                if (value !== availableProductLabel) {
                  selectAvailableProduct("");
                }
              }}
              placeholder="Buscar producto"
              value={availableProductDraft}
            />
          </div>
          <p aria-live="polite" className="mt-4 text-[12px] text-muted">
            {availableProductValid
              ? `Consultando la existencia física y la disponibilidad vendible de ${availableProductName}.`
              : "Elige un producto para consultar su existencia física, su disponibilidad vendible y su costo vigente."}
          </p>
        </section>

        {availableActive &&
          (!availableProductValid ? (
            <EmptyState
              description="Elige un producto para consultar su existencia física y la cantidad disponible para la venta."
              title="Selecciona un producto"
            />
          ) : (
            <AvailableStocksPanel
              key={availableProductId}
              productId={availableProductId}
              productName={availableProductName}
            />
          ))}
      </section>
    </div>
  );
}

function AvailableStocksPanel({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const loader = useCallback(
    () => fetchAvailableStocks(productId),
    [productId],
  );
  const resource = useAsyncResource(loader);
  const currencyStatus = useCurrencyStatusContext();
  const stocks = resource.data ?? NO_AVAILABLE_STOCKS;
  const missingAvailabilityCount = stocks.filter(
    (stock) => stock.quantity > 0 && stock.locatedQuantity <= 0,
  ).length;
  const hasPartialDifference = stocks.some(
    (stock) => stockNonSellableQuantity(stock) > 0,
  );

  const countLabel = resource.data
    ? stockCountLabel(stocks.length)
    : resource.status === "error"
      ? "No se pudo cargar la disponibilidad"
      : "Cargando disponibilidad…";

  function currencyChipFor(stock: AvailableStockRecord) {
    if (!stock.currency) return null;
    return (
      (currencyStatus?.currencies ?? []).find(
        (item) =>
          item.id !== null &&
          (String(item.id) === String(stock.currency?.id) ||
            item.code === stock.currency?.code),
      ) ?? stock.currency
    );
  }

  const columns: RecordsTableColumn<AvailableStockRecord>[] = [
    {
      key: "producto",
      header: "Producto",
      render: () => (
        <span className="font-semibold text-ink">{productName}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado del ítem",
      render: (stock) => (
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {stockItemStateLabel(stock)}
        </span>
      ),
    },
    {
      key: "existencia-fisica",
      header: "Existencia física",
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
      render: (stock) => <StockQuantity quantity={stock.quantity} />,
    },
    {
      key: "disponible-vendible",
      header: "Disponible vendible",
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
      render: (stock) => (
        <StockLocatedQuantity
          locatedQuantity={stock.locatedQuantity}
          physicalQuantity={stock.quantity}
        />
      ),
    },
    {
      key: "no-vendible",
      header: "No vendible",
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
      render: (stock) => (
        <StockNonSellableQuantity
          quantity={stockNonSellableQuantity(stock)}
        />
      ),
    },
    {
      key: "costo",
      header: "Costo",
      className: "whitespace-nowrap",
      render: (stock) =>
        stock.cost === null ? (
          <Link
            className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href={`/app/costos/producto/${stock.product_id}`}
          >
            Sin costo registrado
          </Link>
        ) : (
          <span className="font-semibold tabular-nums text-ink">
            {formatMoney(stock.cost, {
              code: stock.currency?.code,
              symbol: stock.currency?.symbol,
            })}
          </span>
        ),
    },
    {
      key: "moneda",
      header: "Moneda",
      className: "whitespace-nowrap",
      render: (stock) =>
        stock.currency ? (
          <CurrencyChip currency={currencyChipFor(stock)} />
        ) : (
          <span className="text-muted">Sin moneda registrada</span>
        ),
    },
  ];

  function renderActions(stock: AvailableStockRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver los lotes del producto ${productName}`}
          href={`/app/lotes?product_id=${stock.product_id}`}
          icon="layers"
        >
          Ver lotes
        </RecordActionLink>
      </RecordActions>
    );
  }

  function renderCard(stock: AvailableStockRecord) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="text-[15px] font-semibold text-ink">{productName}</span>
          <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
            {stockItemStateLabel(stock)}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Existencia física
            </dt>
            <dd className="mt-1">
              <StockQuantity quantity={stock.quantity} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Disponible vendible
            </dt>
            <dd className="mt-1">
              <StockLocatedQuantity
                locatedQuantity={stock.locatedQuantity}
                physicalQuantity={stock.quantity}
              />
            </dd>
          </div>
          {stockNonSellableQuantity(stock) > 0 && (
            <div className="col-span-2 rounded-xl border border-alert/20 bg-alert/[0.04] px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                No vendible
              </dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-2">
                <StockNonSellableQuantity
                  quantity={stockNonSellableQuantity(stock)}
                />
                <span className="text-[11px] leading-5 text-muted">
                  Parte de la existencia no está disponible para la venta.
                </span>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Costo
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {stock.cost === null ? (
                <Link
                  className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  href={`/app/costos/producto/${stock.product_id}`}
                >
                  Sin costo registrado
                </Link>
              ) : (
                formatMoney(stock.cost, {
                  code: stock.currency?.code,
                  symbol: stock.currency?.symbol,
                })
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1">
              {stock.currency ? (
                <CurrencyChip currency={currencyChipFor(stock)} />
              ) : (
                <span className="font-semibold text-ink">
                  Sin moneda registrada
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <section
      aria-label={`Disponibilidad vendible de ${productName}`}
      className="space-y-4"
    >
      {resource.status === "loading" && (
        <RecordsTableSkeleton
          columns={7}
          label="Cargando disponibilidad…"
          rows={5}
        />
      )}

      {resource.status === "error" && stocks.length === 0 && (
        <RecordsLoadError
          backHref="/app/existencias"
          backLabel="Volver a existencias"
          description={stockErrorMessage(
            resource.error,
            "No pudimos cargar la disponibilidad vendible.",
          )}
          onRetry={resource.error?.canRetry ? resource.reload : undefined}
          title="No pudimos cargar la disponibilidad"
        />
      )}

      {resource.status !== "loading" &&
        !(resource.status === "error" && stocks.length === 0) && (
          <>
            {resource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {resource.status === "error" && stocks.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={resource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {stockErrorMessage(
                  resource.error,
                  "No pudimos actualizar la disponibilidad vendible. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {missingAvailabilityCount > 0 && (
              <NoticeBanner title="Sin disponibilidad vendible" tone="warning">
                Hay existencia física, pero no disponibilidad vendible
                {missingAvailabilityCount === 1
                  ? " en un estado de ítem."
                  : ` en ${formatInteger(missingAvailabilityCount)} estados de ítem.`}{" "}
                Revisa los lotes pendientes, en ubicación o vencidos.
              </NoticeBanner>
            )}

            {stocks.length === 0 ? (
              <EmptyState
                action={
                  <Link
                    className="button-base button-secondary min-h-11 px-5"
                    href={`/app/lotes?product_id=${productId}`}
                  >
                    Ver lotes del producto
                    <Icon name="layers" size={16} />
                  </Link>
                }
                description="No hay estados de ítem vendibles con existencia registrada para este producto. La existencia puede estar en lotes pendientes, en ubicación o vencidos; revísalos o elige otro producto."
                title="No hay existencias vendibles para este producto."
              />
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                  <div>
                    <p className="text-[14px] font-semibold text-ink">{productName}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Disponibilidad vendible
                    </p>
                  </div>
                  <p aria-live="polite" className="text-[12px] font-semibold text-muted">
                    {countLabel}
                  </p>
                </div>
                <RecordsTable
                  caption={`Disponibilidad vendible de ${productName} por estado de ítem: existencia física, disponible vendible, no vendible, costo y moneda. Solo los lotes ubicados, no vencidos y con estado de ítem vendible cuentan para la venta.`}
                  columns={columns}
                  getRowKey={(stock) =>
                    `${stock.product_id}-${stock.item_state_id}`
                  }
                  getRowLabel={(stock) =>
                    `${productName} en estado ${stockItemStateLabel(stock)}`
                  }
                  renderCard={renderCard}
                  rowActions={renderActions}
                  rows={stocks}
                />
              </div>
            )}

            <p className="text-[12px] leading-6 text-muted">
              {hasPartialDifference
                ? "Parte de la existencia no está disponible para la venta. "
                : ""}
              La existencia física incluye lotes pendientes, en ubicación o
              vencidos. Solo los lotes ubicados, no vencidos y con estado de ítem
              vendible cuentan para la disponibilidad vendible. La cantidad
              reservada vive en los lotes.{" "}
              <Link
                className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href={`/app/lotes?product_id=${productId}`}
              >
                Consultar lotes
              </Link>
            </p>
          </>
        )}
    </section>
  );
}
