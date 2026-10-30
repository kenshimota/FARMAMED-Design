import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type RecordId = number | string;

export type Tax = {
  id: RecordId;
  code: string;
  name: string;
  rate: number;
  description: string;
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

export function parseTax(source: unknown): Tax | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const code = readText(record.code);
  const name = readText(record.name);
  const rate = readNumber(record.rate);
  if (id === null || !code || !name || rate === null) return null;

  return {
    id,
    code,
    name,
    rate,
    description: readText(record.description),
    is_active: readBoolean(record.is_active),
  };
}

export function parseTaxList(payload: unknown): Tax[] {
  const list = readCollection(payload);
  const taxes = list
    .map(parseTax)
    .filter((tax): tax is Tax => tax !== null);
  if (list.length > 0 && taxes.length === 0) throw new ApiError(500, null);
  return taxes.sort((a, b) => a.code.localeCompare(b.code));
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchTaxes(isActive?: boolean) {
  const query = isActive === undefined ? "" : `?is_active=${isActive}`;
  const payload = await apiFetch<unknown>(`/taxes${query}`, authOptions());
  return parseTaxList(payload);
}

export async function fetchTax(id: string) {
  const payload = await apiFetch<unknown>(
    `/taxes/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const tax = parseTax(payload);
  if (!tax) throw new ApiError(500, null);
  return tax;
}

export type TaxInput = {
  code: string;
  name: string;
  rate: number;
  description?: string;
  is_active?: boolean;
};

export type TaxUpdate = {
  name?: string;
  rate?: number;
  description?: string;
  is_active?: boolean;
};

export async function createTax(input: TaxInput) {
  const payload = await apiFetch<unknown>("/taxes", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const tax = parseTax(payload);
  if (!tax) throw new ApiError(500, null);
  return tax;
}

export async function updateTax(id: string, input: TaxUpdate) {
  const payload = await apiFetch<unknown>(
    `/taxes/${encodeURIComponent(id)}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const tax = parseTax(payload);
  if (!tax) throw new ApiError(500, null);
  return tax;
}

export async function deleteTax(id: string) {
  await apiFetch<void>(`/taxes/${encodeURIComponent(id)}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export function formatTaxRate(value: number) {
  return value.toFixed(2).replace(".", ",") + " %";
}
