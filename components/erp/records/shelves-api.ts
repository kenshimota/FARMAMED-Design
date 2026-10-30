import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type ShelfSectionRecord = {
  id: RecordId;
  shelf_id: RecordId | null;
  code: string;
  name: string;
  description: string;
};

export type ShelfRecord = {
  id: RecordId;
  warehouse_id: RecordId;
  code: string;
  name: string;
  description: string;
  sections: ShelfSectionRecord[];
};

export type ShelfInput = {
  warehouse_id: RecordId;
  code: string;
  name?: string | null;
  description?: string | null;
};

export type ShelfUpdateInput = {
  code: string;
  name?: string | null;
  description?: string | null;
};

export type SectionInput = {
  code: string;
  name?: string | null;
  description?: string | null;
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

function compareCodes(first: string, second: string) {
  return first.localeCompare(second, "es", { numeric: true, sensitivity: "base" });
}

export function parseSection(source: unknown): ShelfSectionRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const code = readText(record.code);
  if (id === null || !code) return null;

  return {
    id,
    shelf_id: readId(record.shelf_id),
    code,
    name: readText(record.name),
    description: readText(record.description),
  };
}

export function parseSectionList(payload: unknown): ShelfSectionRecord[] {
  const list = readCollection(payload);
  const sections = list
    .map(parseSection)
    .filter((section): section is ShelfSectionRecord => section !== null);
  if (list.length > 0 && sections.length === 0) throw new ApiError(500, null);
  return sections.sort((first, second) => compareCodes(first.code, second.code));
}

function parseSections(value: unknown): ShelfSectionRecord[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseSection)
    .filter((section): section is ShelfSectionRecord => section !== null)
    .sort((first, second) => compareCodes(first.code, second.code));
}

export function parseShelf(source: unknown): ShelfRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const warehouseId = readId(record.warehouse_id);
  const code = readText(record.code);
  if (id === null || warehouseId === null || !code) return null;
  if (typeof warehouseId === "number" && warehouseId <= 0) return null;

  return {
    id,
    warehouse_id: warehouseId,
    code,
    name: readText(record.name),
    description: readText(record.description),
    sections: parseSections(record.sections),
  };
}

function compareShelves(first: ShelfRecord, second: ShelfRecord) {
  const firstWarehouse = Number(first.warehouse_id);
  const secondWarehouse = Number(second.warehouse_id);
  if (
    Number.isFinite(firstWarehouse) &&
    Number.isFinite(secondWarehouse) &&
    firstWarehouse !== secondWarehouse
  ) {
    return firstWarehouse - secondWarehouse;
  }
  return compareCodes(first.code, second.code);
}

export function parseShelfList(payload: unknown): ShelfRecord[] {
  const list = readCollection(payload);
  const shelves = list
    .map(parseShelf)
    .filter((shelf): shelf is ShelfRecord => shelf !== null);
  if (list.length > 0 && shelves.length === 0) throw new ApiError(500, null);
  return shelves.sort(compareShelves);
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchAllShelves() {
  const payload = await apiFetch<unknown>(
    "/shelves?include=sections",
    authOptions(),
  );
  return parseShelfList(payload);
}

export async function fetchShelves(warehouseId: string) {
  const query = new URLSearchParams({
    warehouse_id: warehouseId,
    include: "sections",
  });
  const payload = await apiFetch<unknown>(`/shelves?${query.toString()}`, authOptions());
  return parseShelfList(payload);
}

export async function fetchShelf(id: RecordId) {
  const payload = await apiFetch<unknown>(
    `/shelves/${encodeURIComponent(String(id))}`,
    authOptions(),
  );
  const shelf = parseShelf(payload);
  if (!shelf) throw new ApiError(500, null);
  return shelf;
}

export async function createShelf(values: ShelfInput) {
  const payload = await apiFetch<unknown>("/shelves", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
  return parseShelf(payload);
}

export async function updateShelf(id: RecordId, values: ShelfUpdateInput) {
  const payload = await apiFetch<unknown>(
    `/shelves/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(values),
    },
  );
  return parseShelf(payload);
}

export function deleteShelf(id: RecordId) {
  return apiFetch<void>(`/shelves/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export async function fetchSections(shelfId: RecordId) {
  const payload = await apiFetch<unknown>(
    `/shelves/${encodeURIComponent(String(shelfId))}/sections`,
    authOptions(),
  );
  return parseSectionList(payload);
}

export async function createSection(shelfId: RecordId, values: SectionInput) {
  const payload = await apiFetch<unknown>(
    `/shelves/${encodeURIComponent(String(shelfId))}/sections`,
    {
      ...authOptions(),
      method: "POST",
      body: JSON.stringify(values),
    },
  );
  return parseSection(payload);
}

export async function updateSection(
  shelfId: RecordId,
  sectionId: RecordId,
  values: SectionInput,
) {
  const payload = await apiFetch<unknown>(
    `/shelves/${encodeURIComponent(String(shelfId))}/sections/${encodeURIComponent(String(sectionId))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(values),
    },
  );
  return parseSection(payload);
}

export function deleteSection(shelfId: RecordId, sectionId: RecordId) {
  return apiFetch<void>(
    `/shelves/${encodeURIComponent(String(shelfId))}/sections/${encodeURIComponent(String(sectionId))}`,
    {
      ...authOptions(),
      method: "DELETE",
    },
  );
}
