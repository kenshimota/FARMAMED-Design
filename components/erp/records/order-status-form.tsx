"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
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
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import {
  createOrderStatus,
  fetchOrderStatus,
  fetchOrderStatuses,
  getOrderStatusLabel,
  ORDER_STATUS_LABELS,
  updateOrderStatus,
  type OrderStatus,
  type OrderStatusInput,
  type OrderStatusUpdate,
} from "@/components/erp/records/order-statuses-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const CODE_MAX_LENGTH = 20;
const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 255;

const COPY = {
  flowNotice:
    "El orden solo afecta la presentación; las transiciones las define el siguiente estado.",
  changeWarning:
    "Cambiar el siguiente estado altera el flujo de los pedidos nuevos.",
  systemNotice:
    "Los estados del sistema no se pueden eliminar. Su código e indicador de sistema son inmutables; puedes ajustar nombre, descripción, orden y siguiente estado.",
  codeRequired: "Ingresa el código del estado.",
  codeLength: "El código no puede superar los 20 caracteres.",
  codeFormat: "El API rechazó el formato del código. Revisa el valor.",
  nameRequired: "Ingresa el nombre del estado.",
  nameLength: "El nombre debe tener máximo 100 caracteres.",
  descriptionLength: "La descripción no puede superar los 255 caracteres.",
  sortRequired: "Ingresa el orden de presentación.",
  sortNumber: "El orden debe ser un número entero mayor o igual a cero.",
  sameNext: "El siguiente estado no puede ser el mismo estado.",
  duplicate: "Ya existe un estado con ese código.",
  invalidTransition:
    "El siguiente estado no puede ser el mismo ni generar un ciclo.",
  missingNext: "El siguiente estado indicado no existe.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  forbidden: "No tienes permiso para configurar estados.",
  notFound: "No encontramos ese estado. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic:
    "No pudimos guardar el estado de pedido. Revisa tu conexión e intenta de nuevo.",
} as const;

type OrderStatusFormPageProps = {
  mode: "create" | "edit";
  statusId?: string;
};

function sortOrderError(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return COPY.sortRequired;
  if (!/^\d+$/.test(trimmed)) return COPY.sortNumber;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return COPY.sortNumber;
  return null;
}

function statusName(status: OrderStatus) {
  if (status.name && status.name.toLowerCase() !== status.code.toLowerCase()) {
    return status.name;
  }
  return ORDER_STATUS_LABELS[status.code] ?? status.code;
}

export function OrderStatusFormPage({
  mode,
  statusId,
}: OrderStatusFormPageProps) {
  const { user } = useSession();

  if (!canReadModule(user.role, "pedidos_estados")) {
    return (
      <AccessState description="No tienes permiso para configurar estados de pedido." />
    );
  }

  if (!canWriteModule(user.role, "pedidos_estados")) {
    return (
      <AccessState description="Tu rol puede consultar estados de pedido, pero no crearlos ni editarlos." />
    );
  }

  if (mode === "edit" && !isPositiveRecordId(statusId)) {
    return (
      <RecordsLoadError
        backHref="/app/pedidos/estados"
        backLabel="Volver a estados de pedido"
        description="Puede que el enlace no sea válido o que el estado ya no exista."
        headingLevel="h1"
        title="No encontramos ese estado"
      />
    );
  }

  return <OrderStatusFormLoader mode={mode} statusId={statusId} />;
}

function OrderStatusFormLoader({ mode, statusId }: OrderStatusFormPageProps) {
  const editing = mode === "edit";
  const loader = useCallback(
    () => fetchOrderStatus(statusId ?? ""),
    [statusId],
  );
  const resource = useAsyncResource(loader, { enabled: editing });

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/pedidos/estados"
        >
          Volver a estados
        </Link>
      }
      description={
        editing
          ? "Actualiza el nombre, la descripción, el orden y el siguiente estado. El código y el indicador de sistema no se pueden cambiar."
          : "Registra un estado adicional y define su lugar en la cadena de pedidos."
      }
      eyebrow="Operación"
      title={editing ? "Editar estado de pedido" : "Nuevo estado de pedido"}
    />
  );

  if (editing && resource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && resource.status === "error") {
    const notFound = resource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/pedidos/estados"
          backLabel="Volver a estados de pedido"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : resource.error?.message ??
                "No pudimos cargar el estado de pedido."
          }
          onRetry={notFound ? undefined : resource.reload}
          title={
            notFound
              ? "No encontramos ese estado"
              : "No pudimos cargar el estado de pedido"
          }
        />
      </div>
    );
  }

  if (editing && !resource.data) return null;

  return (
    <OrderStatusFormContent mode={mode} orderStatus={resource.data ?? undefined} />
  );
}

function OrderStatusFormContent({
  mode,
  orderStatus,
}: {
  mode: "create" | "edit";
  orderStatus?: OrderStatus;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = mode === "edit" && orderStatus !== undefined;

  const statusesResource = useAsyncResource(fetchOrderStatuses);

  const [code, setCode] = useState(orderStatus?.code ?? "");
  const [name, setName] = useState(orderStatus?.name ?? "");
  const [description, setDescription] = useState(
    orderStatus?.description ?? "",
  );
  const [sortOrder, setSortOrder] = useState(
    orderStatus ? String(orderStatus.sort_order) : "",
  );
  const [nextStatusCode, setNextStatusCode] = useState(
    orderStatus?.next_status_code ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});

  const codeId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const sortOrderId = useId();
  const nextStatusId = useId();

  const clientErrors: FormErrorItem[] = useMemo(() => {
    const list: FormErrorItem[] = [];
    const trimmedCode = code.trim();

    if (!isEdit) {
      if (!trimmedCode) {
        list.push({
          fieldId: codeId,
          label: "Código",
          message: COPY.codeRequired,
        });
      } else if (trimmedCode.length > CODE_MAX_LENGTH) {
        list.push({
          fieldId: codeId,
          label: "Código",
          message: COPY.codeLength,
        });
      }
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      list.push({
        fieldId: nameId,
        label: "Nombre",
        message: COPY.nameRequired,
      });
    } else if (normalizedName.length > NAME_MAX_LENGTH) {
      list.push({
        fieldId: nameId,
        label: "Nombre",
        message: COPY.nameLength,
      });
    }

    const sortError = sortOrderError(sortOrder);
    if (sortError) {
      list.push({
        fieldId: sortOrderId,
        label: "Orden",
        message: sortError,
      });
    }

    if (description.trim().length > DESCRIPTION_MAX_LENGTH) {
      list.push({
        fieldId: descriptionId,
        label: "Descripción",
        message: COPY.descriptionLength,
      });
    }

    const currentCode = isEdit ? orderStatus?.code : trimmedCode;
    if (nextStatusCode && currentCode && nextStatusCode === currentCode) {
      list.push({
        fieldId: nextStatusId,
        label: "Siguiente estado",
        message: COPY.sameNext,
      });
    }

    return list;
  }, [
    code,
    codeId,
    description,
    descriptionId,
    isEdit,
    name,
    nameId,
    nextStatusCode,
    nextStatusId,
    orderStatus?.code,
    sortOrder,
    sortOrderId,
  ]);

  const visibleErrors = useMemo(() => {
    const result: Record<string, string> = {};
    for (const error of clientErrors) {
      if (touched[error.fieldId] || attempted) {
        result[error.fieldId] = error.message;
      }
    }
    return { ...result, ...serverFieldErrors };
  }, [attempted, clientErrors, serverFieldErrors, touched]);

  const summaryErrors = useMemo(() => {
    const items = clientErrors.filter(
      (error) => attempted || touched[error.fieldId],
    );
    const indexes = new Map(
      items.map((error, index) => [error.fieldId, index]),
    );
    const labels: Record<string, string> = {
      [codeId]: "Código",
      [nameId]: "Nombre",
      [descriptionId]: "Descripción",
      [sortOrderId]: "Orden",
      [nextStatusId]: "Siguiente estado",
    };

    for (const [fieldId, message] of Object.entries(serverFieldErrors)) {
      const error: FormErrorItem = {
        fieldId,
        label: labels[fieldId] ?? "Revisa el campo",
        message,
      };
      const index = indexes.get(fieldId);
      if (index === undefined) {
        indexes.set(fieldId, items.length);
        items.push(error);
      } else {
        items[index] = error;
      }
    }

    return items;
  }, [
    attempted,
    clientErrors,
    codeId,
    descriptionId,
    nameId,
    nextStatusId,
    serverFieldErrors,
    sortOrderId,
    touched,
  ]);

  const hasChanges = useMemo(() => {
    if (isEdit && orderStatus) {
      return (
        name !== orderStatus.name ||
        description !== orderStatus.description ||
        sortOrder !== String(orderStatus.sort_order) ||
        nextStatusCode !== (orderStatus.next_status_code ?? "")
      );
    }
    return Boolean(
      code.trim() ||
        name.trim() ||
        description.trim() ||
        sortOrder.trim() ||
        nextStatusCode,
    );
  }, [
    code,
    description,
    isEdit,
    name,
    nextStatusCode,
    orderStatus,
    sortOrder,
  ]);

  useUnsavedChangesWarning(hasChanges && !busy);

  const statuses = statusesResource.data ?? [];
  const nextOptions = statuses
    .filter(
      (status) =>
        String(status.id) !== String(orderStatus?.id ?? "") &&
        status.code !== (isEdit ? orderStatus?.code : code.trim()),
    )
    .map((status) => ({
      value: status.code,
      label: `${statusName(status)} (${status.code})`,
    }));

  const statusesLoading = statusesResource.status === "loading";
  const statusesError = statusesResource.status === "error";

  function clearServerFieldError(fieldId: string) {
    setServerFieldErrors((current) => {
      if (!(fieldId in current)) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setSubmitError(null);
  }

  function applySubmitError(caught: unknown) {
    setServerFieldErrors({});
    setSubmitError(null);

    if (!(caught instanceof ApiError)) {
      setSubmitError(COPY.generic);
      return;
    }

    const normalizedMessage = caught.message.trim().toLowerCase();

    if (caught.status === 400) {
      setSubmitError(COPY.missingData);
      return;
    }
    if (caught.status === 401) {
      setSubmitError(COPY.session);
      return;
    }
    if (caught.status === 403) {
      setSubmitError(COPY.forbidden);
      return;
    }
    if (caught.status === 404) {
      setSubmitError(COPY.notFound);
      return;
    }

    if (caught.status === 409) {
      if (
        normalizedMessage.includes("already exists") ||
        normalizedMessage.includes("duplicate")
      ) {
        setServerFieldErrors({ [codeId]: COPY.duplicate });
        setTouched((current) => ({ ...current, [codeId]: true }));
        setSubmitError(COPY.duplicate);
        window.requestAnimationFrame(() => focusFirstInvalidField());
        return;
      }
      setSubmitError(translateApiError(caught).message);
      return;
    }

    if (caught.status === 422) {
      const next: Record<string, string> = {};
      const messages: string[] = [];

      for (const [field, rawMessage] of Object.entries(caught.fieldErrors)) {
        const normalizedField = field.toLowerCase();
        if (
          normalizedField === "code" ||
          normalizedField === "codigo"
        ) {
          if (/exist|duplicat/i.test(rawMessage)) {
            next[codeId] = COPY.duplicate;
          } else if (/match|pattern|format|lowercase|letter/i.test(rawMessage)) {
            next[codeId] = COPY.codeFormat;
          } else {
            next[codeId] = "Revisa el código del estado.";
          }
          messages.push(next[codeId]);
          continue;
        }
        if (normalizedField === "name" || normalizedField === "nombre") {
          next[nameId] = "Revisa el nombre del estado.";
          messages.push(next[nameId]);
          continue;
        }
        if (
          normalizedField === "description" ||
          normalizedField === "descripcion"
        ) {
          next[descriptionId] = COPY.descriptionLength;
          messages.push(next[descriptionId]);
          continue;
        }
        if (
          normalizedField === "sort_order" ||
          normalizedField === "sortorder"
        ) {
          next[sortOrderId] = COPY.sortNumber;
          messages.push(next[sortOrderId]);
          continue;
        }
        if (
          normalizedField === "next_status_code" ||
          normalizedField === "nextstatuscode" ||
          normalizedField === "next_status"
        ) {
          next[nextStatusId] = /exist/i.test(rawMessage)
            ? COPY.missingNext
            : COPY.invalidTransition;
          messages.push(next[nextStatusId]);
        }
      }

      if (
        normalizedMessage.includes("cycle") ||
        normalizedMessage.includes("invalid status transition")
      ) {
        next[nextStatusId] = COPY.invalidTransition;
        messages.push(COPY.invalidTransition);
      } else if (
        /next[_ ]?status/.test(normalizedMessage) &&
        /(not exist|does not exist|invalid)/.test(normalizedMessage)
      ) {
        next[nextStatusId] = COPY.missingNext;
        messages.push(COPY.missingNext);
      } else if (
        normalizedMessage.includes("already exists") ||
        normalizedMessage.includes("duplicate")
      ) {
        next[codeId] = COPY.duplicate;
        messages.push(COPY.duplicate);
      }

      if (Object.keys(next).length > 0) {
        setServerFieldErrors(next);
        setTouched((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.keys(next).map((fieldId) => [fieldId, true]),
          ),
        }));
        setSubmitError(messages[0] ?? COPY.validation);
        window.requestAnimationFrame(() => focusFirstInvalidField());
      } else {
        setSubmitError(COPY.validation);
      }
      return;
    }

    setSubmitError(translateApiError(caught).message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setAttempted(true);
    setSubmitError(null);
    setServerFieldErrors({});

    if (clientErrors.length > 0) {
      setTouched((current) => ({
        ...current,
        ...Object.fromEntries(
          clientErrors.map((error) => [error.fieldId, true]),
        ),
      }));
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    const parsedSortOrder = Number(sortOrder.trim());
    const normalizedNext = nextStatusCode.trim() || null;

    setBusy(true);

    try {
      if (isEdit && orderStatus) {
        const update: OrderStatusUpdate = {
          name: name.trim(),
          description: description.trim() || null,
          sort_order: parsedSortOrder,
          next_status_code: normalizedNext,
        };
        await updateOrderStatus(orderStatus.id, update);
        toast.success("Estado actualizado.");
      } else {
        const input: OrderStatusInput = {
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || null,
          sort_order: parsedSortOrder,
          next_status_code: normalizedNext,
        };
        await createOrderStatus(input);
        toast.success("Estado creado.");
      }
      router.push("/app/pedidos/estados");
    } catch (caught) {
      applySubmitError(caught);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/pedidos/estados"
          >
            Volver a estados
          </Link>
        }
        description={
          isEdit
            ? "Actualiza el nombre, la descripción, el orden y el siguiente estado. El código y el indicador de sistema no se pueden cambiar."
            : "Registra un estado adicional y define su lugar en la cadena de pedidos."
        }
        eyebrow="Operación"
        title={
          isEdit
            ? `Editar ${orderStatus?.code ?? "estado"}`
            : "Nuevo estado de pedido"
        }
      />

      <NoticeBanner tone="info">{COPY.flowNotice}</NoticeBanner>

      {isEdit && (
        <NoticeBanner title="Flujo de pedidos" tone="warning">
          {COPY.changeWarning}
        </NoticeBanner>
      )}

      {isEdit && orderStatus?.is_system && (
        <NoticeBanner title="Estado del sistema" tone="warning">
          {COPY.systemNotice}
        </NoticeBanner>
      )}

      <form
        aria-busy={busy}
        className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
        noValidate
        onSubmit={handleSubmit}
      >
        <section aria-labelledby="datos-estado-pedido">
          <h2
            className="text-xl font-semibold tracking-[-0.025em] text-ink"
            id="datos-estado-pedido"
          >
            Datos del estado
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            El código identifica el estado. El orden define su posición en la
            presentación y el siguiente estado define la transición.
          </p>

          {submitError && (
            <div
              className="mt-5 rounded-2xl border border-alert/25 bg-alert/[0.06] px-4 py-3.5"
              role="alert"
              tabIndex={-1}
            >
              <p className="text-[13px] font-semibold text-alert-ink">
                {submitError}
              </p>
            </div>
          )}

          <div className="mt-5">
            <FormErrorSummary errors={summaryErrors} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <TextField
              disabled={busy}
              error={visibleErrors[codeId]}
              help={
                isEdit
                  ? "El código es inmutable y no se envía al guardar."
                  : "Obligatorio. Máximo 20 caracteres. El API valida el formato y la unicidad."
              }
              id={codeId}
              label="Código"
              maxLength={CODE_MAX_LENGTH}
              mono
              onBlur={() =>
                setTouched((current) => ({ ...current, [codeId]: true }))
              }
              onChange={(value) => {
                clearServerFieldError(codeId);
                setCode(value);
              }}
              placeholder="ej. en_espera"
              readOnly={isEdit}
              required
              value={code}
            />

            <TextField
              disabled={busy}
              error={visibleErrors[nameId]}
              help="Obligatorio. Máximo 100 caracteres."
              id={nameId}
              label="Nombre"
              maxLength={NAME_MAX_LENGTH}
              onBlur={() =>
                setTouched((current) => ({ ...current, [nameId]: true }))
              }
              onChange={(value) => {
                clearServerFieldError(nameId);
                setName(value);
              }}
              placeholder="Ej. En despacho"
              required
              value={name}
            />

            <TextField
              disabled={busy}
              error={visibleErrors[sortOrderId]}
              help="Obligatorio. Afecta solo el orden de presentación; no mueve pedidos."
              id={sortOrderId}
              inputMode="numeric"
              label="Orden"
              onBlur={() =>
                setTouched((current) => ({ ...current, [sortOrderId]: true }))
              }
              onChange={(value) => {
                clearServerFieldError(sortOrderId);
                setSortOrder(value.replace(/[^\d]/g, ""));
              }}
              placeholder="Ej. 60"
              required
              value={sortOrder}
            />

            <SelectField
              disabled={busy}
              emptyLabel="No hay otros estados disponibles."
              error={visibleErrors[nextStatusId]}
              help={
                nextStatusCode
                  ? `Siguiente: ${getOrderStatusLabel(nextStatusCode)} (${nextStatusCode}). ${COPY.changeWarning}`
                  : "Sin siguiente estado: el estado se considera terminal."
              }
              id={nextStatusId}
              label="Siguiente estado"
              loadError={
                statusesError ? "No pudimos cargar los estados." : null
              }
              loading={statusesLoading}
              loadingLabel="Cargando estados…"
              onChange={(value) => {
                clearServerFieldError(nextStatusId);
                setNextStatusCode(value);
              }}
              onRetry={statusesResource.reload}
              options={nextOptions}
              placeholder="Sin siguiente estado (terminal)"
              value={nextStatusCode}
            />

            <div className="lg:col-span-2">
              <TextAreaField
                disabled={busy}
                error={visibleErrors[descriptionId]}
                help={`Opcional. ${description.length} de 255 caracteres.`}
                id={descriptionId}
                label="Descripción"
                maxLength={DESCRIPTION_MAX_LENGTH}
                onChange={(value) => {
                  clearServerFieldError(descriptionId);
                  setDescription(value);
                }}
                placeholder="Explica cuándo se usa este estado dentro del flujo."
                rows={3}
                value={description}
              />
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Link
            className="button-base button-secondary min-h-11 px-6 text-center"
            href="/app/pedidos/estados"
          >
            Cancelar
          </Link>
          <BusyButton
            busy={busy}
            busyLabel="Guardando…"
            className="min-h-11 px-6"
            type="submit"
          >
            {isEdit ? "Guardar" : "Crear estado"}
            <Icon name="arrow-right" size={17} />
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
