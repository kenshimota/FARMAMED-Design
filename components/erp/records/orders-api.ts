import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type OrderStatusRecord = {
  id: RecordId;
  code: string;
  name: string;
  description: string;
  sortOrder: number;
  nextStatusCode: string | null;
  isTerminal: boolean;
  isSystem: boolean;
};

export type PaymentTermRecord = {
  id: RecordId;
  code: string;
  name: string;
  description: string;
  days: number;
  isActive: boolean;
};

export type OrderCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
};

export type OrderCustomer = {
  id: RecordId;
  fullName: string;
  email: string;
  direction: string;
  latitude: number | null;
  longitude: number | null;
};

export type OrderProductRef = {
  id: RecordId;
  name: string;
  reference: string;
  imageId: RecordId | null;
};

export type OrderItemState = {
  id: RecordId;
  name: string;
  label: string;
};

export type OrderItem = {
  id: RecordId;
  productId: RecordId;
  itemStateId: RecordId;
  itemState: OrderItemState | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: OrderProductRef | null;
};

export type OrderHistoryActor = {
  id: RecordId;
  username: string;
  email: string;
};

export type OrderHistoryEvent = {
  id: RecordId | null;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  actor: OrderHistoryActor | null;
};

export type OrderInvoiceRef = {
  id: RecordId | null;
  number: RecordId | null;
};

export type OrderRecord = {
  id: RecordId;
  number: number;
  status: string;
  customerId: RecordId | null;
  userId: RecordId | null;
  paymentTermId: RecordId | null;
  paymentTerm: PaymentTermRecord | null;
  currencyId: RecordId | null;
  currency: OrderCurrency | null;
  subtotal: number;
  total: number;
  deliveryAddress: string;
  notes: string;
  createdAt: string | null;
  itemsCount: number;
  items: OrderItem[] | null;
  history: OrderHistoryEvent[] | null;
  customer: OrderCustomer | null;
  invoice: OrderInvoiceRef | null;
};

export type OrderFilters = {
  status?: string;
  customer_id?: RecordId;
  number?: string;
};

export type OrderItemInput = {
  product_id: RecordId;
  item_state_id: RecordId;
  quantity: number;
};

export type OrderCreateInput = {
  customer_id: RecordId;
  payment_term_id?: RecordId;
  items?: OrderItemInput[];
  delivery_address?: string;
  notes?: string;
};

export type OrderStatusUpdateResult = {
  order: OrderRecord;
  invoice: OrderInvoiceRef | null;
};

export type StoreProduct = {
  id: RecordId;
  name: string;
  description: string;
  reference: string;
  categoryId: RecordId | null;
  imageId: RecordId | null;
  itemState: OrderItemState;
  price: number;
  currencyId: RecordId | null;
  currency: OrderCurrency | null;
  available: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readId(value: unknown): RecordId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  }
  return null;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readCoordinate(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function readTimestamp(value: unknown) {
  const text = readText(value);
  return text || null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function readStatusText(value: unknown) {
  const text = readText(value).toLowerCase();
  return /^[a-z][a-z0-9_]{1,19}$/.test(text) ? text : null;
}

export function parseOrderCurrency(source: unknown): OrderCurrency | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  if (id === null || !code) return null;
  return {
    id,
    code,
    name: readText(source.name) || code,
    symbol: readText(source.symbol) || code,
  };
}

export function parsePaymentTerm(source: unknown): PaymentTermRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;
  const id = readId(record.id);
  const code = readText(record.code);
  const name = readText(record.name);
  if (id === null || !code || !name) return null;
  return {
    id,
    code,
    name,
    description: readText(record.description),
    days: Math.max(0, Math.trunc(readNumber(record.days))),
    isActive: record.is_active !== false,
  };
}

export function parsePaymentTermList(payload: unknown): PaymentTermRecord[] {
  const list = readCollection(payload);
  const terms = list
    .map(parsePaymentTerm)
    .filter((term): term is PaymentTermRecord => term !== null);
  if (list.length > 0 && terms.length === 0) throw new ApiError(500, null);
  return terms.sort((first, second) => {
    const byDays = first.days - second.days;
    if (byDays !== 0) return byDays;
    return String(first.id).localeCompare(String(second.id), "es");
  });
}

export function parseOrderStatus(source: unknown): OrderStatusRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;
  const id = readId(record.id);
  const code = readStatusText(record.code);
  const name = readText(record.name);
  if (id === null || !code || !name) return null;
  return {
    id,
    code,
    name,
    description: readText(record.description),
    sortOrder: Math.trunc(readNumber(record.sort_order)),
    nextStatusCode: readStatusText(record.next_status_code),
    isTerminal:
      record.is_terminal === true ||
      (record.is_terminal === undefined && !readStatusText(record.next_status_code)),
    isSystem: record.is_system === true,
  };
}

export function parseOrderStatusList(payload: unknown): OrderStatusRecord[] {
  const list = readCollection(payload);
  const statuses = list
    .map(parseOrderStatus)
    .filter((status): status is OrderStatusRecord => status !== null);
  if (list.length > 0 && statuses.length === 0) throw new ApiError(500, null);
  return statuses.sort((first, second) => {
    const byOrder = first.sortOrder - second.sortOrder;
    if (byOrder !== 0) return byOrder;
    return String(first.id).localeCompare(String(second.id), "es");
  });
}

export function parseOrderCustomer(source: unknown): OrderCustomer | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const fullName = readText(source.fullName) || readText(source.full_name);
  if (id === null || !fullName) return null;
  return {
    id,
    fullName,
    email: readText(source.email),
    direction: readText(source.direction),
    latitude: readCoordinate(source.latitude),
    longitude: readCoordinate(source.longitude),
  };
}

export function parseOrderProduct(source: unknown): OrderProductRef | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  if (id === null || !name) return null;
  return {
    id,
    name,
    reference: readText(source.reference),
    imageId: readId(source.image_id),
  };
}

export function parseOrderItemState(source: unknown): OrderItemState | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  if (id === null) return null;
  const name = readText(source.name);
  const label = readText(source.label) || name;
  if (!label) return null;
  return { id, name: name || label, label };
}

export function parseOrderItem(source: unknown): OrderItem | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;
  const id = readId(record.id);
  const productId = readId(record.product_id);
  const itemStateId = readId(record.item_state_id);
  const quantity = Math.trunc(readNumber(record.quantity, -1));
  const unitPrice = readNumber(record.unit_price, -1);
  if (id === null || productId === null || itemStateId === null) return null;
  if (quantity < 1 || unitPrice < 0) return null;

  return {
    id,
    productId,
    itemStateId,
    itemState: parseOrderItemState(record.item_state),
    quantity,
    unitPrice,
    subtotal: readNumber(record.subtotal, roundMoney(quantity * unitPrice)),
    product: parseOrderProduct(record.product),
  };
}

function parseOrderItemList(payload: unknown): OrderItem[] {
  const list = readCollection(payload);
  const items = list
    .map(parseOrderItem)
    .filter((item): item is OrderItem => item !== null);
  if (list.length > 0 && items.length === 0) throw new ApiError(500, null);
  return items;
}

function parseMetadata(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function parseOrderActor(source: unknown): OrderHistoryActor | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const username = readText(source.username);
  const email = readText(source.email);
  if (id === null || (!username && !email)) return null;
  return { id, username: username || email, email };
}

function parseOrderHistoryEvent(source: unknown): OrderHistoryEvent | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const eventType = readText(record.event_type);
  if (eventType) {
    const toStatus = readStatusText(record.to_status);
    return {
      id: readId(record.id),
      eventType,
      fromStatus: readStatusText(record.from_status),
      toStatus,
      metadata: parseMetadata(record.metadata),
      createdAt: readTimestamp(record.created_at),
      actor: parseOrderActor(record.actor),
    };
  }

  const legacyStatus = readStatusText(record.status);
  if (!legacyStatus) return null;
  return {
    id: readId(record.id),
    eventType: "status_changed",
    fromStatus: null,
    toStatus: legacyStatus,
    metadata: null,
    createdAt: readTimestamp(record.changed_at),
    actor: parseOrderActor(record.changed_by),
  };
}

function parseOrderHistory(payload: unknown): OrderHistoryEvent[] {
  const list = readCollection(payload);
  const events = list
    .map(parseOrderHistoryEvent)
    .filter((event): event is OrderHistoryEvent => event !== null);
  if (list.length > 0 && events.length === 0) throw new ApiError(500, null);
  return events.sort((first, second) => {
    const firstTime = first.createdAt ? Date.parse(first.createdAt) : 0;
    const secondTime = second.createdAt ? Date.parse(second.createdAt) : 0;
    return firstTime - secondTime;
  });
}

function parseInvoiceFromValue(value: unknown): OrderInvoiceRef | null {
  if (!isRecord(value)) return null;
  const id = readId(value.id);
  const number = readId(value.invoice_number) ?? readId(value.number);
  return id === null && number === null ? null : { id, number };
}

function readInvoiceFromHistory(
  history: OrderHistoryEvent[] | null,
): OrderInvoiceRef | null {
  if (!history) return null;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const event = history[index];
    if (event.eventType !== "invoice_issued" || !event.metadata) continue;
    const id = readId(event.metadata.invoice_id);
    const number = readId(event.metadata.invoice_number);
    if (id !== null || number !== null) return { id, number };
  }
  return null;
}

export function parseInvoiceRef(
  payload: unknown,
  order?: OrderRecord | null,
): OrderInvoiceRef | null {
  const record = unwrapRecord(payload);
  if (isRecord(record)) {
    const nested = parseInvoiceFromValue(record.invoice);
    if (nested) return nested;

    const id = readId(record.invoice_id);
    const number = readId(record.invoice_number);
    if (id !== null || number !== null) return { id, number };
  }
  return order?.invoice ?? readInvoiceFromHistory(order?.history ?? null);
}

export function parseOrder(source: unknown): OrderRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const number = Math.trunc(readNumber(record.number, -1));
  const status = readStatusText(record.status);
  if (id === null || number < 0 || !status) return null;

  const items =
    record.items === undefined || record.items === null
      ? null
      : parseOrderItemList(record.items);

  const historySource =
    record.history ?? record.status_history ?? record.history_events;
  const history =
    historySource === undefined || historySource === null
      ? null
      : parseOrderHistory(historySource);

  const itemsCount = Math.max(
    0,
    Math.trunc(readNumber(record.items_count, items?.length ?? 0)),
  );

  const order: OrderRecord = {
    id,
    number,
    status,
    customerId: readId(record.customer_id),
    userId: readId(record.user_id),
    paymentTermId: readId(record.payment_term_id),
    paymentTerm: parsePaymentTerm(record.payment_term),
    currencyId: readId(record.currency_id),
    currency: parseOrderCurrency(record.currency),
    subtotal: readNumber(record.subtotal),
    total: readNumber(record.total),
    deliveryAddress: readText(record.delivery_address),
    notes: readText(record.notes),
    createdAt: readTimestamp(record.created_at) ?? readTimestamp(record.createdAt),
    itemsCount,
    items,
    history,
    customer: parseOrderCustomer(record.customer),
    invoice: null,
  };

  order.invoice = parseInvoiceRef(record, order);
  return order;
}

export function parseOrderList(payload: unknown): OrderRecord[] {
  const list = readCollection(payload);
  const orders = list
    .map(parseOrder)
    .filter((order): order is OrderRecord => order !== null);
  if (list.length > 0 && orders.length === 0) throw new ApiError(500, null);
  return orders.sort((first, second) => {
    const firstTime = first.createdAt ? Date.parse(first.createdAt) : 0;
    const secondTime = second.createdAt ? Date.parse(second.createdAt) : 0;
    if (firstTime !== secondTime) return secondTime - firstTime;
    return Number(second.id) - Number(first.id);
  });
}

export function parseStoreProduct(source: unknown): StoreProduct | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;
  const id = readId(record.id);
  const name = readText(record.name);
  const itemState = parseOrderItemState(record.item_state);
  const price = readNumber(record.price, -1);
  if (id === null || !name || !itemState || price < 0) return null;
  return {
    id,
    name,
    description: readText(record.description),
    reference: readText(record.reference),
    categoryId: readId(record.category_id),
    imageId: readId(record.image_id),
    itemState,
    price,
    currencyId: readId(record.currency_id),
    currency: parseOrderCurrency(record.currency),
    available: record.available !== false,
  };
}

export function parseStoreProductList(payload: unknown): StoreProduct[] {
  const list = readCollection(payload);
  const products = list
    .map(parseStoreProduct)
    .filter((product): product is StoreProduct => product !== null);
  if (list.length > 0 && products.length === 0) throw new ApiError(500, null);
  return products;
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function appendFilter(
  query: URLSearchParams,
  key: string,
  value: RecordId | string | undefined,
) {
  if (value === undefined || value === null) return;
  const normalized = String(value).trim();
  if (normalized) query.set(key, normalized);
}

export async function fetchOrders(filters: OrderFilters = {}) {
  const query = new URLSearchParams();
  appendFilter(query, "status", filters.status);
  appendFilter(query, "customer_id", filters.customer_id);
  appendFilter(query, "number", filters.number);
  const suffix = query.toString();
  const payload = await apiFetch<unknown>(
    `/orders${suffix ? `?${suffix}` : ""}`,
    authOptions(),
  );
  return parseOrderList(payload);
}

export async function fetchOrder(id: string) {
  const payload = await apiFetch<unknown>(
    `/orders/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const order = parseOrder(payload);
  if (!order) throw new ApiError(500, null);
  return order;
}

export async function createOrder(input: OrderCreateInput) {
  const payload = await apiFetch<unknown>("/orders", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const order = parseOrder(payload);
  if (!order) throw new ApiError(500, null);
  return order;
}

export async function updateOrderStatus(id: RecordId, status: string) {
  const payload = await apiFetch<unknown>(
    `/orders/${encodeURIComponent(String(id))}/status`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify({ status }),
    },
  );
  const order = parseOrder(payload) ?? (await fetchOrder(String(id)));
  return {
    order,
    invoice: parseInvoiceRef(payload, order),
  } satisfies OrderStatusUpdateResult;
}

export async function updateOrderPaymentTerm(
  id: RecordId,
  paymentTermId: RecordId,
) {
  const payload = await apiFetch<unknown>(
    `/orders/${encodeURIComponent(String(id))}/payment-term`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify({ payment_term_id: paymentTermId }),
    },
  );
  const order = parseOrder(payload);
  if (!order) throw new ApiError(500, null);
  return order;
}

export async function addOrderItem(orderId: RecordId, input: OrderItemInput) {
  const payload = await apiFetch<unknown>(
    `/orders/${encodeURIComponent(String(orderId))}/items`,
    {
      ...authOptions(),
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  const order = parseOrder(payload);
  if (!order) throw new ApiError(500, null);
  return order;
}

export async function updateOrderItemQuantity(
  orderId: RecordId,
  itemId: RecordId,
  quantity: number,
) {
  const payload = await apiFetch<unknown>(
    `/orders/${encodeURIComponent(String(orderId))}/items/${encodeURIComponent(String(itemId))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify({ quantity }),
    },
  );
  const order = parseOrder(payload);
  if (!order) throw new ApiError(500, null);
  return order;
}

export async function deleteOrderItem(orderId: RecordId, itemId: RecordId) {
  await apiFetch<void>(
    `/orders/${encodeURIComponent(String(orderId))}/items/${encodeURIComponent(String(itemId))}`,
    { ...authOptions(), method: "DELETE" },
  );
  return fetchOrder(String(orderId));
}

export async function fetchOrderStatuses() {
  const payload = await apiFetch<unknown>("/order-statuses", authOptions());
  return parseOrderStatusList(payload);
}

export async function fetchPaymentTerms(activeOnly = true) {
  const payload = await apiFetch<unknown>(
    `/payment-terms${activeOnly ? "?is_active=true" : ""}`,
    authOptions(),
  );
  return parsePaymentTermList(payload);
}

export async function fetchStoreProducts(customerId: RecordId) {
  const payload = await apiFetch<unknown>(
    `/store/products?customer_id=${encodeURIComponent(String(customerId))}`,
    authOptions(),
  );
  return parseStoreProductList(payload);
}
