import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type WarehouseRecord = {
  id: RecordId;
  name: string;
  address: string;
  observations: string;
};

export type WarehouseInput = {
  name: string;
  address: string;
  observations: string | null;
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

export function parseWarehouse(source: unknown): WarehouseRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const name = readText(record.name);
  const address = readText(record.address);
  if (id === null || !name || !address) return null;

  return {
    id,
    name,
    address,
    observations: readText(record.observations),
  };
}

export function parseWarehouseList(payload: unknown): WarehouseRecord[] {
  const list = readCollection(payload);
  const warehouses = list
    .map(parseWarehouse)
    .filter((warehouse): warehouse is WarehouseRecord => warehouse !== null);
  if (list.length > 0 && warehouses.length === 0) throw new ApiError(500, null);
  return warehouses.sort((first, second) => {
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

export async function fetchWarehouses(search?: string) {
  const query = new URLSearchParams();
  const term = search?.trim();
  if (term) query.set("search", term);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const payload = await apiFetch<unknown>(`/warehouses${suffix}`, authOptions());
  return parseWarehouseList(payload);
}

export async function fetchWarehouse(id: string) {
  const payload = await apiFetch<unknown>(
    `/warehouses/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const warehouse = parseWarehouse(payload);
  if (!warehouse) throw new ApiError(500, null);
  return warehouse;
}

export async function createWarehouse(values: WarehouseInput) {
  const payload = await apiFetch<unknown>("/warehouses", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
  return parseWarehouse(payload);
}

export async function updateWarehouse(id: RecordId, values: WarehouseInput) {
  const payload = await apiFetch<unknown>(
    `/warehouses/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(values),
    },
  );
  return parseWarehouse(payload);
}

export function deleteWarehouse(id: RecordId) {
  return apiFetch<void>(`/warehouses/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
