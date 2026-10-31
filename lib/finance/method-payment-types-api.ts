import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type RecordId = number | string;

export const METHOD_PAYMENT_FIELD_TYPES = [
  "text",
  "email",
  "phone",
  "integer",
  "boolean",
] as const;

export type MethodPaymentFieldType = (typeof METHOD_PAYMENT_FIELD_TYPES)[number];

export const METHOD_PAYMENT_FIELD_TYPE_LABELS: Record<MethodPaymentFieldType, string> = {
  text: "Texto",
  email: "Correo electrónico",
  phone: "Teléfono",
  integer: "Número entero",
  boolean: "Sí/No",
};

export function getMethodPaymentFieldTypeLabel(type: MethodPaymentFieldType) {
  return METHOD_PAYMENT_FIELD_TYPE_LABELS[type];
}

export type MethodPaymentField = {
  key: string;
  label: string;
  type: MethodPaymentFieldType;
  required: boolean;
  max_length?: number;
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
  currency_id: RecordId;
  currency: MethodPaymentTypeCurrency | null;
  fields: MethodPaymentField[];
  description: string;
  is_active: boolean;
};

export type MethodPaymentTypeFilters = {
  currencyId?: string;
  isActive?: boolean;
};

export type MethodPaymentTypeInput = {
  code: string;
  name: string;
  currency_id: RecordId;
  fields: MethodPaymentField[];
  description?: string;
  is_active?: boolean;
};

export type MethodPaymentTypeUpdate = {
  name?: string;
  description?: string;
  is_active?: boolean;
  currency_id?: RecordId;
  fields?: MethodPaymentField[];
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
  if (typeof value === "string" && value.trim()) {
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

export function isTextFieldType(type: MethodPaymentFieldType) {
  return type === "text" || type === "email" || type === "phone";
}

export function isMethodPaymentFieldType(value: unknown): value is MethodPaymentFieldType {
  return (
    typeof value === "string" &&
    (METHOD_PAYMENT_FIELD_TYPES as readonly string[]).includes(value)
  );
}

function parseFieldDefinition(source: unknown): MethodPaymentField | null {
  if (!isRecord(source)) return null;

  const key = readText(source.key);
  const label = readText(source.label);
  const type = source.type;
  if (!key || !label || !isMethodPaymentFieldType(type)) return null;

  const maxLength = readNumber(source.max_length);
  const field: MethodPaymentField = {
    key,
    label,
    type,
    required: readBoolean(source.required),
  };

  if (isTextFieldType(type) && maxLength !== null) {
    field.max_length = maxLength;
  }

  return field;
}

function parseFieldList(value: unknown): MethodPaymentField[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseFieldDefinition)
    .filter((field): field is MethodPaymentField => field !== null);
}

function parseCurrencySummary(source: unknown): MethodPaymentTypeCurrency | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const code = readText(record.code);
  const symbol = readText(record.symbol);
  if (id === null || !code || !symbol) return null;

  return {
    id,
    code,
    symbol,
    name: readText(record.name),
  };
}

export function parseMethodPaymentType(source: unknown): MethodPaymentType | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const code = readText(record.code);
  const name = readText(record.name);
  const currencyId = readId(record.currency_id);
  if (id === null || !code || !name || currencyId === null) return null;

  return {
    id,
    code,
    name,
    currency_id: currencyId,
    currency: parseCurrencySummary(record.currency),
    fields: parseFieldList(record.fields),
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

export async function fetchMethodPaymentTypes(filters: MethodPaymentTypeFilters = {}) {
  const query = new URLSearchParams();
  if (filters.currencyId) query.set("currency_id", filters.currencyId);
  if (filters.isActive !== undefined) query.set("is_active", String(filters.isActive));
  const queryString = query.toString();
  const suffix = queryString ? `?${queryString}` : "";
  const payload = await apiFetch<unknown>(
    `/method-payment-types${suffix}`,
    authOptions(),
  );
  return parseMethodPaymentTypeList(payload);
}

export async function fetchMethodPaymentType(id: string) {
  const payload = await apiFetch<unknown>(
    `/method-payment-types/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const type = parseMethodPaymentType(payload);
  if (!type) throw new ApiError(500, null);
  return type;
}

export async function createMethodPaymentType(input: MethodPaymentTypeInput) {
  const payload = await apiFetch<unknown>("/method-payment-types", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const type = parseMethodPaymentType(payload);
  if (!type) throw new ApiError(500, null);
  return type;
}

export async function updateMethodPaymentType(
  id: string,
  input: MethodPaymentTypeUpdate,
) {
  const payload = await apiFetch<unknown>(
    `/method-payment-types/${encodeURIComponent(id)}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const type = parseMethodPaymentType(payload);
  if (!type) throw new ApiError(500, null);
  return type;
}

export async function deleteMethodPaymentType(id: string) {
  await apiFetch<void>(`/method-payment-types/${encodeURIComponent(id)}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
