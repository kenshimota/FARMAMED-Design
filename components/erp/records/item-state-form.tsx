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
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  TextAreaField,
  TextField,
  SwitchField,
} from "@/components/erp/records/form-controls";
import {
  ITEM_STATE_FIELD_IDS,
  itemStateSummaryItems,
  mapItemStateFieldErrors,
  type ItemStateFieldKey,
} from "@/components/erp/records/item-state-errors";
import {
  createItemState,
  fetchItemState,
  updateItemState,
  type ItemStateInput,
} from "@/components/erp/records/item-states-api";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canWriteModule } from "@/lib/permissions";

type ItemStateFormValues = {
  name: string;
  label: string;
  description: string;
  is_sellable: boolean;
};

const EMPTY_VALUES: ItemStateFormValues = {
  name: "",
  label: "",
  description: "",
  is_sellable: false,
};

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const LABEL_MIN_LENGTH = 2;
const LABEL_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 255;
const NAME_PATTERN = /^[a-z0-9_]+$/;

const COPY = {
  nameRequired: "Ingresa la clave técnica.",
  nameLength: `La clave debe tener entre ${NAME_MIN_LENGTH} y ${NAME_MAX_LENGTH} caracteres.`,
  namePattern: "Usa solo minúsculas, números y guion bajo (snake_case).",
  labelRequired: "Ingresa la etiqueta visible.",
  labelLength: `La etiqueta debe tener entre ${LABEL_MIN_LENGTH} y ${LABEL_MAX_LENGTH} caracteres.`,
  descriptionLength: `La descripción no puede superar los ${DESCRIPTION_MAX_LENGTH} caracteres.`,
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe un estado con ese nombre.",
  inUse:
    "No puedes cambiar o eliminar este estado porque tiene costos, existencias o compras asociadas.",
  nameInUse:
    "La clave no cambió: el estado está en uso por costos, existencias o compras.",
  forbidden: "No tienes permisos para guardar estados de ítem.",
  notFound: "No encontramos este estado de ítem. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic:
    "No pudimos guardar el estado de ítem. Revisa tu conexión e intenta de nuevo.",
} as const;

type ItemStateFormPageProps = {
  mode: "create" | "edit";
  itemStateId?: string;
};

export function ItemStateFormPage({ mode, itemStateId }: ItemStateFormPageProps) {
  const { user } = useSession();
  if (!canWriteModule(user.role, "catalogo")) return <AccessState />;
  if (mode === "edit" && !isPositiveRecordId(itemStateId)) {
    return (
      <RecordsLoadError
        backHref="/app/estados-item"
        backLabel="Volver a estados de ítem"
        description="Puede que el enlace no sea válido o que el estado ya no exista."
        headingLevel="h1"
        title="No encontramos este estado de ítem"
      />
    );
  }
  return <ItemStateFormContent mode={mode} itemStateId={itemStateId} />;
}

function ItemStateFormContent({ mode, itemStateId }: ItemStateFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const itemStateLoader = useCallback(
    () => fetchItemState(itemStateId ?? ""),
    [itemStateId],
  );
  const itemStateResource = useAsyncResource(itemStateLoader, { enabled: editing });

  const [values, setValues] = useState<ItemStateFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] =
    useState<ItemStateFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [nameLocked, setNameLocked] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const itemState = itemStateResource.data;

  if (itemState) {
    const key = String(itemState.id);
    if (initializedFor !== key) {
      const next: ItemStateFormValues = {
        name: itemState.name,
        label: itemState.label,
        description: itemState.description ?? "",
        is_sellable: itemState.is_sellable,
      };
      setValues(next);
      setInitialValues(next);
      setNameLocked(false);
      setInitializedFor(key);
    }
  }

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  function clearFieldError(field: ItemStateFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: ItemStateFieldKey, value: string | boolean) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    clearFieldError(field);
  }

  function validate() {
    const next: Record<string, string> = {};
    const name = values.name.trim();
    const label = values.label.trim();

    if (!name) next.name = COPY.nameRequired;
    else if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
      next.name = COPY.nameLength;
    } else if (!NAME_PATTERN.test(name)) {
      next.name = COPY.namePattern;
    }

    if (!label) next.label = COPY.labelRequired;
    else if (label.length < LABEL_MIN_LENGTH || label.length > LABEL_MAX_LENGTH) {
      next.label = COPY.labelLength;
    }

    if (values.description.trim().length > DESCRIPTION_MAX_LENGTH) {
      next.description = COPY.descriptionLength;
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);

    const nameChanged = values.name.trim() !== initialValues.name.trim();
    const includeName = !editing || (!nameLocked && nameChanged);
    const payload: ItemStateInput = {
      ...(includeName ? { name: values.name.trim() } : {}),
      label: values.label.trim(),
      description: values.description.trim() ? values.description.trim() : null,
      is_sellable: values.is_sellable,
    };

    try {
      if (editing && itemStateId) {
        await updateItemState(itemStateId, payload);
        toast.success("Cambios guardados.");
      } else {
        await createItemState(payload);
        toast.success("Estado creado.");
      }
      setInitialValues(values);
      router.push("/app/estados-item");
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          setMessage(COPY.missingData);
        } else if (caught.status === 401) {
          setMessage(COPY.session);
        } else if (caught.status === 403) {
          setMessage(COPY.forbidden);
        } else if (caught.status === 404) {
          setMessage(COPY.notFound);
        } else if (caught.status === 409) {
          const normalized = caught.message.trim().toLowerCase();
          if (normalized.includes("in use")) {
            setNameLocked(true);
            setValues((current) => ({
              ...current,
              name: initialValues.name,
            }));
            setErrors({ name: COPY.nameInUse });
            setShowSummary(true);
            setMessage(COPY.inUse);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else if (normalized.includes("already exists")) {
            setErrors({ name: COPY.duplicate });
            setShowSummary(true);
            setMessage(COPY.duplicate);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translateApiError(caught).message);
          }
        } else if (caught.status === 422) {
          const mapped = mapItemStateFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            setMessage(null);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(COPY.validation);
          }
        } else {
          setMessage(translateApiError(caught).message);
        }
      } else {
        setMessage(COPY.generic);
      }
      setSubmitting(false);
    }
  }

  const headerTitle = editing ? "Editar estado de ítem" : "Nuevo estado de ítem";
  const headerDescription = editing
    ? "Actualiza la etiqueta, la descripción y la condición de venta. La clave técnica solo cambia si el estado no está en uso."
    : "Registra la condición de un producto con su clave estable y su etiqueta visible.";

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/estados-item"
        >
          Volver a estados de ítem
        </Link>
      }
      description={headerDescription}
      eyebrow="Catálogo"
      title={headerTitle}
    />
  );

  if (editing && itemStateResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && itemStateResource.status === "error") {
    const notFound = itemStateResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/estados-item"
          backLabel="Volver a estados de ítem"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : itemStateResource.error?.message ??
                "No pudimos cargar el estado de ítem."
          }
          onRetry={notFound ? undefined : itemStateResource.reload}
          title={
            notFound
              ? "No encontramos este estado de ítem"
              : "No pudimos cargar el estado de ítem"
          }
        />
      </div>
    );
  }

  const summaryItems = itemStateSummaryItems(errors);

  return (
    <div className="space-y-5">
      {header}

      <NoticeBanner tone="info">
        Los estados de ítem describen la condición del producto. Los estados
        geográficos están en{" "}
        <Link
          className="font-semibold text-brand underline underline-offset-4 hover:text-ink"
          href="/app/ubicaciones"
        >
          Ubicaciones
        </Link>
        .
      </NoticeBanner>

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Datos del estado</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-estado-item"
            >
              {editing ? "Información registrada" : "Información del nuevo estado"}
            </h2>
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

        {showSummary && summaryItems.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        <form
          aria-labelledby="datos-estado-item"
          className="mt-6 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="rounded-2xl border border-line bg-background p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
                Avanzado
              </span>
              <span className="rounded-full bg-soft-blue px-2.5 py-1 text-[10px] font-semibold text-brand">
                Clave estable
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-5 text-muted">
              Clave estable usada por el inventario. Solo cambia si el estado no
              está en uso.
            </p>
            <div className="mt-4">
              <TextField
                autoFocus={!editing}
                disabled={submitting}
                error={errors.name}
                help={
                  nameLocked
                    ? "El estado está en uso por costos, existencias o compras. La clave no se puede cambiar."
                    : editing
                      ? "Obligatoria. Entre 2 y 50 caracteres. Solo minúsculas, números y guion bajo. Si el estado está en uso por costos, existencias o compras, no podrás cambiarla."
                      : "Obligatoria. Entre 2 y 50 caracteres. Solo minúsculas, números y guion bajo."
                }
                id={ITEM_STATE_FIELD_IDS.name}
                label="Clave técnica"
                maxLength={NAME_MAX_LENGTH}
                mono
                onChange={(value) => updateField("name", value)}
                placeholder="Ej. sellable"
                readOnly={nameLocked}
                required
                value={values.name}
              />
            </div>
          </div>

          <TextField
            disabled={submitting}
            error={errors.label}
            help="Obligatoria. Entre 2 y 100 caracteres. Es el texto visible del estado."
            id={ITEM_STATE_FIELD_IDS.label}
            label="Etiqueta"
            maxLength={LABEL_MAX_LENGTH}
            onChange={(value) => updateField("label", value)}
            placeholder="Ej. Vendible"
            required
            value={values.label}
          />

          <TextAreaField
            disabled={submitting}
            error={errors.description}
            help={`Opcional. Máximo ${DESCRIPTION_MAX_LENGTH} caracteres. Si lo dejas vacío se guarda sin descripción. ${values.description.length}/${DESCRIPTION_MAX_LENGTH}`}
            id={ITEM_STATE_FIELD_IDS.description}
            label="Descripción"
            maxLength={DESCRIPTION_MAX_LENGTH}
            onChange={(value) => updateField("description", value)}
            placeholder="Explica cuándo se usa este estado sin agregar reglas de venta."
            rows={4}
            value={values.description}
          />

          <SwitchField
            checked={values.is_sellable}
            disabled={submitting}
            error={errors.is_sellable}
            help="Solo describe la condición del producto. No cambia existencias ni reglas de venta."
            id={ITEM_STATE_FIELD_IDS.is_sellable}
            label="Se puede vender"
            onChange={(checked) => updateField("is_sellable", checked)}
          />

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="button-base button-secondary min-h-11 px-5"
              href="/app/estados-item"
            >
              Cancelar
            </Link>
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="sm:min-w-[180px]"
              type="submit"
            >
              {editing ? "Guardar cambios" : "Crear estado"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
