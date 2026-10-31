import { ApiError } from "@/lib/api";
import {
  COPY,
  translateApiError,
  translateFieldMessage,
} from "@/lib/api-errors";
import type { FormErrorItem } from "@/components/erp/ui/form";
import { CURRENCY_NOT_CONFIGURED_DETAIL } from "@/lib/feedback";

export const PURCHASE_COPY = {
  empty: "Todavía no hay compras. Crea la primera para abastecer el inventario.",
  emptyFiltered: "No hay compras que coincidan con los filtros.",
  emptyFilteredHelp: "Ajusta los filtros para ver otros resultados.",
  noLines: "Agrega al menos una línea para confirmar.",
  notEditable: "Esta compra ya no se puede editar.",
  alreadyConfirmed: "Esta compra ya fue confirmada.",
  itemRepeated: "Ese producto y estado ya están en la compra.",
  taxInvalid: "El impuesto de la línea debe ser un monto mayor o igual a 0.",
  desktopOnly: "Disponible en escritorio",
  desktopOnlyHelp:
    "El constructor de líneas necesita más espacio para trabajar con claridad. Puedes consultar el detalle y confirmar o cancelar compras desde el móvil.",
  addLine: "Agregar línea",
  confirmPurchase: "Confirmar compra",
  cancelPurchase: "Cancelar compra",
  deleteDraft: "Eliminar borrador",
  created: "Compra creada.",
  saved: "Cambios guardados.",
  confirmed: "Compra confirmada. Se actualizaron costos y existencias.",
  cancelled: "Compra cancelada.",
  deleted: "Borrador eliminado.",
  supplierRequired: "Selecciona un proveedor.",
  productRequired: "Selecciona un producto.",
  itemStateRequired: "Selecciona un estado de ítem.",
  quantityRequired: "Ingresa la cantidad.",
  quantityFormat: "La cantidad debe ser un número entero mayor que 0.",
  unitCostRequired: "Ingresa el costo unitario.",
  unitCostFormat:
    "Usa un número mayor o igual a 0, con máximo 2 decimales y 9 dígitos enteros.",
  taxRequired: "Ingresa el impuesto (monto).",
  currencyInvalid: "Selecciona una moneda activa.",
  lineInvalid: "Revisa los datos de la línea.",
  purchaseNotFound: "No encontramos esta compra. Puede que haya sido eliminada.",
} as const;

export const PURCHASE_HEADER_FIELD_IDS = {
  supplier_id: "compra-proveedor",
  currency_id: "compra-moneda",
  notes: "compra-notas",
} as const;

export const PURCHASE_LINE_FIELD_IDS = {
  product_id: "compra-linea-producto",
  item_state_id: "compra-linea-estado",
  quantity: "compra-linea-cantidad",
  unit_cost: "compra-linea-costo",
  tax_amount: "compra-linea-impuesto",
} as const;

export type PurchaseHeaderFieldKey = keyof typeof PURCHASE_HEADER_FIELD_IDS;
export type PurchaseLineFieldKey = keyof typeof PURCHASE_LINE_FIELD_IDS;

export const PURCHASE_HEADER_LABELS: Record<PurchaseHeaderFieldKey, string> = {
  supplier_id: "Proveedor",
  currency_id: "Moneda",
  notes: "Notas",
};

export const PURCHASE_LINE_LABELS: Record<PurchaseLineFieldKey, string> = {
  product_id: "Producto",
  item_state_id: "Estado del ítem",
  quantity: "Cantidad",
  unit_cost: "Costo unitario",
  tax_amount: "Impuesto (monto)",
};

export function headerSummaryItems(
  errors: Record<string, string>,
): FormErrorItem[] {
  return (Object.keys(PURCHASE_HEADER_FIELD_IDS) as PurchaseHeaderFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: PURCHASE_HEADER_FIELD_IDS[key],
      label: PURCHASE_HEADER_LABELS[key],
      message: errors[key],
    }));
}

export function lineSummaryItems(errors: Record<string, string>): FormErrorItem[] {
  return (Object.keys(PURCHASE_LINE_FIELD_IDS) as PurchaseLineFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: PURCHASE_LINE_FIELD_IDS[key],
      label: PURCHASE_LINE_LABELS[key],
      message: errors[key],
    }));
}

function readApiMessage(error: ApiError) {
  const payload = error.payload;
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message.trim();
  }
  return error.message.trim();
}

export function purchaseErrorMessage(caught: unknown): string {
  if (caught instanceof ApiError) {
    const raw = readApiMessage(caught);
    const normalized = raw.toLowerCase();

    if (caught.status === 409) {
      if (normalized.includes("not editable")) return PURCHASE_COPY.notEditable;
      if (normalized.includes("already confirmed")) {
        return PURCHASE_COPY.alreadyConfirmed;
      }
      if (normalized.includes("item already exists")) {
        return PURCHASE_COPY.itemRepeated;
      }
    }

    if (caught.status === 422) {
      if (normalized.includes("no items")) return PURCHASE_COPY.noLines;
      if (normalized.includes("currency")) return PURCHASE_COPY.currencyInvalid;
      if (normalized.includes("tax")) return PURCHASE_COPY.taxInvalid;
    }

    if (caught.status === 503) return CURRENCY_NOT_CONFIGURED_DETAIL;

    if (caught.status === 404) {
      if (normalized.includes("item")) return COPY.notFound;
      return PURCHASE_COPY.purchaseNotFound;
    }
  }

  return translateApiError(caught).message;
}

const LINE_FIELD_ALIASES: Record<string, PurchaseLineFieldKey> = {
  product: "product_id",
  product_id: "product_id",
  productid: "product_id",
  item_state: "item_state_id",
  item_state_id: "item_state_id",
  itemstate: "item_state_id",
  itemstateid: "item_state_id",
  quantity: "quantity",
  unit_cost: "unit_cost",
  unitcost: "unit_cost",
  tax_amount: "tax_amount",
  taxamount: "tax_amount",
};

function lineFieldMessage(key: PurchaseLineFieldKey, rawMessage: string) {
  const normalized = rawMessage.trim().toLowerCase();
  switch (key) {
    case "product_id":
      return "Selecciona un producto válido.";
    case "item_state_id":
      return "Selecciona un estado de ítem válido.";
    case "quantity":
      return PURCHASE_COPY.quantityFormat;
    case "unit_cost":
      if (normalized.includes(">= 0") || normalized.includes("number")) {
        return "El costo unitario no puede ser negativo.";
      }
      return PURCHASE_COPY.unitCostFormat;
    case "tax_amount":
      return PURCHASE_COPY.taxInvalid;
  }
}

export function mapLineFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const match = /^(?:items\.\d+\.)?(.+)$/i.exec(field);
    const key = match ? LINE_FIELD_ALIASES[match[1].toLowerCase()] : undefined;
    if (!key) continue;
    mapped[key] = lineFieldMessage(key, rawMessage);
  }

  return mapped;
}

const HEADER_FIELD_ALIASES: Record<string, PurchaseHeaderFieldKey> = {
  supplier: "supplier_id",
  supplier_id: "supplier_id",
  supplierid: "supplier_id",
  currency: "currency_id",
  currency_id: "currency_id",
  currencyid: "currency_id",
  notes: "notes",
};

export function mapHeaderFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field] of Object.entries(error.fieldErrors)) {
    const key = HEADER_FIELD_ALIASES[field.toLowerCase()];
    if (!key || mapped[key]) continue;
    mapped[key] =
      key === "supplier_id"
        ? "Selecciona un proveedor válido."
        : key === "currency_id"
          ? PURCHASE_COPY.currencyInvalid
          : "Revisa las notas de la compra. Máximo 1000 caracteres.";
  }

  if (
    Object.keys(mapped).length === 0 &&
    error.status === 422 &&
    readApiMessage(error).toLowerCase().includes("currency")
  ) {
    mapped.currency_id = PURCHASE_COPY.currencyInvalid;
  }

  return mapped;
}

export type BulkLineError = {
  lineLabel: string;
  fieldLabel: string;
  message: string;
};

const BULK_LINE_FIELD_LABELS: Record<string, string> = {
  product_id: PURCHASE_LINE_LABELS.product_id,
  item_state_id: PURCHASE_LINE_LABELS.item_state_id,
  quantity: PURCHASE_LINE_LABELS.quantity,
  unit_cost: PURCHASE_LINE_LABELS.unit_cost,
  tax_amount: PURCHASE_LINE_LABELS.tax_amount,
};

export function mapBulkLineErrors(error: unknown): BulkLineError[] {
  if (!(error instanceof ApiError)) return [];
  const entries: BulkLineError[] = [];

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const match = /^items\.(\d+)\.([a-z_]+)$/i.exec(field);
    if (!match) continue;
    const fieldLabel = BULK_LINE_FIELD_LABELS[match[2].toLowerCase()];
    if (!fieldLabel) continue;
    const key = LINE_FIELD_ALIASES[match[2].toLowerCase()];
    entries.push({
      lineLabel: `Línea ${Number(match[1]) + 1}`,
      fieldLabel,
      message: key ? lineFieldMessage(key, rawMessage) : translateFieldMessage(rawMessage),
    });
  }

  return entries;
}

export const PURCHASE_QUANTITY_PATTERN = /^\d{1,9}$/;
export const PURCHASE_UNIT_COST_PATTERN = /^\d{1,9}([.,]\d{1,2})?$/;
export const PURCHASE_TAX_PATTERN = /^\d{1,10}([.,]\d{1,2})?$/;
export const PURCHASE_MAX_AMOUNT = 999999999.99;
export const PURCHASE_MAX_TAX = 9999999999.99;

export function parseQuantity(value: string) {
  const trimmed = value.trim();
  if (!PURCHASE_QUANTITY_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
}

export function parseAmount(
  value: string,
  { max, pattern }: { max: number; pattern: RegExp },
) {
  const trimmed = value.trim();
  if (!pattern.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;
  return parsed;
}

export function parseUnitCost(value: string) {
  return parseAmount(value, {
    max: PURCHASE_MAX_AMOUNT,
    pattern: PURCHASE_UNIT_COST_PATTERN,
  });
}

export function parseTaxAmount(value: string) {
  return parseAmount(value, {
    max: PURCHASE_MAX_TAX,
    pattern: PURCHASE_TAX_PATTERN,
  });
}

export function formatAmountInput(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("es-VE", {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
