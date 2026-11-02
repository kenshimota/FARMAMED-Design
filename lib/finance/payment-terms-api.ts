import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type RecordId = number | string;

export type PaymentTerm = {
  id: RecordId;
  code: string;
  name: string;
  description: string;
  days: number;
  is_active: boolean;
};

export type PaymentTermSummary = {
  id: RecordId;
  code: string;
  name: string;
  days: number;
};

export type PaymentTermInput = {
  code: string;
  name: string;
  description?: string;
  days: number;
  is_active?: boolean;
};

export type PaymentTermUpdate = {
  name: string;
  description?: string | null;
  days: number;
  is_active: boolean;
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
    if (Number.isFinite(parsed)) return parsed;
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

export function readCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new ApiError(500, null);
}

export function parsePaymentTerm(source: unknown): PaymentTerm | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const code = readText(record.code);
  const name = readText(record.name);
  const days = readNumber(record.days);
  if (id === null || !code || !name || days === null) return null;

  return {
    id,
    code,
    name,
    description: readText(record.description),
    days,
    is_active: readBoolean(record.is_active),
  };
}

export function parsePaymentTermSummary(
  source: unknown,
): PaymentTermSummary | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  const name = readText(source.name);
  const days = readNumber(source.days);
  if (id === null || !code || !name || days === null) return null;
  return { id, code, name, days };
}

export function parsePaymentTermList(payload: unknown): PaymentTerm[] {
  const list = readCollection(payload);
  const terms = list
    .map(parsePaymentTerm)
    .filter((term): term is PaymentTerm => term !== null);
  if (list.length > 0 && terms.length === 0) throw new ApiError(500, null);
  return terms.sort((first, second) => {
    if (first.days !== second.days) return first.days - second.days;
    const firstId = Number(first.id);
    const secondId = Number(second.id);
    if (Number.isFinite(firstId) && Number.isFinite(secondId)) {
      return firstId - secondId;
    }
    return String(first.id).localeCompare(String(second.id), "es");
  });
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchPaymentTerms(isActive?: boolean) {
  const query = isActive === undefined ? "" : `?is_active=${isActive}`;
  const payload = await apiFetch<unknown>(
    `/payment-terms${query}`,
    authOptions(),
  );
  return parsePaymentTermList(payload);
}

export async function fetchPaymentTerm(id: string) {
  const payload = await apiFetch<unknown>(
    `/payment-terms/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const term = parsePaymentTerm(payload);
  if (!term) throw new ApiError(500, null);
  return term;
}

export async function createPaymentTerm(input: PaymentTermInput) {
  const payload = await apiFetch<unknown>("/payment-terms", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const term = parsePaymentTerm(payload);
  if (!term) throw new ApiError(500, null);
  return term;
}

export async function updatePaymentTerm(
  id: string,
  input: PaymentTermUpdate,
) {
  const payload = await apiFetch<unknown>(
    `/payment-terms/${encodeURIComponent(id)}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const term = parsePaymentTerm(payload);
  if (!term) throw new ApiError(500, null);
  return term;
}

export function deletePaymentTerm(id: string) {
  return apiFetch<void>(`/payment-terms/${encodeURIComponent(id)}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export function paymentTermDayCountLabel(days: number) {
  if (days === 1) return "1 día";
  return `${days} días`;
}

export function paymentTermDaysLabel(days: number) {
  if (days === 0) return "Contado · 0 días";
  return paymentTermDayCountLabel(days);
}

export function paymentTermConditionLabel(days: number) {
  return days === 0 ? "Contado" : "Crédito";
}
