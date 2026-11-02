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
import {
  FormErrorSummary,
  focusFirstInvalidField,
  useUnsavedChangesWarning,
  type FormErrorItem,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  SwitchField,
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
  createPaymentTerm,
  fetchPaymentTerm,
  updatePaymentTerm,
  type PaymentTerm,
  type PaymentTermInput,
  type PaymentTermUpdate,
} from "@/lib/finance/payment-terms-api";
import { ApiError } from "@/lib/api";
import { translateApiError, translateFieldMessage } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const CODE_PATTERN = /^[a-z][a-z0-9_]{1,29}$/;
const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 255;
const DAYS_MIN = 0;
const DAYS_MAX = 3650;

const COPY = {
  codeRequired: "Ingresa el código del término.",
  codeFormat:
    "El código debe empezar con una letra y usar solo minúsculas, números o guion bajo, entre 2 y 30 caracteres.",
  nameRequired: "Ingresa el nombre del término.",
  nameLength: "El nombre debe tener máximo 100 caracteres.",
  descriptionLength: "La descripción no puede superar los 255 caracteres.",
  daysRequired: "Ingresa los días del término.",
  daysInteger: "Los días deben ser un número entero.",
  daysRange: `Los días deben estar entre ${DAYS_MIN} y ${DAYS_MAX}.`,
  duplicate: "Ya existe un término de pago con ese código.",
  forbidden: "No tienes permiso para administrar términos.",
  notFound: "No encontramos ese término. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  generic:
    "No pudimos guardar el término de pago. Revisa tu conexión e intenta de nuevo.",
} as const;

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function daysError(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return COPY.daysRequired;
  if (!/^\d+$/.test(trimmed)) return COPY.daysInteger;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < DAYS_MIN || parsed > DAYS_MAX) {
    return COPY.daysRange;
  }
  return null;
}

type PaymentTermFormPageProps = {
  mode: "create" | "edit";
  termId?: string;
};

export function PaymentTermFormPage({
  mode,
  termId,
}: PaymentTermFormPageProps) {
  const { user } = useSession();

  if (!canReadModule(user.role, "terminos_pago")) {
    return (
      <AccessState description="No tienes permiso para administrar términos de pago." />
    );
  }

  if (!canWriteModule(user.role, "terminos_pago")) {
    return (
      <AccessState description="Tu rol puede consultar términos de pago, pero no crearlos ni editarlos." />
    );
  }

  if (mode === "edit" && !isPositiveRecordId(termId)) {
    return (
      <RecordsLoadError
        backHref="/app/terminos-de-pago"
        backLabel="Volver a términos de pago"
        description="Puede que el enlace no sea válido o que el término ya no exista."
        headingLevel="h1"
        title="No encontramos ese término"
      />
    );
  }

  return <PaymentTermFormLoader mode={mode} termId={termId} />;
}

function PaymentTermFormLoader({ mode, termId }: PaymentTermFormPageProps) {
  const editing = mode === "edit";
  const loader = useCallback(
    () => fetchPaymentTerm(termId ?? ""),
    [termId],
  );
  const resource = useAsyncResource(loader, { enabled: editing });

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/terminos-de-pago"
        >
          Volver a términos
        </Link>
      }
      description="Contado usa 0 días. Crédito usa los días indicados para calcular el vencimiento."
      eyebrow="Finanzas"
      title={editing ? "Editar término de pago" : "Nuevo término de pago"}
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
          backHref="/app/terminos-de-pago"
          backLabel="Volver a términos de pago"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : resource.error?.message ??
                "No pudimos cargar el término de pago."
          }
          onRetry={notFound ? undefined : resource.reload}
          title={
            notFound
              ? "No encontramos ese término"
              : "No pudimos cargar el término de pago"
          }
        />
      </div>
    );
  }

  if (editing && !resource.data) return null;

  return (
    <PaymentTermFormContent
      mode={mode}
      term={resource.data ?? undefined}
    />
  );
}

function PaymentTermFormContent({
  mode,
  term,
}: {
  mode: "create" | "edit";
  term?: PaymentTerm;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = mode === "edit" && term !== undefined;

  const codeId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const daysId = useId();
  const activeId = useId();

  const initialCode = term?.code ?? "";
  const initialName = term?.name ?? "";
  const initialDescription = term?.description ?? "";
  const initialDays = term ? String(term.days) : "";
  const initialActive = term?.is_active ?? true;

  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [days, setDays] = useState(initialDays);
  const [isActive, setIsActive] = useState(initialActive);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<
    Record<string, string>
  >({});

  const clientErrors: FormErrorItem[] = useMemo(() => {
    const list: FormErrorItem[] = [];

    if (!isEdit) {
      const normalizedCode = code.trim();
      if (!normalizedCode) {
        list.push({
          fieldId: codeId,
          label: "Código",
          message: COPY.codeRequired,
        });
      } else if (!CODE_PATTERN.test(normalizedCode)) {
        list.push({
          fieldId: codeId,
          label: "Código",
          message: COPY.codeFormat,
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

    if (description.trim().length > DESCRIPTION_MAX_LENGTH) {
      list.push({
        fieldId: descriptionId,
        label: "Descripción",
        message: COPY.descriptionLength,
      });
    }

    const errorDays = daysError(days);
    if (errorDays) {
      list.push({
        fieldId: daysId,
        label: "Días",
        message: errorDays,
      });
    }

    return list;
  }, [
    code,
    codeId,
    days,
    daysId,
    description,
    descriptionId,
    isEdit,
    name,
    nameId,
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
      [daysId]: "Días",
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
    daysId,
    descriptionId,
    nameId,
    serverFieldErrors,
    touched,
  ]);

  const hasChanges = useMemo(() => {
    if (isEdit) {
      return (
        name !== initialName ||
        description !== initialDescription ||
        days !== initialDays ||
        isActive !== initialActive
      );
    }
    return Boolean(
      code.trim() ||
        name.trim() ||
        description.trim() ||
        days.trim() ||
        isActive !== initialActive,
    );
  }, [
    code,
    days,
    description,
    initialActive,
    initialDays,
    initialDescription,
    initialName,
    isActive,
    isEdit,
    name,
  ]);

  useUnsavedChangesWarning(hasChanges && !busy);

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

    if (caught.status === 409) {
      const message = caught.message.trim().toLowerCase();
      if (message === "payment term already exists" && !isEdit) {
        setSubmitError(COPY.duplicate);
        setServerFieldErrors({ [codeId]: COPY.duplicate });
        setTouched((current) => ({ ...current, [codeId]: true }));
        window.requestAnimationFrame(() => focusFirstInvalidField());
        return;
      }
      setSubmitError(translateApiError(caught).message);
      return;
    }

    if (caught.status === 422) {
      const next: Record<string, string> = {};
      if (!isEdit && caught.fieldErrors.code) {
        next[codeId] = translateFieldMessage(caught.fieldErrors.code);
      }
      if (caught.fieldErrors.name) {
        next[nameId] = translateFieldMessage(caught.fieldErrors.name);
      }
      if (caught.fieldErrors.description) {
        next[descriptionId] = translateFieldMessage(
          caught.fieldErrors.description,
        );
      }
      if (caught.fieldErrors.days) {
        next[daysId] = COPY.daysRange;
      }

      if (Object.keys(next).length > 0) {
        setServerFieldErrors(next);
        setTouched((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.keys(next).map((fieldId) => [fieldId, true]),
          ),
        }));
        window.requestAnimationFrame(() => focusFirstInvalidField());
      } else {
        setSubmitError(translateApiError(caught).message);
      }
      return;
    }

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

    const parsedDays = Number(days.trim());
    if (!Number.isFinite(parsedDays)) return;

    const input: PaymentTermInput = {
      code: normalizeCode(code),
      name: name.trim(),
      description: description.trim() || undefined,
      days: parsedDays,
      is_active: isActive,
    };

    setBusy(true);
    try {
      if (isEdit && term) {
        const update: PaymentTermUpdate = {
          name: name.trim(),
          description: description.trim() || null,
          days: parsedDays,
          is_active: isActive,
        };
        const saved = await updatePaymentTerm(String(term.id), update);
        toast.success("Término actualizado.");
        router.push(`/app/terminos-de-pago/${saved.id}`);
      } else {
        const saved = await createPaymentTerm(input);
        toast.success("Término creado.");
        router.push(`/app/terminos-de-pago/${saved.id}`);
      }
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
            href="/app/terminos-de-pago"
          >
            Volver a términos
          </Link>
        }
        description={
          isEdit
            ? "Actualiza el nombre, la descripción, los días y el estado. El código no se puede cambiar."
            : "Registra un término de contado o crédito con su código, nombre y días."
        }
        eyebrow="Finanzas"
        title={
          isEdit
            ? `Editar ${term?.code ?? "término de pago"}`
            : "Nuevo término de pago"
        }
      />

      <form
        aria-busy={busy}
        className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="space-y-6">
          {submitError && (
            <div
              className="rounded-2xl border border-alert/25 bg-alert/[0.06] px-4 py-3.5"
              role="alert"
              tabIndex={-1}
            >
              <p className="text-[13px] font-semibold text-alert-ink">
                {submitError}
              </p>
            </div>
          )}

          <FormErrorSummary errors={summaryErrors} />

          <TextField
            disabled={busy}
            error={visibleErrors[codeId]}
            help={
              isEdit
                ? "El código no se puede cambiar después de crear el término."
                : "Obligatorio. Empieza con una letra y usa solo minúsculas, números o guion bajo; entre 2 y 30 caracteres. No se puede cambiar después."
            }
            id={codeId}
            label="Código"
            maxLength={30}
            mono
            onBlur={() =>
              setTouched((current) => ({ ...current, [codeId]: true }))
            }
            onChange={(value) => {
              clearServerFieldError(codeId);
              setCode(normalizeCode(value));
            }}
            placeholder="Ej. credit_30"
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
            placeholder="Ej. Crédito 30 días"
            required
            value={name}
          />

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
            placeholder="Ej. Pago a 30 días desde la emisión de la factura."
            rows={3}
            value={description}
          />

          <TextField
            disabled={busy}
            error={visibleErrors[daysId]}
            help="Obligatorio. Contado usa 0 días. Crédito usa los días indicados para calcular el vencimiento, entre 0 y 3650."
            id={daysId}
            inputMode="numeric"
            label="Días"
            maxLength={4}
            onBlur={() =>
              setTouched((current) => ({ ...current, [daysId]: true }))
            }
            onChange={(value) => {
              clearServerFieldError(daysId);
              setDays(value.replace(/[^0-9]/g, ""));
            }}
            placeholder="Ej. 30"
            required
            value={days}
          />

          <SwitchField
            checked={isActive}
            disabled={busy}
            help="Solo los términos activos se pueden asignar a clientes, pedidos y facturas."
            id={activeId}
            label="Activo"
            offIcon="eye-off"
            offLabel="Inactivo"
            onChange={setIsActive}
            onLabel="Activo"
          />
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Link
            className="button-base button-secondary min-h-11 px-6 text-center"
            href="/app/terminos-de-pago"
          >
            Cancelar
          </Link>
          <BusyButton
            busy={busy}
            busyLabel="Guardando…"
            className="min-h-11 px-6"
            type="submit"
          >
            {isEdit ? "Guardar cambios" : "Guardar"}
            <Icon name="arrow-right" size={17} />
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
