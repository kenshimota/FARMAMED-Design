import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  parseLotLocationStatus,
  type LotLocationStatus,
} from "@/components/erp/records/lots-api";
import {
  parseOrderItemState,
  parseOrderProduct,
  type OrderItemState,
  type OrderProductRef,
} from "@/components/erp/records/orders-api";
import type { RecordId } from "@/components/erp/records/records-api";

export type PickingWarehouse = {
  id: RecordId;
  name: string;
};

export type PickingShelf = {
  id: RecordId;
  code: string;
  name: string;
};

export type PickingSection = {
  id: RecordId;
  code: string;
  name: string;
};

export type PickingLot = {
  id: RecordId;
  number: string;
  expirationDate: string;
  locationStatus: LotLocationStatus;
  stock: number;
  reserved: number;
  available: number;
  warehouse: PickingWarehouse | null;
  shelf: PickingShelf | null;
  section: PickingSection | null;
};

export type PickingAllocationStatus = "reserved" | "consumed" | "released";

export type PickingAllocation = {
  allocationId: RecordId;
  quantity: number;
  status: PickingAllocationStatus | string;
  lot: PickingLot | null;
};

export type PickingItem = {
  orderItemId: RecordId;
  productId: RecordId;
  itemStateId: RecordId;
  quantity: number;
  allocatedQuantity: number;
  pendingQuantity: number;
  product: OrderProductRef | null;
  itemState: OrderItemState | null;
  lots: PickingAllocation[];
};

export type PickingSummary = {
  linesCount: number;
  lotsCount: number;
  orderedUnits: number;
  allocatedUnits: number;
  pendingUnits: number;
  ready: boolean;
};

export type PickingOrder = {
  id: RecordId;
  number: number;
  status: string;
  customerId: RecordId | null;
  deliveryAddress: string;
  notes: string;
  createdAt: string | null;
};

export type PickingCustomer = {
  id: RecordId;
  fullName: string;
  email: string;
  direction: string;
};

export type OrderPicking = {
  order: PickingOrder;
  customer: PickingCustomer | null;
  summary: PickingSummary;
  items: PickingItem[];
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

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readTimestamp(value: unknown) {
  const text = readText(value);
  return text || null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function compareIds(first: RecordId, second: RecordId) {
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return firstNumber - secondNumber;
  }
  return String(first).localeCompare(String(second), "es", { numeric: true });
}

function parsePickingWarehouse(source: unknown): PickingWarehouse | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  if (id === null || !name) return null;
  return { id, name };
}

function parsePickingShelf(source: unknown): PickingShelf | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  const name = readText(source.name);
  if (id === null || (!code && !name)) return null;
  return { id, code: code || name, name: name || code };
}

function parsePickingSection(source: unknown): PickingSection | null {
  return parsePickingShelf(source);
}

function parsePickingLot(source: unknown): PickingLot | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const number = readText(source.number);
  const expirationDate = readText(source.expiration_date);
  if (id === null || !number || !expirationDate) return null;

  const warehouse = parsePickingWarehouse(source.warehouse);
  const shelf = parsePickingShelf(source.shelf);
  const section = parsePickingSection(source.section);
  const locationStatus =
    parseLotLocationStatus(source.location_status) ??
    (warehouse && shelf && section ? "located" : "pending");

  const stock = readNumber(source.stock);
  const reserved = readNumber(source.reserved);
  const available = readNumber(source.available, Math.max(0, stock - reserved));

  return {
    id,
    number,
    expirationDate,
    locationStatus,
    stock,
    reserved,
    available,
    warehouse,
    shelf,
    section,
  };
}

function parsePickingAllocation(source: unknown): PickingAllocation | null {
  if (!isRecord(source)) return null;
  const allocationId = readId(source.allocation_id);
  const rawQuantity = readNumber(source.quantity, -1);
  if (allocationId === null || rawQuantity < 0) return null;
  const lot = parsePickingLot(source.lot);
  if (source.lot !== null && source.lot !== undefined && !lot) return null;
  const status = readText(source.status);
  return {
    allocationId,
    quantity: Math.trunc(rawQuantity),
    status: status || "reserved",
    lot,
  };
}

function parsePickingAllocations(source: unknown): PickingAllocation[] {
  if (!Array.isArray(source)) throw new ApiError(500, null);
  const allocations: PickingAllocation[] = [];
  for (const row of source) {
    const allocation = parsePickingAllocation(row);
    if (!allocation) throw new ApiError(500, null);
    allocations.push(allocation);
  }
  return allocations.sort((first, second) => {
    const firstLot = first.lot;
    const secondLot = second.lot;
    const byExpiration = (firstLot?.expirationDate ?? "").localeCompare(
      secondLot?.expirationDate ?? "",
    );
    if (byExpiration !== 0) return byExpiration;
    if (firstLot && secondLot && compareIds(firstLot.id, secondLot.id) !== 0) {
      return compareIds(firstLot.id, secondLot.id);
    }
    return compareIds(first.allocationId, second.allocationId);
  });
}

function parsePickingItem(
  source: unknown,
  cancelled: boolean,
): PickingItem | null {
  if (!isRecord(source)) return null;
  const orderItemId = readId(source.order_item_id);
  const productId = readId(source.product_id);
  const itemStateId = readId(source.item_state_id);
  const rawQuantity = readNumber(source.quantity, -1);
  if (
    orderItemId === null ||
    productId === null ||
    itemStateId === null ||
    rawQuantity < 0
  ) {
    return null;
  }
  const quantity = Math.trunc(rawQuantity);

  const lots = parsePickingAllocations(source.lots);
  const activeAllocatedFallback = lots.reduce(
    (total, allocation) =>
      allocation.status === "released" ? total : total + allocation.quantity,
    0,
  );
  const allocatedFallback = cancelled
    ? activeAllocatedFallback
    : lots.reduce((total, allocation) => total + allocation.quantity, 0);
  const allocatedQuantity = cancelled
    ? activeAllocatedFallback
    : Math.max(
        0,
        Math.trunc(readNumber(source.allocated_quantity, allocatedFallback)),
      );
  const pendingFallback = Math.max(0, quantity - allocatedQuantity);
  const pendingQuantity = Math.max(
    0,
    Math.trunc(readNumber(source.pending_quantity, pendingFallback)),
  );

  return {
    orderItemId,
    productId,
    itemStateId,
    quantity,
    allocatedQuantity,
    pendingQuantity,
    product: parseOrderProduct(source.product),
    itemState: parseOrderItemState(source.item_state),
    lots,
  };
}

function parsePickingItems(source: unknown, cancelled: boolean): PickingItem[] {
  if (!Array.isArray(source)) throw new ApiError(500, null);
  const items: PickingItem[] = [];
  for (const row of source) {
    const item = parsePickingItem(row, cancelled);
    if (!item) throw new ApiError(500, null);
    items.push(item);
  }
  return items.sort(
    (first, second) => compareIds(first.orderItemId, second.orderItemId),
  );
}

function parsePickingOrder(source: unknown): PickingOrder | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const number = Math.trunc(readNumber(source.number, -1));
  const status = readText(source.status).toLowerCase();
  if (id === null || number < 0 || !status) return null;
  return {
    id,
    number,
    status,
    customerId: readId(source.customer_id),
    deliveryAddress: readText(source.delivery_address),
    notes: readText(source.notes),
    createdAt: readTimestamp(source.created_at),
  };
}

function parsePickingCustomer(source: unknown): PickingCustomer | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const fullName = readText(source.fullName) || readText(source.full_name);
  if (id === null || !fullName) return null;
  return {
    id,
    fullName,
    email: readText(source.email),
    direction: readText(source.direction),
  };
}

function parsePickingSummary(
  source: unknown,
  items: readonly PickingItem[],
  cancelled: boolean,
): PickingSummary {
  const record = isRecord(source) ? source : {};
  const linesCount = items.length;
  const lotsCount = items.reduce(
    (total, item) => total + item.lots.length,
    0,
  );
  const reportedLines = Math.trunc(
    readNumber(record.lines_count, linesCount),
  );
  const reportedLots = Math.trunc(readNumber(record.lots_count, lotsCount));
  if (reportedLines > linesCount || reportedLots > lotsCount) {
    throw new ApiError(500, null);
  }
  const orderedFallback = items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const allocatedFallback = items.reduce(
    (total, item) => total + item.allocatedQuantity,
    0,
  );
  const pendingFallback = Math.max(0, orderedFallback - allocatedFallback);
  const readyFallback =
    items.length > 0 &&
    items.every(
      (item) =>
        item.pendingQuantity === 0 && item.allocatedQuantity === item.quantity,
    );

  return {
    linesCount,
    lotsCount,
    orderedUnits: Math.max(0, readNumber(record.ordered_units, orderedFallback)),
    allocatedUnits: cancelled
      ? allocatedFallback
      : Math.max(
          0,
          readNumber(record.allocated_units, allocatedFallback),
        ),
    pendingUnits: Math.max(0, readNumber(record.pending_units, pendingFallback)),
    ready: typeof record.ready === "boolean" ? record.ready : readyFallback,
  };
}

export function parseOrderPicking(payload: unknown): OrderPicking {
  const record = unwrapRecord(payload);
  if (!isRecord(record)) throw new ApiError(500, null);
  const order = parsePickingOrder(record.order);
  if (!order) throw new ApiError(500, null);
  const cancelled = order.status === "cancelled";
  const items = parsePickingItems(record.items, cancelled);
  return {
    order,
    customer: parsePickingCustomer(record.customer),
    summary: parsePickingSummary(record.summary, items, cancelled),
    items,
  };
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchOrderPicking(orderId: string) {
  const payload = await apiFetch<unknown>(
    `/orders/${encodeURIComponent(orderId)}/picking`,
    authOptions(),
  );
  return parseOrderPicking(payload);
}
