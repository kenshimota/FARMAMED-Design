"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { OrderPickingLines } from "@/components/erp/records/order-picking-lines";
import { OrderPickingSummary } from "@/components/erp/records/order-picking-summary";
import {
  fetchOrderPicking,
  type OrderPicking,
} from "@/components/erp/records/order-picking-api";
import {
  OrderStatusBadge,
  orderStatusLabel,
} from "@/components/erp/records/orders-shared";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
  RecordsTableSkeleton,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { formatDateTime } from "@/lib/format";
import { canReadModule } from "@/lib/permissions";

function roleBackLink(role: string) {
  if (canReadModule(role, "pedidos")) {
    return { href: "/app/pedidos", label: "Volver a pedidos" };
  }
  if (canReadModule(role, "lotes")) {
    return { href: "/app/lotes", label: "Volver a lotes" };
  }
  return { href: "/app", label: "Volver al inicio" };
}

export function OrderPickingPage({ orderId }: { orderId: string }) {
  const { user } = useSession();
  const back = roleBackLink(user.role);

  if (!canReadModule(user.role, "alistamiento")) {
    return (
      <AccessState description="Tu rol no tiene acceso a la lista de alistamiento de pedidos. La vista está disponible para administradores, vendedores, despachadores y gerentes de bodega." />
    );
  }

  if (!isPositiveRecordId(orderId)) {
    return (
      <RecordsLoadError
        backHref={back.href}
        backLabel={back.label}
        description="El identificador del pedido no es válido. Revisa el enlace e intenta de nuevo."
        headingLevel="h1"
        title="Identificador no válido"
      />
    );
  }

  return <OrderPickingContent orderId={orderId} />;
}

function DeliveryData({ picking }: { picking: OrderPicking }) {
  const { order, customer } = picking;
  const customerName = customer?.fullName ?? `Cliente #${order.customerId ?? "—"}`;

  return (
    <section
      aria-labelledby="datos-entrega"
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
    >
      <span className="eyebrow">Entrega</span>
      <h2
        className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
        id="datos-entrega"
      >
        Datos de entrega
      </h2>
      <dl className="mt-4 grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Cliente
          </dt>
          <dd className="mt-1.5 text-[14px] font-semibold text-ink">
            {customerName}
          </dd>
          <dd className="mt-0.5 break-all text-[12px] text-muted">
            {customer?.email || "Correo no registrado"}
          </dd>
        </div>
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
            Dirección del cliente
          </dt>
          <dd className="mt-1.5 whitespace-pre-line text-[13px] leading-6 text-ink">
            {customer?.direction || "Sin dirección registrada."}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Notas del pedido
          </dt>
          <dd className="mt-1.5 whitespace-pre-line text-[13px] leading-6 text-ink">
            {order.notes || "Sin notas registradas."}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Fecha de creación
          </dt>
          <dd className="mt-1.5 text-[13px] tabular-nums text-ink">
            {order.createdAt ? formatDateTime(order.createdAt) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Estado del pedido
          </dt>
          <dd className="mt-1.5">
            <OrderStatusBadge status={order.status} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

function OrderPickingContent({ orderId }: { orderId: string }) {
  const { user } = useSession();
  const canReadOrders = canReadModule(user.role, "pedidos");
  const canReadLots = canReadModule(user.role, "lotes");
  const loader = useCallback(() => fetchOrderPicking(orderId), [orderId]);
  const resource = useAsyncResource(loader);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const focusAfterReload = useRef(false);
  const [printedAt, setPrintedAt] = useState<string | null>(null);
  const [printHint, setPrintHint] = useState<string | null>(null);

  useEffect(() => {
    if (!focusAfterReload.current) return;
    if (resource.status === "ready" || resource.status === "error") {
      focusAfterReload.current = false;
      refreshRef.current?.focus();
    }
  }, [resource.status]);

  useEffect(() => {
    function handleBeforePrint() {
      flushSync(() => {
        setPrintedAt(formatDateTime(new Date()));
      });
    }
    window.addEventListener("beforeprint", handleBeforePrint);
    return () => window.removeEventListener("beforeprint", handleBeforePrint);
  }, []);

  function handleRefresh() {
    focusAfterReload.current = true;
    resource.reload();
  }

  function handlePrint() {
    if (typeof window.print !== "function") {
      setPrintHint(
        "Este navegador no ofrece impresión directa. Puedes guardar la página como PDF desde el menú del navegador.",
      );
      return;
    }
    setPrintHint(null);
    try {
      flushSync(() => {
        setPrintedAt(formatDateTime(new Date()));
      });
      window.print();
    } catch {
      setPrintHint(
        "No pudimos abrir la impresión. Puedes guardar esta página como PDF desde el menú del navegador.",
      );
    }
  }

  if (resource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href={roleBackLink(user.role).href}
            >
              {roleBackLink(user.role).label}
            </Link>
          }
          description="Lista de alistamiento con lotes, cantidades y ubicación para preparar el pedido antes de facturar."
          eyebrow="Operación"
          title="Alistamiento del pedido"
        />
        <RecordsDetailSkeleton />
        <RecordsTableSkeleton columns={7} rows={3} label="Cargando lotes a empacar…" />
      </div>
    );
  }

  if (resource.status === "error" && !resource.data) {
    const kind = resource.error?.kind;
    const back = roleBackLink(user.role);

    if (kind === "not-found") {
      return (
        <RecordsLoadError
          backHref={back.href}
          backLabel={back.label}
          description="Puede que haya sido eliminado o que el enlace no sea válido."
          headingLevel="h1"
          title="No encontramos este pedido"
        />
      );
    }

    if (kind === "forbidden" || kind === "blocked") {
      return (
        <RecordsLoadError
          backHref={back.href}
          backLabel={back.label}
          description="Tu rol no tiene acceso a la lista de alistamiento de este pedido."
          headingLevel="h1"
          title="Sin permisos"
        />
      );
    }

    if (kind === "validation" || kind === "bad-request") {
      return (
        <RecordsLoadError
          backHref={back.href}
          backLabel={back.label}
          description="El identificador del pedido no es válido. Revisa el enlace e intenta de nuevo."
          headingLevel="h1"
          title="Identificador no válido"
        />
      );
    }

    return (
      <RecordsLoadError
        backHref={back.href}
        backLabel={back.label}
        description={
          resource.error?.message ??
          "No pudimos cargar la lista de alistamiento. Revisa tu conexión e intenta de nuevo."
        }
        headingLevel="h1"
        onRetry={resource.reload}
        title="No pudimos cargar la lista de alistamiento"
      />
    );
  }

  const picking = resource.data;
  if (!picking) return null;

  const { order, summary, items } = picking;
  const refreshError = resource.status === "error" && resource.data !== null;

  return (
    <div
      aria-busy={resource.status === "refreshing" || undefined}
      className={`picking-print-sheet space-y-5 pb-6 ${
        canReadLots ? "picking-print-with-actions" : ""
      }`}
    >
      <div className="print:hidden">
        <RecordsPageHeader
          actions={
            <>
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={
                  canReadOrders
                    ? `/app/pedidos/${order.id}`
                    : roleBackLink(user.role).href
                }
              >
                {canReadOrders ? "Volver al pedido" : roleBackLink(user.role).label}
              </Link>
              <button
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                disabled={resource.status === "refreshing"}
                onClick={handleRefresh}
                ref={refreshRef}
                type="button"
              >
                Actualizar
              </button>
              <button
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                onClick={handlePrint}
                type="button"
              >
                Imprimir lista
                <Icon name="clipboard" size={16} />
              </button>
            </>
          }
          description="Lista de alistamiento con lotes, cantidades y ubicación para preparar el pedido antes de facturar."
          eyebrow="Operación"
          title={`Alistamiento del pedido #${order.number}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <OrderStatusBadge status={order.status} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
              <Icon name="user" size={14} />
              {picking.customer?.fullName ?? `Cliente #${order.customerId ?? "—"}`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
              <Icon name="eye" size={14} />
              Solo lectura
            </span>
          </div>
        </RecordsPageHeader>
      </div>

      <section aria-hidden="true" className="hidden print:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-brand">
          Farmamed · Operación
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">
          Alistamiento del pedido #{order.number}
        </p>
        <p className="mt-1 text-[12px] leading-5 text-muted">
          {`Estado: ${orderStatusLabel(order.status)}`}
          {printedAt ? ` · Impreso: ${printedAt}` : ""}
        </p>
      </section>

      {resource.status === "refreshing" && (
        <div aria-hidden="true" className="reload-bar print:hidden" />
      )}

      <p aria-live="polite" className="sr-only" role="status">
        {resource.status === "refreshing"
          ? "Actualizando la lista de alistamiento."
          : refreshError
            ? "No pudimos actualizar la lista de alistamiento. Mostramos la última información disponible."
            : `Lista de alistamiento del pedido ${order.number} cargada.`}
      </p>

      {printHint && (
        <NoticeBanner className="print:hidden" role="status" tone="info">
          {printHint}
        </NoticeBanner>
      )}

      {refreshError && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 bg-surface px-4 text-[12px] font-semibold text-ink transition-colors hover:border-olive"
              onClick={handleRefresh}
              type="button"
            >
              Reintentar
            </button>
          }
          className="print:hidden"
          role="alert"
          tone="warning"
        >
          No pudimos actualizar la lista. Mostramos la última información
          disponible.
        </NoticeBanner>
      )}

      {order.status === "invoiced" && (
        <NoticeBanner role="status" tone="info">
          Los lotes mostrados ya fueron consumidos por la factura.
        </NoticeBanner>
      )}

      {(order.status === "draft" || order.status === "request") &&
        summary.lotsCount === 0 && (
          <NoticeBanner role="status" tone="info">
            Este pedido todavía no tiene lotes reservados. Se asignan al
            generarlo.
          </NoticeBanner>
        )}

      <DeliveryData picking={picking} />

      <OrderPickingSummary
        items={items}
        status={order.status}
        summary={summary}
      />

      <OrderPickingLines
        canReadLots={canReadLots}
        items={items}
        orderNumber={order.number}
        status={order.status}
      />

      <NoticeBanner role="note" tone="info">
        Esta lista no descuenta inventario. La facturación consume la reserva
        existente.
      </NoticeBanner>

      <p className="text-[12px] leading-5 text-muted">
        Vista de solo lectura: no modifica pedidos, lotes, reservas, stock ni el
        estado del pedido.
      </p>
    </div>
  );
}
