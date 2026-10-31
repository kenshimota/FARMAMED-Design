"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  SelectField,
  TextField,
} from "@/components/erp/records/form-controls";
import {
  METHOD_PAYMENT_FIELD_TYPES,
  getMethodPaymentFieldTypeLabel,
  isMethodPaymentFieldType,
  isTextFieldType,
  type MethodPaymentField,
  type MethodPaymentFieldType,
} from "@/lib/finance/method-payment-types-api";

export const MAX_FIELDS = 20;
export const MAX_FIELD_KEY_LENGTH = 41;
export const MAX_FIELD_LABEL_LENGTH = 100;
export const MAX_LENGTH_MIN = 1;
export const MAX_LENGTH_MAX = 255;
export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,40}$/;

export const FIELD_TYPE_OPTIONS = METHOD_PAYMENT_FIELD_TYPES.map((type) => ({
  value: type,
  label: getMethodPaymentFieldTypeLabel(type),
}));

const DESKTOP_LAYOUT_QUERY = "(min-width: 1280px)";
const BUILDER_LAYOUT_QUERY = "(min-width: 768px)";
let desktopLayoutQuery: MediaQueryList | null = null;
let builderLayoutQuery: MediaQueryList | null = null;

function getDesktopLayoutQuery() {
  if (!desktopLayoutQuery) {
    desktopLayoutQuery = window.matchMedia(DESKTOP_LAYOUT_QUERY);
  }
  return desktopLayoutQuery;
}

function subscribeToDesktopLayout(callback: () => void) {
  const query = getDesktopLayoutQuery();
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useDesktopLayout() {
  return useSyncExternalStore(
    subscribeToDesktopLayout,
    () => getDesktopLayoutQuery().matches,
    () => false,
  );
}

function getBuilderLayoutQuery() {
  if (!builderLayoutQuery) {
    builderLayoutQuery = window.matchMedia(BUILDER_LAYOUT_QUERY);
  }
  return builderLayoutQuery;
}

function subscribeToBuilderLayout(callback: () => void) {
  const query = getBuilderLayoutQuery();
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function useFieldsBuilderVisible() {
  return useSyncExternalStore(
    subscribeToBuilderLayout,
    () => getBuilderLayoutQuery().matches,
    () => false,
  );
}

export type EditableField = {
  uid: string;
  key: string;
  label: string;
  type: MethodPaymentFieldType;
  required: boolean;
  maxLength: string;
};

export type FieldRowErrors = Partial<
  Record<"key" | "label" | "type" | "max_length", string>
>;

export type FieldValidation = {
  rows: Record<string, FieldRowErrors>;
  summary: { fieldId: string; label: string; message: string }[];
  hasErrors: boolean;
};

export function normalizeMaxLength(value: string) {
  return value.replace(/[^0-9]/g, "").slice(0, 3);
}

export function validateFieldDefinitions(fields: EditableField[]): FieldValidation {
  const rows: Record<string, FieldRowErrors> = {};
  const summary: FieldValidation["summary"] = [];
  const seenKeys = new Map<string, string>();

  fields.forEach((field, index) => {
    const errors: FieldRowErrors = {};
    const position = index + 1;
    const key = field.key.trim();
    const label = field.label.trim();
    const fieldName = label || key || `Campo ${position}`;

    if (!key) {
      errors.key = "Ingresa la clave del campo.";
    } else if (!FIELD_KEY_PATTERN.test(key)) {
      errors.key =
        "Usa una letra inicial y solo minúsculas, números o guion bajo (2 a 41 caracteres).";
    } else if (seenKeys.has(key)) {
      errors.key = "La clave debe ser única entre los campos.";
    } else {
      seenKeys.set(key, field.uid);
    }

    if (!label) {
      errors.label = "Ingresa la etiqueta del campo.";
    } else if (label.length > MAX_FIELD_LABEL_LENGTH) {
      errors.label = "La etiqueta debe tener máximo 100 caracteres.";
    }

    if (!isMethodPaymentFieldType(field.type)) {
      errors.type = "Selecciona un tipo de dato válido.";
    }

    if (isTextFieldType(field.type) && field.maxLength.trim()) {
      const maxLength = Number(field.maxLength);
      if (
        !Number.isInteger(maxLength) ||
        maxLength < MAX_LENGTH_MIN ||
        maxLength > MAX_LENGTH_MAX
      ) {
        errors.max_length = "La longitud máxima debe ser un entero entre 1 y 255.";
      }
    }

    if (Object.keys(errors).length > 0) {
      rows[field.uid] = errors;
      for (const [property, message] of Object.entries(errors)) {
        summary.push({
          fieldId: `${field.uid}-${property.replace("_", "-")}`,
          label: `${fieldName}: ${propertyLabel(property)}`,
          message,
        });
      }
    }
  });

  return { rows, summary, hasErrors: Object.keys(rows).length > 0 };
}

function propertyLabel(property: string) {
  switch (property) {
    case "key":
      return "Clave";
    case "label":
      return "Etiqueta";
    case "type":
      return "Tipo de dato";
    case "max_length":
      return "Longitud máxima";
    default:
      return property;
  }
}

export function toApiFields(fields: EditableField[]): MethodPaymentField[] {
  return fields.map((field) => {
    const definition: MethodPaymentField = {
      key: field.key.trim(),
      label: field.label.trim(),
      type: field.type,
      required: field.required,
    };

    if (isTextFieldType(field.type) && field.maxLength.trim()) {
      definition.max_length = Number(field.maxLength);
    }

    return definition;
  });
}

function fieldSignature(field: MethodPaymentField) {
  return JSON.stringify([
    field.key,
    field.label,
    field.type,
    field.required,
    field.max_length ?? null,
  ]);
}

export function sameFieldDefinitions(
  left: MethodPaymentField[],
  right: MethodPaymentField[],
) {
  if (left.length !== right.length) return false;
  return left.every(
    (field, index) => fieldSignature(field) === fieldSignature(right[index]),
  );
}

type MethodPaymentFieldsEditorProps = {
  fields: EditableField[];
  rowErrors: Record<string, FieldRowErrors>;
  showErrors: boolean;
  disabled?: boolean;
  serverError?: string | null;
  onAdd: () => void;
  onChange: (uid: string, patch: Partial<EditableField>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onRemove: (uid: string) => void;
};

export function MethodPaymentFieldsEditor({
  fields,
  rowErrors,
  showErrors,
  disabled = false,
  serverError,
  onAdd,
  onChange,
  onMove,
  onRemove,
}: MethodPaymentFieldsEditorProps) {
  const atLimit = fields.length >= MAX_FIELDS;
  const desktopLayout = useDesktopLayout();

  return (
    <section
      aria-labelledby="campos-definidos-titulo"
      className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
      id="campos-definidos"
      tabIndex={-1}
    >
      <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            className="text-xl font-semibold tracking-[-0.025em] text-ink"
            id="campos-definidos-titulo"
          >
            Campos definidos
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            Define los datos que se pedirán al registrar un método de pago. Puedes
            agregar hasta 20 campos, reordenarlos y quitar los que no uses.
          </p>
        </div>
        <button
          aria-describedby="campos-definidos-limite"
          className="button-base button-secondary min-h-11 shrink-0 px-5 text-[13px] max-md:!hidden md:inline-flex"
          disabled={disabled || atLimit}
          onClick={onAdd}
          type="button"
        >
          <Icon name="tag" size={17} />
          Agregar campo
        </button>
      </div>

      <p
        aria-live="polite"
        className="mt-4 text-[12px] font-semibold text-muted"
        id="campos-definidos-limite"
      >
        {fields.length} de {MAX_FIELDS} campos configurados
        {atLimit ? ". Alcanzaste el máximo." : "."}
      </p>

      {serverError && (
        <NoticeBanner className="mt-4" role="alert" tone="danger">
          {serverError}
        </NoticeBanner>
      )}

      <div className="mt-5 md:hidden">
        <NoticeBanner title="Constructor disponible en escritorio" tone="info">
          La edición de campos está disponible en escritorio. Aquí puedes consultar
          los campos definidos.
        </NoticeBanner>
        <div className="mt-4">
          <FieldsReadOnlyList
            fields={fields}
            rowErrors={rowErrors}
            showErrors={showErrors}
          />
        </div>
      </div>

      <div className="mt-5 hidden md:block">
        {fields.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line bg-background px-5 py-8 text-center text-[13px] leading-6 text-muted">
            Aún no hay campos definidos. Puedes guardar el tipo sin campos o agregar
            el primero.
          </p>
        ) : (
          <ol className="space-y-4">
            {fields.map((field, index) => {
              const errors = rowErrors[field.uid] ?? {};
              const fieldName = field.label.trim() || field.key.trim() || `Campo ${index + 1}`;
              const typeError = showErrors ? errors.type : undefined;

              return (
                <li key={field.uid}>
                  <details
                    className="group rounded-2xl border border-line bg-background"
                    open={desktopLayout || undefined}
                  >
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 xl:hidden">
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-ink">
                          Campo {index + 1}
                          {field.label.trim() ? `: ${field.label.trim()}` : ""}
                        </span>{" "}
                        <span className="mt-0.5 block truncate text-[12px] leading-5 text-muted">
                          Clave:{" "}
                          <span className="font-mono">
                            {field.key.trim() || "Sin clave"}
                          </span>
                          {" · "}
                          {getMethodPaymentFieldTypeLabel(field.type)}
                        </span>
                      </span>
                      <Icon
                        className="shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                        name="chevron-down"
                        size={16}
                      />
                    </summary>

                    <div className="border-t border-line p-4 xl:border-t-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3
                          className="text-[13px] font-semibold text-ink"
                          id={`${field.uid}-titulo`}
                        >
                          Campo {index + 1}
                        </h3>
                        <div
                          aria-label={`Orden y eliminación de ${fieldName}`}
                          className="flex flex-wrap gap-2"
                          role="group"
                        >
                          <button
                            aria-label={`Subir ${fieldName}`}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={disabled || index === 0}
                            onClick={() => onMove(index, -1)}
                            type="button"
                          >
                            Subir
                          </button>
                          <button
                            aria-label={`Bajar ${fieldName}`}
                            className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={disabled || index === fields.length - 1}
                            onClick={() => onMove(index, 1)}
                            type="button"
                          >
                            Bajar
                          </button>
                          <button
                            aria-label={`Eliminar campo ${fieldName}`}
                            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-alert/30 bg-surface px-3.5 text-[12px] font-semibold text-alert-ink transition-colors hover:border-alert hover:bg-alert/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={disabled}
                            onClick={() => onRemove(field.uid)}
                            type="button"
                          >
                            <Icon name="close" size={14} />
                            Eliminar campo
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
                        <TextField
                          disabled={disabled}
                          error={showErrors ? errors.key : undefined}
                          id={`${field.uid}-key`}
                          label="Clave"
                          maxLength={MAX_FIELD_KEY_LENGTH}
                          mono
                          onChange={(value) => onChange(field.uid, { key: value })}
                          placeholder="numero_cuenta"
                          required
                          value={field.key}
                        />

                        <TextField
                          disabled={disabled}
                          error={showErrors ? errors.label : undefined}
                          id={`${field.uid}-label`}
                          label="Etiqueta"
                          maxLength={MAX_FIELD_LABEL_LENGTH}
                          onChange={(value) => onChange(field.uid, { label: value })}
                          placeholder="Número de cuenta"
                          required
                          value={field.label}
                        />

                        <SelectField
                          disabled={disabled}
                          error={typeError}
                          id={`${field.uid}-type`}
                          label="Tipo de dato"
                          onChange={(value) => {
                            if (!isMethodPaymentFieldType(value)) return;
                            onChange(field.uid, {
                              type: value,
                              ...(isTextFieldType(value) ? {} : { maxLength: "" }),
                            });
                          }}
                          options={FIELD_TYPE_OPTIONS}
                          placeholder="Selecciona un tipo"
                          required
                          value={field.type}
                        />

                        <div>
                          <span className="mb-2 block text-[13px] font-semibold text-ink">
                            Obligatorio
                          </span>
                          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-ink/15 bg-surface px-4 text-[13px] text-ink">
                            <input
                              checked={field.required}
                              className="h-5 w-5 accent-brand"
                              disabled={disabled}
                              id={`${field.uid}-required`}
                              onChange={(event) =>
                                onChange(field.uid, { required: event.target.checked })
                              }
                              type="checkbox"
                            />
                            <span>El método debe informar este dato.</span>
                          </label>
                        </div>

                        {isTextFieldType(field.type) ? (
                          <TextField
                            disabled={disabled}
                            error={showErrors ? errors.max_length : undefined}
                            help="Opcional. Entero de 1 a 255."
                            id={`${field.uid}-max-length`}
                            inputMode="numeric"
                            label="Longitud máxima"
                            onChange={(value) =>
                              onChange(field.uid, {
                                maxLength: normalizeMaxLength(value),
                              })
                            }
                            placeholder="255"
                            value={field.maxLength}
                          />
                        ) : (
                          <div>
                            <span className="mb-2 block text-[13px] font-semibold text-muted">
                              Longitud máxima
                            </span>
                            <p className="flex min-h-12 items-center rounded-xl border border-dashed border-line bg-surface px-4 text-[12px] leading-5 text-muted">
                              No aplica para este tipo de dato.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <FieldsPreview fields={fields} />
      </div>
    </section>
  );
}

function FieldsReadOnlyList({
  fields,
  rowErrors,
  showErrors,
}: {
  fields: EditableField[];
  rowErrors: Record<string, FieldRowErrors>;
  showErrors: boolean;
}) {
  if (fields.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-background px-5 py-6 text-center text-[13px] text-muted">
        Aún no hay campos definidos.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {fields.map((field, index) => {
        const errors = showErrors ? rowErrors[field.uid] ?? {} : {};

        return (
          <li
            className="rounded-2xl border border-line bg-background p-4"
            key={field.uid}
          >
            <p className="text-[13px] font-semibold text-ink">
              {index + 1}. {field.label.trim() || "Sin etiqueta"}
            </p>
            <dl className="mt-2 grid gap-1.5 text-[12px] leading-5 text-muted">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-ink">Clave:</dt>
                <dd className="font-mono">{field.key.trim() || "Sin clave"}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-ink">Tipo de dato:</dt>
                <dd>{getMethodPaymentFieldTypeLabel(field.type)}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-semibold text-ink">Obligatorio:</dt>
                <dd>{field.required ? "Sí" : "No"}</dd>
              </div>
              {isTextFieldType(field.type) && field.maxLength.trim() && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-ink">Longitud máxima:</dt>
                  <dd>{field.maxLength}</dd>
                </div>
              )}
            </dl>
            {Object.entries(errors).some(([, message]) => message) && (
              <ul className="mt-3 space-y-1.5 rounded-xl border border-alert/25 bg-alert/[0.06] px-3 py-2 text-[12px] leading-5 text-alert-ink">
                {Object.entries(errors).map(([property, message]) =>
                  message ? (
                    <li key={property}>
                      <span className="font-semibold">{propertyLabel(property)}:</span>{" "}
                      {message}
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function FieldsPreview({ fields }: { fields: EditableField[] }) {
  const builderVisible = useFieldsBuilderVisible();

  return (
    <div>
      <h3 className="text-[15px] font-semibold text-ink">
        Vista previa del formulario futuro
      </h3>
      <p className="mt-2 text-[12px] leading-5 text-muted">
        Así se pedirán los datos al registrar un método de pago. Esta vista es
        ilustrativa y no procesa pagos ni guarda credenciales.
      </p>

      {fields.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line bg-background px-5 py-6 text-center text-[13px] text-muted">
          {builderVisible
            ? "Agrega campos para ver la vista previa."
            : "La vista previa aparecerá cuando definas los campos desde escritorio."}
        </p>
      ) : (
        <div className="mt-4 grid gap-4 rounded-2xl border border-line bg-background p-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => {
            const previewId = `${field.uid}-preview`;
            const label = field.label.trim() || field.key.trim() || "Campo sin etiqueta";
            const helpId = `${field.uid}-preview-help`;

            return (
              <div key={field.uid}>
                {field.type === "boolean" ? (
                  <div>
                    <label
                      className="flex min-h-12 items-center gap-3 rounded-xl border border-ink/15 bg-surface px-4 text-[13px] text-ink"
                      htmlFor={previewId}
                    >
                      <input
                        aria-describedby={helpId}
                        disabled
                        id={previewId}
                        type="checkbox"
                      />
                      <span>
                        {label}
                        {field.required && (
                          <span className="ml-2 text-[11px] font-medium text-muted">
                            (obligatorio)
                          </span>
                        )}
                      </span>
                    </label>
                    <p className="mt-1.5 text-[11px] leading-5 text-muted" id={helpId}>
                      Clave: <span className="font-mono">{field.key.trim()}</span>
                    </p>
                  </div>
                ) : (
                  <div>
                    <label
                      className="mb-2 block text-[13px] font-semibold text-ink"
                      htmlFor={previewId}
                    >
                      {label}
                      {field.required && (
                        <span className="ml-2 text-[11px] font-medium text-muted">
                          (obligatorio)
                        </span>
                      )}
                    </label>
                    <input
                      aria-describedby={helpId}
                      className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[14px] text-ink disabled:cursor-not-allowed disabled:opacity-70"
                      disabled
                      id={previewId}
                      inputMode={
                        field.type === "email"
                          ? "email"
                          : field.type === "phone"
                            ? "tel"
                            : field.type === "integer"
                              ? "numeric"
                              : undefined
                      }
                      maxLength={field.maxLength ? Number(field.maxLength) : undefined}
                      placeholder={
                        field.type === "email"
                          ? "correo@ejemplo.com"
                          : field.type === "phone"
                            ? "+58 412 1234567"
                            : field.type === "integer"
                              ? "0"
                              : "Escribe un valor"
                      }
                      type={
                        field.type === "email"
                          ? "email"
                          : field.type === "phone"
                            ? "tel"
                            : field.type === "integer"
                              ? "number"
                              : "text"
                      }
                    />
                    <p className="mt-1.5 text-[11px] leading-5 text-muted" id={helpId}>
                      Clave: <span className="font-mono">{field.key.trim()}</span>
                      {field.maxLength ? ` · Máximo ${field.maxLength} caracteres` : ""}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
