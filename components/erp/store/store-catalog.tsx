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
  storeQuantityLabel,
  type StoreFeedback,
} from "@/components/erp/store/store-shared";
import { useStoreResource } from "@/components/erp/store/use-store-resource";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useServerList } from "@/components/erp/ui/use-server-list";
import { ApiError } from "@/lib/api";
import { CART_MAX_LINES, addCartLine, readCart } from "@/lib/cart";
import { getCustomerAccessIssue } from "@/lib/customer";
import { formatInteger } from "@/lib/format";
import {
  fetchStoreProductPage,
  type StoreProduct,
} from "@/lib/store";

function StoreCatalogContent({
  customerId,
}: {
  customerId: number | string;
}) {
  const [feedback, setFeedback] = useState<StoreFeedback | null>(null);

  const itemStatesLoader = useCallback(
    () => fetchItemStates({ isSellable: true }),
    [],
  );

  const list = useServerList<StoreProduct>({
    loader: (request) => fetchStoreProductPage(request),
    filterKeys: ["item_state_id"],
    defaultPageSize: 12,
  });
  const itemStatesResource = useStoreResource(itemStatesLoader, "estados");

  const products = list.items;
  const itemStateFilter = list.filters.item_state_id ?? "";
  const hasQuery = Boolean(list.request.q);
  const hasFilters = hasQuery || Boolean(itemStateFilter);

  const stateOptions = useMemo(
    () =>
      (itemStatesResource.data ?? []).map((itemState) => ({
        value: String(itemState.id),
        label: itemState.label,
      })),
    [itemStatesResource.data],
  );

  const loading = list.status === "loading";
  const refreshing = list.status === "refreshing";

  const chips: FilterChip[] = [];
  if (hasQuery) {
    chips.push({
      id: "q",
      label: `Búsqueda: ${list.request.q}`,
      onRemove: () => {
        list.setSearch("");
        list.commitSearch();
      },
    });
  }
  if (itemStateFilter) {
    chips.push({
      id: "item_state_id",
      label: `Estado: ${
        stateOptions.find((option) => option.value === itemStateFilter)?.label ??
        `#${itemStateFilter}`
      }`,
      onRemove: () => list.setFilter("item_state_id", ""),
    });
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

  const error = list.error;

  if (error && products.length === 0) {
    const accessIssue = getCustomerAccessIssue(error);
    if (accessIssue) {
      return (
        <StoreAccountIssue onRetry={list.reload} reason={accessIssue} />
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
            ? () => list.setFilter("item_state_id", "")
            : copy.canRetry
              ? list.reload
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
        description="Consulta los productos con existencia y el precio de tu lista. La búsqueda y los filtros se aplican en el servidor."
        eyebrow="Tienda"
        title="Catálogo"
      />

      <StoreFeedbackBanner feedback={feedback} />

      {error && products.length > 0 && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={
                error instanceof ApiError && error.status === 422 && itemStateFilter
                  ? () => list.setFilter("item_state_id", "")
                  : list.reload
              }
              type="button"
            >
              {error instanceof ApiError && error.status === 422 && itemStateFilter
                ? "Quitar filtro de estado"
                : "Reintentar"}
            </button>
          }
          tone="warning"
        >
          {error.message}
        </NoticeBanner>
      )}

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        id="tienda-filtros"
        loading={loading}
        onClear={list.clearFilters}
        results={
          loading
            ? "Cargando productos…"
            : list.meta.total === 0
              ? "Sin productos disponibles"
              : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                  list.range.to,
                )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <TextField
            help="Busca por nombre o referencia. La búsqueda se aplica en el servidor."
            id="tienda-buscar"
            inputType="search"
            label="Buscar productos"
            onChange={list.setSearch}
            placeholder="Nombre o referencia"
            value={list.searchDraft}
          />
        }
      >
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
          onChange={(value) => list.setFilter("item_state_id", value)}
          onRetry={itemStatesResource.reload}
          options={stateOptions}
          placeholder="Todos los estados"
          value={itemStateFilter}
        />
      </FilterBar>

      {loading && <StoreGridSkeleton />}

      {!loading && refreshing && (
        <div aria-hidden="true" className="reload-bar" />
      )}

      {!loading && !refreshing && products.length === 0 && (
        list.meta.total === 0 && !hasFilters ? (
          <EmptyState
            description="Cuando tu lista tenga productos disponibles, aparecerán aquí."
            title="No hay productos con existencia en este momento."
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
                  )} productos disponibles en total, pero esta página no tiene filas.`
                : "Ajusta la búsqueda o el estado para ver otros productos."
            }
            title={
              list.isPageOutOfRange
                ? "No hay resultados en esta página"
                : "Sin resultados con estos filtros."
            }
          />
        )
      )}

      {!loading && products.length > 0 && (
        <section
          aria-busy={refreshing || undefined}
          aria-label="Productos disponibles"
          className="space-y-4"
        >
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product, index) => (
              <li className="min-w-0" key={`${product.id}:${product.itemState.id}`}>
                <article className="flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_18px_60px_rgba(27,12,104,0.04)]">
                  <StoreImage
                    className="h-44 w-full rounded-none border-x-0 border-t-0 border-b border-line"
                    label={product.name}
                    priority={index < 4}
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

          <PaginationControls
            meta={list.meta}
            onFirstPage={list.goToFirstPage}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            pageSizeOptions={[12, 24, 48]}
          />
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
