import { ApiError } from "@/lib/api";
import { COPY, translateApiError } from "@/lib/api-errors";
import type { RecordId } from "@/components/erp/records/records-api";

export const ORDER_COPY = {
  empty: "Todavía no hay pedidos registrados.",
  emptyFiltered: "No hay pedidos con esos filtros.",
  emptyFilteredHelp: "Ajusta el estado, el cliente o el número para ver otros resultados.",
  notEditable: "Este pedido ya no se puede editar.",
  invalidTransition: "Ese cambio de estado no está permitido para este pedido.",
  paymentTermRequired: "Selecciona un término de pago antes de continuar.",
  paymentTermInvalid: "Selecciona un término de pago activo.",
  stockShortage: "No hay existencia suficiente para aprobar el pedido.",
  walletBalance:
    "El cliente no tiene saldo suficiente para un pedido de contado.",
  duplicateItem: "Ese producto y estado ya están en el pedido.",
  orderNotFound: "No encontramos este pedido. Puede que haya sido eliminado.",
  sellerNotAssigned:
    "Este cliente no está asignado a tu usuario. Un administrador puede asignarlo.",
  priceListMissing:
    "El cliente no tiene una lista de precios asignada. Asígnale una lista antes de crear el pedido.",
  customerProfileMissing:
    "La cuenta no está vinculada a un cliente. Un administrador debe completar el vínculo.",
  statusConfig: "No podemos procesar pedidos en este momento.",
  noCustomer: "Selecciona un cliente para crear el pedido.",
  noItemsToGenerate: "Agrega al menos una línea para generar el pedido.",
  created: "Borrador de pedido creado.",
  generated: "Pedido generado.",
  invoiced: "Pedido facturado.",
  cancelled: "Pedido cancelado.",
  updated: "Pedido actualizado.",
  itemAdded: "Línea agregada.",
  itemUpdated: "Cantidad actualizada.",
  itemRemoved: "Línea eliminada.",
  paymentTermChanged: "Término de pago actualizado.",
  addLine: "Agregar línea",
  noStoreProducts:
    "El cliente no tiene productos disponibles con precio y existencia para armar el pedido.",
} as const;

function readApiMessage(error: ApiError) {
  const payload = error.payload;
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message.trim();
  }
  return error.message.trim();
}

function fieldErrorText(error: ApiError) {
  return Object.values(error.fieldErrors).join(" ").toLowerCase();
}

export function isSellerAssignmentError(caught: unknown) {
  if (!(caught instanceof ApiError) || caught.status !== 403) return false;
  return readApiMessage(caught)
    .toLowerCase()
    .includes("not assigned to this seller");
}

export function isPriceListError(caught: unknown) {
  if (!(caught instanceof ApiError)) return false;
  const message = readApiMessage(caught).toLowerCase();
  return (
    caught.status === 403 &&
    (message.includes("price list") || fieldErrorText(caught).includes("price list"))
  );
}

export function isStockShortageError(caught: unknown) {
  if (!(caught instanceof ApiError) || caught.status !== 409) return false;
  return readApiMessage(caught).toLowerCase().includes("insufficient stock");
}

export type OrderStockShortage = {
  items: { productId: RecordId; itemStateId: RecordId | null }[];
};

function readShortageId(value: unknown): RecordId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  }
  return null;
}

export function readStockShortage(caught: unknown): OrderStockShortage | null {
  if (!isStockShortageError(caught) || !(caught instanceof ApiError)) return null;
  const payload = caught.payload;
  if (typeof payload !== "object" || payload === null) return null;

  const items: OrderStockShortage["items"] = [];
  const source = (payload as { items?: unknown }).items;
  if (Array.isArray(source)) {
    for (const item of source) {
      if (typeof item !== "object" || item === null) continue;
      const record = item as Record<string, unknown>;
      const productId = readShortageId(record.product_id);
      if (productId === null) continue;
      items.push({
        productId,
        itemStateId: readShortageId(record.item_state_id),
      });
    }
  }

  if (items.length === 0) {
    const productIds = (payload as { product_ids?: unknown }).product_ids;
    if (Array.isArray(productIds)) {
      for (const value of productIds) {
        const productId = readShortageId(value);
        if (productId !== null) items.push({ productId, itemStateId: null });
      }
    }
  }

  return items.length > 0 ? { items } : null;
}

export function orderErrorMessage(caught: unknown): string {
  if (!(caught instanceof ApiError)) return translateApiError(caught).message;

  const message = readApiMessage(caught);
  const normalized = message.toLowerCase();
  const fields = fieldErrorText(caught);

  if (caught.status === 400) {
    if (normalized.includes("customer_id")) return ORDER_COPY.noCustomer;
    return COPY.badRequest;
  }

  if (caught.status === 403) {
    if (normalized.includes("price list") || fields.includes("price list")) {
      return ORDER_COPY.priceListMissing;
    }
    if (normalized.includes("not assigned to this seller")) {
      return ORDER_COPY.sellerNotAssigned;
    }
    if (normalized.includes("profile is not linked")) {
      return ORDER_COPY.customerProfileMissing;
    }
  }

  if (caught.status === 404) {
    if (normalized.includes("customer")) return "No encontramos ese cliente.";
    if (normalized.includes("payment term")) {
      return "No encontramos ese término de pago.";
    }
    if (normalized.includes("item")) return COPY.notFound;
    return ORDER_COPY.orderNotFound;
  }

  if (caught.status === 409) {
    if (normalized.includes("insufficient stock")) return ORDER_COPY.stockShortage;
    if (normalized.includes("wallet balance")) return ORDER_COPY.walletBalance;
    if (normalized.includes("already has an invoice")) {
      return "Este pedido ya tiene una factura.";
    }
    if (
      normalized.includes("already in order") ||
      normalized.includes("already exists")
    ) {
      return ORDER_COPY.duplicateItem;
    }
  }

  if (caught.status === 422) {
    if (normalized.includes("invalid status transition")) {
      return ORDER_COPY.invalidTransition;
    }
    if (normalized.includes("not editable")) return ORDER_COPY.notEditable;
    if (normalized.includes("cannot be invoiced")) {
      return "Este pedido no se puede facturar en su estado actual.";
    }
    if (
      normalized.includes("payment term is required") ||
      fields.includes("payment term is required")
    ) {
      return ORDER_COPY.paymentTermRequired;
    }
    if (
      normalized.includes("invalid payment term") ||
      fields.includes("invalid payment term")
    ) {
      return ORDER_COPY.paymentTermInvalid;
    }
    if (normalized.includes("no items")) {
      return "Agrega al menos una línea para continuar.";
    }
    if (normalized.includes("price")) {
      return "Una línea no tiene un precio válido para la lista del cliente.";
    }
    return COPY.validation;
  }

  if (caught.status === 503) return ORDER_COPY.statusConfig;

  return translateApiError(caught).message;
}

export function mapCreateOrderFieldErrors(caught: unknown) {
  const mapped: { customerId?: string; paymentTermId?: string; items?: string } = {};
  if (!(caught instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(caught.fieldErrors)) {
    const key = field.toLowerCase();
    const message = rawMessage.toLowerCase();
    if (key === "customer_id" || key === "customer") {
      mapped.customerId = "Selecciona un cliente válido.";
    } else if (key === "payment_term_id" || key === "payment_term") {
      mapped.paymentTermId = message.includes("invalid")
        ? ORDER_COPY.paymentTermInvalid
        : ORDER_COPY.paymentTermRequired;
    } else if (key === "items" || key.startsWith("items.")) {
      mapped.items =
        message.includes("duplicate")
          ? ORDER_COPY.duplicateItem
          : "Revisa las líneas del pedido. Una línea no es válida para este cliente.";
    }
  }

  if (!mapped.customerId && caught.status === 400) {
    const message = readApiMessage(caught).toLowerCase();
    if (message.includes("customer_id")) mapped.customerId = ORDER_COPY.noCustomer;
  }

  return mapped;
}

export function mapOrderItemFieldErrors(caught: unknown) {
  const mapped: { productId?: string; itemStateId?: string; quantity?: string; general?: string } =
    {};
  if (!(caught instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(caught.fieldErrors)) {
    const key = field.toLowerCase();
    const message = rawMessage.toLowerCase();
    if (key === "product_id" || key === "product") {
      mapped.productId = message.includes("price")
        ? "Este producto no tiene precio para la lista del cliente."
        : "Selecciona un producto válido.";
    } else if (key === "item_state_id" || key === "item_state") {
      mapped.itemStateId = "Selecciona un estado de ítem vendible.";
    } else if (key === "quantity") {
      mapped.quantity = "La cantidad debe ser un entero entre 1 y 999.";
    } else if (key === "status") {
      mapped.general = ORDER_COPY.notEditable;
    }
  }

  if (caught.status === 409) mapped.general = ORDER_COPY.duplicateItem;
  return mapped;
}

export function mapPaymentTermFieldError(caught: unknown) {
  if (!(caught instanceof ApiError)) return null;
  const values = fieldErrorText(caught);
  const normalized = readApiMessage(caught).toLowerCase();
  if (normalized.includes("not editable")) return ORDER_COPY.notEditable;
  if (
    normalized.includes("invalid payment term") ||
    values.includes("invalid payment term")
  ) {
    return ORDER_COPY.paymentTermInvalid;
  }
  if (
    normalized.includes("payment term is required") ||
    values.includes("payment term is required")
  ) {
    return ORDER_COPY.paymentTermRequired;
  }
  return null;
}
