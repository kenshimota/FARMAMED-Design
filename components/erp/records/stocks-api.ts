import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type StockCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
};

export type StockItemState = {
  id: RecordId;
  name: string;
  label: string;
  is_sellable: boolean;
};

export type StockRecord = {
  id: RecordId;
  product_id: RecordId;
  item_state_id: RecordId;
  quantity: number;
  item_state: StockItemState | null;
};

export type AvailableStockRecord = {
  product_id: RecordId;
  item_state_id: RecordId;
  quantity: number;
  cost: number | null;
  currency_id: RecordId | null;
  currency: StockCurrency | null;
  item_state: StockItemState | null;
};

export type StockFilters = {
  product_id?: RecordId;
  item_state_id?: RecordId;
  in_stock?: boolean;
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

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function parseStockItemState(source: unknown): StockItemState | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  const label = readText(source.label);
  if (id === null || !name || !label) return null;
  return {
    id,
    name,
    label,
    is_sellable: readBoolean(source.is_sellable) ?? false,
  };
}

export function parseStockCurrency(source: unknown): StockCurrency | null {
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

export function parseStock(source: unknown): StockRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const productId = readId(record.product_id);
  const itemStateId = readId(record.item_state_id);
  const quantity = readNumber(record.quantity);
  if (id === null || productId === null || itemStateId === null || quantity === null) {
    return null;
  }

  return {
    id,
    product_id: productId,
    item_state_id: itemStateId,
    quantity,
    item_state: parseStockItemState(record.item_state),
  };
}

export function parseAvailableStock(source: unknown): AvailableStockRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const productId = readId(record.product_id);
  const itemStateId = readId(record.item_state_id);
  const quantity = readNumber(record.quantity);
  if (productId === null || itemStateId === null || quantity === null) return null;

  return {
    product_id: productId,
    item_state_id: itemStateId,
    quantity,
    cost: readNumber(record.cost),
    currency_id: readId(record.currency_id),
    currency: parseStockCurrency(record.currency),
    item_state: parseStockItemState(record.item_state),
  };
}

function compareIds(first: RecordId, second: RecordId) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return firstNumber - secondNumber;
  }
  return String(first).localeCompare(String(second), "es", { numeric: true });
}

export function parseStockList(payload: unknown): StockRecord[] {
  const list = readCollection(payload);
  const stocks = list
    .map(parseStock)
    .filter((stock): stock is StockRecord => stock !== null);
  if (list.length > 0 && stocks.length === 0) throw new ApiError(500, null);

  return stocks.sort(
    (first, second) =>
      compareIds(first.product_id, second.product_id) ||
      compareIds(first.item_state_id, second.item_state_id),
  );
}

export function parseAvailableStockList(payload: unknown): AvailableStockRecord[] {
  const list = readCollection(payload);
  const stocks = list
    .map(parseAvailableStock)
    .filter((stock): stock is AvailableStockRecord => stock !== null);
  if (list.length > 0 && stocks.length === 0) throw new ApiError(500, null);
  return stocks;
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function appendFilter(query: URLSearchParams, key: string, value: RecordId | undefined) {
  if (value === undefined || value === null) return;
  const normalized = String(value).trim();
  if (normalized) query.set(key, normalized);
}

export async function fetchStocks(filters: StockFilters = {}) {
  const query = new URLSearchParams();
  appendFilter(query, "product_id", filters.product_id);
  appendFilter(query, "item_state_id", filters.item_state_id);
  if (filters.in_stock !== undefined) {
    query.set("in_stock", String(filters.in_stock));
  }
  const suffix = query.toString();
  const payload = await apiFetch<unknown>(
    `/stocks${suffix ? `?${suffix}` : ""}`,
    authOptions(),
  );
  return parseStockList(payload);
}

export async function fetchStock(id: string) {
  const payload = await apiFetch<unknown>(
    `/stocks/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const stock = parseStock(payload);
  if (!stock) throw new ApiError(500, null);
  return stock;
}

export async function fetchStocksByProduct(productId: RecordId) {
  const payload = await apiFetch<unknown>(
    `/stocks/product/${encodeURIComponent(String(productId))}`,
    authOptions(),
  );
  return parseStockList(payload);
}

export async function fetchAvailableStocks(productId: RecordId) {
  const query = new URLSearchParams();
  appendFilter(query, "product_id", productId);
  const payload = await apiFetch<unknown>(
    `/stocks/available?${query.toString()}`,
    authOptions(),
  );
  return parseAvailableStockList(payload);
}
