import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type SupplierCity = {
  id: RecordId;
  name: string;
};

export type SupplierState = {
  id: RecordId;
  name: string;
  code: string;
};

export type SupplierRecord = {
  id: RecordId;
  name: string;
  identification: string;
  email: string;
  phone: string;
  address: string;
  observations: string;
  city_id: RecordId;
  state_id: RecordId;
  city: SupplierCity | null;
  state: SupplierState | null;
};

export type SupplierInput = {
  name: string;
  identification: string;
  email: string;
  phone: string;
  address: string;
  observations: string | null;
  state_id: RecordId;
  city_id: RecordId;
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

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function parseSupplierState(source: unknown): SupplierState | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  if (id === null || !name) return null;
  return { id, name, code: readText(source.code) };
}

export function parseSupplierCity(source: unknown): SupplierCity | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  if (id === null || !name) return null;
  return { id, name };
}

export function parseSupplier(source: unknown): SupplierRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const name = readText(record.name);
  const identification = readText(record.identification);
  if (id === null || !name || !identification) return null;

  const citySource = record.city;
  const city = parseSupplierCity(citySource);
  const cityState =
    isRecord(citySource) && isRecord(citySource.state)
      ? parseSupplierState(citySource.state)
      : null;
  const state = parseSupplierState(record.state) ?? cityState;

  const cityId = readId(record.city_id) ?? city?.id ?? null;
  const stateId = readId(record.state_id) ?? state?.id ?? null;
  if (cityId === null || stateId === null) return null;

  return {
    id,
    name,
    identification,
    email: readText(record.email),
    phone: readText(record.phone),
    address: readText(record.address),
    observations: readText(record.observations),
    city_id: cityId,
    state_id: stateId,
    city,
    state,
  };
}

export function parseSupplierList(payload: unknown): SupplierRecord[] {
  const list = readCollection(payload);
  const suppliers = list
    .map(parseSupplier)
    .filter((supplier): supplier is SupplierRecord => supplier !== null);
  if (list.length > 0 && suppliers.length === 0) throw new ApiError(500, null);
  return suppliers.sort((first, second) =>
    first.name.localeCompare(second.name, "es", { sensitivity: "base" }),
  );
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchSuppliers() {
  const payload = await apiFetch<unknown>("/suppliers", authOptions());
  return parseSupplierList(payload);
}

export async function fetchSupplier(id: string) {
  const payload = await apiFetch<unknown>(
    `/suppliers/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const supplier = parseSupplier(payload);
  if (!supplier) throw new ApiError(500, null);
  return supplier;
}

export async function createSupplier(values: SupplierInput) {
  const payload = await apiFetch<unknown>("/suppliers", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
  return parseSupplier(payload);
}

export async function updateSupplier(id: RecordId, values: SupplierInput) {
  const payload = await apiFetch<unknown>(
    `/suppliers/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(values),
    },
  );
  return parseSupplier(payload);
}

export function deleteSupplier(id: RecordId) {
  return apiFetch<void>(`/suppliers/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
