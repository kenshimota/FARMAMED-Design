"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import {
  FormErrorSummary,
  focusFirstInvalidField,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import {
  SectionFormFields,
  ShelfFormFields,
  sectionToFormValues,
  shelfToFormValues,
  validateSectionValues,
  validateShelfValues,
  type SectionFormValues,
  type ShelfFormValues,
} from "@/components/erp/records/shelf-form-fields";
import {
  hasImmutableParentError,
  mapSectionFieldErrors,
  mapShelfFieldErrors,
  sectionSummaryItems,
  shelfSummaryItems,
} from "@/components/erp/records/shelf-errors";
import {
  updateSection,
  updateShelf,
  type ShelfRecord,
  type ShelfSectionRecord,
} from "@/components/erp/records/shelves-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";

const COPY = {
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  forbidden: "No tienes permisos para guardar estantes.",
  sectionForbidden: "No tienes permisos para guardar secciones.",
  notFound: "No encontramos este registro. Puede que haya sido eliminado.",
  shelfParent: "Un estante no se puede mover a otra bodega.",
  sectionParent: "Una sección no se puede mover a otro estante.",
  generic: "No pudimos guardar los cambios. Revisa tu conexión e intenta de nuevo.",
} as const;

type EditShelfDialogProps = {
  shelf: ShelfRecord;
  onClose: () => void;
  onSaved: () => void;
};

export function EditShelfDialog({ shelf, onClose, onSaved }: EditShelfDialogProps) {
  const toast = useToast();
  const [values, setValues] = useState<ShelfFormValues>(() =>
    shelfToFormValues(shelf),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof ShelfFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateShelfValues(values);
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

    const name = values.name.trim();
    const description = values.description.trim();

    try {
      await updateShelf(shelf.id, {
        code: values.code.trim().toUpperCase(),
        name: name || null,
        description: description || null,
      });
      toast.success("Cambios guardados.");
      onSaved();
      onClose();
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
          setMessage(translateApiError(caught).message);
        } else if (caught.status === 422) {
          if (hasImmutableParentError(caught, "warehouse_id")) {
            setMessage(COPY.shelfParent);
          } else {
            const mapped = mapShelfFieldErrors(caught);
            if (Object.keys(mapped).length > 0) {
              setErrors(mapped);
              setShowSummary(true);
              window.requestAnimationFrame(() => focusFirstInvalidField());
            } else {
              setMessage(translateApiError(caught).message);
            }
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

  const summaryItems = shelfSummaryItems(errors);

  return (
    <FormDialog
      closeDisabled={submitting}
      description="Actualiza el código, el nombre y la descripción del estante. La bodega no se puede cambiar."
      onClose={onClose}
      open
      title={`Editar estante ${shelf.code}`}
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

      <form className="mt-6" noValidate onSubmit={handleSubmit}>
        <ShelfFormFields
          disabled={submitting}
          errors={errors}
          onChange={updateField}
          values={values}
        />

        <p className="mt-5 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          Un estante no se puede mover a otra bodega.
        </p>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
            className="sm:min-w-[180px]"
            type="submit"
          >
            Guardar cambios
            <Icon name="arrow-right" size={18} />
          </BusyButton>
        </div>
      </form>
    </FormDialog>
  );
}

type EditSectionDialogProps = {
  shelf: ShelfRecord;
  section: ShelfSectionRecord;
  onClose: () => void;
  onSaved: () => void;
};

export function EditSectionDialog({
  shelf,
  section,
  onClose,
  onSaved,
}: EditSectionDialogProps) {
  const toast = useToast();
  const [values, setValues] = useState<SectionFormValues>(() =>
    sectionToFormValues(section),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof SectionFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateSectionValues(values);
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

    const name = values.name.trim();
    const description = values.description.trim();

    try {
      await updateSection(shelf.id, section.id, {
        code: values.code.trim().toUpperCase(),
        name: name || null,
        description: description || null,
      });
      toast.success("Cambios guardados.");
      onSaved();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          setMessage(COPY.missingData);
        } else if (caught.status === 401) {
          setMessage(COPY.session);
        } else if (caught.status === 403) {
          setMessage(COPY.sectionForbidden);
        } else if (caught.status === 404) {
          setMessage(COPY.notFound);
        } else if (caught.status === 409) {
          setMessage(translateApiError(caught).message);
        } else if (caught.status === 422) {
          if (hasImmutableParentError(caught, "shelf_id")) {
            setMessage(COPY.sectionParent);
          } else {
            const mapped = mapSectionFieldErrors(caught);
            if (Object.keys(mapped).length > 0) {
              setErrors(mapped);
              setShowSummary(true);
              window.requestAnimationFrame(() => focusFirstInvalidField());
            } else {
              setMessage(translateApiError(caught).message);
            }
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

  const summaryItems = sectionSummaryItems(errors);

  return (
    <FormDialog
      closeDisabled={submitting}
      description="Actualiza el código, el nombre y la descripción de la sección. El estante no se puede cambiar."
      onClose={onClose}
      open
      title={`Editar sección ${section.code}`}
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

      <form className="mt-6" noValidate onSubmit={handleSubmit}>
        <SectionFormFields
          disabled={submitting}
          errors={errors}
          onChange={updateField}
          values={values}
        />

        <p className="mt-5 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          Una sección no se puede mover a otro estante.
        </p>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
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
            className="sm:min-w-[180px]"
            type="submit"
          >
            Guardar cambios
            <Icon name="arrow-right" size={18} />
          </BusyButton>
        </div>
      </form>
    </FormDialog>
  );
}
