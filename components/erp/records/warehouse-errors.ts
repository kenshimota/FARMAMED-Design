import { ApiError } from "@/lib/api";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const WAREHOUSE_FIELD_IDS = {
  name: "bodega-nombre",
  address: "bodega-direccion",
  observations: "bodega-observaciones",
} as const;

export type WarehouseFieldKey = keyof typeof WAREHOUSE_FIELD_IDS;

export const WAREHOUSE_FIELD_LABELS: Record<WarehouseFieldKey, string> = {
  name: "Nombre de la bodega",
  address: "Dirección",
  observations: "Observaciones",
};

const FIELD_ALIASES: Record<string, WarehouseFieldKey> = {
  name: "name",
  address: "address",
  observations: "observations",
};

const FIELD_MESSAGES: Record<WarehouseFieldKey, string> = {
  name: "Ingresa el nombre de la bodega.",
  address: "Ingresa la dirección de la bodega.",
  observations: "Las observaciones no son válidas.",
};

export function mapWarehouseFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const field of Object.keys(error.fieldErrors)) {
    const key = FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    mapped[key] = FIELD_MESSAGES[key];
  }

  return mapped;
}

export function warehouseSummaryItems(
  errors: Record<string, string>,
): FormErrorItem[] {
  return (Object.keys(WAREHOUSE_FIELD_IDS) as WarehouseFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: WAREHOUSE_FIELD_IDS[key],
      label: WAREHOUSE_FIELD_LABELS[key],
      message: errors[key],
    }));
}
