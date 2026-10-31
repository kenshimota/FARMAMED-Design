import { ApiError } from "@/lib/api";
import { translateFieldMessage } from "@/lib/api-errors";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const LOT_FIELD_IDS = {
  number: "lote-numero",
  product_id: "lote-producto",
  item_state_id: "lote-estado-item",
  expiration_date: "lote-vencimiento",
  stock: "lote-existencia",
  reserved: "lote-reservado",
  warehouse_id: "lote-bodega",
  shelf_id: "lote-estante",
  section_id: "lote-seccion",
} as const;

export type LotFieldKey = keyof typeof LOT_FIELD_IDS;

export const LOT_FIELD_LABELS: Record<LotFieldKey, string> = {
  number: "Número de lote",
  product_id: "Producto",
  item_state_id: "Estado del ítem",
  expiration_date: "Fecha de vencimiento",
  stock: "Existencia",
  reserved: "Reservado",
  warehouse_id: "Bodega",
  shelf_id: "Estante",
  section_id: "Sección",
};

const FIELD_ALIASES: Record<string, LotFieldKey> = {
  number: "number",
  lot_number: "number",
  lotnumber: "number",
  product: "product_id",
  product_id: "product_id",
  productid: "product_id",
  item_state: "item_state_id",
  item_state_id: "item_state_id",
  itemstate: "item_state_id",
  itemstateid: "item_state_id",
  expiration: "expiration_date",
  expiration_date: "expiration_date",
  expirationdate: "expiration_date",
  expiry_date: "expiration_date",
  expirydate: "expiration_date",
  stock: "stock",
  quantity: "stock",
  reserved: "reserved",
  reserve: "reserved",
  reserved_quantity: "reserved",
  warehouse: "warehouse_id",
  warehouse_id: "warehouse_id",
  warehouseid: "warehouse_id",
  shelf: "shelf_id",
  shelf_id: "shelf_id",
  shelfid: "shelf_id",
  section: "section_id",
  section_id: "section_id",
  sectionid: "section_id",
};

export const LOT_COPY = {
  numberRequired: "Ingresa el número de lote.",
  numberLength: "El número de lote debe tener entre 1 y 100 caracteres.",
  productRequired: "Selecciona un producto.",
  itemStateRequired: "Selecciona un estado de ítem.",
  expirationRequired: "Selecciona la fecha de vencimiento.",
  expirationInvalid: "Ingresa una fecha de vencimiento válida.",
  stockRequired: "Ingresa la existencia.",
  stockInvalid: "La existencia debe ser un entero mayor o igual a 0.",
  reservedRequired: "Ingresa el reservado.",
  reservedInvalid: "El reservado debe ser un entero mayor o igual a 0.",
  reservedGreater: "El reservado no puede superar la existencia.",
  warehouseRequired: "Selecciona una bodega.",
  shelfRequired: "Selecciona un estante.",
  sectionRequired: "Selecciona una sección.",
  shelfMismatch: "El estante no pertenece a la bodega.",
  sectionMismatch: "La sección no pertenece al estante.",
  duplicate: "Ya existe un lote con ese número para el producto.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  forbidden: "No tienes permisos para guardar lotes.",
  notFound: "No encontramos este lote. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic: "No pudimos guardar el lote. Revisa tu conexión e intenta de nuevo.",
} as const;

function lotFieldMessage(key: LotFieldKey, rawMessage: string) {
  const normalized = rawMessage.trim().toLowerCase();

  switch (key) {
    case "number":
      if (/exist|duplic|unique/.test(normalized)) return LOT_COPY.duplicate;
      if (/between|length|longer|shorter|maximum|minimum|100/.test(normalized)) {
        return LOT_COPY.numberLength;
      }
      return translateFieldMessage(rawMessage);
    case "expiration_date":
      if (/date|time|format|parse|invalid/.test(normalized)) {
        return LOT_COPY.expirationInvalid;
      }
      return translateFieldMessage(rawMessage);
    case "stock":
      if (/integer|number|>=|non-negative|negative|quantity/.test(normalized)) {
        return LOT_COPY.stockInvalid;
      }
      return translateFieldMessage(rawMessage);
    case "reserved":
      if (/greater|exceed|super|stock|available/.test(normalized)) {
        return LOT_COPY.reservedGreater;
      }
      if (/integer|number|>=|non-negative|negative|quantity/.test(normalized)) {
        return LOT_COPY.reservedInvalid;
      }
      return translateFieldMessage(rawMessage);
    case "shelf_id":
      if (/warehouse|belong|match|coherent/.test(normalized)) {
        return LOT_COPY.shelfMismatch;
      }
      return "Selecciona un estante válido.";
    case "section_id":
      if (/shelf|belong|match|coherent/.test(normalized)) {
        return LOT_COPY.sectionMismatch;
      }
      return "Selecciona una sección válida.";
    case "warehouse_id":
      return "Selecciona una bodega válida.";
    case "product_id":
      return "Selecciona un producto válido.";
    case "item_state_id":
      return "Selecciona un estado de ítem válido.";
    default:
      return translateFieldMessage(rawMessage);
  }
}

export function mapLotFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const key = FIELD_ALIASES[field.trim().toLowerCase()];
    if (!key) continue;
    mapped[key] = lotFieldMessage(key, rawMessage);
  }

  if (Object.keys(mapped).length === 0) {
    const message = error.message.trim().toLowerCase();
    if (/shelf.*warehouse|warehouse.*shelf/.test(message)) {
      mapped.shelf_id = LOT_COPY.shelfMismatch;
    } else if (/section.*shelf|shelf.*section/.test(message)) {
      mapped.section_id = LOT_COPY.sectionMismatch;
    } else if (/reserved.*(greater|super|exceed|stock)|reserved.*available/.test(message)) {
      mapped.reserved = LOT_COPY.reservedGreater;
    } else if (/expiration|expiry|date/.test(message)) {
      mapped.expiration_date = LOT_COPY.expirationInvalid;
    }
  }

  return mapped;
}

export function lotSummaryItems(errors: Record<string, string>): FormErrorItem[] {
  return (Object.keys(LOT_FIELD_IDS) as LotFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: LOT_FIELD_IDS[key],
      label: LOT_FIELD_LABELS[key],
      message: errors[key],
    }));
}
