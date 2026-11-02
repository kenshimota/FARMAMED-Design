import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  parseLotActor,
  parseLotItemState,
  parseLotLocationStatus,
  parseLotProduct,
  type LotActor,
  type LotItemState,
  type LotLocationStatus,
  type LotProduct,
} from "@/components/erp/records/lots-api";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type WarehouseInboxStatusFilter =
  | LotLocationStatus
  | "all";

export type WarehouseInboxFilters = {
  product_id?: RecordId;
  purchase_id?: RecordId;
  lot_number?: string;
  status?: WarehouseInboxStatusFilter;
  expiring_before?: string;
};

export type WarehouseInboxPurchase = {
  id: RecordId;
  number: number;
  supplier_id: RecordId | null;
};

export type WarehouseInboxLot = {
  id: RecordId;
  number: string;
  product_id: RecordId;
  item_state_id: RecordId;
  expiration_date: string;
  stock: number;
  reserved: number;
  available: number;
  location_status: LotLocationStatus;
  location_started_at: string | null;
  located_at: string | null;
  created_at: string | null;
  started_by: LotActor | null;
  location_started_by: LotActor | null;
  located_by: LotActor | null;
  purchase: WarehouseInboxPurchase | null;
  purchase_item_id: RecordId | null;
  product: LotProduct | null;
  item_state: LotItemState | null;
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

function readTimestamp(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function parseWarehouseInboxPurchase(source: unknown): WarehouseInboxPurchase | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const number = readNumber(source.number);
  if (id === null || number === null) return null;
  return {
    id,
    number: Math.trunc(number),
    supplier_id: readId(source.supplier_id),
  };
}

export function parseWarehouseInboxLot(source: unknown): WarehouseInboxLot | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const number = readText(record.number);
  const productId = readId(record.product_id);
  const itemStateId = readId(record.item_state_id);
  const expirationDate =
    readText(record.expiration_date) || readText(record.expirationDate);

  if (
    id === null ||
    !number ||
    productId === null ||
    itemStateId === null ||
    !expirationDate
  ) {
    return null;
  }

  const warehouseId = readId(record.warehouse_id);
  const shelfId = readId(record.shelf_id);
  const sectionId = readId(record.section_id);
  const locationStatus =
    parseLotLocationStatus(record.location_status) ??
    (warehouseId !== null && shelfId !== null && sectionId !== null
      ? "located"
      : "pending");

  const stock = readNumber(record.stock) ?? 0;
  const reserved = readNumber(record.reserved) ?? 0;
  const available =
    readNumber(record.available) ??
    (locationStatus === "located" ? stock - reserved : 0);

  return {
    id,
    number,
    product_id: productId,
    item_state_id: itemStateId,
    expiration_date: expirationDate,
    stock,
    reserved,
    available,
    location_status: locationStatus,
    location_started_at: readTimestamp(record.location_started_at),
    located_at: readTimestamp(record.located_at),
    created_at: readTimestamp(record.created_at ?? record.createdAt),
    started_by: parseLotActor(record.started_by),
    location_started_by: parseLotActor(record.location_started_by),
    located_by: parseLotActor(record.located_by),
    purchase: parseWarehouseInboxPurchase(record.purchase),
    purchase_item_id: readId(record.purchase_item_id),
    product: parseLotProduct(record.product),
    item_state: parseLotItemState(record.item_state),
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

export function parseWarehouseInboxList(payload: unknown): WarehouseInboxLot[] {
  const list = readCollection(payload);
  const lots = list
    .map(parseWarehouseInboxLot)
    .filter((lot): lot is WarehouseInboxLot => lot !== null);
  if (list.length > 0 && lots.length === 0) throw new ApiError(500, null);

  return lots.sort((first, second) => {
    const firstDate = first.created_at ?? "";
    const secondDate = second.created_at ?? "";
    return firstDate.localeCompare(secondDate) || compareIds(first.id, second.id);
  });
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function appendQuery(
  query: URLSearchParams,
  key: string,
  value: RecordId | string | undefined,
) {
  if (value === undefined || value === null) return;
  const normalized = String(value).trim();
  if (normalized) query.set(key, normalized);
}

export async function fetchWarehouseInboxLots(
  filters: WarehouseInboxFilters = {},
) {
  const query = new URLSearchParams();
  appendQuery(query, "product_id", filters.product_id);
  appendQuery(query, "purchase_id", filters.purchase_id);
  appendQuery(query, "lot_number", filters.lot_number);
  appendQuery(query, "status", filters.status);
  appendQuery(query, "expiring_before", filters.expiring_before);

  const suffix = query.toString();
  const payload = await apiFetch<unknown>(
    `/warehouse-inbox/lots${suffix ? `?${suffix}` : ""}`,
    authOptions(),
  );
  return parseWarehouseInboxList(payload);
}

export async function startWarehouseInboxLot(id: RecordId) {
  const payload = await apiFetch<unknown>(
    `/warehouse-inbox/lots/${encodeURIComponent(String(id))}/start`,
    { ...authOptions(), method: "POST" },
  );
  return parseWarehouseInboxLot(payload);
}

export type WarehouseInboxLocationInput = {
  warehouse_id: RecordId;
  shelf_id: RecordId;
  section_id: RecordId;
};

export async function assignWarehouseInboxLocation(
  id: RecordId,
  values: WarehouseInboxLocationInput,
) {
  const payload = await apiFetch<unknown>(
    `/warehouse-inbox/lots/${encodeURIComponent(String(id))}/location`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(values),
    },
  );
  return parseWarehouseInboxLot(payload);
}
