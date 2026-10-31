import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type RecordId = number | string;

export type MethodPaymentDetailValue = string | number | boolean;

export type MethodPaymentDetails = Record<string, MethodPaymentDetailValue>;

export type MethodPaymentCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
};

export type MethodPaymentTypeInfo = {
  id: RecordId;
  code: string;
  name: string;
};

export type MethodPayment = {
  id: RecordId;
  method_payment_type_id: RecordId | null;
  label: string;
  details: MethodPaymentDetails;
  is_active: boolean;
  currency_id: RecordId | null;
  currency: MethodPaymentCurrency | null;
  method_payment_type: MethodPaymentTypeInfo | null;
};

export type MethodPaymentListFilters = {
  method_payment_type_id?: string;
  currency_id?: string;
  is_active?: boolean;
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

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function readCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new ApiError(500, null);
}

export function parseMethodPaymentDetails(
  value: unknown,
): MethodPaymentDetails {
  const details: MethodPaymentDetails = {};
  if (!isRecord(value)) return details;
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string" || typeof raw === "boolean") {
      details[key] = raw;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      details[key] = raw;
    }
  }
  return details;
}

function parseCurrency(source: unknown): MethodPaymentCurrency | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  const name = readText(source.name);
  if (id === null || !code || !name) return null;
  return { id, code, name, symbol: readText(source.symbol) };
}

function parseTypeInfo(source: unknown): MethodPaymentTypeInfo | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  const name = readText(source.name);
  if (id === null || !code || !name) return null;
  return { id, code, name };
}

export function parseMethodPayment(source: unknown): MethodPayment | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const label = readText(record.label);
  if (id === null || !label) return null;

  return {
    id,
    method_payment_type_id: readId(record.method_payment_type_id),
    label,
    details: parseMethodPaymentDetails(record.details),
    is_active: readBoolean(record.is_active),
    currency_id: readId(record.currency_id),
    currency: parseCurrency(record.currency),
    method_payment_type: parseTypeInfo(record.method_payment_type),
  };
}

export function parseMethodPaymentList(payload: unknown): MethodPayment[] {
  const list = readCollection(payload);
  const methods = list
    .map(parseMethodPayment)
    .filter((method): method is MethodPayment => method !== null);
  if (list.length > 0 && methods.length === 0) throw new ApiError(500, null);
  return methods.sort((a, b) => {
    const typeOrder = (a.method_payment_type?.code ?? "").localeCompare(
      b.method_payment_type?.code ?? "",
    );
    return typeOrder !== 0 ? typeOrder : a.label.localeCompare(b.label);
  });
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function filtersQuery(filters: MethodPaymentListFilters) {
  const params = new URLSearchParams();
  if (filters.method_payment_type_id) {
    params.set("method_payment_type_id", filters.method_payment_type_id);
  }
  if (filters.currency_id) params.set("currency_id", filters.currency_id);
  if (filters.is_active !== undefined) {
    params.set("is_active", String(filters.is_active));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchMethodPayments(filters: MethodPaymentListFilters = {}) {
  const payload = await apiFetch<unknown>(
    `/method-payments${filtersQuery(filters)}`,
    authOptions(),
  );
  return parseMethodPaymentList(payload);
}

export async function fetchMethodPayment(id: string) {
  const payload = await apiFetch<unknown>(
    `/method-payments/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const method = parseMethodPayment(payload);
  if (!method) throw new ApiError(500, null);
  return method;
}

export type MethodPaymentCreateInput = {
  method_payment_type_id: RecordId;
  label: string;
  details: MethodPaymentDetails;
  is_active?: boolean;
};

export type MethodPaymentUpdateInput = {
  label: string;
  details: MethodPaymentDetails;
  is_active: boolean;
};

export async function createMethodPayment(input: MethodPaymentCreateInput) {
  const payload = await apiFetch<unknown>("/method-payments", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const method = parseMethodPayment(payload);
  if (!method) throw new ApiError(500, null);
  return method;
}

export async function updateMethodPayment(
  id: string,
  input: MethodPaymentUpdateInput,
) {
  const payload = await apiFetch<unknown>(
    `/method-payments/${encodeURIComponent(id)}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const method = parseMethodPayment(payload);
  if (!method) throw new ApiError(500, null);
  return method;
}

export async function deleteMethodPayment(id: string) {
  await apiFetch<void>(`/method-payments/${encodeURIComponent(id)}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
