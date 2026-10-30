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
  STATE_FIELD_IDS,
  mapStateFieldErrors,
  stateSummaryItems,
  type StateFieldKey,
} from "@/components/erp/records/location-errors";
import { createState, updateState, type StateRecord } from "@/components/erp/records/locations-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";

type StateFormDialogProps = {
  open: boolean;
  stateRecord?: StateRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

type StateFormValues = {
  name: string;
  code: string;
};

const EMPTY_VALUES: StateFormValues = { name: "", code: "" };

const COPY = {
  nameRequired: "Ingresa el nombre del estado.",
  nameLength: "El nombre debe tener entre 2 y 100 caracteres.",
  codeRequired: "Ingresa el código del estado.",
  codeLength: "El código debe tener entre 2 y 10 caracteres.",
  codeSpaces: "El código no puede contener espacios.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe un estado con ese nombre.",
  forbidden: "No tienes permisos para guardar estados.",
  notFound: "No encontramos este estado. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic: "No pudimos guardar el estado. Revisa tu conexión e intenta de nuevo.",
} as const;

export function StateFormDialog({
  open,
  stateRecord,
  onClose,
  onSaved,
}: StateFormDialogProps) {
  const toast = useToast();
  const editing = Boolean(stateRecord);
  const [values, setValues] = useState<StateFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initializedKey, setInitializedKey] = useState<string | null>(null);

  const formKey = open ? (stateRecord ? `edit-${stateRecord.id}` : "create") : "closed";
  if (initializedKey !== formKey) {
    setInitializedKey(formKey);
    if (open) {
      setValues(
        stateRecord
          ? { name: stateRecord.name, code: stateRecord.code.toUpperCase() }
          : EMPTY_VALUES,
      );
      setErrors({});
      setShowSummary(false);
      setMessage(null);
      setSubmitting(false);
    }
  }

  function clearFieldError(field: StateFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: StateFieldKey, value: string) {
    setValues((current) => ({
      ...current,
      [field]: field === "code" ? value.toUpperCase() : value,
    }));
    setMessage(null);
    clearFieldError(field);
  }

  function validate() {
    const next: Record<string, string> = {};
    const name = values.name.trim();
    const code = values.code.trim();

    if (!name) next.name = COPY.nameRequired;
    else if (name.length < 2 || name.length > 100) next.name = COPY.nameLength;

    if (!code) next.code = COPY.codeRequired;
    else if (code.length < 2 || code.length > 10) next.code = COPY.codeLength;
    else if (!/^\S+$/.test(code)) next.code = COPY.codeSpaces;

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

    const payload = {
      name: values.name.trim(),
      code: values.code.trim().toUpperCase(),
    };

    try {
      if (stateRecord) {
        await updateState(stateRecord.id, payload);
        toast.success("Cambios guardados.");
      } else {
        await createState(payload);
        toast.success("Estado creado.");
      }
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
          setErrors({});
          setShowSummary(false);
          setMessage(COPY.duplicate);
        } else if (caught.status === 422) {
          const mapped = mapStateFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
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

  const summaryItems = stateSummaryItems(errors);

  return (
    <FormDialog
      closeDisabled={submitting}
      description={
        editing
          ? "Actualiza el nombre o el código del estado geográfico."
          : "El código se guarda en mayúsculas. No es un estado de ítem del inventario."
      }
      onClose={onClose}
      open={open}
      title={editing ? "Editar estado" : "Nuevo estado"}
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
          help="Obligatorio. Entre 2 y 100 caracteres."
          id={STATE_FIELD_IDS.name}
          label="Nombre del estado"
          maxLength={100}
          onChange={(value) => updateField("name", value)}
          placeholder="Ej. Aragua"
          required
          value={values.name}
        />

        <TextField
          autoComplete="off"
          disabled={submitting}
          error={errors.code}
          help="Obligatorio. Entre 2 y 10 caracteres, sin espacios. Se guarda en mayúsculas."
          id={STATE_FIELD_IDS.code}
          label="Código"
          maxLength={10}
          onChange={(value) => updateField("code", value)}
          placeholder="Ej. DISTRITO"
          required
          value={values.code}
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
            {editing ? "Guardar cambios" : "Crear estado"}
            <Icon name="arrow-right" size={17} />
          </BusyButton>
        </div>
      </form>
    </FormDialog>
  );
}
