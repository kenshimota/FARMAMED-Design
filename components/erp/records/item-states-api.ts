import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import { readCollection, type RecordId } from "@/components/erp/records/records-api";

export type ItemStateRecord = {
  id: RecordId;
  name: string;
  label: string;
  description: string | null;
  is_sellable: boolean;
};

export type ItemStateInput = {
  name?: string;
  label?: string;
  description?: string | null;
  is_sellable?: boolean;
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

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function parseItemState(source: unknown): ItemStateRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const name = readText(record.name);
  const label = readText(record.label);
  const description = readText(record.description);
  const isSellable = readBoolean(record.is_sellable ?? record.isSellable);

  if (id === null || !name || !label || isSellable === null) return null;

  return {
    id,
    name,
    label,
    description: description || null,
    is_sellable: isSellable,
  };
}

export function parseItemStateList(payload: unknown): ItemStateRecord[] {
  const list = readCollection(payload);
  const itemStates = list
    .map(parseItemState)
    .filter((itemState): itemState is ItemStateRecord => itemState !== null);
  if (list.length > 0 && itemStates.length === 0) throw new ApiError(500, null);

  return itemStates.sort((first, second) =>
    first.name.localeCompare(second.name, "es", { sensitivity: "base" }),
  );
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchItemStates(options: { isSellable?: boolean } = {}) {
  const query = new URLSearchParams();
  if (options.isSellable !== undefined) {
    query.set("is_sellable", String(options.isSellable));
  }
  const suffix = query.toString();
  const payload = await apiFetch<unknown>(
    `/item-states${suffix ? `?${suffix}` : ""}`,
    authOptions(),
  );
  return parseItemStateList(payload);
}

export async function fetchItemState(id: string) {
  const payload = await apiFetch<unknown>(
    `/item-states/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const itemState = parseItemState(payload);
  if (!itemState) throw new ApiError(500, null);
  return itemState;
}

export function createItemState(values: ItemStateInput) {
  return apiFetch<void>("/item-states", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
}

export function updateItemState(id: RecordId, values: ItemStateInput) {
  return apiFetch<void>(`/item-states/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "PUT",
    body: JSON.stringify(values),
  });
}

export function deleteItemState(id: RecordId) {
  return apiFetch<void>(`/item-states/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
