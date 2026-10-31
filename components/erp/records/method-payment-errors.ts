import { ApiError } from "@/lib/api";
import {
  COPY,
  INVALID_EMAIL_MESSAGE,
  translateApiError,
} from "@/lib/api-errors";
import type { FormErrorItem } from "@/components/erp/ui/form";
import type {
  MethodPaymentFieldType,
  MethodPaymentTypeField,
} from "@/components/erp/records/method-payment-types-api";
import type { MethodPaymentDetails } from "@/components/erp/records/method-payments-api";

export const METHOD_PAYMENT_COPY = {
  privacy:
    "Estos datos son para cobro. No ingreses contraseñas, tokens ni datos completos de tarjetas.",
  typeImmutable: "El tipo de método no se puede cambiar.",
  typeNoFields: "Este tipo no requiere datos adicionales.",
  loadingTypes: "Cargando tipos de pago…",
  empty: "Todavía no hay métodos de pago registrados.",
  emptyFiltered: "No hay métodos que coincidan con los filtros.",
  created: "Método creado.",
  saved: "Cambios guardados.",
  deactivated: "Método desactivado.",
  reactivated: "Método reactivado.",
  deleted: "Método eliminado.",
  duplicate: "Ya existe un método con esa etiqueta para el tipo.",
  inUse: "No puedes eliminar este método porque está en uso.",
  reactivateBlocked:
    "No puedes reactivar este método mientras el tipo o su moneda estén inactivos.",
  notFound: "No encontramos este método de pago.",
  labelRequired: "La etiqueta es obligatoria.",
  labelLength: "La etiqueta debe tener entre 1 y 100 caracteres.",
  labelHelp:
    "Obligatorio. Entre 1 y 100 caracteres. La etiqueta no se puede repetir dentro del mismo tipo.",
  detailRequired: "Este campo es obligatorio.",
  detailTooLong: "El valor supera el máximo permitido.",
  phoneInvalid:
    "Ingresa un teléfono válido: de 6 a 20 caracteres con dígitos, +, espacios o guiones.",
  integerInvalid: "Ingresa un número entero sin decimales.",
  typeRequired: "Selecciona un tipo de método.",
  typeInvalid: "Selecciona un tipo de método válido.",
  stateInvalid: "Revisa el estado del método.",
  detailsInvalid: "Revisa los datos del método.",
  writeNotice:
    "Tu rol puede consultar los métodos de pago. Solo la administración puede crear, editar o eliminar datos de cobro.",
  inactiveNotice:
    "Este método está inactivo. Sigue inactivo hasta que lo reactives.",
  inheritedCurrency: "Se hereda del tipo de método y no se puede cambiar.",
} as const;

export const METHOD_PAYMENT_FIELD_IDS = {
  method_payment_type_id: "metodo-tipo",
  label: "metodo-etiqueta",
  is_active: "metodo-estado",
} as const;

export function detailFieldId(key: string) {
  return `metodo-dato-${key}`;
}

export const LABEL_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[0-9+\s-]{6,20}$/;
export const INTEGER_PATTERN = /^-?\d+$/;

export function validateLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return METHOD_PAYMENT_COPY.labelRequired;
  if (trimmed.length > LABEL_MAX_LENGTH) return METHOD_PAYMENT_COPY.labelLength;
  return null;
}

export function validateDetailField(
  field: Pick<MethodPaymentTypeField, "type" | "required" | "max_length">,
  value: string | boolean,
): string | null {
  if (field.type === "boolean") return null;
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return field.required ? METHOD_PAYMENT_COPY.detailRequired : null;

  if (field.max_length !== null && text.length > field.max_length) {
    return `Usa máximo ${field.max_length} caracteres.`;
  }
  switch (field.type) {
    case "email":
      return text.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(text)
        ? null
        : INVALID_EMAIL_MESSAGE;
    case "phone":
      return PHONE_PATTERN.test(text) ? null : METHOD_PAYMENT_COPY.phoneInvalid;
    case "integer":
      return INTEGER_PATTERN.test(text) ? null : METHOD_PAYMENT_COPY.integerInvalid;
    default:
      return null;
  }
}

export type DetailValues = Record<string, string | boolean>;

export function buildDetailErrors(
  fields: readonly MethodPaymentTypeField[],
  values: DetailValues,
) {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const message = validateDetailField(field, values[field.key] ?? "");
    if (message) errors[field.key] = message;
  }
  return errors;
}

export function buildDetailsPayload(
  fields: readonly MethodPaymentTypeField[],
  values: DetailValues,
  baseDetails?: MethodPaymentDetails,
): MethodPaymentDetails {
  const details: MethodPaymentDetails = {};
  if (baseDetails) {
    for (const [key, value] of Object.entries(baseDetails)) {
      if (!fields.some((field) => field.key === key)) details[key] = value;
    }
  }
  for (const field of fields) {
    const raw = values[field.key];
    if (field.type === "boolean") {
      details[field.key] = raw === true;
      continue;
    }
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) continue;
    details[field.key] = field.type === "integer" ? Number(text) : text;
  }
  return details;
}

export function detailFieldValue(details: MethodPaymentDetails, key: string) {
  const value = details[key];
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value;
  return String(value);
}

export function detailFieldPlaceholder(field: MethodPaymentTypeField) {
  switch (field.type) {
    case "email":
      return "correo@ejemplo.com";
    case "phone":
      return "04141234567";
    case "integer":
      return "0";
    default:
      return "";
  }
}

function readApiMessage(error: ApiError) {
  const payload = error.payload;
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message.trim();
  }
  return error.message.trim();
}

export function methodPaymentErrorMessage(
  caught: unknown,
  { reactivating = false }: { reactivating?: boolean } = {},
): string {
  if (caught instanceof ApiError) {
    const normalized = readApiMessage(caught).toLowerCase();

    if (caught.status === 409) {
      if (normalized.includes("already exists")) {
        return METHOD_PAYMENT_COPY.duplicate;
      }
      if (normalized.includes("is in use")) return METHOD_PAYMENT_COPY.inUse;
    }

    if (caught.status === 422) {
      if (reactivating) return METHOD_PAYMENT_COPY.reactivateBlocked;
      if (caught.fieldErrors.method_payment_type_id) {
        return METHOD_PAYMENT_COPY.typeImmutable;
      }
      if (caught.fieldErrors.details) return METHOD_PAYMENT_COPY.detailsInvalid;
    }

    if (caught.status === 404) return METHOD_PAYMENT_COPY.notFound;
    if (caught.status === 400) return COPY.badRequest;
  }

  return translateApiError(caught).message;
}

function detailFieldMessage(rawMessage: string) {
  const normalized = rawMessage.trim().toLowerCase();
  if (normalized.includes("required")) return METHOD_PAYMENT_COPY.detailRequired;
  if (
    normalized.includes("max_length") ||
    normalized.includes("too long") ||
    normalized.includes("length")
  ) {
    return METHOD_PAYMENT_COPY.detailTooLong;
  }
  if (normalized.includes("email")) return INVALID_EMAIL_MESSAGE;
  if (normalized.includes("phone") || normalized.includes("digit")) {
    return METHOD_PAYMENT_COPY.phoneInvalid;
  }
  if (
    normalized.includes("integer") ||
    normalized.includes("number") ||
    normalized.includes("decimal")
  ) {
    return METHOD_PAYMENT_COPY.integerInvalid;
  }
  return COPY.invalidField;
}

export function mapMethodPaymentFieldErrors(
  error: unknown,
  fields: readonly MethodPaymentTypeField[],
): Record<string, string> {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const key = field.trim().toLowerCase();
    if (key === "label") {
      mapped[METHOD_PAYMENT_FIELD_IDS.label] = rawMessage
        .trim()
        .toLowerCase()
        .includes("required")
        ? METHOD_PAYMENT_COPY.labelRequired
        : METHOD_PAYMENT_COPY.labelLength;
      continue;
    }
    if (key === "method_payment_type_id") {
      mapped[METHOD_PAYMENT_FIELD_IDS.method_payment_type_id] = rawMessage
        .trim()
        .toLowerCase()
        .includes("changed")
        ? METHOD_PAYMENT_COPY.typeImmutable
        : METHOD_PAYMENT_COPY.typeInvalid;
      continue;
    }
    if (key === "is_active") {
      mapped[METHOD_PAYMENT_FIELD_IDS.is_active] = METHOD_PAYMENT_COPY.stateInvalid;
      continue;
    }
    if (key === "details") continue;
    const detailMatch = /^details\.(.+)$/i.exec(key);
    if (detailMatch) {
      const detailKey = detailMatch[1];
      const known = fields.some((item) => item.key === detailKey);
      mapped[detailFieldId(detailKey)] = known
        ? detailFieldMessage(rawMessage)
        : METHOD_PAYMENT_COPY.detailsInvalid;
    }
  }

  return mapped;
}

export function summaryItemsFor(
  errors: Record<string, string>,
  fieldLabels: Record<string, string>,
): FormErrorItem[] {
  return Object.entries(errors)
    .filter(([fieldId]) => fieldLabels[fieldId])
    .map(([fieldId, message]) => ({
      fieldId,
      label: fieldLabels[fieldId],
      message,
    }));
}

export function detailInputType(type: MethodPaymentFieldType) {
  switch (type) {
    case "email":
      return "email" as const;
    case "phone":
      return "tel" as const;
    case "integer":
      return "number" as const;
    default:
      return "text" as const;
  }
}
