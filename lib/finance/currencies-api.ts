import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type RecordId = number | string;

export type Currency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
  rate: number;
  is_base: boolean;
  is_default_for_transactions: boolean;
  is_active: boolean;
};

export type CurrencyHistoryEntry = {
  id: RecordId;
  currency_id: RecordId;
  previous_rate: number | null;
  new_rate: number;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
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

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : value === 1 || value === "true";
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function readCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new ApiError(500, null);
}

export function parseCurrency(source: unknown): Currency | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const code = readText(record.code);
  const name = readText(record.name);
  const symbol = readText(record.symbol);
  const rate = readNumber(record.rate);
  if (id === null || !code || !name || !symbol || rate === null) return null;

  return {
    id,
    code,
    name,
    symbol,
    rate,
    is_base: readBoolean(record.is_base),
    is_default_for_transactions: readBoolean(record.is_default_for_transactions),
    is_active: readBoolean(record.is_active),
  };
}

export function parseCurrencyList(payload: unknown): Currency[] {
  const list = readCollection(payload);
  const currencies = list
    .map(parseCurrency)
    .filter((currency): currency is Currency => currency !== null);
  if (list.length > 0 && currencies.length === 0) throw new ApiError(500, null);
  return currencies.sort((a, b) => {
    if (a.is_base && !b.is_base) return -1;
    if (!a.is_base && b.is_base) return 1;
    return a.code.localeCompare(b.code);
  });
}

export function parseHistoryEntry(source: unknown): CurrencyHistoryEntry | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const currencyId = readId(record.currency_id);
  const newRate = readNumber(record.new_rate);
  const changedAt = readText(record.changed_at);
  if (id === null || currencyId === null || newRate === null || !changedAt) return null;

  return {
    id,
    currency_id: currencyId,
    previous_rate: readNumber(record.previous_rate),
    new_rate: newRate,
    changed_by: typeof record.changed_by === "string" ? record.changed_by : null,
    changed_at: changedAt,
    reason: typeof record.reason === "string" ? record.reason : null,
  };
}

export function parseHistoryList(payload: unknown): CurrencyHistoryEntry[] {
  const list = readCollection(payload);
  const entries = list
    .map(parseHistoryEntry)
    .filter((entry): entry is CurrencyHistoryEntry => entry !== null);
  if (list.length > 0 && entries.length === 0) throw new ApiError(500, null);
  return entries.sort(
    (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime(),
  );
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchCurrencies(includeInactive = false) {
  const query = includeInactive ? "?include_inactive=true" : "";
  const payload = await apiFetch<unknown>(`/currencies${query}`, authOptions());
  return parseCurrencyList(payload);
}

export async function fetchCurrency(id: string) {
  const payload = await apiFetch<unknown>(
    `/currencies/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const currency = parseCurrency(payload);
  if (!currency) throw new ApiError(500, null);
  return currency;
}

export async function fetchCurrencyHistory(id: string) {
  const payload = await apiFetch<unknown>(
    `/currencies/${encodeURIComponent(id)}/history`,
    authOptions(),
  );
  return parseHistoryList(payload);
}

export type CurrencyInput = {
  code: string;
  name: string;
  symbol: string;
  rate: number;
};

export type CurrencyUpdate = {
  name?: string;
  symbol?: string;
  rate?: number;
  is_active?: boolean;
  reason?: string;
};

export async function createCurrency(input: CurrencyInput) {
  const payload = await apiFetch<unknown>("/currencies", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const currency = parseCurrency(payload);
  if (!currency) throw new ApiError(500, null);
  return currency;
}

export async function updateCurrency(id: string, input: CurrencyUpdate) {
  const payload = await apiFetch<unknown>(
    `/currencies/${encodeURIComponent(id)}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const currency = parseCurrency(payload);
  if (!currency) throw new ApiError(500, null);
  return currency;
}

export async function deactivateCurrency(id: string) {
  await apiFetch<void>(`/currencies/${encodeURIComponent(id)}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export function formatRate(value: number) {
  return Number(value.toFixed(6)).toString();
}

export function isBaseCurrency(currency: Currency) {
  return currency.is_base;
}

export function isDefaultTransactionCurrency(currency: Currency) {
  return currency.is_default_for_transactions;
}

export function canEditCurrency(currency: Currency) {
  return !currency.is_base;
}

export function canDeactivateCurrency(currency: Currency) {
  return !currency.is_base && !currency.is_default_for_transactions;
}
