import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type PriceList = {
  id: RecordId;
  name: string;
  description: string;
  percentage: number;
};

export type PriceListInput = {
  name: string;
  description?: string | null;
  percentage: number;
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

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function parsePriceList(source: unknown): PriceList | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const name = readText(record.name);
  const percentage = readNumber(record.percentage);
  if (id === null || !name || percentage === null) return null;

  return {
    id,
    name,
    description: readText(record.description),
    percentage,
  };
}

function comparePriceLists(first: PriceList, second: PriceList) {
  const byName = first.name.localeCompare(second.name, "es", {
    sensitivity: "base",
  });
  if (byName !== 0) return byName;
  const firstId = Number(first.id);
  const secondId = Number(second.id);
  if (Number.isFinite(firstId) && Number.isFinite(secondId)) {
    return firstId - secondId;
  }
  return String(first.id).localeCompare(String(second.id), "es");
}

export function parsePriceListList(payload: unknown): PriceList[] {
  const list = readCollection(payload);
  const priceLists = list
    .map(parsePriceList)
    .filter((priceList): priceList is PriceList => priceList !== null);
  if (list.length > 0 && priceLists.length === 0) throw new ApiError(500, null);
  return priceLists.sort(comparePriceLists);
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchPriceLists() {
  const payload = await apiFetch<unknown>("/price-lists", authOptions());
  return parsePriceListList(payload);
}

export async function fetchPriceList(id: string) {
  const payload = await apiFetch<unknown>(
    `/price-lists/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const priceList = parsePriceList(payload);
  if (!priceList) throw new ApiError(500, null);
  return priceList;
}

export async function createPriceList(input: PriceListInput) {
  const payload = await apiFetch<unknown>("/price-lists", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const priceList = parsePriceList(payload);
  if (!priceList) throw new ApiError(500, null);
  return priceList;
}

export async function updatePriceList(id: string, input: PriceListInput) {
  const payload = await apiFetch<unknown>(
    `/price-lists/${encodeURIComponent(id)}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const priceList = parsePriceList(payload);
  if (!priceList) throw new ApiError(500, null);
  return priceList;
}

export function deletePriceList(id: string) {
  return apiFetch<void>(`/price-lists/${encodeURIComponent(id)}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
