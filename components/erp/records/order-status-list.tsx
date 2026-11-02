"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
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
import { OrderStatusChain } from "@/components/erp/records/order-status-chain";
import {
  deleteOrderStatus,
  fetchOrderStatuses,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/components/erp/records/order-statuses-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

const NO_STATUSES: OrderStatus[] = [];

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function statusesLabel(count: number) {
  return count === 1 ? "1 estado" : `${formatInteger(count)} estados`;
}

function statusName(status: OrderStatus) {
  if (status.name && status.name.toLowerCase() !== status.code.toLowerCase()) {
    return status.name;
  }
  return ORDER_STATUS_LABELS[status.code] ?? status.code;
}

function nextStatusLabel(status: OrderStatus, byCode: Map<string, OrderStatus>) {
  if (!status.next_status_code) return "Sin siguiente estado";
  const next = byCode.get(status.next_status_code);
  return next
    ? `${statusName(next)} (${next.code})`
    : status.next_status_code;
}

function SemanticBadge({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active ? "bg-soft-lime text-ink" : "bg-soft-blue text-ink"
      }`}
    >
      <Icon
        className={active ? "text-olive" : "text-brand"}
        name={active ? "check" : "layers"}
        size={13}
      />
      {children}
    </span>
  );
}

export function OrderStatusListPage() {
  const { user } = useSession();
  const canRead = canReadModule(user.role, "pedidos_estados");
  const canWrite = canWriteModule(user.role, "pedidos_estados");

  if (!canRead) {
    return (
      <AccessState description="No tienes permiso para configurar estados de pedido." />
    );
  }

  return <OrderStatusListContent canWrite={canWrite} />;
}

function OrderStatusListContent({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const resource = useAsyncResource(fetchOrderStatuses);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OrderStatus | null>(null);

  const statuses = resource.data ?? NO_STATUSES;
  const byCode = useMemo(
    () => new Map(statuses.map((status) => [status.code, status])),
    [statuses],
  );

  const filteredStatuses = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return statuses;
    return statuses.filter(
      (status) =>
        normalizeSearch(status.code).includes(normalized) ||
        normalizeSearch(status.name).includes(normalized) ||
        normalizeSearch(status.description).includes(normalized),
    );
  }, [query, statuses]);

  const loading = resource.status === "loading" && statuses.length === 0;
  const initialError = resource.status === "error" && statuses.length === 0;
  const refreshError = resource.status === "error" && statuses.length > 0;

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteOrderStatus(deleteTarget.id);
    toast.success("Estado eliminado.");
    resource.reload();
    setDeleteTarget(null);
  }

  function renderActions(status: OrderStatus) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Editar ${status.code}`}
          href={`/app/pedidos/estados/${status.id}/editar`}
          icon="arrow-right"
        >
          Editar
        </RecordActionLink>
        {status.is_system ? (
          <RecordActionButton
            aria-label={`Eliminar ${status.code}, no disponible porque es un estado del sistema`}
            danger
            disabled
            icon="close"
            title="Los estados del sistema no se pueden eliminar."
          >
            Eliminar
          </RecordActionButton>
        ) : (
          <RecordActionButton
            aria-label={`Eliminar ${status.code}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(status)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(status: OrderStatus) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-background px-2 font-mono text-[12px] font-semibold text-ink">
              {status.sort_order}
            </span>
            <span className="text-[15px] font-semibold text-ink">
              {statusName(status)}
            </span>
          </div>
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {status.code}
          </span>
        </div>

        <dl className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Siguiente
            </dt>
            <dd className="text-right text-[13px] text-ink">
              {nextStatusLabel(status, byCode)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Terminal
            </dt>
            <dd>
              <SemanticBadge active={status.is_terminal}>
                {status.is_terminal ? "Terminal" : "Continúa"}
              </SemanticBadge>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Origen
            </dt>
            <dd>
              <SemanticBadge active={status.is_system}>
                {status.is_system ? "Sistema" : "Personalizado"}
              </SemanticBadge>
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Descripción
            </dt>
            <dd className="line-clamp-2 text-right text-[13px] text-muted">
              {status.description || "Sin descripción"}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const columns: RecordsTableColumn<OrderStatus>[] = [
    {
      key: "orden",
      header: "Orden",
      render: (status) => (
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-background px-2 font-mono text-[12px] font-semibold text-ink">
          {status.sort_order}
        </span>
      ),
    },
    {
      key: "codigo",
      header: "Código",
      render: (status) => (
        <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
          {status.code}
        </span>
      ),
    },
    {
      key: "nombre",
      header: "Nombre",
      render: (status) => (
        <div>
          <span className="font-semibold text-ink">{statusName(status)}</span>
          <span className="mt-1 block max-w-[220px] truncate text-[12px] text-muted">
            {status.description || "Sin descripción"}
          </span>
        </div>
      ),
    },
    {
      key: "siguiente",
      header: "Siguiente estado",
      render: (status) => (
        <span className="text-[13px] text-ink">
          {nextStatusLabel(status, byCode)}
        </span>
      ),
    },
    {
      key: "terminal",
      header: "Terminal",
      render: (status) => (
        <SemanticBadge active={status.is_terminal}>
          {status.is_terminal ? "Sí" : "No"}
        </SemanticBadge>
      ),
    },
    {
      key: "sistema",
      header: "Sistema",
      render: (status) => (
        <SemanticBadge active={status.is_system}>
          {status.is_system ? "Sí" : "No"}
        </SemanticBadge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/pedidos/estados/nuevo"
            >
              Nuevo estado
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Configura el orden y la cadena de estados que seguirán los pedidos. Solo un administrador puede crear, editar o eliminar estados."
        eyebrow="Operación"
        title="Estados de pedido"
      />

      {loading && (
        <RecordsTableSkeleton
          columns={7}
          label="Cargando estados de pedido…"
          rows={5}
        />
      )}

      {initialError && (
        <RecordsLoadError
          description={
            resource.error?.status === 403
              ? "No tienes permiso para configurar estados."
              : resource.error?.message ??
                "No pudimos cargar los estados de pedido."
          }
          onRetry={resource.reload}
          title="No pudimos cargar los estados de pedido"
        />
      )}

      {!loading && !initialError && (
        <section aria-label="Listado de estados de pedido" className="space-y-4">
          {resource.status === "refreshing" && (
            <div aria-hidden="true" className="reload-bar" />
          )}

          {refreshError && (
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
              {resource.error?.message ??
                "No pudimos actualizar los estados. Mostramos los datos disponibles."}
            </NoticeBanner>
          )}

          {statuses.length === 0 ? (
            <EmptyState
              action={
                canWrite ? (
                  <Link
                    className="button-base button-primary min-h-11 px-5"
                    href="/app/pedidos/estados/nuevo"
                  >
                    Nuevo estado
                    <Icon name="arrow-right" size={17} />
                  </Link>
                ) : undefined
              }
              description="Crea el primero para empezar."
              title="No hay estados configurados."
            />
          ) : (
            <>
              <OrderStatusChain statuses={statuses} />

              <NoticeBanner tone="info">
                Los estados del sistema se pueden editar, pero no eliminar. Su
                código e indicador de sistema son inmutables.
              </NoticeBanner>

              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <div className="relative w-full sm:max-w-md">
                  <label className="sr-only" htmlFor="buscar-estados-pedido">
                    Buscar estados de pedido
                  </label>
                  <Icon
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    name="search"
                    size={17}
                  />
                  <input
                    className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                    id="buscar-estados-pedido"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por código, nombre o descripción"
                    type="search"
                    value={query}
                  />
                </div>

                <p
                  aria-live="polite"
                  className="mt-4 text-[12px] font-semibold text-muted"
                >
                  {query.trim()
                    ? `Mostrando ${formatInteger(filteredStatuses.length)} de ${statusesLabel(statuses.length)}`
                    : statusesLabel(statuses.length)}
                </p>
              </div>

              {filteredStatuses.length === 0 ? (
                <EmptyState
                  action={
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={() => setQuery("")}
                      type="button"
                    >
                      Limpiar búsqueda
                    </button>
                  }
                  description="No hay estados que coincidan con la búsqueda."
                  title="Sin resultados"
                />
              ) : (
                <RecordsTable
                  caption="Estados de pedido con su orden, código, nombre, siguiente estado, condición terminal, origen y acciones"
                  columns={columns}
                  getRowKey={(status) => String(status.id)}
                  getRowLabel={(status) => status.code}
                  renderCard={renderCard}
                  rowActions={canWrite ? renderActions : undefined}
                  rows={filteredStatuses}
                />
              )}
            </>
          )}
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar estado"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Estado:{" "}
                <span className="font-semibold text-ink">
                  {deleteTarget.code}
                </span>
              </p>
              <p>
                Esta acción es permanente y no se puede deshacer. Un estado en
                uso o un estado del sistema no se puede eliminar.
              </p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={
          deleteTarget
            ? `¿Eliminar el estado ${deleteTarget.code}?`
            : "Eliminar estado"
        }
      />
    </div>
  );
}
