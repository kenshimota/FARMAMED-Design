"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FormErrorSummary, focusFirstInvalidField } from "@/components/erp/ui/form";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import {
  CITY_FIELD_IDS,
  citySummaryItems,
  mapCityFieldErrors,
  type CityFieldKey,
} from "@/components/erp/records/location-errors";
import {
  createCity,
  updateCity,
  type CityRecord,
  type StateRecord,
} from "@/components/erp/records/locations-api";
import { toApiId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";

type CityFormDialogProps = {
  open: boolean;
  cityRecord?: CityRecord | null;
  states: StateRecord[];
  statesLoading: boolean;
  statesError: string | null;
  onRetryStates: () => void;
  onClose: () => void;
  onSaved: () => void;
};

type CityFormValues = {
  name: string;
  state_id: string;
};

const EMPTY_VALUES: CityFormValues = { name: "", state_id: "" };

const COPY = {
  nameRequired: "Ingresa el nombre de la ciudad.",
  nameLength: "El nombre debe tener entre 2 y 100 caracteres.",
  stateRequired: "Selecciona un estado.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe esa ciudad en el estado.",
  forbidden: "No tienes permisos para guardar ciudades.",
  notFound: "No encontramos esta ciudad. Puede que haya sido eliminada.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic: "No pudimos guardar la ciudad. Revisa tu conexión e intenta de nuevo.",
} as const;

export function CityFormDialog({
  open,
  cityRecord,
  states,
  statesLoading,
  statesError,
  onRetryStates,
  onClose,
  onSaved,
}: CityFormDialogProps) {
  const toast = useToast();
  const editing = Boolean(cityRecord);
  const [values, setValues] = useState<CityFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [initializedKey, setInitializedKey] = useState<string | null>(null);

  const formKey = open ? (cityRecord ? `edit-${cityRecord.id}` : "create") : "closed";
  if (initializedKey !== formKey) {
    setInitializedKey(formKey);
    if (open) {
      setValues(
        cityRecord
          ? { name: cityRecord.name, state_id: String(cityRecord.state_id) }
          : EMPTY_VALUES,
      );
      setErrors({});
      setShowSummary(false);
      setMessage(null);
      setSubmitting(false);
    }
  }

  const stateOptions = states.map((state) => ({
    value: String(state.id),
    label: `${state.name} · ${state.code}`,
  }));
  const statesReady = !statesLoading && !statesError && states.length > 0;

  function clearFieldError(field: CityFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: CityFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    clearFieldError(field);
  }

  function validate() {
    const next: Record<string, string> = {};
    const name = values.name.trim();

    if (!name) next.name = COPY.nameRequired;
    else if (name.length < 2 || name.length > 100) next.name = COPY.nameLength;

    if (!values.state_id) next.state_id = COPY.stateRequired;

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !statesReady) return;

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
      state_id: toApiId(values.state_id),
    };

    try {
      if (cityRecord) {
        await updateCity(cityRecord.id, payload);
        toast.success("Cambios guardados.");
      } else {
        await createCity(payload);
        toast.success("Ciudad creada.");
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
          const mapped = mapCityFieldErrors(caught);
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

  const summaryItems = citySummaryItems(errors);

  return (
    <FormDialog
      closeDisabled={submitting}
      description="La ciudad pertenece a un estado geográfico del catálogo de Farmamed."
      onClose={onClose}
      open={open}
      title={editing ? "Editar ciudad" : "Nueva ciudad"}
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
          id={CITY_FIELD_IDS.name}
          label="Nombre de la ciudad"
          maxLength={100}
          onChange={(value) => updateField("name", value)}
          placeholder="Ej. Maracay"
          required
          value={values.name}
        />

        <SelectField
          disabled={submitting}
          emptyLabel="No hay estados configurados."
          error={errors.state_id}
          help="Selecciona el estado geográfico al que pertenece la ciudad."
          id={CITY_FIELD_IDS.state_id}
          label="Estado"
          loadError={statesError}
          loading={statesLoading}
          loadingLabel="Cargando estados…"
          onChange={(value) => updateField("state_id", value)}
          onRetry={onRetryStates}
          options={stateOptions}
          placeholder="Selecciona un estado"
          required
          value={values.state_id}
        />

        {!statesLoading && !statesError && states.length === 0 && (
          <NoticeBanner tone="warning">
            No hay estados configurados. Crea un estado antes de registrar una ciudad.
          </NoticeBanner>
        )}

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
            disabled={!statesReady}
            type="submit"
          >
            {editing ? "Guardar cambios" : "Crear ciudad"}
            <Icon name="arrow-right" size={17} />
          </BusyButton>
        </div>
      </form>
    </FormDialog>
  );
}
