"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
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
  fetchStocksByProduct,
  type StockRecord,
} from "@/components/erp/records/stocks-api";
import {
  StockQuantity,
  StockSyncNotice,
  stockCountLabel,
  stockItemStateLabel,
  stockProductName,
} from "@/components/erp/records/stock-shared";
import { canReadModule } from "@/lib/permissions";
import type { UiError } from "@/lib/api-errors";

const NO_PRODUCTS: ProductRecord[] = [];
const NO_STOCKS: StockRecord[] = [];

function stockErrorMessage(error: UiError | null, fallback: string) {
  if (!error) return fallback;
  if (error.kind === "validation") {
    return "El producto indicado no es válido. Vuelve al listado e intenta de nuevo.";
  }
  return error.message;
}

export function ProductStocksPage({ productId }: { productId: string }) {
  const { user } = useSession();
  if (!canReadModule(user.role, "existencias")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de existencias. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  if (!isPositiveRecordId(productId)) {
    return (
      <RecordsLoadError
        backHref="/app/existencias"
        backLabel="Volver a existencias"
        description="Puede que el enlace no sea válido o que el producto no exista."
        headingLevel="h1"
        title="No encontramos este producto."
      />
    );
  }

  return <ProductStocksContent productId={productId} />;
}

function ProductStocksContent({ productId }: { productId: string }) {
  const productsResource = useAsyncResource(fetchProducts);
  const stocksLoader = useCallback(
    () => fetchStocksByProduct(productId),
    [productId],
  );
  const stocksResource = useAsyncResource(stocksLoader);

  const products = productsResource.data ?? NO_PRODUCTS;
  const stocks = stocksResource.data ?? NO_STOCKS;
  const product = findById(products, productId);
  const productName = stockProductName(product, productId);
  const productMissing = productsResource.data !== null && !product;

  const columns: RecordsTableColumn<StockRecord>[] = [
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
  ];

  function renderActions(stock: StockRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver el detalle de la existencia de ${productName} en estado ${stockItemStateLabel(stock)}`}
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
        <RecordActionLink
          ariaLabel={`Ver la disponibilidad vendible de ${productName}`}
          href={`/app/existencias/disponibles?product_id=${stock.product_id}`}
          icon="box"
        >
          Disponibles
        </RecordActionLink>
      </RecordActions>
    );
  }

  function renderCard(stock: StockRecord) {
    return (
      <div>
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {stockItemStateLabel(stock)}
        </span>
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

  const headerDescription = product
    ? `Existencias de ${product.name} (${product.reference}) por estado de ítem. Los lotes se consultan aparte.`
    : "Existencias del producto por estado de ítem. Los lotes se consultan aparte.";

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/existencias"
            >
              Volver a existencias
            </Link>
            {!productMissing && (
              <Link
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href={`/app/existencias/disponibles?product_id=${productId}`}
              >
                Ver disponibles
                <Icon name="arrow-right" size={17} />
              </Link>
            )}
          </>
        }
        description={headerDescription}
        eyebrow="Inventario"
        title="Existencias del producto"
      />

      <StockSyncNotice />

      {productsResource.status === "error" && (
        <NoticeBanner
          action={
            productsResource.error?.canRetry ? (
              <button
                className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                onClick={productsResource.reload}
                type="button"
              >
                Reintentar
              </button>
            ) : undefined
          }
          tone="warning"
        >
          No pudimos cargar los datos del producto. Mostramos las existencias
          con su identificador.
        </NoticeBanner>
      )}

      {productMissing ? (
        <section
          aria-labelledby="producto-no-encontrado"
          className="space-y-4"
        >
          <h2 className="sr-only" id="producto-no-encontrado">
            Producto no encontrado
          </h2>
          <EmptyState
            action={
              <Link
                className="button-base button-secondary min-h-11 px-5"
                href="/app/existencias"
              >
                Volver a existencias
              </Link>
            }
            description="Puede que haya sido eliminado o que el enlace no sea válido."
            title="No encontramos este producto."
          />
        </section>
      ) : stocksResource.status === "loading" ? (
        <RecordsTableSkeleton
          columns={4}
          label="Cargando existencias del producto…"
          rows={5}
        />
      ) : stocksResource.status === "error" && stocks.length === 0 ? (
        <RecordsLoadError
          backHref="/app/existencias"
          backLabel="Volver a existencias"
          description={stockErrorMessage(
            stocksResource.error,
            "No pudimos cargar las existencias del producto.",
          )}
          onRetry={
            stocksResource.error?.canRetry
              ? stocksResource.reload
              : undefined
          }
          title="No pudimos cargar las existencias del producto"
        />
      ) : (
        <section
          aria-labelledby="existencias-producto-titulo"
          className="space-y-4"
        >
          <h2 className="sr-only" id="existencias-producto-titulo">
            Existencias por estado
          </h2>
          {stocksResource.status === "refreshing" && (
            <div aria-hidden="true" className="reload-bar" />
          )}

          {stocksResource.status === "error" && stocks.length > 0 && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={stocksResource.reload}
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

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <p className="text-[14px] font-semibold text-ink">{productName}</p>
                {product?.reference && (
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    Ref. {product.reference}
                  </p>
                )}
              </div>
              <p aria-live="polite" className="text-[12px] font-semibold text-muted">
                {stocksResource.data
                  ? stockCountLabel(stocks.length)
                  : "Cargando existencias…"}
              </p>
            </div>

            {stocks.length === 0 ? (
              <EmptyState
                description="Se crean al confirmar una compra."
                title="Todavía no hay existencias registradas."
              />
            ) : (
              <RecordsTable
                caption={`Existencias de ${productName} por estado de ítem, con enlaces a lotes y disponibilidad`}
                columns={columns}
                getRowKey={(stock) => String(stock.id)}
                getRowLabel={(stock) =>
                  `${productName} en estado ${stockItemStateLabel(stock)}`
                }
                renderCard={renderCard}
                rowActions={renderActions}
                rows={stocks}
              />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
