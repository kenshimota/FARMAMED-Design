import { ApiError } from "@/lib/api";
import { translateFieldMessage } from "@/lib/api-errors";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const ITEM_STATE_FIELD_IDS = {
  name: "estado-item-nombre",
  label: "estado-item-etiqueta",
  description: "estado-item-descripcion",
  is_sellable: "estado-item-vendible",
} as const;

export type ItemStateFieldKey = keyof typeof ITEM_STATE_FIELD_IDS;

export const ITEM_STATE_FIELD_LABELS: Record<ItemStateFieldKey, string> = {
  name: "Clave técnica",
  label: "Etiqueta",
  description: "Descripción",
  is_sellable: "Se puede vender",
};

const FIELD_ALIASES: Record<string, ItemStateFieldKey> = {
  name: "name",
  label: "label",
  description: "description",
  is_sellable: "is_sellable",
  issellable: "is_sellable",
};

export function mapItemStateFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const key = FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    const normalized = rawMessage.toLowerCase();

    if (key === "name") {
      if (/between|length|longer|shorter|minimum|maximum/.test(normalized)) {
        mapped.name = "La clave debe tener entre 2 y 50 caracteres.";
      } else if (/snake|lowercase|underscore|format|pattern/.test(normalized)) {
        mapped.name = "Usa solo minúsculas, números y guion bajo (snake_case).";
      } else if (/exist/.test(normalized)) {
        mapped.name = "Ya existe un estado con ese nombre.";
      } else {
        mapped.name = translateFieldMessage(rawMessage);
      }
      continue;
    }

    if (key === "label" && /between|length|longer|shorter|minimum|maximum/.test(normalized)) {
      mapped.label = "La etiqueta debe tener entre 2 y 100 caracteres.";
      continue;
    }

    if (key === "description" && /255|length|maximum|long/.test(normalized)) {
      mapped.description = "La descripción no puede superar los 255 caracteres.";
      continue;
    }

    if (key === "is_sellable") {
      mapped.is_sellable = "El valor de «Se puede vender» no es válido.";
      continue;
    }

    mapped[key] = translateFieldMessage(rawMessage);
  }

  return mapped;
}

export function itemStateSummaryItems(
  errors: Record<string, string>,
): FormErrorItem[] {
  return (Object.keys(ITEM_STATE_FIELD_IDS) as ItemStateFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: ITEM_STATE_FIELD_IDS[key],
      label: ITEM_STATE_FIELD_LABELS[key],
      message: errors[key],
    }));
}
