import { ApiError } from "@/lib/api";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const SUPPLIER_FIELD_IDS = {
  name: "proveedor-nombre",
  identification: "proveedor-identificacion",
  email: "proveedor-correo",
  phone: "proveedor-telefono",
  address: "proveedor-direccion",
  observations: "proveedor-observaciones",
  state_id: "proveedor-estado",
  city_id: "proveedor-ciudad",
} as const;

export type SupplierFieldKey = keyof typeof SUPPLIER_FIELD_IDS;

export const SUPPLIER_FIELD_LABELS: Record<SupplierFieldKey, string> = {
  name: "Nombre",
  identification: "Identificación",
  email: "Correo",
  phone: "Teléfono",
  address: "Dirección",
  observations: "Observaciones",
  state_id: "Estado",
  city_id: "Ciudad",
};

const FIELD_ALIASES: Record<string, SupplierFieldKey> = {
  name: "name",
  identification: "identification",
  email: "email",
  phone: "phone",
  address: "address",
  observations: "observations",
  state_id: "state_id",
  stateid: "state_id",
  city_id: "city_id",
  cityid: "city_id",
};

const FIELD_MESSAGES: Record<SupplierFieldKey, string> = {
  name: "Ingresa un nombre de 2 a 150 caracteres.",
  identification: "Ingresa una identificación de 5 a 30 caracteres.",
  email: "Ingresa un correo válido.",
  phone: "Ingresa un teléfono de 7 a 30 caracteres.",
  address: "Ingresa una dirección de 5 a 255 caracteres.",
  observations: "Las observaciones no pueden superar los 1000 caracteres.",
  state_id: "Selecciona un estado válido.",
  city_id: "Selecciona una ciudad válida.",
};

export const SUPPLIER_LOCATION_MESSAGE =
  "La ciudad seleccionada no pertenece al estado.";

export function supplierHasLocationConflict(error: unknown) {
  if (!(error instanceof ApiError)) return false;
  return Object.entries(error.fieldErrors).some(
    ([field, message]) =>
      field.toLowerCase() === "city_id" && /belong/i.test(message),
  );
}

export function mapSupplierFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const key = FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    mapped[key] =
      key === "city_id" && /belong/i.test(rawMessage)
        ? SUPPLIER_LOCATION_MESSAGE
        : FIELD_MESSAGES[key];
  }

  return mapped;
}

export function supplierSummaryItems(
  errors: Record<string, string>,
): FormErrorItem[] {
  return (Object.keys(SUPPLIER_FIELD_IDS) as SupplierFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: SUPPLIER_FIELD_IDS[key],
      label: SUPPLIER_FIELD_LABELS[key],
      message: errors[key],
    }));
}
