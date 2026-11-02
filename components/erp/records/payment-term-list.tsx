"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
import {
  deletePaymentTerm,
  fetchPaymentTerms,
  paymentTermConditionLabel,
  paymentTermDayCountLabel,
  paymentTermDaysLabel,
  type PaymentTerm,
} from "@/lib/finance/payment-terms-api";
import { formatInteger } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const NO_TERMS: PaymentTerm[] = [];

type StatusFilter = "" | "true" | "false";

function termsLabel(count: number) {
  return count === 1 ? "1 término" : `${formatInteger(count)} términos`;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function TermStatusBadge({ term }: { term: PaymentTerm }) {
  if (!term.is_active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted">
        <Icon name="eye-off" size={13} />
        Inactivo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
      <Icon name="check" size={13} />
      Activo
    </span>
  );
}

export function PaymentTermListPage() {
  const { user } = useSession();
  const canRead = canReadModule(user.role, "terminos_pago");
  const canWrite = canWriteModule(user.role, "terminos_pago");

  if (!canRead) {
    return (
      <AccessState description="No tienes permiso para administrar términos de pago." />
    );
  }

  return <PaymentTermListContent canWrite={canWrite} />;
}

function PaymentTermListContent({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PaymentTerm | null>(null);
  const resource = useAsyncResource(
    () =>
      fetchPaymentTerms(
        statusFilter === "" ? undefined : statusFilter === "true",
      ),
    { enabled: true },
  );

  const terms = resource.data ?? NO_TERMS;

  const filteredTerms = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return terms;
    return terms.filter(
      (term) =>
        normalizeSearch(term.code).includes(normalized) ||
        normalizeSearch(term.name).includes(normalized) ||
        normalizeSearch(term.description).includes(normalized),
    );
  }, [query, terms]);

  async function handleDelete() {
    if (!deleteTarget) return;
    await deletePaymentTerm(String(deleteTarget.id));
    toast.success("Término eliminado.");
    resource.reload();
    setDeleteTarget(null);
  }

  function clearFilters() {
    setStatusFilter("");
    setQuery("");
    resource.reload();
  }

  function renderActions(term: PaymentTerm) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver el término ${term.code}`}
          href={`/app/terminos-de-pago/${term.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar el término ${term.code}`}
            href={`/app/terminos-de-pago/${term.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar el término ${term.code}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(term)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(term: PaymentTerm) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {term.code}
          </span>
          <Link
            className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            href={`/app/terminos-de-pago/${term.id}`}
          >
            {term.name}
          </Link>
        </div>
        <dl className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Condición
            </dt>
            <dd className="text-[13px] text-ink">
              {paymentTermConditionLabel(term.days)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Días
            </dt>
            <dd className="text-[13px] text-ink">
              {paymentTermDayCountLabel(term.days)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Descripción
            </dt>
            <dd className="line-clamp-2 text-right text-[13px] text-muted">
              {term.description || "Sin descripción"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Estado
            </dt>
            <dd>
              <TermStatusBadge term={term} />
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const columns: RecordsTableColumn<PaymentTerm>[] = [
    {
      key: "codigo",
      header: "Código",
      render: (term) => (
        <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
          {term.code}
        </span>
      ),
    },
    {
      key: "nombre",
      header: "Nombre",
      render: (term) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/terminos-de-pago/${term.id}`}
        >
          {term.name}
        </Link>
      ),
    },
    {
      key: "dias",
      header: "Días",
      render: (term) => (
        <span className="whitespace-nowrap text-[13px] font-semibold text-ink">
          {paymentTermDaysLabel(term.days)}
        </span>
      ),
    },
    {
      key: "descripcion",
      header: "Descripción",
      render: (term) => (
        <span className="line-clamp-2 text-muted">
          {term.description || "Sin descripción"}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (term) => <TermStatusBadge term={term} />,
    },
  ];

  const loading = resource.status === "loading" && terms.length === 0;
  const initialError = resource.status === "error" && terms.length === 0;
  const refreshError = resource.status === "error" && terms.length > 0;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/terminos-de-pago/nueva"
            >
              Nuevo término
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Contado usa 0 días. Crédito usa los días indicados para calcular el vencimiento. El término del cliente se copia a los pedidos nuevos."
        eyebrow="Finanzas"
        title="Términos de pago"
      />

      {loading && (
        <RecordsTableSkeleton
          columns={5}
          label="Cargando términos de pago…"
          rows={4}
        />
      )}

      {initialError && (
        <RecordsLoadError
          description={
            resource.error?.message ??
            "No pudimos cargar los términos de pago."
          }
          onRetry={resource.reload}
          title="No pudimos cargar los términos de pago"
        />
      )}

      {!loading && !initialError && (
        <section
          aria-label="Listado de términos de pago"
          className="space-y-4"
        >
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
                "No pudimos actualizar los términos de pago. Mostramos los datos disponibles."}
            </NoticeBanner>
          )}

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(170px,220px)] sm:items-end">
              <div className="relative w-full">
                <label className="sr-only" htmlFor="buscar-terminos-de-pago">
                  Buscar términos de pago
                </label>
                <Icon
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                  name="search"
                  size={17}
                />
                <input
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                  id="buscar-terminos-de-pago"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por código, nombre o descripción"
                  type="search"
                  value={query}
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-[12px] font-semibold text-ink"
                  htmlFor="filtro-estado-terminos"
                >
                  Estado
                </label>
                <select
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[14px] text-ink transition-colors hover:border-brand/45 focus:border-brand"
                  id="filtro-estado-terminos"
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    resource.reload();
                  }}
                  value={statusFilter}
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
            </div>

            <p
              aria-live="polite"
              className="mt-4 text-[12px] font-semibold text-muted"
            >
              {query.trim()
                ? `Mostrando ${formatInteger(filteredTerms.length)} de ${termsLabel(terms.length)}`
                : termsLabel(terms.length)}
            </p>
          </div>

          {terms.length === 0 ? (
            statusFilter === "true" ? (
              <EmptyState
                action={
                  <button
                    className="button-base button-secondary min-h-11 px-5"
                    onClick={clearFilters}
                    type="button"
                  >
                    Limpiar filtro
                  </button>
                }
                description="No hay términos de pago activos. Cambia el filtro para ver todos los términos."
                title="No hay términos activos."
              />
            ) : statusFilter === "false" ? (
              <EmptyState
                action={
                  <button
                    className="button-base button-secondary min-h-11 px-5"
                    onClick={clearFilters}
                    type="button"
                  >
                    Limpiar filtro
                  </button>
                }
                description="No hay términos de pago inactivos. Cambia el filtro para ver todos los términos."
                title="No hay términos inactivos."
              />
            ) : (
              <EmptyState
                action={
                  canWrite ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href="/app/terminos-de-pago/nueva"
                    >
                      Nuevo término
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description="No hay términos de pago configurados. Crea el primero para definir condiciones de contado o crédito."
                title="No hay términos de pago configurados."
              />
            )
          ) : filteredTerms.length === 0 ? (
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
              description="No hay términos que coincidan con la búsqueda."
              title="Sin resultados"
            />
          ) : (
            <RecordsTable
              caption="Términos de pago con su código, nombre, días, descripción, estado y acciones"
              columns={columns}
              getRowKey={(term) => String(term.id)}
              getRowLabel={(term) => term.code}
              renderCard={renderCard}
              rowActions={renderActions}
              rows={filteredTerms}
            />
          )}
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar término"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Código:{" "}
                <span className="font-semibold text-ink">
                  {deleteTarget.code}
                </span>
              </p>
              <p>
                Esta acción es permanente. No se puede eliminar un término
                asignado a clientes, pedidos o facturas.
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
            ? `¿Eliminar ${deleteTarget.code}?`
            : "Eliminar término de pago"
        }
      />
    </div>
  );
}
