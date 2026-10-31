import { ApiError } from "@/lib/api";
import { translateFieldMessage } from "@/lib/api-errors";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const COST_FIELD_IDS = {
  product_id: "costo-producto",
  item_state_id: "costo-estado-item",
  cost: "costo-monto",
  currency_id: "costo-moneda",
} as const;

export type CostFieldKey = keyof typeof COST_FIELD_IDS;

export const COST_FIELD_LABELS: Record<CostFieldKey, string> = {
  product_id: "Producto",
  item_state_id: "Estado del ítem",
  cost: "Costo",
  currency_id: "Moneda",
};

const FIELD_ALIASES: Record<string, CostFieldKey> = {
  product: "product_id",
  product_id: "product_id",
  productid: "product_id",
  item_state: "item_state_id",
  item_state_id: "item_state_id",
  itemstate: "item_state_id",
  itemstateid: "item_state_id",
  cost: "cost",
  amount: "cost",
  currency: "currency_id",
  currency_id: "currency_id",
  currencyid: "currency_id",
};

const FIELD_MESSAGES: Partial<Record<CostFieldKey, string>> = {
  product_id: "Selecciona un producto válido.",
  item_state_id: "Selecciona un estado de ítem válido.",
  currency_id: "Selecciona una moneda válida.",
};

function costFieldMessage(rawMessage: string) {
  const normalized = rawMessage.trim().toLowerCase();
  if (normalized.includes(">= 0")) return "El costo no puede ser negativo.";
  if (normalized.includes("2 decimals")) {
    return "El costo admite máximo 2 decimales.";
  }
  if (normalized.includes("9 integer digits")) {
    return "El costo admite máximo 9 dígitos enteros.";
  }
  if (normalized.includes("number")) return "Ingresa un costo numérico.";
  return translateFieldMessage(rawMessage);
}

export function mapCostFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const key = FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    mapped[key] = key === "cost" ? costFieldMessage(rawMessage) : FIELD_MESSAGES[key]!;
  }

  return mapped;
}

export function costSummaryItems(errors: Record<string, string>): FormErrorItem[] {
  return (Object.keys(COST_FIELD_IDS) as CostFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: COST_FIELD_IDS[key],
      label: COST_FIELD_LABELS[key],
      message: errors[key],
    }));
}
