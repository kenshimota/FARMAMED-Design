import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type RecordId = number | string;

export type MethodPaymentFieldType =
  | "text"
  | "email"
  | "phone"
  | "integer"
  | "boolean";

export type MethodPaymentTypeField = {
  key: string;
  label: string;
  type: MethodPaymentFieldType;
  required: boolean;
  max_length: number | null;
};

export type MethodPaymentTypeCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
};

export type MethodPaymentType = {
  id: RecordId;
  code: string;
  name: string;
  currency_id: RecordId | null;
  currency: MethodPaymentTypeCurrency | null;
  fields: MethodPaymentTypeField[];
  description: string;
  is_active: boolean;
};

const FIELD_TYPES: readonly MethodPaymentFieldType[] = [
  "text",
  "email",
  "phone",
  "integer",
  "boolean",
];

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

function readCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new ApiError(500, null);
}

export function parseMethodPaymentTypeField(
  source: unknown,
): MethodPaymentTypeField | null {
  if (!isRecord(source)) return null;
  const key = readText(source.key);
  const label = readText(source.label);
  const rawType = readText(source.type);
  const type = (FIELD_TYPES as readonly string[]).includes(rawType)
    ? (rawType as MethodPaymentFieldType)
    : null;
  if (!key || !label || !type) return null;

  const maxLength = readNumber(source.max_length);
  return {
    key,
    label,
    type,
    required: readBoolean(source.required),
    max_length:
      maxLength !== null && Number.isInteger(maxLength) && maxLength > 0
        ? maxLength
        : null,
  };
}

function parseCurrency(source: unknown): MethodPaymentTypeCurrency | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  const name = readText(source.name);
  if (id === null || !code || !name) return null;
  return { id, code, name, symbol: readText(source.symbol) };
}

export function parseMethodPaymentType(source: unknown): MethodPaymentType | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const code = readText(record.code);
  const name = readText(record.name);
  if (id === null || !code || !name) return null;

  const rawFields = Array.isArray(record.fields) ? record.fields : [];
  const fields = rawFields
    .map(parseMethodPaymentTypeField)
    .filter((field): field is MethodPaymentTypeField => field !== null);

  return {
    id,
    code,
    name,
    currency_id: readId(record.currency_id),
    currency: parseCurrency(record.currency),
    fields,
    description: readText(record.description),
    is_active: readBoolean(record.is_active),
  };
}

export function parseMethodPaymentTypeList(payload: unknown): MethodPaymentType[] {
  const list = readCollection(payload);
  const types = list
    .map(parseMethodPaymentType)
    .filter((type): type is MethodPaymentType => type !== null);
  if (list.length > 0 && types.length === 0) throw new ApiError(500, null);
  return types.sort((a, b) => a.code.localeCompare(b.code));
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchMethodPaymentTypes() {
  const payload = await apiFetch<unknown>("/method-payment-types", authOptions());
  return parseMethodPaymentTypeList(payload);
}

export function findMethodPaymentType(
  types: readonly MethodPaymentType[],
  id: RecordId | null,
) {
  if (id === null) return null;
  return types.find((type) => String(type.id) === String(id)) ?? null;
}
