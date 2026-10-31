"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useId,
  useMemo,
  useRef,
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
  MAX_FIELDS,
  MethodPaymentFieldsEditor,
  sameFieldDefinitions,
  toApiFields,
  useFieldsBuilderVisible,
  validateFieldDefinitions,
  type EditableField,
} from "@/components/erp/finance/method-payment-type-fields";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { fetchCurrencies } from "@/lib/finance/currencies-api";
import {
  createMethodPaymentType,
  fetchMethodPaymentType,
  updateMethodPaymentType,
  type MethodPaymentField,
  type MethodPaymentType,
  type MethodPaymentTypeUpdate,
} from "@/lib/finance/method-payment-types-api";
import { canWriteModule } from "@/lib/permissions";

const CODE_MIN_LENGTH = 2;
const CODE_MAX_LENGTH = 30;
const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 255;
const CODE_PATTERN = /^[A-Z0-9_]{2,30}$/;

const COPY = {
  catalogNotice:
    "Este catálogo define los datos de cobro. No procesa pagos ni guarda credenciales.",
  protectedNotice:
    "Si este tipo ya tiene métodos, no podrás cambiar la moneda ni los campos.",
  codeRequired: "Ingresa el código del tipo.",
  codeLength: "El código debe tener entre 2 y 30 caracteres.",
  codePattern: "Usa solo mayúsculas, números y guion bajo.",
  nameRequired: "Ingresa el nombre del tipo.",
  nameLength: "El nombre debe tener máximo 100 caracteres.",
  currencyRequired: "Selecciona una moneda activa.",
  descriptionLength: "La descripción no puede superar los 255 caracteres.",
  duplicate: "Ya existe un tipo con ese código.",
  hasMethods:
    "No puedes cambiar la moneda ni los campos porque el tipo ya tiene métodos.",
  invalidFields:
    "Revisa las definiciones de campos: clave, etiqueta, tipo y longitud.",
  invalidCurrency: "Selecciona una moneda activa.",
  generic:
    "No pudimos guardar el tipo de método de pago. Revisa tu conexión e intenta de nuevo.",
} as const;

type MethodPaymentTypeFormPageProps = {
  mode: "create" | "edit";
  typeId?: string;
};

type MethodPaymentTypeFormContentProps = {
  mode: "create" | "edit";
  methodPaymentType: MethodPaymentType | null;
};

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "")
    .slice(0, CODE_MAX_LENGTH);
}

function focusFieldsError() {
  window.requestAnimationFrame(() => {
    document.getElementById("campos-definidos")?.focus();
  });
}

function focusFirstError() {
  window.requestAnimationFrame(() => {
    const field = focusFirstInvalidField();
    if (field) return;
    document.getElementById("campos-definidos")?.focus();
  });
}

function editableFieldsFromApi(
  fields: MethodPaymentField[],
  typeId: string,
): EditableField[] {
  return fields.map((field, index) => ({
    uid: `tipo-${typeId}-campo-${index + 1}`,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    maxLength: field.max_length ? String(field.max_length) : "",
  }));
}

export function MethodPaymentTypeFormPage({
  mode,
  typeId,
}: MethodPaymentTypeFormPageProps) {
  const { user } = useSession();
  if (!canWriteModule(user.role, "tipos_metodos_pago")) {
    return <AccessState />;
  }

  if (mode === "edit" && !isPositiveRecordId(typeId)) {
    return (
      <RecordsLoadError
        backHref="/app/tipos-metodo-pago"
        backLabel="Volver a tipos de métodos de pago"
        description="Puede que el enlace no sea válido o que el tipo ya no exista."
        headingLevel="h1"
        title="No encontramos este tipo de método de pago"
      />
    );
  }

  return <MethodPaymentTypeFormLoader mode={mode} typeId={typeId} />;
}

function MethodPaymentTypeFormLoader({ mode, typeId }: MethodPaymentTypeFormPageProps) {
  const editing = mode === "edit";
  const typeLoader = useCallback(
    () => fetchMethodPaymentType(typeId ?? ""),
    [typeId],
  );
  const typeResource = useAsyncResource(typeLoader, { enabled: editing });

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/tipos-metodo-pago"
        >
          Volver a tipos
        </Link>
      }
      description={
        editing
          ? "Actualiza el nombre, la descripción, el estado y, si el tipo no tiene métodos, la moneda y los campos."
          : "Registra una categoría de cobro con su moneda y los campos que pedirá el método de pago."
      }
      eyebrow="Finanzas"
      title={editing ? `Editar ${typeResource.data?.code ?? "tipo"}` : "Nuevo tipo"}
    />
  );

  if (editing && typeResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && typeResource.status === "error") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/tipos-metodo-pago"
          backLabel="Volver a tipos de métodos de pago"
          description={typeResource.error?.message ?? "No pudimos cargar el tipo."}
          onRetry={typeResource.reload}
          title="No pudimos cargar el tipo de método de pago"
        />
      </div>
    );
  }

  if (editing && !typeResource.data) return null;

  return (
    <MethodPaymentTypeFormContent
      methodPaymentType={typeResource.data}
      mode={mode}
    />
  );
}

function MethodPaymentTypeFormContent({
  mode,
  methodPaymentType,
}: MethodPaymentTypeFormContentProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const isEdit = editing && methodPaymentType !== null;
  const builderVisible = useFieldsBuilderVisible();

  const currenciesResource = useAsyncResource(() => fetchCurrencies(editing), {
    enabled: true,
  });

  const [code, setCode] = useState(() => methodPaymentType?.code ?? "");
  const [name, setName] = useState(() => methodPaymentType?.name ?? "");
  const [currencyId, setCurrencyId] = useState(() =>
    methodPaymentType ? String(methodPaymentType.currency_id) : "",
  );
  const [description, setDescription] = useState(
    () => methodPaymentType?.description ?? "",
  );
  const [isActive, setIsActive] = useState(
    () => methodPaymentType?.is_active ?? true,
  );
  const [fields, setFields] = useState<EditableField[]>(() =>
    methodPaymentType
      ? editableFieldsFromApi(methodPaymentType.fields, String(methodPaymentType.id))
      : [],
  );
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
  const [fieldServerError, setFieldServerError] = useState<string | null>(null);
  const uidCounter = useRef(0);

  const nextFieldUid = useCallback(() => {
    uidCounter.current += 1;
    return `campo-${uidCounter.current}`;
  }, []);

  const codeId = useId();
  const nameId = useId();
  const currencyIdField = useId();
  const descriptionId = useId();
  const activeId = useId();

  const fieldValidation = useMemo(() => validateFieldDefinitions(fields), [fields]);
  const apiFields = useMemo(() => toApiFields(fields), [fields]);

  const clientErrors: FormErrorItem[] = useMemo(() => {
    const list: FormErrorItem[] = [];

    if (!isEdit) {
      const normalizedCode = code.trim();
      if (!normalizedCode) {
        list.push({ fieldId: codeId, label: "Código", message: COPY.codeRequired });
      } else if (
        normalizedCode.length < CODE_MIN_LENGTH ||
        normalizedCode.length > CODE_MAX_LENGTH
      ) {
        list.push({ fieldId: codeId, label: "Código", message: COPY.codeLength });
      } else if (!CODE_PATTERN.test(normalizedCode)) {
        list.push({ fieldId: codeId, label: "Código", message: COPY.codePattern });
      }
    }

    const normalizedName = name.trim();
    if (!normalizedName) {
      list.push({ fieldId: nameId, label: "Nombre", message: COPY.nameRequired });
    } else if (normalizedName.length > NAME_MAX_LENGTH) {
      list.push({ fieldId: nameId, label: "Nombre", message: COPY.nameLength });
    }

    if (!currencyId) {
      list.push({
        fieldId: currencyIdField,
        label: "Moneda",
        message: COPY.currencyRequired,
      });
    }

    if (description.trim().length > DESCRIPTION_MAX_LENGTH) {
      list.push({
        fieldId: descriptionId,
        label: "Descripción",
        message: COPY.descriptionLength,
      });
    }

    return list;
  }, [
    code,
    currencyId,
    currencyIdField,
    description,
    descriptionId,
    isEdit,
    name,
    nameId,
    codeId,
  ]);

  const visibleErrors = useMemo(() => {
    const result: Record<string, string> = {};
    for (const error of clientErrors) {
      if (touched[error.fieldId]) result[error.fieldId] = error.message;
    }
    return { ...result, ...serverFieldErrors };
  }, [clientErrors, touched, serverFieldErrors]);

  const showFieldErrors = attempted || Boolean(fieldServerError);

  const summaryErrors = useMemo(() => {
    const items: FormErrorItem[] = [];
    const indexByField = new Map<string, number>();
    const push = (error: FormErrorItem) => {
      const index = indexByField.get(error.fieldId);
      if (index === undefined) {
        indexByField.set(error.fieldId, items.length);
        items.push(error);
        return;
      }
      items[index] = error;
    };

    for (const error of clientErrors) {
      if (attempted || touched[error.fieldId]) push(error);
    }
    if (showFieldErrors) {
      for (const error of fieldValidation.summary) {
        push(
          builderVisible
            ? error
            : { ...error, targetId: "campos-definidos" },
        );
      }
    }
    if (fieldServerError) {
      push({
        fieldId: "campos-definidos",
        label: "Campos definidos",
        message: fieldServerError,
      });
    }
    for (const [fieldId, message] of Object.entries(serverFieldErrors)) {
      if (fieldId === currencyIdField) {
        push({ fieldId, label: "Moneda", message });
      } else if (fieldId === nameId) {
        push({ fieldId, label: "Nombre", message });
      } else if (fieldId === codeId) {
        push({ fieldId, label: "Código", message });
      } else if (fieldId === descriptionId) {
        push({ fieldId, label: "Descripción", message });
      }
    }
    return items;
  }, [
    attempted,
    builderVisible,
    clientErrors,
    codeId,
    currencyIdField,
    descriptionId,
    fieldServerError,
    fieldValidation.summary,
    nameId,
    serverFieldErrors,
    showFieldErrors,
    touched,
  ]);

  const hasChanges = useMemo(() => {
    if (isEdit && methodPaymentType) {
      return (
        name !== methodPaymentType.name ||
        description !== methodPaymentType.description ||
        isActive !== methodPaymentType.is_active ||
        String(methodPaymentType.currency_id) !== currencyId ||
        !sameFieldDefinitions(methodPaymentType.fields, apiFields)
      );
    }
    return Boolean(
      code.trim() ||
        name.trim() ||
        currencyId ||
        description.trim() ||
        fields.length > 0 ||
        !isActive,
    );
  }, [
    apiFields,
    code,
    currencyId,
    description,
    fields.length,
    isActive,
    isEdit,
    methodPaymentType,
    name,
  ]);

  useUnsavedChangesWarning(hasChanges && !busy);

  const currencies = currenciesResource.data ?? [];
  const currencyOptions = currencies
    .filter(
      (currency) =>
        currency.is_active || String(currency.id) === (currencyId || ""),
    )
    .map((currency) => {
      const badges = [
        currency.is_base ? "Base" : null,
        currency.is_default_for_transactions ? "Predeterminada" : null,
        !currency.is_active ? "Inactiva" : null,
      ].filter(Boolean);
      return {
        value: String(currency.id),
        label: `${currency.code} · ${currency.symbol}${
          badges.length > 0 ? ` · ${badges.join(" · ")}` : ""
        }`,
      };
    });

  function clearServerFieldError(fieldId: string) {
    setServerFieldErrors((current) => {
      if (!(fieldId in current)) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setSubmitError(null);
  }

  function markFieldsChanged() {
    setFieldServerError(null);
    setSubmitError(null);
  }

  function updateField(uid: string, patch: Partial<EditableField>) {
    markFieldsChanged();
    setFields((current) =>
      current.map((field) => (field.uid === uid ? { ...field, ...patch } : field)),
    );
  }

  function moveField(index: number, direction: -1 | 1) {
    markFieldsChanged();
    setFields((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  }

  function removeField(uid: string) {
    markFieldsChanged();
    setFields((current) => current.filter((field) => field.uid !== uid));
  }

  function addField() {
    if (fields.length >= MAX_FIELDS) return;
    markFieldsChanged();
    const uid = nextFieldUid();
    setFields((current) => {
      if (current.length >= MAX_FIELDS) return current;
      return [
        ...current,
        {
          uid,
          key: "",
          label: "",
          type: "text",
          required: false,
          maxLength: "",
        },
      ];
    });
  }

  function applySubmitError(caught: unknown) {
    setFieldServerError(null);
    setServerFieldErrors({});

    if (!(caught instanceof ApiError)) {
      setSubmitError(COPY.generic);
      return;
    }

    if (caught.status === 409) {
      const normalized = caught.message.trim().toLowerCase();
      if (normalized === "payment type already exists") {
        setSubmitError(COPY.duplicate);
        if (!isEdit) setServerFieldErrors({ [codeId]: COPY.duplicate });
        if (!isEdit) {
          setTouched((current) => ({ ...current, [codeId]: true }));
          focusFirstError();
        }
        return;
      }
      if (normalized === "payment type has methods") {
        setSubmitError(COPY.hasMethods);
        setFieldServerError(COPY.hasMethods);
        focusFieldsError();
        return;
      }
    }

    if (caught.status === 422) {
      const ui = translateApiError(caught);
      const next: Record<string, string> = {};
      const messages: string[] = [];
      let hasFieldsError = false;

      if (caught.fieldErrors.currency_id) {
        next[currencyIdField] = COPY.invalidCurrency;
        messages.push(COPY.invalidCurrency);
      }
      if (caught.fieldErrors.fields) {
        hasFieldsError = true;
        setFieldServerError(COPY.invalidFields);
        messages.push(COPY.invalidFields);
      }
      if (ui.fieldErrors.name) {
        next[nameId] = ui.fieldErrors.name;
        messages.push(ui.fieldErrors.name);
      }
      if (ui.fieldErrors.code && !isEdit) {
        next[codeId] = ui.fieldErrors.code;
        messages.push(ui.fieldErrors.code);
      }
      if (ui.fieldErrors.description) {
        next[descriptionId] = ui.fieldErrors.description;
        messages.push(ui.fieldErrors.description);
      }

      setServerFieldErrors(next);
      setSubmitError(messages[0] ?? "Revisa los datos del formulario.");
      if (Object.keys(next).length > 0) {
        setTouched((current) => ({
          ...current,
          ...Object.fromEntries(Object.keys(next).map((fieldId) => [fieldId, true])),
        }));
        focusFirstError();
      } else if (hasFieldsError) {
        focusFieldsError();
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
    setFieldServerError(null);
    setServerFieldErrors({});

    if (clientErrors.length > 0 || fieldValidation.hasErrors) {
      setTouched((current) => ({
        ...current,
        ...Object.fromEntries(
          [...clientErrors, ...fieldValidation.summary].map((error) => [
            error.fieldId,
            true,
          ]),
        ),
      }));
      focusFirstError();
      return;
    }

    setBusy(true);

    try {
      if (isEdit && methodPaymentType) {
        const update: MethodPaymentTypeUpdate = {
          name: name.trim(),
          description: description.trim(),
          is_active: isActive,
        };

        if (String(methodPaymentType.currency_id) !== currencyId) {
          update.currency_id = Number(currencyId);
        }

        if (!sameFieldDefinitions(methodPaymentType.fields, apiFields)) {
          update.fields = apiFields;
        }

        await updateMethodPaymentType(String(methodPaymentType.id), update);
        toast.success("Cambios guardados.");
      } else {
        await createMethodPaymentType({
          code: normalizeCode(code),
          name: name.trim(),
          currency_id: Number(currencyId),
          fields: apiFields,
          description: description.trim() || undefined,
          is_active: isActive,
        });
        toast.success("Tipo creado.");
      }

      router.push("/app/tipos-metodo-pago");
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
            href="/app/tipos-metodo-pago"
          >
            Volver a tipos
          </Link>
        }
        description={
          isEdit
            ? "Actualiza el nombre, la descripción, el estado y, si el tipo no tiene métodos, la moneda y los campos."
            : "Registra una categoría de cobro con su moneda y los campos que pedirá el método de pago."
        }
        eyebrow="Finanzas"
        title={
          isEdit
            ? `Editar ${methodPaymentType?.code ?? "tipo"}`
            : "Nuevo tipo"
        }
      />

      <NoticeBanner tone="info">{COPY.catalogNotice}</NoticeBanner>

      {isEdit && (
        <NoticeBanner title="Cambios protegidos" tone="warning">
          {COPY.protectedNotice}
        </NoticeBanner>
      )}

      <form
        aria-busy={busy}
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        <section
          aria-labelledby="datos-tipo"
          className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
        >
          <h2
            className="text-xl font-semibold tracking-[-0.025em] text-ink"
            id="datos-tipo"
          >
            Datos del tipo
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            El código identifica el tipo, la moneda define cómo se interpretan los
            montos y los campos describen los datos de cobro.
          </p>

          {submitError && (
            <div
              className="mt-5 rounded-2xl border border-alert/25 bg-alert/[0.06] px-4 py-3.5"
              role="alert"
              tabIndex={-1}
            >
              <p className="text-[13px] font-semibold text-alert-ink">{submitError}</p>
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
                  : "Entre 2 y 30 caracteres. Se guarda en mayúsculas."
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
                setCode(normalizeCode(value));
              }}
              placeholder="PAGO_MOVIL"
              readOnly={isEdit}
              required
              value={code}
            />

            <TextField
              disabled={busy}
              error={visibleErrors[nameId]}
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
              placeholder="Pago Móvil"
              required
              value={name}
            />

            <SelectField
              disabled={busy}
              emptyLabel="No hay monedas activas."
              error={visibleErrors[currencyIdField]}
              help={
                isEdit
                  ? "Solo se ofrecen monedas activas. La moneda actual se conserva aunque esté inactiva. No hay conversión automática de montos."
                  : "Solo se ofrecen monedas activas. No hay conversión automática de montos."
              }
              id={currencyIdField}
              label="Moneda"
              loadError={
                currenciesResource.status === "error"
                  ? "No pudimos cargar las monedas."
                  : null
              }
              loading={currenciesResource.status === "loading"}
              loadingLabel="Cargando monedas…"
              onChange={(value) => {
                clearServerFieldError(currencyIdField);
                markFieldsChanged();
                setCurrencyId(value);
              }}
              onRetry={currenciesResource.reload}
              options={currencyOptions}
              placeholder="Selecciona una moneda"
              required
              value={currencyId}
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
                placeholder="Describe cuándo se usa este tipo de cobro."
                rows={3}
                value={description}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span
                className="block text-[13px] font-semibold text-ink"
                id={`${activeId}-label`}
              >
                Activo
              </span>
              <p className="mt-1 text-[12px] leading-5 text-muted">
                Los tipos inactivos no se ofrecen al registrar métodos de pago.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                aria-live="polite"
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${
                  isActive ? "text-ink" : "text-muted"
                }`}
              >
                <Icon name={isActive ? "check" : "close"} size={14} />
                {isActive ? "Activo" : "Inactivo"}
              </span>
              <button
                aria-checked={isActive}
                aria-labelledby={`${activeId}-label`}
                className="group relative inline-flex min-h-11 w-14 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy}
                id={activeId}
                onClick={() => setIsActive((current) => !current)}
                role="switch"
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors motion-reduce:transition-none ${
                    isActive
                      ? "border-olive bg-olive group-hover:bg-[color-mix(in_srgb,var(--olive)_85%,var(--ink))]"
                      : "border-ink/60 bg-ink/50 group-hover:bg-ink/60"
                  }`}
                >
                  <span
                    className={`h-6 w-6 rounded-full bg-surface shadow-[0_2px_8px_rgba(27,12,104,0.2)] transition-transform motion-reduce:transition-none ${
                      isActive ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </section>

        <MethodPaymentFieldsEditor
          disabled={busy}
          fields={fields}
          onAdd={addField}
          onChange={updateField}
          onMove={moveField}
          onRemove={removeField}
          rowErrors={attempted ? fieldValidation.rows : {}}
          serverError={fieldServerError}
          showErrors={showFieldErrors}
        />

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          <Link
            className="button-base button-secondary min-h-11 px-6 text-center"
            href="/app/tipos-metodo-pago"
          >
            Cancelar
          </Link>
          <BusyButton
            busy={busy}
            busyLabel="Guardando…"
            className="min-h-11 px-6"
            type="submit"
          >
            {isEdit ? "Guardar cambios" : "Crear tipo"}
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
