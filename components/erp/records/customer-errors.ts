import { ApiError } from "@/lib/api";
import type { FormErrorItem } from "@/components/erp/ui/form";
import {
  LATITUDE_RANGE,
  LONGITUDE_RANGE,
} from "@/components/erp/records/customers-api";

export const CUSTOMER_FIELD_IDS = {
  fullName: "cliente-nombre",
  email: "cliente-correo",
  direction: "cliente-direccion",
  latitude: "cliente-latitud",
  longitude: "cliente-longitud",
} as const;

export type CustomerFieldKey = keyof typeof CUSTOMER_FIELD_IDS;

export const CUSTOMER_FIELD_LABELS: Record<CustomerFieldKey, string> = {
  fullName: "Nombre completo",
  email: "Correo",
  direction: "Dirección",
  latitude: "Latitud",
  longitude: "Longitud",
};

const FIELD_ALIASES: Record<string, CustomerFieldKey> = {
  fullname: "fullName",
  full_name: "fullName",
  name: "fullName",
  email: "email",
  direction: "direction",
  address: "direction",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
};

const FIELD_MESSAGES: Record<CustomerFieldKey, string> = {
  fullName: "Ingresa el nombre completo del cliente.",
  email: "Ingresa un correo válido.",
  direction: "Ingresa la dirección del cliente.",
  latitude: `La latitud debe estar entre ${LATITUDE_RANGE.min} y ${LATITUDE_RANGE.max}.`,
  longitude: `La longitud debe estar entre ${LONGITUDE_RANGE.min} y ${LONGITUDE_RANGE.max}.`,
};

export function mapCustomerFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const field of Object.keys(error.fieldErrors)) {
    const key = FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    mapped[key] = FIELD_MESSAGES[key];
  }

  return mapped;
}

export function customerSummaryItems(
  errors: Record<string, string>,
): FormErrorItem[] {
  return (Object.keys(CUSTOMER_FIELD_IDS) as CustomerFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: CUSTOMER_FIELD_IDS[key],
      label: CUSTOMER_FIELD_LABELS[key],
      message: errors[key],
    }));
}
