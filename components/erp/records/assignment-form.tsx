"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  FormErrorSummary,
  focusFirstInvalidField,
  useUnsavedChangesWarning,
  type FormErrorItem,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { SelectField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  isPositiveRecordId,
  toApiId,
} from "@/components/erp/records/records-api";
import {
  fetchCustomers,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import { fetchUsers, type UserRecord } from "@/components/erp/users-api";
import {
  assignmentCustomerLabel,
  assignmentErrorMessage,
  createAssignment,
  fetchAssignment,
  fetchAssignments,
  updateAssignment,
  type AssignmentRecord,
} from "@/components/erp/records/assignments-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canWriteModule } from "@/lib/permissions";
import { sessionDisplayName } from "@/lib/session";

const FIELD_IDS = {
  customer: "asignacion-cliente",
  seller: "asignacion-vendedor",
} as const;

const NO_CUSTOMERS: CustomerRecord[] = [];
const NO_USERS: UserRecord[] = [];
const NO_ASSIGNMENTS: AssignmentRecord[] = [];

type AssignmentFormMode = "create" | "edit";

type AssignmentFormPageProps = {
  mode: AssignmentFormMode;
  assignmentId?: string;
  initialCustomerId?: string;
};

export function AssignmentFormPage({
  mode,
  assignmentId,
  initialCustomerId,
}: AssignmentFormPageProps) {
  const { user } = useSession();

  if (!canWriteModule(user.role, "asignaciones")) {
    return (
      <AccessState description="Tu rol puede consultar asignaciones, pero no crear ni reasignar vendedores." />
    );
  }

  if (mode === "edit" && !isPositiveRecordId(assignmentId)) {
    return (
      <RecordsLoadError
        backHref="/app/asignaciones"
        backLabel="Volver a asignaciones"
        description="Puede que el enlace no sea válido o que la asignación ya no exista."
        headingLevel="h1"
        title="No encontramos esta asignación"
      />
    );
  }

  return (
    <AssignmentFormContent
      assignmentId={assignmentId}
      initialCustomerId={initialCustomerId}
      mode={mode}
    />
  );
}

function AssignmentFormContent({
  mode,
  assignmentId,
  initialCustomerId,
}: AssignmentFormPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const isAdmin = user.role === "admin";
  const isSeller = user.role === "seller";
  const fixedSellerId =
    user.id !== null && user.id !== undefined ? String(user.id) : "";

  const assignmentLoader = useCallback(
    () => fetchAssignment(assignmentId ?? ""),
    [assignmentId],
  );
  const assignmentResource = useAsyncResource(assignmentLoader, {
    enabled: editing,
  });
  const customersResource = useAsyncResource(fetchCustomers, {
    enabled: !editing,
  });
  const assignmentsResource = useAsyncResource(fetchAssignments, {
    enabled: !editing,
  });
  const usersResource = useAsyncResource(fetchUsers, {
    enabled: isAdmin,
  });

  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [sellerId, setSellerId] = useState(isSeller ? fixedSellerId : "");
  const [initialSellerId, setInitialSellerId] = useState(
    isSeller ? fixedSellerId : "",
  );
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    assignment: AssignmentRecord | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const assignment = assignmentResource.data;
  const customers = customersResource.data ?? NO_CUSTOMERS;
  const users = usersResource.data ?? NO_USERS;
  const existingAssignments = assignmentsResource.data ?? NO_ASSIGNMENTS;

  const activeSellers = useMemo(
    () => users.filter((entry) => entry.role === "seller" && !entry.isBlocked),
    [users],
  );
  const activeSellerIds = useMemo(
    () => new Set(activeSellers.map((entry) => String(entry.id))),
    [activeSellers],
  );
  const assignedCustomerIds = useMemo(
    () =>
      new Set(
        existingAssignments.map((entry) => String(entry.customer_id)),
      ),
    [existingAssignments],
  );
  const availableCustomers = useMemo(
    () =>
      customers.filter(
        (customer) => !assignedCustomerIds.has(String(customer.id)),
      ),
    [assignedCustomerIds, customers],
  );

  const effectiveCustomerId =
    customerId &&
    availableCustomers.some(
      (customer) => String(customer.id) === customerId,
    )
      ? customerId
      : "";

  if (editing && assignment) {
    const key = String(assignment.id);
    if (initializedFor !== key) {
      const nextSellerId = isAdmin ? String(assignment.seller_id) : fixedSellerId;
      setSellerId(nextSellerId);
      setInitialSellerId(nextSellerId);
      setInitializedFor(key);
    }
  }

  const customerOptions = availableCustomers.map((customer) => ({
    value: String(customer.id),
    label: customer.email
      ? `${customer.fullName} · ${customer.email}`
      : customer.fullName,
  }));

  const activeSellerOptions = activeSellers.map((seller) => ({
    value: String(seller.id),
    label: seller.name?.trim()
      ? `${seller.name} · ${seller.username}`
      : seller.username,
  }));

  const currentSellerUnavailable = Boolean(
    editing &&
      assignment &&
      isAdmin &&
      !activeSellerIds.has(String(assignment.seller_id)),
  );

  const sellerOptions = useMemo(() => {
    const options = [...activeSellerOptions];
    if (currentSellerUnavailable && assignment) {
      options.unshift({
        value: String(assignment.seller_id),
        label: `${
          assignment.seller?.name?.trim() ||
          assignment.seller?.username ||
          "Vendedor actual"
        } · No disponible`,
      });
    }
    return options;
  }, [activeSellerOptions, assignment, currentSellerUnavailable]);

  const customersLoading = customersResource.status === "loading";
  const customerCatalogLoading =
    !editing &&
    (customersLoading || assignmentsResource.status === "loading");
  const customerLoadError =
    customersResource.status === "error"
      ? customersResource.error?.message ?? "No pudimos cargar los clientes."
      : null;
  const assignmentsCheckError =
    !editing && assignmentsResource.status === "error";
  const usersLoadError =
    isAdmin && usersResource.status === "error"
      ? usersResource.error?.message ?? "No pudimos cargar los vendedores."
      : null;
  const sellersLoading = isAdmin && usersResource.status === "loading";

  const customerEmptyLabel =
    customers.length === 0
      ? "No hay clientes registrados."
      : "No hay clientes sin vendedor.";

  const customersReady =
    customersResource.data !== null && customersResource.status !== "error";
  const sellersReady = isSeller
    ? Boolean(fixedSellerId)
    : usersResource.data !== null && usersResource.status !== "error";
  const baseReady = editing ? Boolean(assignment) : customersReady;
  const selectorsReady = baseReady && sellersReady;
  const dirty = editing
    ? Boolean(assignment) && sellerId !== initialSellerId
    : Boolean(effectiveCustomerId) || (isAdmin && Boolean(sellerId));
  const submitDisabled =
    submitting ||
    !selectorsReady ||
    customerCatalogLoading ||
    (isAdmin && Boolean(usersLoadError)) ||
    (isAdmin && activeSellers.length === 0) ||
    (isSeller && !fixedSellerId) ||
    (editing && !dirty);
  useUnsavedChangesWarning(dirty && !submitting);

  function clearFieldError(field: keyof typeof FIELD_IDS) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetFeedback() {
    setMessage(null);
    setConflict(null);
  }

  function updateCustomer(value: string) {
    setCustomerId(value);
    resetFeedback();
    clearFieldError("customer");
  }

  function updateSeller(value: string) {
    setSellerId(value);
    resetFeedback();
    clearFieldError("seller");
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!editing && !effectiveCustomerId) {
      next.customer = "Selecciona un cliente.";
    }
    if (!sellerId) {
      next.seller = "Selecciona un vendedor.";
    } else if (isAdmin && !activeSellerIds.has(sellerId)) {
      next.seller = "Selecciona un vendedor activo con rol Vendedor.";
    }
    if (isSeller && !fixedSellerId) {
      next.seller =
        "No pudimos identificar tu usuario de vendedor. Vuelve a iniciar sesión.";
    }
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || submitDisabled) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      resetFeedback();
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    resetFeedback();

    try {
      if (editing) {
        await updateAssignment(assignmentId ?? "", {
          seller_id: toApiId(sellerId),
        });
        toast.success("Vendedor actualizado.");
      } else {
        await createAssignment({
          customer_id: toApiId(customerId),
          seller_id: toApiId(sellerId),
        });
        toast.success("Cliente asignado.");
      }
      router.push("/app/asignaciones");
    } catch (caught) {
      if (caught instanceof ApiError) {
        const uiError = translateApiError(caught);
        if (caught.status === 409 && !editing) {
          setMessage(null);
          setConflict({ assignment: null });
          if (effectiveCustomerId) {
            try {
              const rows = await fetchAssignments({
                customer_id: toApiId(effectiveCustomerId),
              });
              setConflict({ assignment: rows[0] ?? null });
            } catch {
              setConflict({ assignment: null });
            }
          }
        } else if (caught.status === 422) {
          const mapped: Record<string, string> = {};
          if (caught.fieldErrors.seller_id) {
            mapped.seller = "Selecciona un vendedor activo con rol Vendedor.";
          }
          if (caught.fieldErrors.customer_id) {
            mapped.customer = "Selecciona un cliente válido.";
          }
          setErrors(mapped);
          setShowSummary(Object.keys(mapped).length > 0);
          setMessage(
            assignmentErrorMessage(uiError, editing ? "update" : "create"),
          );
          if (Object.keys(mapped).length > 0) {
            window.requestAnimationFrame(() => focusFirstInvalidField());
          }
        } else {
          setMessage(
            assignmentErrorMessage(uiError, editing ? "update" : "create"),
          );
        }
      } else {
        setMessage(
          "No pudimos guardar la asignación. Revisa tu conexión e intenta de nuevo.",
        );
      }
      setSubmitting(false);
    }
  }

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/asignaciones"
        >
          Volver a asignaciones
        </Link>
      }
      description={
        editing
          ? "Cambia el vendedor responsable sin modificar el cliente."
          : "Asigna un cliente sin vendedor a un vendedor activo."
      }
      eyebrow="Operación"
      title={editing ? "Reasignar vendedor" : "Nueva asignación"}
    />
  );

  if (editing && assignmentResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && assignmentResource.status === "error") {
    const forbidden = assignmentResource.error?.kind === "forbidden";
    const notFound = assignmentResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/asignaciones"
          backLabel="Volver a asignaciones"
          description={
            assignmentResource.error
              ? assignmentErrorMessage(assignmentResource.error, "load")
              : "No pudimos cargar la asignación."
          }
          onRetry={
            forbidden || notFound ? undefined : assignmentResource.reload
          }
          title={
            forbidden
              ? "No puedes gestionar esta asignación"
              : notFound
                ? "No encontramos esta asignación"
                : "No pudimos cargar la asignación"
          }
        />
      </div>
    );
  }

  const summaryItems: FormErrorItem[] = [];
  if (errors.customer) {
    summaryItems.push({
      fieldId: FIELD_IDS.customer,
      label: "Cliente",
      message: errors.customer,
    });
  }
  if (errors.seller) {
    summaryItems.push({
      fieldId: FIELD_IDS.seller,
      label: "Vendedor",
      message: errors.seller,
    });
  }

  return (
    <div className="space-y-5">
      {header}

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Asignación</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-asignacion"
            >
              {editing ? "Datos de la asignación" : "Datos de la nueva asignación"}
            </h2>
            <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted">
              Un cliente solo puede tener un vendedor.
            </p>
          </div>
          <span className="rounded-full bg-soft-blue px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
            Escritura habilitada
          </span>
        </div>

        {message && (
          <NoticeBanner className="mt-5" role="alert" tone="danger">
            {message}
          </NoticeBanner>
        )}

        {conflict && (
          <NoticeBanner
            action={
              conflict.assignment ? (
                <Link
                  className="button-base button-secondary min-h-11 px-4 text-[12px]"
                  href={`/app/asignaciones/${conflict.assignment.id}/editar`}
                >
                  Reasignar asignación existente
                  <Icon name="arrow-right" size={15} />
                </Link>
              ) : isSeller ? undefined : (
                <Link
                  className="button-base button-secondary min-h-11 px-4 text-[12px]"
                  href="/app/asignaciones"
                >
                  Ver asignaciones
                </Link>
              )
            }
            className="mt-5"
            tone="danger"
          >
            {conflict.assignment
              ? "Este cliente ya tiene un vendedor. Puedes reasignarlo."
              : isSeller
                ? "Este cliente ya tiene un vendedor. Solo un administrador puede reasignarlo."
                : "Este cliente ya tiene un vendedor. No pudimos localizar la asignación existente; búscala en la lista de asignaciones."}
          </NoticeBanner>
        )}

        {showSummary && summaryItems.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        <form
          aria-labelledby="datos-asignacion"
          className="mt-6 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          {editing && assignment ? (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-ink">Cliente</p>
              <div className="rounded-xl border border-ink/15 bg-background px-4 py-3.5">
                <p className="text-[15px] font-semibold text-ink">
                  {assignmentCustomerLabel(assignment.customer)}
                </p>
                <p className="mt-1 break-all text-[12px] text-muted">
                  {assignment.customer?.email || "Correo no registrado"}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-muted">
                  El cliente no cambia al reasignar.
                </p>
              </div>
            </div>
          ) : (
            <SelectField
              disabled={submitting}
              emptyLabel={customerEmptyLabel}
              error={errors.customer}
              help="Un cliente solo puede tener un vendedor."
              id={FIELD_IDS.customer}
              label="Cliente"
              loadError={customerLoadError}
              loading={customerCatalogLoading}
              loadingLabel="Cargando clientes…"
              onChange={updateCustomer}
              onRetry={customersResource.reload}
              options={customerOptions}
              placeholder="Selecciona un cliente"
              required
              value={effectiveCustomerId}
            />
          )}

          {isSeller ? (
            <div
              aria-labelledby="asignacion-vendedor-etiqueta"
              id={FIELD_IDS.seller}
              role="group"
              tabIndex={-1}
            >
              <p
                className="mb-2 text-[13px] font-semibold text-ink"
                id="asignacion-vendedor-etiqueta"
              >
                Vendedor
              </p>
              <div className="rounded-xl border border-ink/15 bg-background px-4 py-3.5">
                <p className="text-[15px] font-semibold text-ink">
                  {sessionDisplayName(user)}
                </p>
                <p className="mt-1 break-all text-[12px] text-muted">
                  {user.username} · {user.email}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-muted">
                  Asignación fija a tu usuario. No puedes asignar clientes a otro
                  vendedor.
                </p>
              </div>
              {!fixedSellerId && (
                <p className="mt-2 text-[12px] font-semibold text-alert-ink" role="alert">
                  No pudimos identificar tu usuario de vendedor. Vuelve a iniciar
                  sesión.
                </p>
              )}
              {errors.seller && fixedSellerId && (
                <p className="mt-2 text-[12px] font-semibold text-alert-ink" role="alert">
                  {errors.seller}
                </p>
              )}
            </div>
          ) : (
            <SelectField
              disabled={submitting}
              emptyLabel="No hay vendedores activos disponibles."
              error={errors.seller}
              help="Solo se muestran vendedores activos con rol Vendedor."
              id={FIELD_IDS.seller}
              label="Vendedor"
              loadError={usersLoadError}
              loading={sellersLoading}
              loadingLabel="Cargando vendedores…"
              onChange={updateSeller}
              onRetry={usersResource.reload}
              options={sellerOptions}
              placeholder="Selecciona un vendedor"
              required
              value={sellerId}
            />
          )}

          {isSeller && (
            <NoticeBanner tone="info">
              Solo ves y gestionas tus propios clientes asignados.
              {!editing &&
                " Si el cliente ya tiene un vendedor, solo un administrador puede reasignarlo."}
            </NoticeBanner>
          )}

          {isAdmin &&
            currentSellerUnavailable &&
            !sellersLoading &&
            !usersLoadError &&
            activeSellers.length > 0 && (
              <NoticeBanner tone="warning">
                El vendedor actual ya no está disponible. Elige un vendedor
                activo con rol Vendedor.
              </NoticeBanner>
            )}

          {isAdmin &&
            !sellersLoading &&
            !usersLoadError &&
            activeSellers.length === 0 && (
              <NoticeBanner
                action={
                  <Link
                    className="button-base button-secondary min-h-11 px-4 text-[12px]"
                    href="/app/usuarios"
                  >
                    Ir a usuarios
                    <Icon name="arrow-right" size={15} />
                  </Link>
                }
                tone="warning"
              >
                No hay vendedores activos disponibles. Crea o habilita un usuario
                con rol Vendedor antes de asignar clientes.
              </NoticeBanner>
            )}

          {assignmentsCheckError && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={assignmentsResource.reload}
                  type="button"
                >
                  Reintentar
                </button>
              }
              tone="warning"
            >
              No pudimos verificar qué clientes ya tienen vendedor. Si eliges uno
              asignado, el sistema te avisará al guardar.
            </NoticeBanner>
          )}

          {!editing &&
            customersResource.status === "ready" &&
            customers.length === 0 && (
              <NoticeBanner
                action={
                  <Link
                    className="button-base button-secondary min-h-11 px-4 text-[12px]"
                    href="/app/clientes/nuevo"
                  >
                    Registrar cliente
                    <Icon name="arrow-right" size={15} />
                  </Link>
                }
                tone="warning"
              >
                No hay clientes registrados. Registra uno antes de crear una
                asignación.
              </NoticeBanner>
            )}

          {!editing &&
            !customerCatalogLoading &&
            !customerLoadError &&
            !assignmentsCheckError &&
            customers.length > 0 &&
            availableCustomers.length === 0 && (
              <NoticeBanner tone="info">
                Todos los clientes registrados ya tienen un vendedor. Puedes
                reasignarlos desde la lista de asignaciones.
              </NoticeBanner>
            )}

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="button-base button-secondary min-h-11 px-5"
              href="/app/asignaciones"
            >
              Cancelar
            </Link>
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="sm:min-w-[180px]"
              disabled={submitDisabled}
              type="submit"
            >
              {editing ? "Guardar cambios" : "Asignar cliente"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
