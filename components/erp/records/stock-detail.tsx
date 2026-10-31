"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  fetchProducts,
  findById,
  isPositiveRecordId,
} from "@/components/erp/records/records-api";
import { fetchStock } from "@/components/erp/records/stocks-api";
import {
  StockQuantity,
  StockSyncNotice,
  stockItemStateLabel,
  stockProductName,
} from "@/components/erp/records/stock-shared";
import { canReadModule } from "@/lib/permissions";

export function StockDetailPage({ stockId }: { stockId: string }) {
  const { user } = useSession();
  if (!canReadModule(user.role, "existencias")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de existencias. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  if (!isPositiveRecordId(stockId)) {
    return (
      <RecordsLoadError
        backHref="/app/existencias"
        backLabel="Volver a existencias"
        description="Puede que el enlace no sea válido o que la existencia haya cambiado."
        headingLevel="h1"
        title="No encontramos esta existencia"
      />
    );
  }

  return <StockDetailContent stockId={stockId} />;
}

function StockDetailContent({ stockId }: { stockId: string }) {
  const stockLoader = useCallback(() => fetchStock(stockId), [stockId]);
  const stockResource = useAsyncResource(stockLoader);
  const productsResource = useAsyncResource(fetchProducts);

  if (stockResource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/existencias"
            >
              Volver a existencias
            </Link>
          }
          description="Consulta el agregado registrado para un producto y estado de ítem."
          eyebrow="Inventario"
          title="Detalle de existencia"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (stockResource.status === "error" || !stockResource.data) {
    const notFound = stockResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/existencias"
        backLabel="Volver a existencias"
        description={
          notFound
            ? "Puede que el enlace no sea válido o que la existencia haya cambiado."
            : stockResource.error?.message ??
              "No pudimos cargar la existencia."
        }
        headingLevel="h1"
        onRetry={
          !notFound && stockResource.error?.canRetry
            ? stockResource.reload
            : undefined
        }
        title={
          notFound
            ? "No encontramos esta existencia"
            : "No pudimos cargar la existencia"
        }
      />
    );
  }

  const stock = stockResource.data;
  const product = findById(productsResource.data ?? [], stock.product_id);
  const productName = stockProductName(product, stock.product_id);
  const itemStateLabel = stockItemStateLabel(stock);

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
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href={`/app/existencias/producto/${stock.product_id}`}
            >
              Ver existencias del producto
              <Icon name="arrow-right" size={17} />
            </Link>
          </>
        }
        description={`Existencia de ${productName} en estado ${itemStateLabel}.`}
        eyebrow="Inventario"
        title="Detalle de existencia"
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
          No pudimos cargar el nombre del producto. Mostramos su identificador.
        </NoticeBanner>
      )}

      <section
        aria-labelledby="ficha-existencia"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Ficha de la existencia</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ficha-existencia"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Producto
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              <Link
                className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
                href={`/app/existencias/producto/${stock.product_id}`}
              >
                {productName}
              </Link>
              {product?.reference && (
                <span className="mt-1 block font-mono text-[11px] text-muted">
                  Ref. {product.reference}
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Estado del ítem
            </dt>
            <dd className="mt-1.5">
              <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
                {itemStateLabel}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Cantidad
            </dt>
            <dd className="mt-1.5">
              <StockQuantity quantity={stock.quantity} />
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Condición de venta
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              {stock.item_state
                ? stock.item_state.is_sellable
                  ? "Vendible"
                  : "No vendible"
                : "Sin dato"}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">
              #{stock.id}
            </dd>
          </div>
        </dl>

        <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          Las existencias se crean al confirmar una compra y no se editan desde
          esta pantalla.
        </p>
      </section>

      <section
        aria-labelledby="enlaces-existencia"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Trazabilidad</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="enlaces-existencia"
        >
          Enlaces relacionados
        </h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          <li className="rounded-2xl border border-line bg-background p-4">
            <Link
              className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/lotes?product_id=${stock.product_id}`}
            >
              Ver lotes
              <Icon name="layers" size={15} />
            </Link>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              Detalle físico, vencimientos y ubicaciones.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-background p-4">
            <Link
              className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/costos/producto/${stock.product_id}`}
            >
              Ver costos
              <Icon name="calculator" size={15} />
            </Link>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              Costo vigente por estado de ítem.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-background p-4">
            <Link
              className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href="/app/compras"
            >
              Ver compras confirmadas
              <Icon name="clipboard" size={15} />
            </Link>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              El módulo de compras está en preparación.
            </p>
          </li>
        </ul>
      </section>
    </div>
  );
}
