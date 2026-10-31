import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type CostCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
};

export type CostItemState = {
  id: RecordId;
  name: string;
  label: string;
  is_sellable: boolean;
};

export type CostRecord = {
  id: RecordId;
  product_id: RecordId;
  item_state_id: RecordId;
  cost: number | null;
  currency_id: RecordId | null;
  currency: CostCurrency | null;
  item_state: CostItemState | null;
};

export type CostFilters = {
  product_id?: RecordId;
  item_state_id?: RecordId;
  currency_id?: RecordId;
};

export type CostInput = {
  product_id: RecordId;
  item_state_id: RecordId;
  cost: number;
  currency_id?: RecordId;
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

export function parseCostCurrency(source: unknown): CostCurrency | null {
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

export function parseCostItemState(source: unknown): CostItemState | null {
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

export function parseCost(source: unknown): CostRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const productId = readId(record.product_id);
  const itemStateId = readId(record.item_state_id);
  if (id === null || productId === null || itemStateId === null) return null;

  return {
    id,
    product_id: productId,
    item_state_id: itemStateId,
    cost: readNumber(record.cost),
    currency_id: readId(record.currency_id),
    currency: parseCostCurrency(record.currency),
    item_state: parseCostItemState(record.item_state),
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

export function parseCostList(payload: unknown): CostRecord[] {
  const list = readCollection(payload);
  const costs = list
    .map(parseCost)
    .filter((cost): cost is CostRecord => cost !== null);
  if (list.length > 0 && costs.length === 0) throw new ApiError(500, null);

  return costs.sort(
    (first, second) =>
      compareIds(first.product_id, second.product_id) ||
      compareIds(first.item_state_id, second.item_state_id),
  );
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function appendFilter(query: URLSearchParams, key: string, value: RecordId | undefined) {
  if (value === undefined || value === null) return;
  const normalized = String(value).trim();
  if (normalized) query.set(key, normalized);
}

export async function fetchCosts(filters: CostFilters = {}) {
  const query = new URLSearchParams();
  appendFilter(query, "product_id", filters.product_id);
  appendFilter(query, "item_state_id", filters.item_state_id);
  appendFilter(query, "currency_id", filters.currency_id);
  const suffix = query.toString();
  const payload = await apiFetch<unknown>(
    `/costs${suffix ? `?${suffix}` : ""}`,
    authOptions(),
  );
  return parseCostList(payload);
}

export async function fetchCost(id: string) {
  const payload = await apiFetch<unknown>(
    `/costs/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const cost = parseCost(payload);
  if (!cost) throw new ApiError(500, null);
  return cost;
}

export async function fetchCostsByProduct(productId: RecordId) {
  const payload = await apiFetch<unknown>(
    `/costs/product/${encodeURIComponent(String(productId))}`,
    authOptions(),
  );
  return parseCostList(payload);
}

export async function createCost(input: CostInput) {
  const payload = await apiFetch<unknown>("/costs", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const cost = parseCost(payload);
  if (!cost) throw new ApiError(500, null);
  return cost;
}

export async function updateCost(id: RecordId, input: Partial<CostInput>) {
  const payload = await apiFetch<unknown>(
    `/costs/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const cost = parseCost(payload);
  if (!cost) throw new ApiError(500, null);
  return cost;
}

export function deleteCost(id: RecordId) {
  return apiFetch<void>(`/costs/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
