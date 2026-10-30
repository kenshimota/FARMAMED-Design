"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordActionButton } from "@/components/erp/records/record-actions";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  deleteCustomer,
  fetchCustomer,
  hasCoordinates,
} from "@/components/erp/records/customers-api";
import {
  assignmentErrorMessage,
  assignmentSellerLabel,
  fetchAssignments,
} from "@/components/erp/records/assignments-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { formatCoordinate, formatDateTime } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type CustomerDetailPageProps = {
  customerId: string;
};

export function CustomerDetailPage({ customerId }: CustomerDetailPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canRead = canReadModule(user.role, "clientes");
  const canWrite = canWriteModule(user.role, "clientes");
  const canReadAssignments = canReadModule(user.role, "asignaciones");
  const canAssignCustomers = canWriteModule(user.role, "asignaciones");
  const isSeller = user.role === "seller";
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validId = isPositiveRecordId(customerId);
  const customerLoader = useCallback(
    () => fetchCustomer(customerId),
    [customerId],
  );
  const customerResource = useAsyncResource(customerLoader, {
    enabled: canRead && validId,
  });
  const assignmentLoader = useCallback(
    () => fetchAssignments({ customer_id: customerId }),
    [customerId],
  );
  const assignmentResource = useAsyncResource(assignmentLoader, {
    enabled: canReadAssignments && validId,
  });

  if (!canRead) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de clientes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/clientes"
        backLabel="Volver a clientes"
        description="Puede que el enlace no sea válido o que el cliente ya no exista."
        headingLevel="h1"
        title="No encontramos este cliente"
      />
    );
  }

  if (customerResource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/clientes"
            >
              Volver a clientes
            </Link>
          }
          description="Consulta los datos registrados del cliente."
          eyebrow="Operación"
          title="Detalle del cliente"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (customerResource.status === "error" || !customerResource.data) {
    const notFound = customerResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/clientes"
        backLabel="Volver a clientes"
        description={
          notFound
            ? "Puede que haya sido eliminado o que el enlace no sea válido."
            : customerResource.error?.message ??
              "No pudimos cargar el cliente."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : customerResource.reload}
        title={
          notFound
            ? "No encontramos este cliente"
            : "No pudimos cargar el cliente"
        }
      />
    );
  }

  const customer = customerResource.data;
  const located = hasCoordinates(customer);
  const assignment = assignmentResource.data?.[0] ?? null;
  const assignmentResolved = assignmentResource.data !== null;
  const showReassign = canAssignCustomers && assignment !== null;
  const showAssign =
    canAssignCustomers &&
    !isSeller &&
    assignmentResolved &&
    assignment === null;
  const showAssignmentsLink =
    canReadAssignments && !showReassign && !showAssign;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            {showReassign && (
              <Link
                aria-label={`Reasignar el vendedor del cliente ${customer.fullName}`}
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={`/app/asignaciones/${assignment.id}/editar`}
              >
                Reasignar vendedor
                <Icon name="link" size={16} />
              </Link>
            )}
            {showAssign && (
              <Link
                aria-label={`Asignar vendedor al cliente ${customer.fullName}`}
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={`/app/asignaciones/nueva?customer_id=${customer.id}`}
              >
                Asignar vendedor
                <Icon name="link" size={16} />
              </Link>
            )}
            {showAssignmentsLink && (
              <Link
                aria-label={`Ver asignaciones de vendedores del cliente ${customer.fullName}`}
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href="/app/asignaciones"
              >
                Ver asignaciones
                <Icon name="link" size={16} />
              </Link>
            )}
            {canWrite && (
              <Link
                aria-label={`Editar cliente ${customer.fullName}`}
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href={`/app/clientes/${customer.id}/editar`}
              >
                Editar cliente
                <Icon name="arrow-right" size={17} />
              </Link>
            )}
            {canWrite && (
              <RecordActionButton
                aria-label={`Eliminar cliente ${customer.fullName}`}
                danger
                onClick={() => setDeleteOpen(true)}
              >
                Eliminar cliente
              </RecordActionButton>
            )}
          </>
        }
        description="Ficha con los datos de contacto y la ubicación registrada del cliente."
        eyebrow="Operación"
        title={customer.fullName}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/clientes"
        >
          Volver a clientes
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      {!located && canWrite && (
        <NoticeBanner tone="warning">
          Este cliente no tiene ubicación registrada. Puedes agregar las
          coordenadas desde la edición del cliente.
        </NoticeBanner>
      )}

      <section
        aria-labelledby="ficha-cliente"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Ficha del cliente</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ficha-cliente"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Nombre completo
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">{customer.fullName}</dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Correo
            </dt>
            <dd className="mt-1.5 break-all text-[14px] text-ink">
              {customer.email || "No registrado"}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">
              #{customer.id}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Dirección
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
              {customer.direction || "No registrada"}
            </dd>
          </div>

          {located ? (
            <>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Latitud
                </dt>
                <dd className="mt-1.5 font-mono text-[14px] text-ink">
                  {formatCoordinate(customer.latitude)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Longitud
                </dt>
                <dd className="mt-1.5 font-mono text-[14px] text-ink">
                  {formatCoordinate(customer.longitude)}
                </dd>
              </div>
            </>
          ) : (
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Ubicación
              </dt>
              <dd className="mt-1.5">
                <span className="inline-flex rounded-lg bg-soft-lime px-2 py-1 text-[12px] font-semibold text-ink">
                  Sin ubicación registrada
                </span>
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          Los clientes son terceros a los que se les vende; no son usuarios del
          ERP y no inician sesión.
        </p>
      </section>

      {canReadAssignments && (
        <section
          aria-labelledby="vendedor-asignado"
          className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
        >
          <div>
            <span className="eyebrow">Asignación</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="vendedor-asignado"
            >
              Vendedor asignado
            </h2>
          </div>

          {!assignmentResolved && assignmentResource.status === "loading" && (
            <p
              className="mt-4 text-[13px] font-semibold text-muted"
              role="status"
            >
              Consultando el vendedor asignado…
            </p>
          )}

          {!assignmentResolved && assignmentResource.status === "error" && (
            <div
              className="mt-4 rounded-xl border border-alert/25 bg-alert/[0.06] px-4 py-3 text-[12px] leading-5 text-alert-ink"
              role="alert"
            >
              <p>
                {assignmentResource.error
                  ? assignmentErrorMessage(assignmentResource.error, "load")
                  : "No pudimos consultar el vendedor asignado."}
              </p>
              {assignmentResource.error?.kind !== "forbidden" &&
                assignmentResource.error?.kind !== "not-found" && (
                  <button
                    className="mt-2 min-h-11 rounded-full border border-alert/30 px-4 text-[12px] font-semibold transition-colors hover:bg-surface"
                    onClick={assignmentResource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                )}
            </div>
          )}

          {assignmentResolved && assignment && (
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Vendedor
                </dt>
                <dd className="mt-1.5 text-[14px] text-ink">
                  {assignmentSellerLabel(assignment.seller)}
                </dd>
              </div>
              {assignment.seller?.email && (
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Correo
                  </dt>
                  <dd className="mt-1.5 break-all text-[14px] text-ink">
                    {assignment.seller.email}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Fecha de asignación
                </dt>
                <dd className="mt-1.5 text-[14px] text-ink">
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
          )}

          {assignmentResolved && !assignment && (
            <div className="mt-4">
              {isSeller ? (
                <>
                  <p className="text-[14px] text-ink">
                    No tienes este cliente asignado.
                  </p>
                  <p className="mt-2 text-[12px] leading-5 text-muted">
                    Como vendedor, solo ves las asignaciones asociadas a tu
                    usuario. Si el cliente está asignado a otro vendedor, no se
                    muestra aquí.
                  </p>
                </>
              ) : (
                <p>
                  <span className="inline-flex rounded-lg bg-soft-lime px-2.5 py-1 text-[12px] font-semibold text-ink">
                    Sin vendedor asignado
                  </span>
                </p>
              )}
            </div>
          )}

          {assignmentResolved && assignmentResource.status === "error" && (
            <p
              className="mt-3 text-[12px] leading-5 text-muted"
              role="alert"
            >
              No pudimos actualizar el vendedor asignado. Mostramos la última
              información disponible.
            </p>
          )}
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar cliente"
        description={
          <div className="space-y-2">
            <p>
              Correo:{" "}
              <span className="font-semibold text-ink">
                {customer.email || "No registrado"}
              </span>
            </p>
            <p>No se puede deshacer.</p>
          </div>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteCustomer(customer.id);
          toast.success("Cliente eliminado.");
          router.push("/app/clientes");
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteOpen}
        title={`¿Eliminar el cliente ${customer.fullName}?`}
      />
    </div>
  );
}
