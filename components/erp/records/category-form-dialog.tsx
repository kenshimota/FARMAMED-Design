"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FormErrorSummary, focusFirstInvalidField } from "@/components/erp/ui/form";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { TextField } from "@/components/erp/records/form-controls";
import {
  createCategory,
  updateCategory,
  type CategoryRecord,
} from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError, translateFieldMessage } from "@/lib/api-errors";

const NAME_FIELD_ID = "categoria-nombre";
const NAME_MAX_LENGTH = 100;

const COPY = {
  nameRequired: "Ingresa el nombre de la categoría.",
  nameLength: `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres.`,
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe una categoría con ese nombre.",
  forbidden: "No tienes permisos para guardar categorías.",
  notFound: "No encontramos esta categoría. Puede que haya sido eliminada.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic:
    "No pudimos guardar la categoría. Revisa tu conexión e intenta de nuevo.",
} as const;

function mapCategoryFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  const rawMessage = error.fieldErrors.name;
  if (!rawMessage) return mapped;

  const normalized = rawMessage.toLowerCase();
  if (/exist|duplicate/.test(normalized)) {
    mapped.name = COPY.duplicate;
  } else if (/required|empty|missing/.test(normalized)) {
    mapped.name = COPY.nameRequired;
  } else if (/between|length|longer|shorter|minimum|maximum|100/.test(normalized)) {
    mapped.name = COPY.nameLength;
  } else {
    mapped.name = translateFieldMessage(rawMessage);
  }

  return mapped;
}

type CategoryFormDialogProps = {
  open: boolean;
  category?: CategoryRecord | null;
  onClose: () => void;
  onSaved: (category: CategoryRecord) => void;
  onMissing?: () => void;
};

export function CategoryFormDialog({
  open,
  category,
  onClose,
  onSaved,
  onMissing,
}: CategoryFormDialogProps) {
  const toast = useToast();
  const editing = Boolean(category);
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initializedKey, setInitializedKey] = useState<string | null>(null);

  const formKey = open ? (category ? `edit-${category.id}` : "create") : "closed";
  if (initializedKey !== formKey) {
    setInitializedKey(formKey);
    if (open) {
      setName(category?.name ?? "");
      setErrors({});
      setShowSummary(false);
      setMessage(null);
      setSubmitting(false);
    }
  }

  function updateName(value: string) {
    setName(value);
    setMessage(null);
    setErrors((current) => {
      if (!current.name) return current;
      const next = { ...current };
      delete next.name;
      return next;
    });
  }

  function validate() {
    const next: Record<string, string> = {};
    const trimmed = name.trim();

    if (!trimmed) next.name = COPY.nameRequired;
    else if (trimmed.length > NAME_MAX_LENGTH) next.name = COPY.nameLength;

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

    const payload = { name: name.trim() };

    try {
      const saved =
        editing && category
          ? await updateCategory(category.id, payload)
          : await createCategory(payload);
      toast.success(editing ? "Cambios guardados." : "Categoría creada.");
      onSaved(saved);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          setMessage(COPY.missingData);
        } else if (caught.status === 401) {
          setMessage(translateApiError(caught).message || COPY.session);
        } else if (caught.status === 403) {
          setMessage(translateApiError(caught).message || COPY.forbidden);
        } else if (caught.status === 404) {
          if (editing) {
            toast.error(COPY.notFound);
            setSubmitting(false);
            onClose();
            onMissing?.();
            return;
          }
          setMessage(COPY.notFound);
        } else if (caught.status === 409) {
          setErrors({ name: COPY.duplicate });
          setShowSummary(true);
          setMessage(null);
          window.requestAnimationFrame(() => focusFirstInvalidField());
        } else if (caught.status === 422) {
          const mapped = mapCategoryFieldErrors(caught);
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

  const summaryItems = errors.name
    ? [{ fieldId: NAME_FIELD_ID, label: "Nombre de la categoría", message: errors.name }]
    : [];

  return (
    <FormDialog
      closeDisabled={submitting}
      description="La categoría solo guarda un nombre visible para organizar el catálogo de Farmamed."
      onClose={onClose}
      open={open}
      title={editing ? "Editar categoría" : "Nueva categoría"}
    >
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

      <form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit}>
        <TextField
          autoFocus
          disabled={submitting}
          error={errors.name}
          help={`Obligatorio. Máximo ${NAME_MAX_LENGTH} caracteres. Se quitan los espacios al inicio y al final.`}
          id={NAME_FIELD_ID}
          label="Nombre de la categoría"
          maxLength={NAME_MAX_LENGTH}
          onChange={updateName}
          placeholder="Ej. Analgésicos"
          required
          value={name}
        />

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <button
            className="button-base button-secondary min-h-11 px-5"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <BusyButton
            busy={submitting}
            busyLabel="Guardando…"
            className="sm:min-w-[170px]"
            type="submit"
          >
            {editing ? "Guardar cambios" : "Crear categoría"}
            <Icon name="arrow-right" size={17} />
          </BusyButton>
        </div>
      </form>
    </FormDialog>
  );
}
