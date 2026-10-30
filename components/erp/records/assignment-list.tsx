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
import { SelectField } from "@/components/erp/records/form-controls";
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
  assignmentCustomerLabel,
  assignmentErrorMessage,
  assignmentSellerLabel,
  deleteAssignment,
  fetchAssignments,
  type AssignmentRecord,
} from "@/components/erp/records/assignments-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatDateTime, formatInteger } from "@/lib/format";

const NO_ASSIGNMENTS: AssignmentRecord[] = [];

type FilterOption = { value: string; label: string };

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function assignmentsLabel(count: number) {
  return count === 1 ? "1 asignación" : `${formatInteger(count)} asignaciones`;
}

function sellerSecondary(seller: AssignmentRecord["seller"]) {
  if (!seller) return "";
  return seller.name?.trim() ? seller.username : seller.email;
}

export function AssignmentListPage() {
  const { user } = useSession();
  if (!canReadModule(user.role, "asignaciones")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de asignaciones. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }
  return <AssignmentListContent />;
}

function AssignmentListContent() {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "asignaciones");
  const isAdmin = user.role === "admin";
  const isSeller = user.role === "seller";
  const isDispatcher = user.role === "dispatcher";
  const sellerIdMissing =
    isSeller && (user.id === null || user.id === undefined);
  const resource = useAsyncResource(fetchAssignments, {
    enabled: !sellerIdMissing,
  });
  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [sellerFilter, setSellerFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AssignmentRecord | null>(
    null,
  );

  const assignments = useMemo(() => {
    const rows = resource.data ?? NO_ASSIGNMENTS;
    if (!isSeller) return rows;
    if (sellerIdMissing) return NO_ASSIGNMENTS;
    return rows.filter(
      (assignment) => String(assignment.seller_id) === String(user.id),
    );
  }, [isSeller, resource.data, sellerIdMissing, user.id]);

  const customerOptions = useMemo(() => {
    const options = new Map<string, FilterOption>();
    for (const assignment of assignments) {
      const value = String(assignment.customer_id);
      if (options.has(value)) continue;
      const label = assignment.customer?.email
        ? `${assignmentCustomerLabel(assignment.customer)} · ${assignment.customer.email}`
        : assignmentCustomerLabel(assignment.customer);
      options.set(value, { value, label });
    }
    return [...options.values()].sort((first, second) =>
      first.label.localeCompare(second.label, "es"),
    );
  }, [assignments]);

  const sellerOptions = useMemo(() => {
    const options = new Map<string, FilterOption>();
    for (const assignment of assignments) {
      const value = String(assignment.seller_id);
      if (options.has(value)) continue;
      options.set(value, {
        value,
        label: assignmentSellerLabel(assignment.seller),
      });
    }
    return [...options.values()].sort((first, second) =>
      first.label.localeCompare(second.label, "es"),
    );
  }, [assignments]);

  const filteredAssignments = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return assignments.filter((assignment) => {
      if (customerFilter && String(assignment.customer_id) !== customerFilter) {
        return false;
      }
      if (
        isAdmin &&
        sellerFilter &&
        String(assignment.seller_id) !== sellerFilter
      ) {
        return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        assignmentCustomerLabel(assignment.customer),
        assignment.customer?.email ?? "",
        assignmentSellerLabel(assignment.seller),
        assignment.seller?.username ?? "",
        assignment.seller?.email ?? "",
      ].join(" ");
      return normalizeSearch(haystack).includes(normalizedQuery);
    });
  }, [assignments, customerFilter, isAdmin, query, sellerFilter]);

  const searchLabel = isSeller
    ? "Buscar por cliente"
    : "Buscar por cliente o vendedor";
  const filtersActive = Boolean(
    query.trim() || (isAdmin && (customerFilter || sellerFilter)),
  );
  const totalLabel = assignmentsLabel(assignments.length);
  const countLabel = filtersActive
    ? `Mostrando ${formatInteger(filteredAssignments.length)} de ${totalLabel}`
    : totalLabel;

  function resetFilters() {
    setQuery("");
    setCustomerFilter("");
    setSellerFilter("");
  }

  function renderActions(assignment: AssignmentRecord) {
    const customer = assignmentCustomerLabel(assignment.customer);
    const seller = assignmentSellerLabel(assignment.seller);
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Reasignar el vendedor de ${customer}`}
          href={`/app/asignaciones/${assignment.id}/editar`}
          icon="arrow-right"
        >
          Reasignar
        </RecordActionLink>
        <RecordActionButton
          aria-label={`Quitar la asignación de ${customer} con ${seller}`}
          danger
          icon="close"
          onClick={() => setDeleteTarget(assignment)}
        >
          Quitar
        </RecordActionButton>
      </RecordActions>
    );
  }

  function renderCard(assignment: AssignmentRecord) {
    return (
      <div>
        <p className="text-[15px] font-semibold text-ink">
          {assignmentCustomerLabel(assignment.customer)}
        </p>
        <p className="mt-1 break-all text-[12px] text-muted">
          {assignment.customer?.email || "Correo no registrado"}
        </p>
        <dl className="mt-3 space-y-2 text-[12px] leading-5">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Vendedor
            </dt>
            <dd className="min-w-0 text-right font-semibold text-ink">
              {assignmentSellerLabel(assignment.seller)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Fecha de asignación
            </dt>
            <dd className="min-w-0 text-right text-ink">
              {assignment.assigned_at ? (
                <time dateTime={assignment.assigned_at}>
                  {formatDateTime(assignment.assigned_at)}
                </time>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const columns: RecordsTableColumn<AssignmentRecord>[] = [
    {
      key: "cliente",
      header: "Cliente",
      render: (assignment) => (
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            {assignmentCustomerLabel(assignment.customer)}
          </p>
          <p className="mt-1 break-all text-[12px] text-muted">
            {assignment.customer?.email || "Correo no registrado"}
          </p>
        </div>
      ),
    },
    {
      key: "vendedor",
      header: "Vendedor",
      render: (assignment) => {
        const secondary = sellerSecondary(assignment.seller);
        return (
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {assignmentSellerLabel(assignment.seller)}
            </p>
            {secondary && (
              <p className="mt-1 break-all text-[12px] text-muted">
                {secondary}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "fecha",
      header: "Fecha de asignación",
      render: (assignment) =>
        assignment.assigned_at ? (
          <time
            className="whitespace-nowrap text-ink"
            dateTime={assignment.assigned_at}
          >
            {formatDateTime(assignment.assigned_at)}
          </time>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ];

  const header = (
    <RecordsPageHeader
      actions={
        canWrite && !sellerIdMissing ? (
          <Link
            className="button-base button-primary min-h-11 px-5 text-[13px]"
            href="/app/asignaciones/nueva"
          >
            Nueva asignación
            <Icon name="arrow-right" size={17} />
          </Link>
        ) : undefined
      }
      description="Consulta qué vendedor tiene cada cliente, reasigna y quita asignaciones sin borrar clientes ni usuarios."
      eyebrow="Operación"
      title="Asignaciones"
    />
  );

  if (sellerIdMissing) {
    return (
      <div className="space-y-5">
        {header}
        <NoticeBanner title="Sesión incompleta" tone="warning">
          No pudimos identificar tu usuario de vendedor. Vuelve a iniciar sesión
          para consultar tus asignaciones.
        </NoticeBanner>
      </div>
    );
  }

  if (resource.status === "loading" && assignments.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <RecordsTableSkeleton
          columns={4}
          label="Cargando asignaciones…"
          rows={6}
        />
      </div>
    );
  }

  if (resource.status === "error" && assignments.length === 0) {
    if (resource.error?.kind === "forbidden") {
      return (
        <div className="space-y-5">
          {header}
          <AccessState
            description="Solo administradores, despachadores y vendedores pueden consultar las asignaciones."
            headingLevel="h2"
          />
        </div>
      );
    }
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          description={
            resource.error
              ? assignmentErrorMessage(resource.error, "load")
              : "No pudimos cargar las asignaciones."
          }
          onRetry={resource.reload}
          title="No pudimos cargar las asignaciones"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {header}

      {isSeller && (
        <NoticeBanner tone="info">Solo ves tus clientes asignados.</NoticeBanner>
      )}

      {isDispatcher && (
        <NoticeBanner tone="info">
          Puedes consultar las asignaciones. Tu rol no permite crear, reasignar
          ni quitar vendedores.
        </NoticeBanner>
      )}

      {resource.status === "refreshing" && (
        <div aria-hidden="true" className="reload-bar" />
      )}

      {resource.status === "error" && assignments.length > 0 && (
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
          {resource.error
            ? assignmentErrorMessage(resource.error, "load")
            : "No pudimos actualizar las asignaciones. Mostramos los datos disponibles."}
        </NoticeBanner>
      )}

      <section aria-label="Listado de asignaciones" className="space-y-4">
        <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
          <div
            className={
              isAdmin
                ? "grid gap-4 md:grid-cols-2 md:items-end lg:grid-cols-[minmax(0,1fr)_minmax(190px,240px)_minmax(180px,230px)]"
                : "grid gap-4 md:grid-cols-[minmax(0,1fr)] md:items-end"
            }
          >
            <div className={isAdmin ? "md:col-span-2 lg:col-span-1" : undefined}>
              <label
                className="mb-2 block text-[12px] font-semibold text-ink"
                htmlFor="buscar-asignaciones"
              >
                {searchLabel}
              </label>
              <div className="relative">
                <Icon
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                  name="search"
                  size={17}
                />
                <input
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-11 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                  id="buscar-asignaciones"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchLabel}
                  type="search"
                  value={query}
                />
                {query && (
                  <button
                    aria-label="Limpiar búsqueda"
                    className="absolute right-0.5 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-background hover:text-ink"
                    onClick={() => setQuery("")}
                    type="button"
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
            </div>

            {isAdmin && (
              <>
                <SelectField
                  id="filtro-cliente"
                  label="Cliente"
                  onChange={setCustomerFilter}
                  options={customerOptions}
                  placeholder="Todos los clientes"
                  value={customerFilter}
                />
                <SelectField
                  id="filtro-vendedor"
                  label="Vendedor"
                  onChange={setSellerFilter}
                  options={sellerOptions}
                  placeholder="Todos los vendedores"
                  value={sellerFilter}
                />
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
            <p aria-live="polite" className="text-[12px] font-semibold text-muted">
              {countLabel}
            </p>
            {filtersActive && (
              <button
                className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                onClick={resetFilters}
                type="button"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {assignments.length === 0 ? (
          isSeller ? (
            <EmptyState
              description="Cuando un administrador te asigne clientes, aparecerán aquí."
              title="No tienes clientes asignados todavía."
            />
          ) : (
            <EmptyState
              action={
                canWrite ? (
                  <Link
                    className="button-base button-primary min-h-11 px-5"
                    href="/app/asignaciones/nueva"
                  >
                    Nueva asignación
                    <Icon name="arrow-right" size={17} />
                  </Link>
                ) : undefined
              }
              description={
                canWrite
                  ? "Crea la primera asignación para que un vendedor tenga clientes a su cargo."
                  : "Cuando se registre una asignación, aparecerá aquí."
              }
              title="Todavía no hay clientes asignados a vendedores."
            />
          )
        ) : filteredAssignments.length === 0 ? (
          <EmptyState
            action={
              <button
                className="button-base button-secondary min-h-11 px-5"
                onClick={resetFilters}
                type="button"
              >
                Limpiar filtros
              </button>
            }
            description="Ajusta la búsqueda o los filtros para encontrar la asignación."
            title="No hay asignaciones que coincidan con los filtros."
          />
        ) : (
          <RecordsTable
            caption="Asignaciones de clientes a vendedores con su correo, fecha de asignación y acciones"
            columns={columns}
            getRowKey={(assignment) => String(assignment.id)}
            getRowLabel={(assignment) =>
              `${assignmentCustomerLabel(assignment.customer)} con ${assignmentSellerLabel(assignment.seller)}`
            }
            renderCard={renderCard}
            rowActions={canWrite ? renderActions : undefined}
            rows={filteredAssignments}
          />
        )}
      </section>

      <ConfirmDialog
        confirmBusyLabel="Quitando…"
        confirmLabel="Quitar asignación"
        description={<p>El cliente quedará sin vendedor.</p>}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteAssignment(deleteTarget.id);
          toast.success("Asignación eliminada.");
          resource.reload();
        }}
        onError={(error) => {
          toast.error(assignmentErrorMessage(error, "delete"));
          resource.reload();
        }}
        open={deleteTarget !== null}
        title={
          deleteTarget
            ? `¿Quitar la asignación de ${assignmentCustomerLabel(
                deleteTarget.customer,
              )} con ${assignmentSellerLabel(deleteTarget.seller)}?`
            : "Quitar asignación"
        }
      />
    </div>
  );
}
