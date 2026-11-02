"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { OrderActionsSection } from "@/components/erp/records/order-actions";
import { OrderLinesSection } from "@/components/erp/records/order-lines";
import {
  ORDER_COPY,
} from "@/components/erp/records/orders-errors";
import {
  fetchOrder,
  fetchOrderStatuses,
  type OrderHistoryEvent,
  type OrderRecord,
  type OrderStatusRecord,
} from "@/components/erp/records/orders-api";
import {
  OrderStatusBadge,
  orderMoney,
  orderNumberLabel,
  orderProductLabel,
  orderStatusLabel,
  paymentTermDetail,
  paymentTermLabel,
  type OrderDisplayCurrency,
} from "@/components/erp/records/orders-shared";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatCoordinate, formatDateTime, formatInteger } from "@/lib/format";

export function OrderDetailPage({ orderId }: { orderId: string }) {
  const { user } = useSession();
  if (!canReadModule(user.role, "pedidos")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de pedidos. La gestión interna está disponible para administradores y vendedores." />
    );
  }
  if (!isPositiveRecordId(orderId)) {
    return (
      <RecordsLoadError
        backHref="/app/pedidos"
        backLabel="Volver a pedidos"
        description="Puede que el enlace no sea válido o que el pedido ya no exista."
        headingLevel="h1"
        title="No encontramos este pedido"
      />
    );
  }
  return <OrderDetailContent orderId={orderId} />;
}

function eventLabel(
  event: OrderHistoryEvent,
  statuses: readonly OrderStatusRecord[],
) {
  switch (event.eventType) {
    case "created":
      return "Pedido creado";
    case "status_changed": {
      const from = event.fromStatus
        ? orderStatusLabel(event.fromStatus, statuses)
        : "Inicio";
      const to = event.toStatus
        ? orderStatusLabel(event.toStatus, statuses)
        : "Sin estado";
      return `Estado actualizado: ${from} → ${to}`;
    }
    case "item_added":
      return "Línea agregada";
    case "item_updated":
      return "Cantidad actualizada";
    case "item_removed":
      return "Línea eliminada";
    case "invoice_issued": {
      const number = event.metadata?.invoice_number;
      return typeof number === "string" || typeof number === "number"
        ? `Factura #${number} emitida`
        : "Factura emitida";
    }
    default:
      return "Evento";
  }
}

function eventDetail(
  event: OrderHistoryEvent,
  order: OrderRecord,
  statuses: readonly OrderStatusRecord[],
) {
  const metadata = event.metadata;
  if (!metadata) return null;

  if (
    event.eventType === "item_added" ||
    event.eventType === "item_updated" ||
    event.eventType === "item_removed"
  ) {
    const productId = metadata.product_id;
    const itemStateId = metadata.item_state_id;
    const quantity = metadata.quantity;
    const item = (order.items ?? []).find(
      (candidate) =>
        String(candidate.productId) === String(productId) &&
        (itemStateId === undefined ||
          itemStateId === null ||
          String(candidate.itemStateId) === String(itemStateId)),
    );
    const product = item
      ? orderProductLabel(item.product, item.productId)
      : typeof productId === "string" || typeof productId === "number"
        ? `Producto #${productId}`
        : null;
    const parts: string[] = [];
    if (product) parts.push(product);
    if (typeof quantity === "string" || typeof quantity === "number") {
      parts.push(`cantidad ${formatInteger(Number(quantity))}`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }

  if (event.eventType === "invoice_issued") {
    const id = metadata.invoice_id;
    if (typeof id === "string" || typeof id === "number") {
      return `Identificador de factura ${id}`;
    }
  }

  if (event.eventType === "status_changed" && event.toStatus) {
    return orderStatusLabel(event.toStatus, statuses);
  }

  return null;
}

function OrderHistory({
  order,
  statuses,
}: {
  order: OrderRecord;
  statuses: readonly OrderStatusRecord[];
}) {
  const history = order.history ?? [];
  return (
    <section
      aria-labelledby="historial-pedido"
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
    >
      <span className="eyebrow">Trazabilidad</span>
      <h2
        className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
        id="historial-pedido"
      >
        Historial del pedido
      </h2>

      {history.length === 0 ? (
        <p className="mt-4 text-[13px] leading-6 text-muted">
          No hay eventos registrados para este pedido.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {history.map((event, index) => {
            const detail = eventDetail(event, order, statuses);
            return (
              <li className="flex gap-3" key={`${event.id ?? "evento"}-${index}`}>
                <span className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full border border-brand/40 bg-soft-blue" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-5 text-ink">
                    {eventLabel(event, statuses)}
                  </p>
                  {detail && (
                    <p className="mt-0.5 text-[11px] leading-5 text-muted">
                      {detail}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {event.createdAt ? (
                      <time dateTime={event.createdAt}>
                        {formatDateTime(event.createdAt)}
                      </time>
                    ) : (
                      "Sin fecha registrada"
                    )}
                    {" · "}
                    {event.actor
                      ? `por ${event.actor.username}`
                      : "Sin actor registrado"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function OrderTotalsCard({
  order,
  currency,
}: {
  order: OrderRecord;
  currency: OrderDisplayCurrency | null;
}) {
  return (
    <section
      aria-labelledby="resumen-pedido"
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
    >
      <span className="eyebrow">Resumen</span>
      <h2
        className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
        id="resumen-pedido"
      >
        Totales del pedido
      </h2>
      <dl className="mt-4 space-y-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Subtotal</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {orderMoney(order.subtotal, currency)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">
            {orderMoney(order.total, currency)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
          <dt className="text-muted">Moneda</dt>
          <dd>
            <CurrencyChip currency={currency} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Líneas</dt>
          <dd className="tabular-nums text-ink">
            {formatInteger(order.itemsCount)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Término de pago</dt>
          <dd className="mt-1 font-semibold text-ink">
            {paymentTermLabel(order.paymentTerm)}
          </dd>
          <dd className="mt-0.5 text-[12px] text-muted">
            {paymentTermDetail(order.paymentTerm)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Fecha de creación</dt>
          <dd className="mt-1 tabular-nums text-ink">
            {order.createdAt ? formatDateTime(order.createdAt) : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function OrderDetailContent({ orderId }: { orderId: string }) {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const canWrite = canWriteModule(user.role, "pedidos");
  const loader = useCallback(() => fetchOrder(orderId), [orderId]);
  const resource = useAsyncResource(loader);
  const statusesResource = useAsyncResource(fetchOrderStatuses);
  const statuses = statusesResource.data ?? [];

  if (resource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/pedidos"
            >
              Volver a pedidos
            </Link>
          }
          description="Consulta el cliente, las líneas, el término de pago y el historial del pedido."
          eyebrow="Operación"
          title="Detalle del pedido"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (resource.status === "error" || !resource.data) {
    const notFound = resource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/pedidos"
        backLabel="Volver a pedidos"
        description={
          notFound
            ? ORDER_COPY.orderNotFound
            : resource.error?.message ?? "No pudimos cargar el pedido."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={
          notFound ? "No encontramos este pedido" : "No pudimos cargar el pedido"
        }
      />
    );
  }

  const order = resource.data;
  const currency: OrderDisplayCurrency | null =
    order.currency ?? currencyStatus?.defaultCurrency ?? null;
  const customer = order.customer;
  const latitude = customer?.latitude ?? null;
  const longitude = customer?.longitude ?? null;
  const hasCoordinates = latitude !== null && longitude !== null;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <RecordsPageHeader
        actions={
          <>
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/pedidos"
            >
              Volver a pedidos
            </Link>
            {canWrite && (
              <Link
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href="/app/pedidos/nuevo"
              >
                Nuevo pedido
                <Icon name="arrow-right" size={17} />
              </Link>
            )}
          </>
        }
        description="Detalle interno del pedido con cliente, líneas, término de pago, totales e historial."
        eyebrow="Operación"
        title={orderNumberLabel(order.number)}
      >
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} statuses={statuses} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
            <Icon name="user" size={14} />
            {customer?.fullName ?? `Cliente #${order.customerId ?? "—"}`}
          </span>
        </div>
      </RecordsPageHeader>

      {statusesResource.status === "error" && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={statusesResource.reload}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos cargar el catálogo de estados. Mostramos las etiquetas base
          y algunas acciones pueden no estar disponibles hasta reintentar.
        </NoticeBanner>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section
            aria-labelledby="cliente-pedido"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="eyebrow">Cliente</span>
                <h2
                  className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
                  id="cliente-pedido"
                >
                  Datos del cliente
                </h2>
              </div>
              {order.customerId !== null && (
                <Link
                  className="inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  href={`/app/clientes/${order.customerId}`}
                >
                  Ver ficha del cliente
                  <Icon name="arrow-up-right" size={14} />
                </Link>
              )}
            </div>

            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Nombre completo
                </dt>
                <dd className="mt-1.5 text-[14px] font-semibold text-ink">
                  {customer?.fullName ?? `Cliente #${order.customerId ?? "—"}`}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Correo
                </dt>
                <dd className="mt-1.5 break-all text-[14px] text-ink">
                  {customer?.email || "No registrado"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Identificador
                </dt>
                <dd className="mt-1.5 font-mono text-[13px] text-ink">
                  #{order.customerId ?? "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Dirección del cliente
                </dt>
                <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
                  {customer?.direction || "No registrada"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Ubicación
                </dt>
                <dd className="mt-1.5 text-[14px] text-ink">
                  {hasCoordinates ? (
                    <span className="font-mono text-[13px]">
                      Lat. {formatCoordinate(latitude)} · Lon.{" "}
                      {formatCoordinate(longitude)}
                    </span>
                  ) : (
                    "Sin ubicación registrada"
                  )}
                </dd>
              </div>
            </dl>

            <dl className="mt-6 grid gap-5 border-t border-line pt-5 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Dirección de entrega
                </dt>
                <dd className="mt-1.5 whitespace-pre-line text-[13px] leading-6 text-ink">
                  {order.deliveryAddress || "Sin dirección de entrega registrada."}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Notas del pedido
                </dt>
                <dd className="mt-1.5 whitespace-pre-line text-[13px] leading-6 text-ink">
                  {order.notes || "Sin notas registradas."}
                </dd>
              </div>
            </dl>

            <p className="mt-5 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
              Este detalle no expone lotes, reservas, costos, bodegas ni notas
              internas. La reserva de existencia se gestiona al generar el
              pedido y el stock se descuenta al facturar.
            </p>
          </section>

          <OrderLinesSection
            canWrite={canWrite}
            currency={currency}
            onReload={resource.reload}
            order={order}
            statuses={statuses}
          />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:h-fit">
          <OrderTotalsCard currency={currency} order={order} />
          <OrderActionsSection
            canWrite={canWrite}
            currency={currency}
            onReload={resource.reload}
            order={order}
            statuses={statuses}
          />
          <OrderHistory order={order} statuses={statuses} />
        </aside>
      </div>

      <p className="sr-only" aria-live="polite">
        {`Pedido ${order.number}, estado ${orderStatusLabel(order.status, statuses)}, total ${orderMoney(order.total, currency)}.`}
      </p>
    </div>
  );
}
