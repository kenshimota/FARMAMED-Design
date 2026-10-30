import { ApiError } from "@/lib/api";
import { translateFieldMessage } from "@/lib/api-errors";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const PRODUCT_FIELD_IDS = {
  name: "producto-nombre",
  description: "producto-descripcion",
  reference: "producto-referencia",
  category_id: "producto-categoria",
  image_id: "producto-imagen",
} as const;

export type ProductFieldKey = keyof typeof PRODUCT_FIELD_IDS;

export const PRODUCT_FIELD_LABELS: Record<ProductFieldKey, string> = {
  name: "Nombre del producto",
  description: "Descripción",
  reference: "Referencia",
  category_id: "Categoría",
  image_id: "Imagen",
};

const FIELD_ALIASES: Record<string, ProductFieldKey> = {
  name: "name",
  description: "description",
  reference: "reference",
  category_id: "category_id",
  categoryid: "category_id",
  image_id: "image_id",
  imageid: "image_id",
};

const SPECIFIC_FIELD_MESSAGES: Partial<Record<ProductFieldKey, string>> = {
  category_id: "Selecciona una categoría válida.",
  image_id: "Selecciona una imagen válida.",
};

export function mapProductFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const key = FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    if (key === "reference" && /exist/i.test(rawMessage)) {
      mapped.reference = "Ya existe un producto con esa referencia.";
      continue;
    }
    mapped[key] = SPECIFIC_FIELD_MESSAGES[key] ?? translateFieldMessage(rawMessage);
  }

  return mapped;
}

export function productSummaryItems(errors: Record<string, string>): FormErrorItem[] {
  return (Object.keys(PRODUCT_FIELD_IDS) as ProductFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: PRODUCT_FIELD_IDS[key],
      label: PRODUCT_FIELD_LABELS[key],
      message: errors[key],
    }));
}
