"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  Tabs,
  getTabId,
  getTabPanelId,
} from "@/components/erp/ui/tabs";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
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
  fetchProducts,
  findById,
  isPositiveRecordId,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import {
  fetchItemStates,
  type ItemStateRecord,
} from "@/components/erp/records/item-states-api";
import {
  fetchAvailableStocks,
  fetchStocks,
  type AvailableStockRecord,
  type StockRecord,
} from "@/components/erp/records/stocks-api";
import {
  StockQuantity,
  StockSyncNotice,
  stockCountLabel,
  stockItemStateLabel,
  stockProductName,
} from "@/components/erp/records/stock-shared";
import { formatMoney } from "@/lib/format";
import { canReadModule } from "@/lib/permissions";
import type { UiError } from "@/lib/api-errors";

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

const EMPTY_FILTERS: StockListFilters = {
  productId: "",
  itemStateId: "",
  inStock: "",
};

const NO_PRODUCTS: ProductRecord[] = [];
const NO_ITEM_STATES: ItemStateRecord[] = [];
const NO_STOCKS: StockRecord[] = [];
const NO_AVAILABLE_STOCKS: AvailableStockRecord[] = [];

function filtersKey(filters: StockListFilters) {
  return `${filters.productId}|${filters.itemStateId}|${filters.inStock}`;
}

function hasActiveFilters(filters: StockListFilters) {
  return Boolean(filters.productId || filters.itemStateId || filters.inStock);
}

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

  const [filters, setFilters] = useState<StockListFilters>(initialFilters);
  const [availableProductId, setAvailableProductId] = useState(
    initialAvailableProductId,
  );
  const [productQuery, setProductQuery] = useState("");

  const initialFiltersKey = filtersKey(initialFilters);
  const [appliedInitialFiltersKey, setAppliedInitialFiltersKey] =
    useState(initialFiltersKey);
  if (initialFiltersKey !== appliedInitialFiltersKey) {
    setAppliedInitialFiltersKey(initialFiltersKey);
    setFilters({
      productId: initialFilters.productId,
      itemStateId: initialFilters.itemStateId,
      inStock: initialFilters.inStock,
    });
  }

  const [appliedInitialProductId, setAppliedInitialProductId] = useState(
    initialAvailableProductId,
  );
  if (initialAvailableProductId !== appliedInitialProductId) {
    setAppliedInitialProductId(initialAvailableProductId);
    setAvailableProductId(initialAvailableProductId);
  }

  const aggregatedActive = activeTab === "agregadas";
  const availableActive = activeTab === "disponibles";

  const productsResource = useAsyncResource(fetchProducts);
  const itemStatesResource = useAsyncResource(fetchItemStates, {
    enabled: aggregatedActive,
  });

  const products = productsResource.data ?? NO_PRODUCTS;
  const itemStates = itemStatesResource.data ?? NO_ITEM_STATES;

  const stocksLoader = useCallback(
    () =>
      fetchStocks({
        product_id: filters.productId || undefined,
        item_state_id: filters.itemStateId || undefined,
        in_stock:
          filters.inStock === "" ? undefined : filters.inStock === "true",
      }),
    [filters.inStock, filters.itemStateId, filters.productId],
  );
  const stocksResource = useAsyncResource(stocksLoader, {
    enabled: aggregatedActive,
  });
  const reloadStocks = stocksResource.reload;
  const stocks = stocksResource.data ?? NO_STOCKS;

  const activeFilterKey = filtersKey(filters);
  const appliedFilterKey = useRef(activeFilterKey);

  useEffect(() => {
    if (!aggregatedActive) return;
    if (appliedFilterKey.current === activeFilterKey) return;
    appliedFilterKey.current = activeFilterKey;
    reloadStocks();
  }, [activeFilterKey, aggregatedActive, reloadStocks]);

  const filtersActive = hasActiveFilters(filters);
  const countLabel = stocksResource.data
    ? stockCountLabel(stocks.length)
    : stocksResource.status === "error"
      ? "No se pudieron cargar las existencias"
      : "Cargando existencias…";

  const aggregatedProductOptions = useMemo(
    () =>
      products.map((product) => ({
        value: String(product.id),
        label: productOptionLabel(product),
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

  const availableProduct = findById(products, availableProductId);
  const availableProductValid = isPositiveRecordId(availableProductId);
  const availableProductName = stockProductName(
    availableProduct,
    availableProductId,
  );

  const availableProductOptions = useMemo(() => {
    const normalized = productQuery.trim().toLowerCase();
    const filtered = normalized
      ? products.filter((product) =>
          `${product.name} ${product.reference}`
            .toLowerCase()
            .includes(normalized),
        )
      : products;
    const options = filtered.map((product) => ({
      value: String(product.id),
      label: productOptionLabel(product),
    }));

    if (
      availableProduct &&
      !options.some((option) => option.value === String(availableProduct.id))
    ) {
      options.unshift({
        value: String(availableProduct.id),
        label: productOptionLabel(availableProduct),
      });
    }

    return options;
  }, [availableProduct, productQuery, products]);

  function replaceQuery(path: string, params: URLSearchParams) {
    const query = params.toString();
    router.replace(query ? `${path}?${query}` : path, { scroll: false });
  }

  function aggregatedQuery(next: StockListFilters) {
    const params = new URLSearchParams();
    if (next.productId) params.set("product_id", next.productId);
    if (next.itemStateId) params.set("item_state_id", next.itemStateId);
    if (next.inStock) params.set("in_stock", next.inStock);
    return params;
  }

  function availableQuery(productId: string) {
    const params = new URLSearchParams();
    if (productId) params.set("product_id", productId);
    return params;
  }

  function updateFilter(key: keyof StockListFilters, value: string) {
    const next = { ...filters, [key]: value } as StockListFilters;
    setFilters(next);
    replaceQuery(AGGREGATED_PATH, aggregatedQuery(next));
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    replaceQuery(AGGREGATED_PATH, new URLSearchParams());
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
      const params = availableQuery(availableProductId);
      const query = params.toString();
      router.push(query ? `${AVAILABLE_PATH}?${query}` : AVAILABLE_PATH);
      return;
    }

    const params = aggregatedQuery(filters);
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
        const product = findById(products, stock.product_id);
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
      header: "Cantidad",
      className: "whitespace-nowrap",
      render: (stock) => <StockQuantity quantity={stock.quantity} />,
    },
  ];

  function renderAggregatedActions(stock: StockRecord) {
    const product = findById(products, stock.product_id);
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
    const product = findById(products, stock.product_id);
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
              Cantidad
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
        description="Consulta el agregado por producto y estado, y la disponibilidad vendible con su costo vigente. Este módulo es de solo lectura."
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

        <section
          aria-label="Filtros de existencias"
          className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SelectField
              emptyLabel="No hay productos registrados."
              id="filtro-existencias-producto"
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
              options={aggregatedProductOptions}
              placeholder="Todos los productos"
              value={filters.productId}
            />
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
              onChange={(value) => updateFilter("itemStateId", value)}
              onRetry={itemStatesResource.reload}
              options={itemStateOptions}
              placeholder="Todos los estados"
              value={filters.itemStateId}
            />
            <SelectField
              id="filtro-existencias-disponibilidad"
              label="Disponibilidad"
              onChange={(value) =>
                updateFilter(
                  "inStock",
                  value === "true" || value === "false" ? value : "",
                )
              }
              options={[
                { value: "true", label: "Solo con stock" },
                { value: "false", label: "Solo sin stock" },
              ]}
              placeholder="Todas las existencias"
              value={filters.inStock}
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

        {stocksResource.status === "loading" && (
          <RecordsTableSkeleton
            columns={4}
            label="Cargando existencias…"
            rows={6}
          />
        )}

        {stocksResource.status === "error" && stocks.length === 0 && (
          <RecordsLoadError
            backHref="/app"
            backLabel="Volver al inicio"
            description={stockErrorMessage(
              stocksResource.error,
              "No pudimos cargar las existencias.",
            )}
            onRetry={
              stocksResource.error?.canRetry ? reloadStocks : undefined
            }
            title="No pudimos cargar las existencias"
          />
        )}

        {stocksResource.status !== "loading" &&
          !(stocksResource.status === "error" && stocks.length === 0) && (
            <section aria-label="Listado de existencias agregadas" className="space-y-4">
              {stocksResource.status === "refreshing" && (
                <div aria-hidden="true" className="reload-bar" />
              )}

              {stocksResource.status === "error" && stocks.length > 0 && (
                <NoticeBanner
                  action={
                    <button
                      className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                      onClick={reloadStocks}
                      type="button"
                    >
                      Reintentar
                    </button>
                  }
                  tone="warning"
                >
                  {stockErrorMessage(
                    stocksResource.error,
                    "No pudimos actualizar las existencias. Mostramos los datos disponibles.",
                  )}
                </NoticeBanner>
              )}

              {stocks.length === 0 ? (
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
                    ) : (
                      <Link
                        className="button-base button-secondary min-h-11 px-5"
                        href="/app/compras"
                      >
                        Ver compras
                        <Icon name="clipboard" size={16} />
                      </Link>
                    )
                  }
                  description={
                    filtersActive
                      ? "Ajusta los filtros para ver otros resultados."
                      : "Se crean al confirmar una compra."
                  }
                  title={
                    filtersActive
                      ? "No hay existencias que coincidan con los filtros."
                      : "Todavía no hay existencias registradas."
                  }
                />
              ) : (
                <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                  <RecordsTable
                    caption="Existencias agregadas por producto y estado de ítem, con su cantidad y enlace a lotes"
                    columns={aggregatedColumns}
                    getRowKey={(stock) => String(stock.id)}
                    getRowLabel={(stock) =>
                      `${stockProductName(findById(products, stock.product_id), stock.product_id)} en estado ${stockItemStateLabel(stock, itemStates)}`
                    }
                    renderCard={renderAggregatedCard}
                    rowActions={renderAggregatedActions}
                    rows={stocks}
                  />
                </div>
              )}
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
        <h2 className="sr-only">Disponibilidad vendible</h2>

        <section
          aria-label="Selector de producto para disponibilidad"
          className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              help="Filtra la lista por nombre o referencia sin salir de la página."
              id="buscar-producto-disponible"
              label="Buscar producto"
              onChange={setProductQuery}
              placeholder="Nombre o referencia"
              value={productQuery}
            />
            <SelectField
              emptyLabel={
                productQuery
                  ? "No hay productos que coincidan con la búsqueda."
                  : "No hay productos registrados."
              }
              id="producto-disponible"
              label="Producto"
              loading={productsResource.status === "loading"}
              loadingLabel="Cargando productos…"
              loadError={
                productsResource.status === "error"
                  ? productsResource.error?.message ??
                    "No pudimos cargar los productos."
                  : null
              }
              onChange={selectAvailableProduct}
              onRetry={productsResource.reload}
              options={availableProductOptions}
              placeholder="Selecciona un producto"
              value={availableProductId}
            />
          </div>
          <p aria-live="polite" className="mt-4 text-[12px] text-muted">
            {availableProductValid
              ? `Consultando la disponibilidad vendible de ${availableProductName}.`
              : "Elige un producto para consultar su disponibilidad vendible y su costo vigente."}
          </p>
        </section>

        {availableActive &&
          (!availableProductValid ? (
            <EmptyState
              description="Solo se muestran los estados de ítem vendibles con cantidad mayor que cero."
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
  const stocks = resource.data ?? NO_AVAILABLE_STOCKS;

  const countLabel = resource.data
    ? stockCountLabel(stocks.length)
    : resource.status === "error"
      ? "No se pudo cargar la disponibilidad"
      : "Cargando disponibilidad…";

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
      key: "cantidad",
      header: "Cantidad",
      className: "whitespace-nowrap",
      render: (stock) => <StockQuantity quantity={stock.quantity} />,
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
            {formatMoney(stock.cost)}
          </span>
        ),
    },
    {
      key: "moneda",
      header: "Moneda",
      className: "whitespace-nowrap",
      render: (stock) =>
        stock.currency ? (
          <div>
            <span className="font-semibold text-ink">{stock.currency.code}</span>
            <span className="mt-0.5 block text-[11px] text-muted">
              {stock.currency.symbol}
            </span>
          </div>
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
              Cantidad
            </dt>
            <dd className="mt-1">
              <StockQuantity quantity={stock.quantity} />
            </dd>
          </div>
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
                formatMoney(stock.cost)
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1 font-semibold text-ink">
              {stock.currency?.code ?? "Sin moneda registrada"}
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
          columns={5}
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
                  "No pudimos actualizar la disponibilidad. Mostramos los datos disponibles.",
                )}
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
                description="Solo se muestran estados vendibles con cantidad mayor que cero."
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
                  caption={`Disponibilidad vendible de ${productName} por estado de ítem, con costo y moneda`}
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
              La cantidad reservada no se muestra en existencias; vive en los
              lotes.{" "}
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
