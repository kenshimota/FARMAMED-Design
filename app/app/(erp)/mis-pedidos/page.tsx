"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { use, useEffect, useId, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { CustomerIncompleteContent } from "@/components/erp/customer-incomplete";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { SelectField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsLoadError, RecordsTableSkeleton } from "@/components/erp/records/record-states";
import {
  fetchOrders,
  fetchOrderStatuses,
  type OrderRecord,
  type OrderStatusRecord,
} from "@/components/erp/records/orders-api";
import {
  OrderStatusBadge,
  orderCountLabel,
  orderMoney,
  orderNumberLabel,
} from "@/components/erp/records/orders-shared";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { getCustomerAccessIssue } from "@/lib/customer";
import { formatDateTime, formatInteger } from "@/lib/format";
import {
  buildLoginUrl,
  clearStoredToken,
  getCurrentReturnPath,
} from "@/lib/session";

type OrdersState =
  | { status: "loading" }
  | { status: "ready"; orders: OrderRecord[] }
  | { status: "error"; error: unknown };

type StatusesState =
  | { status: "loading" }
  | { status: "ready"; statuses: OrderStatusRecord[] }
  | { status: "error"; error: unknown };

type ErrorCopy = {
  title: string;
  description: string;
  canRetry: boolean;
};

type MisPedidosPageProps = {
  searchParams: Promise<{ status?: string | string[] }>;
};

const STATUS_PATTERN = /^[a-z][a-z0-9_]{1,19}$/;

function readStatusFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = raw?.trim().toLowerCase() ?? "";
  return STATUS_PATTERN.test(normalized) ? normalized : "";
}

function redirectToLogin(notice: "expirada" | "bloqueada") {
  clearStoredToken();
  window.location.replace(buildLoginUrl(getCurrentReturnPath(), notice));
}

function listErrorCopy(error: unknown): ErrorCopy {
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
        title: "No pudimos acceder a tus pedidos.",
        description:
          "Tu cuenta no tiene acceso a esta sección. Contacta al administrador para revisar el vínculo del cliente.",
        canRetry: false,
      };
    }

    if (error.status === 422) {
      return {
        title: "No pudimos aplicar el filtro.",
        description:
          "El estado seleccionado no es válido. Vuelve a todos los estados para continuar.",
        canRetry: false,
      };
    }

    if (error.status === 503) {
      return {
        title: "No podemos cargar tus pedidos en este momento.",
        description:
          "El servicio de pedidos no está disponible. Intenta de nuevo en unos minutos.",
        canRetry: true,
      };
    }
  }

  const translated = translateApiError(error);
  return {
    title: "No pudimos cargar tus pedidos.",
    description: translated.message,
    canRetry: true,
  };
}

function DisabledStoreAction() {
  const hintId = useId();

  return (
    <div>
      <button
        aria-describedby={hintId}
        className="button-base button-secondary cursor-not-allowed opacity-70"
        disabled
        type="button"
      >
        Ver la tienda
        <Icon name="arrow-right" size={17} />
      </button>
      <p
        className="mt-2 max-w-xs text-center text-[11px] font-medium leading-5 text-muted sm:text-left"
        id={hintId}
      >
        Disponible cuando el catálogo esté habilitado.
      </p>
    </div>
  );
}

export default function MisPedidosPage({ searchParams }: MisPedidosPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const params = use(searchParams);
  const statusFilter = readStatusFilter(params.status);
  const [ordersState, setOrdersState] = useState<OrdersState>({
    status: "loading",
  });
  const [statusesState, setStatusesState] = useState<StatusesState>({
    status: "loading",
  });
  const [ordersAttempt, setOrdersAttempt] = useState(0);
  const [statusesAttempt, setStatusesAttempt] = useState(0);

  useEffect(() => {
    if (user.role !== "customer") return;
    let active = true;

    async function loadOrders() {
      try {
        const orders = await fetchOrders({
          status: statusFilter || undefined,
        });
        if (active) setOrdersState({ status: "ready", orders });
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
        setOrdersState({ status: "error", error });
      }
    }

    void loadOrders();
    return () => {
      active = false;
    };
  }, [ordersAttempt, statusFilter, user.role]);

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

  function handleStatusChange(value: string) {
    if (value === statusFilter) return;
    setOrdersState({ status: "loading" });
    const query = value ? `?status=${encodeURIComponent(value)}` : "";
    router.replace(`${pathname}${query}`, { scroll: false });
  }

  function retryOrders() {
    setOrdersState({ status: "loading" });
    setOrdersAttempt((current) => current + 1);
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

  if (ordersState.status === "error") {
    const issue = getCustomerAccessIssue(ordersState.error);
    if (issue) return <CustomerIncompleteContent reason={issue} />;

    const copy = listErrorCopy(ordersState.error);
    const filterError =
      ordersState.error instanceof ApiError && ordersState.error.status === 422;
    return (
      <RecordsLoadError
        backHref={filterError ? "/app/mis-pedidos" : "/app"}
        backLabel={filterError ? "Ver todos los estados" : "Volver al inicio"}
        description={copy.description}
        headingLevel="h1"
        onRetry={copy.canRetry ? retryOrders : undefined}
        title={copy.title}
      />
    );
  }

  const orders = ordersState.status === "ready" ? ordersState.orders : [];
  const statuses =
    statusesState.status === "ready" ? statusesState.statuses : [];
  const statusOptions = statuses.map((status) => ({
    value: status.code,
    label: status.name,
  }));
  const countLabel =
    ordersState.status === "ready"
      ? orderCountLabel(orders.length)
      : "Cargando pedidos…";
  const statusesLoadError =
    statusesState.status === "error"
      ? "No pudimos cargar los estados de pedido."
      : null;

  return (
    <div className="space-y-6">
      <RecordsPageHeader
        description="Consulta tus pedidos, revisa su estado y abre el detalle de cada uno. Solo se muestran los pedidos asociados a tu cuenta."
        eyebrow="Portal del cliente"
        title="Mis pedidos"
      />

      <section
        aria-label="Filtros de tus pedidos"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,280px)_1fr] sm:items-end">
          <SelectField
            emptyLabel="No hay estados configurados."
            id="filtro-estado-mis-pedidos"
            label="Estado del pedido"
            loadError={statusesLoadError}
            loading={statusesState.status === "loading"}
            loadingLabel="Cargando estados…"
            onChange={handleStatusChange}
            options={statusOptions}
            placeholder="Todos los estados"
            value={statusFilter}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
            <p
              aria-live="polite"
              className="text-[12px] font-semibold text-muted"
            >
              {countLabel}
            </p>
            {statusFilter && (
              <button
                className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                onClick={() => handleStatusChange("")}
                type="button"
              >
                Ver todos los estados
              </button>
            )}
          </div>
        </div>
      </section>

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
          No pudimos cargar el catálogo de estados. Las etiquetas de los pedidos
          usan los estados conocidos hasta que el servicio se recupere.
        </NoticeBanner>
      )}

      {ordersState.status === "loading" && (
        <RecordsTableSkeleton
          columns={5}
          label="Cargando tus pedidos…"
          rows={4}
        />
      )}

      {ordersState.status === "ready" && orders.length === 0 && (
        <EmptyState
          action={
            statusFilter ? (
              <button
                className="button-base button-secondary min-h-11 px-5"
                onClick={() => handleStatusChange("")}
                type="button"
              >
                Ver todos los estados
              </button>
            ) : (
              <DisabledStoreAction />
            )
          }
          description={
            statusFilter
              ? "No hay pedidos con el estado seleccionado. Prueba con otro filtro."
              : "Cuando realices tu primer pedido, aparecerá aquí."
          }
          headingLevel={2}
          title={
            statusFilter
              ? "No hay pedidos con ese estado."
              : "Aún no tienes pedidos."
          }
        />
      )}

      {ordersState.status === "ready" && orders.length > 0 && (
        <section aria-label="Listado de tus pedidos" className="space-y-3">
          <div className="hidden overflow-x-auto rounded-[24px] border border-line bg-surface p-4 sm:p-5 lg:block">
            <table className="w-full min-w-[780px] border-collapse text-left">
              <caption className="sr-only">
                Tus pedidos con número, fecha, estado, líneas, total, moneda y
                acciones
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th
                    className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Número
                  </th>
                  <th
                    className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Fecha
                  </th>
                  <th
                    className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Estado
                  </th>
                  <th
                    className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Líneas
                  </th>
                  <th
                    className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Total
                  </th>
                  <th
                    className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Moneda
                  </th>
                  <th
                    className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    className="border-b border-line align-middle last:border-b-0"
                    key={String(order.id)}
                  >
                    <td className="whitespace-nowrap py-3.5 pr-4 text-[13px]">
                      <Link
                        className="font-mono font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
                        href={`/app/mis-pedidos/${order.id}`}
                      >
                        {orderNumberLabel(order.number)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4 text-[13px] tabular-nums text-muted">
                      {order.createdAt
                        ? formatDateTime(order.createdAt)
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4 text-[13px]">
                      <OrderStatusBadge
                        status={order.status}
                        statuses={statuses}
                      />
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4 text-[13px] tabular-nums text-ink">
                      {formatInteger(order.itemsCount)}
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4 text-[13px] font-semibold tabular-nums text-ink">
                      {orderMoney(order.total, order.currency)}
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4 text-[13px] text-ink">
                      {order.currency?.code ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-3.5 text-right">
                      <Link
                        aria-label={`Ver detalle del ${orderNumberLabel(order.number)}`}
                        className="button-base button-secondary min-h-11 px-4 text-[12px]"
                        href={`/app/mis-pedidos/${order.id}`}
                      >
                        Ver detalle
                        <Icon name="arrow-right" size={15} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {orders.map((order) => (
              <li
                className="rounded-2xl border border-line bg-surface p-5 shadow-[0_12px_40px_rgba(27,12,104,0.04)] sm:p-6"
                key={String(order.id)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-[-0.025em] text-ink">
                      {orderNumberLabel(order.number)}
                    </h2>
                    <p className="mt-1 text-[12px] leading-5 text-muted">
                      {order.createdAt
                        ? `Realizado el ${formatDateTime(order.createdAt)}`
                        : "Sin fecha registrada"}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status} statuses={statuses} />
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-[12px] sm:grid-cols-3">
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Líneas
                    </dt>
                    <dd className="mt-1 tabular-nums text-ink">
                      {formatInteger(order.itemsCount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Total
                    </dt>
                    <dd className="mt-1 font-semibold tabular-nums text-ink">
                      {orderMoney(order.total, order.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Moneda
                    </dt>
                    <dd className="mt-1 text-ink">
                      {order.currency?.code ?? "—"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 flex justify-end border-t border-line pt-4">
                  <Link
                    aria-label={`Ver detalle del ${orderNumberLabel(order.number)}`}
                    className="button-base button-secondary min-h-11 px-5 text-[13px]"
                    href={`/app/mis-pedidos/${order.id}`}
                  >
                    Ver detalle
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
