import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type PurchaseStatus = "draft" | "confirmed" | "cancelled";

export const PURCHASE_STATUSES: readonly PurchaseStatus[] = [
  "draft",
  "confirmed",
  "cancelled",
];

export type PurchaseCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
};

export type PurchaseSupplierRef = {
  id: RecordId;
  name: string;
  identification: string;
};

export type PurchaseItem = {
  id: RecordId;
  product_id: RecordId;
  item_state_id: RecordId;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  tax_amount: number;
  total: number;
};

export type PurchaseRecord = {
  id: RecordId;
  number: number;
  supplier_id: RecordId;
  currency_id: RecordId | null;
  currency: PurchaseCurrency | null;
  status: PurchaseStatus;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string;
  confirmed_at: string | null;
  items: PurchaseItem[] | null;
  supplier: PurchaseSupplierRef | null;
};

export type PurchaseFilters = {
  supplier_id?: RecordId;
  status?: PurchaseStatus;
  number?: string;
  currency_id?: RecordId;
  include_items?: boolean;
};

export type PurchaseHeaderInput = {
  supplier_id: RecordId;
  currency_id?: RecordId;
  notes?: string | null;
};

export type PurchaseCreateInput = PurchaseHeaderInput & {
  items?: PurchaseItemInput[];
};

export type PurchaseItemInput = {
  product_id: RecordId;
  item_state_id: RecordId;
  quantity: number;
  unit_cost: number;
  tax_amount: number;
};

export type PurchaseItemPatch = {
  product_id?: RecordId;
  item_state_id?: RecordId;
  quantity?: number;
  unit_cost?: number;
  tax_amount?: number;
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

function readStatus(value: unknown): PurchaseStatus | null {
  const text = readText(value);
  return (PURCHASE_STATUSES as readonly string[]).includes(text)
    ? (text as PurchaseStatus)
    : null;
}

function readTimestamp(value: unknown) {
  const text = readText(value);
  return text || null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function parsePurchaseCurrency(source: unknown): PurchaseCurrency | null {
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

export function parsePurchaseSupplierRef(
  source: unknown,
): PurchaseSupplierRef | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  if (id === null || !name) return null;
  return { id, name, identification: readText(source.identification) };
}

export function parsePurchaseItem(source: unknown): PurchaseItem | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const productId = readId(record.product_id);
  const itemStateId = readId(record.item_state_id);
  if (id === null || productId === null || itemStateId === null) return null;

  const quantity = readNumber(record.quantity, -1);
  const unitCost = readNumber(record.unit_cost, -1);
  if (quantity < 0 || unitCost < 0) return null;

  const subtotal = readNumber(record.subtotal, roundMoney(quantity * unitCost));
  const taxAmount = Math.max(0, readNumber(record.tax_amount, 0));
  return {
    id,
    product_id: productId,
    item_state_id: itemStateId,
    quantity,
    unit_cost: unitCost,
    subtotal,
    tax_amount: taxAmount,
    total: readNumber(record.total, roundMoney(subtotal + taxAmount)),
  };
}

function parsePurchaseItemList(payload: unknown): PurchaseItem[] {
  const list = readCollection(payload);
  const items = list
    .map(parsePurchaseItem)
    .filter((item): item is PurchaseItem => item !== null);
  if (list.length > 0 && items.length === 0) throw new ApiError(500, null);
  return items;
}

export function parsePurchase(source: unknown): PurchaseRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const number = readNumber(record.number, -1);
  const supplierId = readId(record.supplier_id);
  const status = readStatus(record.status);
  if (id === null || number < 0 || supplierId === null || status === null) {
    return null;
  }

  const itemsSource = record.items;
  const items =
    itemsSource === undefined || itemsSource === null
      ? null
      : parsePurchaseItemList(itemsSource);

  return {
    id,
    number: Math.trunc(number),
    supplier_id: supplierId,
    currency_id: readId(record.currency_id),
    currency: parsePurchaseCurrency(record.currency),
    status,
    subtotal: readNumber(record.subtotal),
    tax_amount: readNumber(record.tax_amount),
    total: readNumber(record.total),
    notes: readText(record.notes),
    confirmed_at: readTimestamp(record.confirmed_at),
    items,
    supplier: parsePurchaseSupplierRef(record.supplier),
  };
}

export function parsePurchaseList(payload: unknown): PurchaseRecord[] {
  const list = readCollection(payload);
  const purchases = list
    .map(parsePurchase)
    .filter((purchase): purchase is PurchaseRecord => purchase !== null);
  if (list.length > 0 && purchases.length === 0) throw new ApiError(500, null);
  return purchases;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
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

export async function fetchPurchases(filters: PurchaseFilters = {}) {
  const query = new URLSearchParams();
  appendFilter(query, "supplier_id", filters.supplier_id);
  appendFilter(query, "status", filters.status);
  appendFilter(query, "number", filters.number);
  appendFilter(query, "currency_id", filters.currency_id);
  if (filters.include_items) query.set("include", "items");
  const suffix = query.toString();
  const payload = await apiFetch<unknown>(
    `/purchases${suffix ? `?${suffix}` : ""}`,
    authOptions(),
  );
  return parsePurchaseList(payload);
}

export async function fetchPurchase(id: string) {
  const payload = await apiFetch<unknown>(
    `/purchases/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const purchase = parsePurchase(payload);
  if (!purchase) throw new ApiError(500, null);
  return purchase;
}

export async function createPurchase(input: PurchaseCreateInput) {
  const payload = await apiFetch<unknown>("/purchases", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const purchase = parsePurchase(payload);
  if (!purchase) throw new ApiError(500, null);
  return purchase;
}

export async function updatePurchase(
  id: RecordId,
  input: Partial<PurchaseHeaderInput>,
) {
  const payload = await apiFetch<unknown>(
    `/purchases/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const purchase = parsePurchase(payload);
  if (!purchase) throw new ApiError(500, null);
  return purchase;
}

export function deletePurchase(id: RecordId) {
  return apiFetch<void>(`/purchases/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export function confirmPurchase(id: RecordId) {
  return apiFetch<void>(
    `/purchases/${encodeURIComponent(String(id))}/confirm`,
    { ...authOptions(), method: "POST" },
  );
}

export function cancelPurchase(id: RecordId) {
  return apiFetch<void>(
    `/purchases/${encodeURIComponent(String(id))}/cancel`,
    { ...authOptions(), method: "POST" },
  );
}

async function readUpdatedPurchase(purchaseId: RecordId, payload: unknown) {
  const purchase = parsePurchase(payload);
  if (purchase) return purchase;
  return fetchPurchase(String(purchaseId));
}

export async function createPurchaseItem(
  purchaseId: RecordId,
  input: PurchaseItemInput,
) {
  const payload = await apiFetch<unknown>(
    `/purchases/${encodeURIComponent(String(purchaseId))}/items`,
    {
      ...authOptions(),
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return readUpdatedPurchase(purchaseId, payload);
}

export async function updatePurchaseItem(
  purchaseId: RecordId,
  itemId: RecordId,
  input: PurchaseItemPatch,
) {
  const payload = await apiFetch<unknown>(
    `/purchases/${encodeURIComponent(String(purchaseId))}/items/${encodeURIComponent(String(itemId))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  return readUpdatedPurchase(purchaseId, payload);
}

export async function deletePurchaseItem(
  purchaseId: RecordId,
  itemId: RecordId,
) {
  await apiFetch<void>(
    `/purchases/${encodeURIComponent(String(purchaseId))}/items/${encodeURIComponent(String(itemId))}`,
    { ...authOptions(), method: "DELETE" },
  );
  return fetchPurchase(String(purchaseId));
}
