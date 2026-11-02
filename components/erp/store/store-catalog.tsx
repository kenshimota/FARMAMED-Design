"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { fetchItemStates } from "@/components/erp/records/item-states-api";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import { useSession } from "@/components/erp/session-context";
import {
  STORE_CART_ADD_ERROR,
  STORE_CART_FULL_MESSAGE,
  StoreAccountIssue,
  StoreAvailability,
  StoreErrorState,
  StoreFeedbackBanner,
  StoreGridSkeleton,
  StoreImage,
  StoreItemStateBadge,
  describeStoreError,
  formatStoreMoney,
  storeCountLabel,
  storeQuantityLabel,
  type StoreFeedback,
} from "@/components/erp/store/store-shared";
import { useStoreResource } from "@/components/erp/store/use-store-resource";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { ApiError } from "@/lib/api";
import { CART_MAX_LINES, addCartLine, readCart } from "@/lib/cart";
import { getCustomerAccessIssue } from "@/lib/customer";
import { formatInteger } from "@/lib/format";
import {
  fetchStoreProducts,
  type StoreProduct,
} from "@/lib/store";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function StoreCatalogContent({
  customerId,
}: {
  customerId: number | string;
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [itemStateFilter, setItemStateFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [feedback, setFeedback] = useState<StoreFeedback | null>(null);

  const productsLoader = useCallback(
    () => fetchStoreProducts(itemStateFilter || null),
    [itemStateFilter],
  );
  const itemStatesLoader = useCallback(
    () => fetchItemStates({ isSellable: true }),
    [],
  );

  const productsResource = useStoreResource(
    productsLoader,
    `productos:${itemStateFilter || "todos"}`,
  );
  const itemStatesResource = useStoreResource(itemStatesLoader, "estados");

  const products = useMemo(
    () => (productsResource.data ?? []).filter((product) => product.available),
    [productsResource.data],
  );

  const categoryOptions = useMemo(() => {
    const categories = new Map<string, string>();
    for (const product of products) {
      if (!product.category) continue;
      categories.set(String(product.category.id), product.category.name);
    }
    return [...categories.entries()]
      .sort((first, second) =>
        first[1].localeCompare(second[1], "es", { sensitivity: "base" }),
      )
      .map(([value, label]) => ({ value, label }));
  }, [products]);

  const stateOptions = useMemo(
    () =>
      (itemStatesResource.data ?? []).map((itemState) => ({
        value: String(itemState.id),
        label: itemState.label,
      })),
    [itemStatesResource.data],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return products.filter((product) => {
      if (
        categoryFilter &&
        String(product.category?.id ?? "") !== categoryFilter
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      return normalizeSearch(`${product.name} ${product.reference}`).includes(
        normalizedQuery,
      );
    });
  }, [categoryFilter, products, query]);

  const hasLocalFilters = Boolean(query.trim() || categoryFilter);
  const hasFilters = hasLocalFilters || Boolean(itemStateFilter);
  const activeFilterCount =
    Number(Boolean(query.trim())) +
    Number(Boolean(categoryFilter)) +
    Number(Boolean(itemStateFilter));
  const loading = productsResource.status === "loading";
  const refreshing = productsResource.status === "refreshing";

  function clearFilters() {
    setQuery("");
    setCategoryFilter("");
    setItemStateFilter("");
  }

  function addProduct(product: StoreProduct) {
    if (!product.available || !product.currency) return;

    const currentCart = readCart(customerId);
    const existingLine = currentCart.find(
      (line) =>
        line.productId === product.id &&
        line.itemStateId === product.itemState.id,
    );
    if (!existingLine && currentCart.length >= CART_MAX_LINES) {
      setFeedback({ tone: "error", message: STORE_CART_FULL_MESSAGE });
      return;
    }

    const lines = addCartLine(customerId, {
      productId: product.id,
      itemStateId: product.itemState.id,
      name: product.name,
      reference: product.reference || null,
      itemStateLabel: product.itemState.label,
      unitPrice: product.price,
      currencyId: product.currency.id,
      currencyCode: product.currency.code,
      currencySymbol: product.currency.symbol,
      imageUrl: product.imageUrl,
    });
    const line = lines.find(
      (item) =>
        item.productId === product.id &&
        item.itemStateId === product.itemState.id,
    );
    if (!line) {
      setFeedback({ tone: "error", message: STORE_CART_ADD_ERROR });
      return;
    }

    setFeedback({
      tone: "success",
      message: `Agregamos ${product.name} (${product.itemState.label}) a tu pedido. Ahora tienes ${storeQuantityLabel(line.quantity)}.`,
    });
  }

  const error = productsResource.error;

  if (error) {
    const accessIssue = getCustomerAccessIssue(error);
    if (accessIssue) {
      return (
        <StoreAccountIssue
          onRetry={productsResource.reload}
          reason={accessIssue}
        />
      );
    }

    const copy = describeStoreError(error, "catalog");
    const invalidFilter = error instanceof ApiError && error.status === 422;
    return (
      <StoreErrorState
        {...copy}
        headingLevel="h1"
        onRetry={
          invalidFilter && itemStateFilter
            ? () => setItemStateFilter("")
            : copy.canRetry
              ? productsResource.reload
              : undefined
        }
        retryLabel={
          invalidFilter && itemStateFilter
            ? "Quitar filtro de estado"
            : "Reintentar"
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        description="Consulta los productos con existencia y el precio de tu lista. La búsqueda y el filtro de categoría se aplican a los productos cargados."
        eyebrow="Tienda"
        title="Catálogo"
      />

      <StoreFeedbackBanner feedback={feedback} />

      <section aria-label="Búsqueda y filtros del catálogo" className="space-y-3">
        <button
          aria-controls="tienda-filtros"
          aria-expanded={filtersOpen}
          className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 text-left text-[13px] font-semibold text-ink transition-colors hover:border-brand/40 md:hidden"
          onClick={() => setFiltersOpen((current) => !current)}
          type="button"
        >
          <span className="flex items-center gap-2">
            <Icon aria-hidden="true" name="search" size={17} />
            Buscar y filtrar
          </span>
          <span className="flex items-center gap-2 text-[12px] font-medium text-muted">
            {hasFilters
              ? `${activeFilterCount} ${activeFilterCount === 1 ? "filtro activo" : "filtros activos"}`
              : "Sin filtros"}
            <Icon
              aria-hidden="true"
              name="chevron-down"
              className={`transition-transform motion-reduce:transition-none ${filtersOpen ? "rotate-180" : ""}`}
              size={15}
            />
          </span>
        </button>

        <div
          className={`rounded-[24px] border border-line bg-surface p-4 sm:p-5 ${
            filtersOpen ? "block" : "hidden"
          } md:block`}
          id="tienda-filtros"
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px] lg:items-start">
            <TextField
              help="Busca por nombre o referencia en los productos cargados."
              id="tienda-buscar"
              label="Buscar productos"
              onChange={setQuery}
              placeholder="Nombre o referencia"
              value={query}
            />

            <SelectField
              emptyLabel="Todas las categorías"
              id="tienda-categoria"
              label="Categoría"
              loading={loading}
              loadingLabel="Cargando categorías…"
              onChange={setCategoryFilter}
              options={categoryOptions}
              placeholder="Todas las categorías"
              value={categoryFilter}
            />

            <SelectField
              emptyLabel="Todos los estados"
              id="tienda-estado"
              label="Estado"
              loadError={
                itemStatesResource.status === "error"
                  ? "No pudimos cargar los estados vendibles."
                  : null
              }
              loading={itemStatesResource.status === "loading"}
              loadingLabel="Cargando estados…"
              onChange={setItemStateFilter}
              onRetry={itemStatesResource.reload}
              options={stateOptions}
              placeholder="Todos los estados"
              value={itemStateFilter}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <p aria-live="polite" className="text-[12px] font-semibold text-muted">
              {hasLocalFilters
                ? `Mostrando ${formatInteger(filteredProducts.length)} de ${storeCountLabel(products.length)}`
                : storeCountLabel(filteredProducts.length)}
            </p>
            {hasFilters && (
              <button
                className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                onClick={clearFilters}
                type="button"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </section>

      {loading && <StoreGridSkeleton />}

      {!loading && refreshing && (
        <div aria-hidden="true" className="reload-bar" />
      )}

      {!loading && !refreshing && products.length === 0 && (
        <EmptyState
          action={
            itemStateFilter ? (
              <button
                className="button-base button-secondary min-h-11 px-5"
                onClick={() => setItemStateFilter("")}
                type="button"
              >
                Quitar filtro de estado
              </button>
            ) : (
              <button
                className="button-base button-secondary min-h-11 px-5"
                onClick={productsResource.reload}
                type="button"
              >
                Reintentar
              </button>
            )
          }
          description={
            itemStateFilter
              ? "No hay productos disponibles para el estado seleccionado. Prueba con otro estado o vuelve más tarde."
              : "Cuando tu lista tenga productos disponibles, aparecerán aquí."
          }
          title="No hay productos con existencia en este momento."
        />
      )}

      {!loading && !refreshing && products.length > 0 && filteredProducts.length === 0 && (
        <EmptyState
          action={
            <button
              className="button-base button-secondary min-h-11 px-5"
              onClick={clearFilters}
              type="button"
            >
              Limpiar filtros
            </button>
          }
          description="Ajusta la búsqueda, la categoría o el estado para ver otros productos."
          title="No encontramos productos con ese criterio."
        />
      )}

      {!loading && filteredProducts.length > 0 && (
        <section aria-label="Productos disponibles" className="space-y-4">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <li className="min-w-0" key={`${product.id}:${product.itemState.id}`}>
                <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_18px_60px_rgba(27,12,104,0.04)]">
                  <StoreImage
                    className="h-44 w-full rounded-none border-x-0 border-t-0 border-b border-line"
                    label={product.name}
                    src={product.imageUrl}
                  />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <StoreItemStateBadge label={product.itemState.label} />
                      <StoreAvailability available={product.available} />
                    </div>

                    <h2 className="mt-4 text-[17px] font-semibold leading-6 tracking-[-0.02em] text-ink">
                      <Link
                        className="underline-offset-4 hover:text-brand hover:underline"
                        href={`/app/tienda/${product.id}`}
                      >
                        {product.name}
                      </Link>
                    </h2>

                    <p className="mt-1.5 text-[12px] text-muted">
                      {product.reference || "Sin referencia"}
                    </p>
                    <p className="mt-1 text-[12px] text-muted">
                      {product.category?.name ?? "Sin categoría"}
                    </p>

                    {product.description && (
                      <p className="mt-3 line-clamp-2 text-[13px] leading-6 text-muted">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-auto pt-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                        Precio
                      </p>
                      <p className="mt-1 text-xl font-semibold tracking-[-0.025em] text-ink">
                        {formatStoreMoney(product.price, product.currency)}
                      </p>
                      {!product.currency && (
                        <p className="mt-1 text-[11px] leading-5 text-alert-ink">
                          Moneda no disponible.
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <Link
                          aria-label={`Ver detalle de ${product.name} (${product.itemState.label})`}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-surface px-4 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand"
                          href={`/app/tienda/${product.id}`}
                        >
                          Ver detalle
                          <Icon aria-hidden="true" name="arrow-right" size={14} />
                        </Link>
                        <button
                          aria-label={`Agregar ${product.name} (${product.itemState.label}) al pedido`}
                          className="button-base button-primary min-h-11 flex-1 px-4 text-[12px]"
                          disabled={!product.available || !product.currency}
                          onClick={() => addProduct(product)}
                          type="button"
                        >
                          Agregar al pedido
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function StoreCatalogPage() {
  const { user } = useSession();

  if (user.role !== "customer") {
    return (
      <AccessState description="Esta sección pertenece al portal del cliente. Usa la navegación del ERP para continuar." />
    );
  }

  if (user.customer_id === null) {
    return <StoreAccountIssue reason="vinculo" />;
  }

  return <StoreCatalogContent customerId={user.customer_id} />;
}
