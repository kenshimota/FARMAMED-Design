"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { CustomerIncompleteContent } from "@/components/erp/customer-incomplete";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsDetailSkeleton, RecordsLoadError } from "@/components/erp/records/record-states";
import {
  fetchOrder,
  fetchOrderStatuses,
  updateOrderStatus,
  type OrderHistoryEvent,
  type OrderItem,
  type OrderRecord,
  type OrderStatusRecord,
} from "@/components/erp/records/orders-api";
import {
  OrderStatusBadge,
  orderMoney,
  orderNumberLabel,
  orderStatusLabel,
} from "@/components/erp/records/orders-shared";
import { OrderDocumentActions } from "@/components/erp/records/document-actions";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { getCustomerAccessIssue } from "@/lib/customer";
import { formatDateTime, formatInteger } from "@/lib/format";
import {
  buildLoginUrl,
  clearStoredToken,
  getCurrentReturnPath,
} from "@/lib/session";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; order: OrderRecord }
  | { status: "error"; error: unknown };

type StatusesState =
  | { status: "loading" }
  | { status: "ready"; statuses: OrderStatusRecord[] }
  | { status: "error"; error: unknown };

type DialogKind = "send" | "cancel" | null;

type ErrorCopy = {
  title: string;
  description: string;
  canRetry: boolean;
};

type MisPedidoDetailPageProps = {
  params: Promise<{ id: string }>;
};

const EVENT_LABELS: Record<string, string> = {
  created: "Pedido creado",
  item_added: "Producto agregado",
  item_updated: "Cantidad actualizada",
  item_removed: "Producto retirado",
  status_changed: "Cambio de estado",
  invoice_issued: "Factura emitida",
};

const METADATA_LABELS: Record<string, string> = {
  invoice_number: "Factura",
  quantity: "Cantidad",
};

const SENSITIVE_METADATA_KEY =
  /(actor|user|usuario|lot|lote|cost|costo|warehouse|bodega|stock|allocation|reserv|internal|nota|note|reason|seller|dispatcher|manager|email|username)/i;

function redirectToLogin(notice: "expirada" | "bloqueada") {
  clearStoredToken();
  window.location.replace(buildLoginUrl(getCurrentReturnPath(), notice));
}

function detailErrorCopy(error: unknown): ErrorCopy {
  if (error instanceof ApiError) {
    if (error.isUserBlocked()) {
      return {
        title: "Tu cuenta está bloqueada.",
        description: "Contacta al administrador para revisar tu acceso.",
        canRetry: false,
      };
    }

    if (error.status === 401) {
      return {
        title: "Tu sesión expiró.",
        description: "Inicia sesión de nuevo para consultar tus pedidos.",
        canRetry: false,
      };
    }

    if (error.status === 403) {
      return {
        title: "No pudimos acceder a este pedido.",
        description:
          "Tu cuenta no tiene acceso a esta sección. Contacta al administrador para revisar el vínculo del cliente.",
        canRetry: false,
      };
    }

    if (error.status === 404) {
      return {
        title: "No encontramos ese pedido.",
        description:
          "Puede que no exista o que no pertenezca a tu cuenta. Vuelve a tus pedidos para continuar.",
        canRetry: false,
      };
    }

    if (error.status === 422) {
      return {
        title: "No encontramos ese pedido.",
        description:
          "El pedido solicitado no es válido. Vuelve a tus pedidos para continuar.",
        canRetry: false,
      };
    }

    if (error.status === 503) {
      return {
        title: "No podemos cargar tu pedido en este momento.",
        description:
          "El servicio de pedidos no está disponible. Intenta de nuevo en unos minutos.",
        canRetry: true,
      };
    }
  }

  const translated = translateApiError(error);
  return {
    title: "No pudimos cargar el pedido.",
    description: translated.message,
    canRetry: true,
  };
}

function actionErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Tu sesión expiró. Inicia sesión de nuevo para continuar.";
    }

    if (error.status === 403) {
      const issue = getCustomerAccessIssue(error);
      if (issue === "vinculo") {
        return "Tu cuenta no está vinculada a un cliente. Contacta al administrador.";
      }
      if (issue === "lista") {
        return "Tu cuenta no tiene una lista de precios asignada. Contacta al administrador.";
      }
      return "Tu cuenta no tiene permiso para cambiar este pedido.";
    }

    if (error.status === 404) {
      return "No encontramos ese pedido.";
    }

    if (error.status === 409 || error.status === 422) {
      const message = error.message.toLowerCase();
      if (message.includes("payment term")) {
        return "Este pedido necesita un término de pago activo antes de enviarse. Contacta a tu vendedor.";
      }
      if (message.includes("no items") || message.includes("al menos una línea")) {
        return "El pedido debe tener al menos un producto antes de enviarse.";
      }
      return "Ese cambio de estado no está permitido para este pedido. Actualizamos el detalle para que revises su estado actual.";
    }

    if (error.status === 503) {
      return "No podemos procesar tu pedido en este momento. Intenta de nuevo en unos minutos.";
    }
  }

  return translateApiError(error).message;
}

function eventTypeLabel(eventType: string) {
  return EVENT_LABELS[eventType] ?? "Actualización del pedido";
}

function transitionLabel(
  event: OrderHistoryEvent,
  statuses: readonly OrderStatusRecord[],
) {
  const from = event.fromStatus
    ? orderStatusLabel(event.fromStatus, statuses)
    : null;
  const to = event.toStatus ? orderStatusLabel(event.toStatus, statuses) : null;

  if (from && to) return `De ${from} a ${to}`;
  if (to) return `Estado: ${to}`;
  return null;
}

function findOrderItem(
  order: OrderRecord,
  metadata: Record<string, unknown>,
  field: "product_id" | "item_state_id",
) {
  const expected = metadata[field];
  if (expected === undefined || expected === null) return null;
  return (
    order.items?.find((item) =>
      field === "product_id"
        ? String(item.productId) === String(expected)
        : String(item.itemStateId) === String(expected),
    ) ?? null
  );
}

function metadataEntries(order: OrderRecord, event: OrderHistoryEvent) {
  const metadata = event.metadata;
  if (!metadata) return [];

  const used = new Set<string>();
  const entries: { label: string; value: string }[] = [];

  const invoiceNumber = metadata.invoice_number;
  if (invoiceNumber !== undefined && invoiceNumber !== null) {
    used.add("invoice_number");
    entries.push({ label: "Factura", value: `#${String(invoiceNumber)}` });
  }

  const item = findOrderItem(order, metadata, "product_id");
  if (item?.product?.name) {
    used.add("product_id");
    entries.push({ label: "Producto", value: item.product.name });
  }

  const itemState = findOrderItem(order, metadata, "item_state_id");
  if (itemState?.itemState?.label) {
    used.add("item_state_id");
    entries.push({ label: "Estado", value: itemState.itemState.label });
  }

  const quantity = metadata.quantity;
  if (quantity !== undefined && quantity !== null) {
    used.add("quantity");
    entries.push({ label: "Cantidad", value: String(quantity) });
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (used.has(key) || key.endsWith("_id") || SENSITIVE_METADATA_KEY.test(key)) {
      continue;
    }
    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      continue;
    }
    entries.push({
      label: METADATA_LABELS[key] ?? key.replaceAll("_", " "),
      value: String(value),
    });
  }

  return entries;
}

function paymentTermLabel(term: OrderRecord["paymentTerm"]) {
  if (!term) return "Sin término de pago";
  if (term.days === 0) return `${term.name} · Pago de contado`;
  return `${term.name} · ${term.days} ${
    term.days === 1 ? "día" : "días"
  } de crédito`;
}

function productName(item: OrderItem) {
  return item.product?.name || "Producto no disponible";
}

function itemStateName(item: OrderItem) {
  return item.itemState?.label || "Estado no disponible";
}

function OrderHistorySection({
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
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
    >
      <span className="eyebrow">Seguimiento</span>
      <h2
        className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
        id="historial-pedido"
      >
        Historial del pedido
      </h2>
      <p className="mt-3 text-[13px] leading-6 text-muted">
        Solo se muestran los eventos del pedido visibles para tu cuenta.
      </p>

      {history.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-line bg-background px-4 py-4 text-[13px] leading-6 text-muted">
          No hay eventos registrados para este pedido.
        </p>
      ) : (
        <ol className="mt-5 space-y-5">
          {history.map((event, index) => {
            const transition = transitionLabel(event, statuses);
            const meta = metadataEntries(order, event);

            return (
              <li
                className="flex gap-3"
                key={`${String(event.id ?? event.eventType)}-${index}`}
              >
                <span
                  aria-hidden="true"
                  className="mt-1.5 flex h-2.5 w-2.5 shrink-0 rounded-full border border-brand/40 bg-soft-blue"
                />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-5 text-ink">
                    {eventTypeLabel(event.eventType)}
                  </p>
                  {transition && (
                    <p className="mt-0.5 text-[12px] leading-5 text-ink">
                      {transition}
                    </p>
                  )}
                  {meta.length > 0 && (
                    <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-5">
                      {meta.map((entry, entryIndex) => (
                        <div
                          className="flex gap-1"
                          key={`${entry.label}-${entryIndex}`}
                        >
                          <dt className="text-muted">{entry.label}:</dt>
                          <dd className="text-ink">{entry.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <p className="mt-1 text-[11px] leading-5 text-muted">
                    {event.createdAt ? (
                      <time dateTime={event.createdAt}>
                        {formatDateTime(event.createdAt)}
                      </time>
                    ) : (
                      "Sin fecha registrada"
                    )}
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

export default function MisPedidoDetailPage({
  params,
}: MisPedidoDetailPageProps) {
  const { user } = useSession();
  const { id } = use(params);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [statusesState, setStatusesState] = useState<StatusesState>({
    status: "loading",
  });
  const [attempt, setAttempt] = useState(0);
  const [statusesAttempt, setStatusesAttempt] = useState(0);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (user.role !== "customer") return;
    let active = true;

    async function loadOrder() {
      try {
        const order = await fetchOrder(id);
        if (active) setState({ status: "ready", order });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          redirectToLogin("expirada");
          return;
        }
        if (error instanceof ApiError && error.isUserBlocked()) {
          redirectToLogin("bloqueada");
          return;
        }
        setState({ status: "error", error });
      }
    }

    void loadOrder();
    return () => {
      active = false;
    };
  }, [attempt, id, user.role]);

  useEffect(() => {
    if (user.role !== "customer") return;
    let active = true;

    async function loadStatuses() {
      try {
        const statuses = await fetchOrderStatuses();
        if (active) setStatusesState({ status: "ready", statuses });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          redirectToLogin("expirada");
          return;
        }
        if (error instanceof ApiError && error.isUserBlocked()) {
          redirectToLogin("bloqueada");
          return;
        }
        setStatusesState({ status: "error", error });
      }
    }

    void loadStatuses();
    return () => {
      active = false;
    };
  }, [statusesAttempt, user.role]);

  async function refreshOrder() {
    try {
      const fresh = await fetchOrder(id);
      setState({ status: "ready", order: fresh });
      return fresh;
    } catch {
      // El detalle actual permanece visible si la actualización falla.
      return null;
    }
  }

  async function runStatus(
    order: OrderRecord,
    statuses: readonly OrderStatusRecord[],
    target: "request" | "cancelled",
  ) {
    setActionError(null);
    try {
      const result = await updateOrderStatus(order.id, target);
      const fresh = await refreshOrder();
      const updated = fresh ?? result.order;
      setState({ status: "ready", order: updated });
      const statusLabel = orderStatusLabel(updated.status, statuses);
      setAnnouncement(
        target === "cancelled"
          ? `Pedido ${order.number} cancelado. Su estado ahora es ${statusLabel}.`
          : `Pedido ${order.number} enviado. Su estado ahora es ${statusLabel}.`,
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirectToLogin("expirada");
        return;
      }
      if (error instanceof ApiError && error.isUserBlocked()) {
        redirectToLogin("bloqueada");
        return;
      }
      setActionError(actionErrorMessage(error));
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.status === 422)
      ) {
        void refreshOrder();
      }
    }
  }

  function retry() {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  function retryStatuses() {
    setStatusesState({ status: "loading" });
    setStatusesAttempt((current) => current + 1);
  }

  if (user.role !== "customer") {
    return (
      <AccessState description="Esta sección pertenece al portal del cliente. Usa la navegación del ERP para continuar." />
    );
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-5">
        <h1 className="sr-only">Detalle del pedido</h1>
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/mis-pedidos"
        >
          Volver a mis pedidos
        </Link>
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (state.status === "error") {
    const issue = getCustomerAccessIssue(state.error);
    if (issue) return <CustomerIncompleteContent reason={issue} />;

    const copy = detailErrorCopy(state.error);
    return (
      <RecordsLoadError
        backHref="/app/mis-pedidos"
        backLabel="Volver a mis pedidos"
        description={copy.description}
        headingLevel="h1"
        onRetry={copy.canRetry ? retry : undefined}
        title={copy.title}
      />
    );
  }

  const order = state.order;
  const statuses =
    statusesState.status === "ready" ? statusesState.statuses : [];
  const isDraft = order.status === "draft";
  const canCancel = isDraft || order.status === "request";
  const invoiceLabel =
    order.invoice?.number !== null && order.invoice?.number !== undefined
      ? `Factura #${String(order.invoice.number)}`
      : order.invoice?.id !== null && order.invoice?.id !== undefined
        ? "Factura registrada"
        : null;
  const items = order.items ?? [];

  return (
    <div className="space-y-5">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/mis-pedidos"
          >
            Volver a mis pedidos
          </Link>
        }
        description={
          order.createdAt
            ? `Realizado el ${formatDateTime(order.createdAt)}.`
            : "Consulta el detalle de tu pedido."
        }
        eyebrow="Mis pedidos"
        title={orderNumberLabel(order.number)}
      >
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} statuses={statuses} />
          <span className="text-[13px] font-semibold text-ink">
            Total {orderMoney(order.total, order.currency)}
          </span>
        </div>
      </RecordsPageHeader>

      {statusesState.status === "error" && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={retryStatuses}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos cargar el catálogo de estados. Mostramos los estados
          conocidos hasta que el servicio se recupere.
        </NoticeBanner>
      )}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section
            aria-labelledby="productos-pedido"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <span className="eyebrow">Detalle</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="productos-pedido"
            >
              Productos del pedido
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-muted">
              Producto, estado, cantidad, precio unitario y subtotal de cada
              línea.
            </p>

            {items.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-line bg-background px-4 py-4 text-[13px] leading-6 text-muted">
                Este pedido no tiene líneas registradas.
              </p>
            ) : (
              <ul aria-label="Líneas del pedido" className="mt-5 space-y-3">
                {items.map((item) => (
                  <li
                    className="rounded-2xl border border-line bg-background p-4"
                    key={String(item.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-ink">
                          {productName(item)}
                        </p>
                        <p className="mt-1 text-[12px] leading-5 text-muted">
                          {itemStateName(item)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                          Subtotal
                        </p>
                        <p className="mt-1 text-[14px] font-semibold tabular-nums text-ink">
                          {orderMoney(item.subtotal, order.currency)}
                        </p>
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[12px]">
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                          Cantidad
                        </dt>
                        <dd className="mt-1 tabular-nums text-ink">
                          {formatInteger(item.quantity)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                          Precio unitario
                        </dt>
                        <dd className="mt-1 tabular-nums text-ink">
                          {orderMoney(item.unitPrice, order.currency)}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <OrderHistorySection order={order} statuses={statuses} />
        </div>

        <aside className="space-y-5">
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
                  {orderMoney(order.subtotal, order.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="text-lg font-semibold tabular-nums text-ink">
                  {orderMoney(order.total, order.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="text-muted">Moneda</dt>
                <dd className="text-ink">{order.currency?.code ?? "—"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
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
              </div>
              <div>
                <dt className="text-muted">Fecha del pedido</dt>
                <dd className="mt-1 tabular-nums text-ink">
                  {order.createdAt ? formatDateTime(order.createdAt) : "—"}
                </dd>
              </div>
            </dl>

            {order.notes && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Notas de tu pedido
                </p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink">
                  {order.notes}
                </p>
              </div>
            )}

            {order.deliveryAddress && (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Dirección de entrega
                </p>
                <p className="mt-1 whitespace-pre-line text-[13px] leading-6 text-ink">
                  {order.deliveryAddress}
                </p>
              </div>
            )}

            {invoiceLabel ? (
              <div className="mt-4 rounded-xl border border-olive/30 bg-soft-lime px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Factura
                </p>
                <p className="mt-1 text-[14px] font-semibold text-ink">
                  {invoiceLabel}
                </p>
                {order.invoice?.id !== null &&
                  order.invoice?.id !== undefined && (
                    <Link
                      className="mt-2 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                      href={`/app/facturas/${order.invoice.id}`}
                    >
                      Ver factura
                      <Icon name="arrow-up-right" size={14} />
                    </Link>
                  )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-line bg-background px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Factura
                </p>
                <p className="mt-1 text-[13px] leading-6 text-muted">
                  Todavía no tiene factura.
                </p>
              </div>
            )}
          </section>

          <section
            aria-labelledby="acciones-pedido"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
          >
            <span className="eyebrow">Acciones</span>
            <h2
              className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
              id="acciones-pedido"
            >
              Acciones del pedido
            </h2>

            {actionError && (
              <NoticeBanner className="mt-4" role="alert" tone="danger">
                {actionError}
              </NoticeBanner>
            )}

            <OrderDocumentActions
              className="mt-4"
              onReload={() => {
                void refreshOrder();
              }}
              order={order}
            />

            {(isDraft || canCancel) && (
              <div className="mt-5 flex flex-col gap-3">
                {isDraft && (
                  <Link
                    className="button-base button-secondary min-h-11 px-5 text-[13px]"
                    href={`/app/mis-pedidos/${order.id}/editar`}
                  >
                    Editar borrador
                    <Icon name="arrow-right" size={16} />
                  </Link>
                )}
                {isDraft && (
                  <button
                    className="button-base button-primary min-h-11 px-5 text-[13px]"
                    onClick={() => {
                      setActionError(null);
                      setDialog("send");
                    }}
                    type="button"
                  >
                    Enviar pedido
                    <Icon name="check" size={16} />
                  </button>
                )}
                {canCancel && (
                  <button
                    className="button-base min-h-11 border border-alert/35 bg-surface px-5 text-[13px] text-alert-ink hover:border-alert hover:bg-alert/[0.06]"
                    onClick={() => {
                      setActionError(null);
                      setDialog("cancel");
                    }}
                    type="button"
                  >
                    Cancelar pedido
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
            )}

            {!isDraft &&
              !canCancel &&
              order.status !== "generate" &&
              order.status !== "invoiced" &&
              order.status !== "cancelled" && (
                <p className="mt-4 rounded-2xl border border-line bg-background px-4 py-3 text-[13px] leading-6 text-muted">
                  Este pedido está en estado{" "}
                  <span className="font-semibold text-ink">
                    {orderStatusLabel(order.status, statuses)}
                  </span>{" "}
                  y solo admite consulta.
                </p>
              )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        confirmBusyLabel="Enviando…"
        confirmLabel="Enviar pedido"
        description={
          <p>
            Enviarás el borrador como solicitud. Después no podrás editar sus
            líneas. Esta acción no se puede deshacer.
          </p>
        }
        onClose={() => setDialog(null)}
        onConfirm={() => runStatus(order, statuses, "request")}
        onError={(error) => setActionError(error.message)}
        open={dialog === "send"}
        title={`¿Enviar el pedido #${order.number}?`}
      />

      <ConfirmDialog
        confirmBusyLabel="Cancelando…"
        confirmLabel="Cancelar pedido"
        description={
          <p>
            Pedido #{order.number}. Esta acción no se puede deshacer.
          </p>
        }
        onClose={() => setDialog(null)}
        onConfirm={() => runStatus(order, statuses, "cancelled")}
        onError={(error) => setActionError(error.message)}
        open={dialog === "cancel"}
        title="¿Cancelar este pedido?"
      />
    </div>
  );
}
