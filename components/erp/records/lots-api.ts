import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type LotProduct = {
  id: RecordId;
  name: string;
  reference: string;
};

export type LotItemState = {
  id: RecordId;
  name: string;
  label: string;
  is_sellable: boolean;
};

export type LotWarehouse = {
  id: RecordId;
  name: string;
  address: string;
};

export type LotShelfSection = {
  id: RecordId;
  shelf_id: RecordId | null;
  code: string;
  name: string;
  description: string;
};

export type LotShelf = {
  id: RecordId;
  warehouse_id: RecordId | null;
  code: string;
  name: string;
  description: string;
  sections: LotShelfSection[];
};

export type LotRecord = {
  id: RecordId;
  number: string;
  product_id: RecordId;
  item_state_id: RecordId;
  expiration_date: string;
  stock: number;
  reserved: number;
  warehouse_id: RecordId;
  shelf_id: RecordId;
  section_id: RecordId;
  product: LotProduct | null;
  item_state: LotItemState | null;
  warehouse: LotWarehouse | null;
  shelf: LotShelf | null;
  section: LotShelfSection | null;
};

export type LotFilters = {
  product_id?: RecordId;
  item_state_id?: RecordId;
  warehouse_id?: RecordId;
  shelf_id?: RecordId;
  section_id?: RecordId;
  number?: string;
  expired?: boolean;
  expiring_before?: string;
};

export type LotInput = {
  number: string;
  product_id: RecordId;
  expiration_date: string;
  item_state_id: RecordId;
  stock: number;
  reserved: number;
  warehouse_id: RecordId;
  shelf_id: RecordId;
  section_id: RecordId;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
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
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function readNested(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return isRecord(value) ? value : null;
}

export function parseLotProduct(source: unknown): LotProduct | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  if (id === null || !name) return null;
  return {
    id,
    name,
    reference: readText(source.reference),
  };
}

export function parseLotItemState(source: unknown): LotItemState | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  const label = readText(source.label) || name;
  if (id === null || !name || !label) return null;
  return {
    id,
    name,
    label,
    is_sellable: readBoolean(source.is_sellable) ?? false,
  };
}

export function parseLotWarehouse(source: unknown): LotWarehouse | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  if (id === null || !name) return null;
  return {
    id,
    name,
    address: readText(source.address),
  };
}

export function parseLotSection(source: unknown): LotShelfSection | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  const code = readText(source.code) || name;
  if (id === null || !code) return null;
  return {
    id,
    shelf_id: readId(source.shelf_id),
    code,
    name,
    description: readText(source.description),
  };
}

function parseSections(value: unknown): LotShelfSection[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseLotSection)
    .filter((section): section is LotShelfSection => section !== null)
    .sort((first, second) =>
      first.code.localeCompare(second.code, "es", {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

export function parseLotShelf(source: unknown): LotShelf | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  const code = readText(source.code) || name;
  if (id === null || !code) return null;
  return {
    id,
    warehouse_id: readId(source.warehouse_id),
    code,
    name,
    description: readText(source.description),
    sections: parseSections(source.sections),
  };
}

export function parseLot(source: unknown): LotRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const number = readText(record.number);
  const productNested = readNested(record, "product");
  const itemStateNested = readNested(record, "item_state");
  const warehouseNested = readNested(record, "warehouse");
  const shelfNested = readNested(record, "shelf");
  const sectionNested = readNested(record, "section");

  const productId = readId(record.product_id) ?? (productNested ? readId(productNested.id) : null);
  const itemStateId =
    readId(record.item_state_id) ??
    (itemStateNested ? readId(itemStateNested.id) : null);
  const warehouseId =
    readId(record.warehouse_id) ??
    (warehouseNested ? readId(warehouseNested.id) : null);
  const shelfId =
    readId(record.shelf_id) ?? (shelfNested ? readId(shelfNested.id) : null);
  const sectionId =
    readId(record.section_id) ??
    (sectionNested ? readId(sectionNested.id) : null);
  const expirationDate =
    readText(record.expiration_date) || readText(record.expirationDate);

  if (
    id === null ||
    !number ||
    productId === null ||
    itemStateId === null ||
    !expirationDate ||
    warehouseId === null ||
    shelfId === null ||
    sectionId === null
  ) {
    return null;
  }

  return {
    id,
    number,
    product_id: productId,
    item_state_id: itemStateId,
    expiration_date: expirationDate,
    stock: readNumber(record.stock) ?? 0,
    reserved: readNumber(record.reserved) ?? 0,
    warehouse_id: warehouseId,
    shelf_id: shelfId,
    section_id: sectionId,
    product: parseLotProduct(productNested),
    item_state: parseLotItemState(itemStateNested),
    warehouse: parseLotWarehouse(warehouseNested),
    shelf: parseLotShelf(shelfNested),
    section: parseLotSection(sectionNested),
  };
}

function compareIds(first: RecordId, second: RecordId) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return firstNumber - secondNumber;
  }
  return String(first).localeCompare(String(second), "es", { numeric: true });
}

export function parseLotList(payload: unknown): LotRecord[] {
  const list = readCollection(payload);
  const lots = list
    .map(parseLot)
    .filter((lot): lot is LotRecord => lot !== null);
  if (list.length > 0 && lots.length === 0) throw new ApiError(500, null);

  return lots.sort(
    (first, second) =>
      first.expiration_date.localeCompare(second.expiration_date) ||
      compareIds(first.id, second.id),
  );
}

export function lotAvailable(lot: Pick<LotRecord, "stock" | "reserved">) {
  return lot.stock - lot.reserved;
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function appendQuery(
  query: URLSearchParams,
  key: string,
  value: RecordId | undefined,
) {
  if (value === undefined || value === null) return;
  const normalized = String(value).trim();
  if (normalized) query.set(key, normalized);
}

export async function fetchLots(filters: LotFilters = {}) {
  const query = new URLSearchParams();
  appendQuery(query, "product_id", filters.product_id);
  appendQuery(query, "item_state_id", filters.item_state_id);
  appendQuery(query, "warehouse_id", filters.warehouse_id);
  appendQuery(query, "shelf_id", filters.shelf_id);
  appendQuery(query, "section_id", filters.section_id);

  const number = filters.number?.trim();
  if (number) query.set("number", number);
  if (filters.expired !== undefined) {
    query.set("expired", String(filters.expired));
  }
  const expiringBefore = filters.expiring_before?.trim();
  if (expiringBefore) query.set("expiring_before", expiringBefore);

  const suffix = query.toString();
  const payload = await apiFetch<unknown>(
    `/lots${suffix ? `?${suffix}` : ""}`,
    authOptions(),
  );
  return parseLotList(payload);
}

export async function fetchLot(id: string) {
  const payload = await apiFetch<unknown>(
    `/lots/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const lot = parseLot(payload);
  if (!lot) throw new ApiError(500, null);
  return lot;
}

export async function createLot(values: LotInput) {
  const payload = await apiFetch<unknown>("/lots", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
  return parseLot(payload);
}

export async function updateLot(id: RecordId, values: LotInput) {
  const payload = await apiFetch<unknown>(
    `/lots/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(values),
    },
  );
  return parseLot(payload);
}

export function deleteLot(id: RecordId) {
  return apiFetch<void>(`/lots/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
