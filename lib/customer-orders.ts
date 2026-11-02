import { apiFetch, ApiError } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  addOrderItem,
  deleteOrderItem,
  fetchOrder,
  parseOrder,
  updateOrderItemQuantity,
  updateOrderStatus,
  type OrderRecord,
} from "@/components/erp/records/orders-api";
import { orderErrorMessage } from "@/components/erp/records/orders-errors";
import { translateApiError } from "@/lib/api-errors";

export type CustomerOrderItemInput = {
  product_id: number;
  item_state_id: number;
  quantity: number;
};

export type CreateCustomerOrderInput = {
  items: CustomerOrderItemInput[];
  delivery_address?: string;
  notes?: string;
};

export type UpdateCustomerOrderDetailsInput = {
  delivery_address: string;
  notes: string;
};

export type CustomerOrderFieldErrors = {
  deliveryAddress?: string;
  notes?: string;
  items?: string;
};

export type CustomerOrderLineRef = {
  productId: number | string;
  itemStateId: number | string;
  name: string;
  itemStateLabel?: string | null;
};

export type CustomerOrderAffectedProduct = {
  productId: string;
  name: string;
  itemStateLabel: string | null;
};

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function createCustomerOrder(input: CreateCustomerOrderInput) {
  const payload = await apiFetch<unknown>("/orders", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const order = parseOrder(payload);
  if (!order) throw new ApiError(500, null);
  return order;
}

export async function updateCustomerOrderDetails(
  orderId: number | string,
  input: UpdateCustomerOrderDetailsInput,
): Promise<OrderRecord> {
  await apiFetch<unknown>(
    `/orders/${encodeURIComponent(String(orderId))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  return fetchOrder(String(orderId));
}

export async function addCustomerOrderItem(
  orderId: number | string,
  input: CustomerOrderItemInput,
): Promise<OrderRecord> {
  await addOrderItem(orderId, input);
  return fetchOrder(String(orderId));
}

export async function updateCustomerOrderItemQuantity(
  orderId: number | string,
  itemId: number | string,
  quantity: number,
): Promise<OrderRecord> {
  await updateOrderItemQuantity(orderId, itemId, quantity);
  return fetchOrder(String(orderId));
}

export async function removeCustomerOrderItem(
  orderId: number | string,
  itemId: number | string,
): Promise<OrderRecord> {
  return deleteOrderItem(orderId, itemId);
}

export async function sendCustomerOrder(
  orderId: number | string,
): Promise<OrderRecord> {
  await updateOrderStatus(orderId, "request");
  return fetchOrder(String(orderId));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapPayload(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function readIdText(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function readProductRef(value: unknown) {
  if (!isRecord(value)) return null;
  const productId = readIdText(value.product_id ?? value.productId);
  if (!productId) return null;
  return {
    productId,
    itemStateId: readIdText(value.item_state_id ?? value.itemStateId),
  };
}

export function readCustomerOrderErrorProducts(
  caught: unknown,
): { productId: string; itemStateId: string | null }[] {
  if (!(caught instanceof ApiError)) return [];
  if (caught.status !== 409 && caught.status !== 422) return [];

  const record = unwrapPayload(caught.payload);
  if (!isRecord(record)) return [];

  const refs: { productId: string; itemStateId: string | null }[] = [];
  const direct = readProductRef(record);
  if (direct) refs.push(direct);

  const items = record.items;
  if (Array.isArray(items)) {
    for (const item of items) {
      const ref = readProductRef(item);
      if (ref) refs.push(ref);
    }
  }

  const productIds = record.product_ids;
  if (Array.isArray(productIds)) {
    for (const value of productIds) {
      const ref = readProductRef(value);
      if (ref) {
        refs.push(ref);
        continue;
      }
      const productId = readIdText(value);
      if (productId) refs.push({ productId, itemStateId: null });
    }
  }

  const errors = record.errors;
  if (isRecord(errors) && Array.isArray(errors.items)) {
    for (const item of errors.items) {
      const ref = readProductRef(item);
      if (ref) refs.push(ref);
    }
  }

  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.productId}:${ref.itemStateId ?? "*"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveAffectedOrderProducts(
  caught: unknown,
  lines: readonly CustomerOrderLineRef[],
): CustomerOrderAffectedProduct[] {
  const refs = readCustomerOrderErrorProducts(caught);
  const resolved: CustomerOrderAffectedProduct[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const line = lines.find(
      (candidate) =>
        String(candidate.productId) === ref.productId &&
        (ref.itemStateId === null ||
          String(candidate.itemStateId) === ref.itemStateId),
    );
    const name = line?.name ?? `Producto #${ref.productId}`;
    const itemStateLabel = line?.itemStateLabel ?? null;
    const key = `${name}:${itemStateLabel ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    resolved.push({ productId: ref.productId, name, itemStateLabel });
  }

  return resolved;
}

function readApiMessage(error: ApiError) {
  const payload = error.payload;
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message.trim().toLowerCase();
  }
  return error.message.trim().toLowerCase();
}

export function mapCustomerOrderFieldErrors(
  caught: unknown,
): CustomerOrderFieldErrors {
  const mapped: CustomerOrderFieldErrors = {};
  if (!(caught instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(caught.fieldErrors)) {
    const key = field.toLowerCase();
    const message = rawMessage.toLowerCase();
    if (key === "delivery_address" || key === "deliveryaddress") {
      mapped.deliveryAddress = message.includes("500")
        ? "La dirección de entrega no puede superar los 500 caracteres."
        : "Revisa la dirección de entrega.";
    } else if (key === "notes" || key === "notas") {
      mapped.notes = message.includes("1000")
        ? "Las notas no pueden superar los 1000 caracteres."
        : "Revisa las notas del pedido.";
    } else if (key === "items" || key.startsWith("items.")) {
      mapped.items = "Revisa las líneas del pedido antes de continuar.";
    }
  }

  if (Object.keys(mapped).length === 0 && caught.status === 400) {
    const message = readApiMessage(caught);
    if (message.includes("delivery_address")) {
      mapped.deliveryAddress = "Revisa la dirección de entrega.";
    } else if (message.includes("notes")) {
      mapped.notes = "Revisa las notas del pedido.";
    } else if (message.includes("items")) {
      mapped.items = "Agrega al menos una línea para continuar.";
    }
  }

  return mapped;
}

export function customerOrderErrorMessage(
  caught: unknown,
  context: "cart" | "draft" = "cart",
): string {
  if (!(caught instanceof ApiError)) {
    return translateApiError(caught).message;
  }

  const message = readApiMessage(caught);
  const conserved =
    context === "cart" ? "Tu carrito se conserva." : "Tu borrador se conserva.";

  if (caught.status === 403) {
    if (
      message.includes("price list") ||
      Object.values(caught.fieldErrors).some((value) =>
        value.toLowerCase().includes("price list"),
      )
    ) {
      return `Tu cuenta no tiene una lista de precios asignada. Contacta al administrador. ${conserved}`;
    }
    if (message.includes("profile is not linked")) {
      return `Tu cuenta no está vinculada a un cliente. Contacta al administrador. ${conserved}`;
    }
  }

  if (caught.status === 404) {
    return context === "draft"
      ? "No encontramos este pedido. Puede que haya sido eliminado o que pertenezca a otra cuenta."
      : "No encontramos los datos del pedido. Vuelve al carrito e intenta de nuevo.";
  }

  if (caught.status === 409) {
    if (message.includes("insufficient stock")) {
      return `La disponibilidad de uno o más productos cambió. Revisa las líneas del pedido. ${conserved}`;
    }
    if (message.includes("wallet balance")) {
      return `No pudimos procesar el pedido con los datos actuales. ${conserved}`;
    }
    if (
      message.includes("already in order") ||
      message.includes("already exists")
    ) {
      return "Uno de los productos ya está en el pedido. Revisa las líneas del pedido.";
    }
    return `La información del pedido cambió mientras lo revisabas. ${conserved}`;
  }

  if (caught.status === 422) {
    if (message.includes("not editable")) {
      return "Este pedido ya no se puede editar.";
    }
    if (
      message.includes("payment term is required") ||
      message.includes("invalid payment term")
    ) {
      return `Tu cuenta necesita un término de pago activo antes de enviar el pedido. ${conserved}`;
    }
    return `Revisa los datos del pedido antes de continuar. ${conserved}`;
  }

  if (caught.status === 503) {
    return `No podemos procesar pedidos en este momento. ${conserved}`;
  }

  return orderErrorMessage(caught);
}
