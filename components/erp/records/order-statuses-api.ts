import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type OrderStatus = {
  id: RecordId;
  code: string;
  name: string;
  description: string;
  sort_order: number;
  next_status_code: string | null;
  is_system: boolean;
  is_terminal: boolean;
};

export type OrderStatusInput = {
  code: string;
  name: string;
  description?: string | null;
  sort_order: number;
  next_status_code?: string | null;
};

export type OrderStatusUpdate = {
  name: string;
  description?: string | null;
  sort_order: number;
  next_status_code?: string | null;
};

export const BASE_ORDER_STATUS_CODES = [
  "draft",
  "request",
  "generate",
  "invoiced",
  "cancelled",
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  request: "Solicitado",
  generate: "Generado",
  invoiced: "Facturado",
  cancelled: "Cancelado",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableText(value: unknown) {
  const text = readText(value);
  return text || null;
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

export function parseOrderStatus(source: unknown): OrderStatus | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const code = readText(record.code);
  const name = readText(record.name);
  const sortOrder = readNumber(record.sort_order ?? record.sortOrder);
  const nextStatusCode = readNullableText(
    record.next_status_code ?? record.nextStatusCode,
  );
  const isSystem = readBoolean(record.is_system ?? record.isSystem);
  const isTerminalValue = readBoolean(record.is_terminal ?? record.isTerminal);

  if (id === null || !code || !name || sortOrder === null || isSystem === null) {
    return null;
  }

  return {
    id,
    code,
    name,
    description: readText(record.description),
    sort_order: sortOrder,
    next_status_code: nextStatusCode,
    is_system: isSystem,
    is_terminal: isTerminalValue ?? nextStatusCode === null,
  };
}

function compareOrderStatuses(first: OrderStatus, second: OrderStatus) {
  if (first.sort_order !== second.sort_order) {
    return first.sort_order - second.sort_order;
  }
  const firstId = Number(first.id);
  const secondId = Number(second.id);
  if (Number.isFinite(firstId) && Number.isFinite(secondId)) {
    return firstId - secondId;
  }
  return String(first.id).localeCompare(String(second.id), "es");
}

export function parseOrderStatusList(payload: unknown): OrderStatus[] {
  const list = readCollection(payload);
  const statuses = list
    .map(parseOrderStatus)
    .filter((status): status is OrderStatus => status !== null);
  if (list.length > 0 && statuses.length === 0) throw new ApiError(500, null);
  return statuses.sort(compareOrderStatuses);
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchOrderStatuses() {
  const payload = await apiFetch<unknown>("/order-statuses", authOptions());
  return parseOrderStatusList(payload);
}

export async function fetchOrderStatus(id: string) {
  const payload = await apiFetch<unknown>(
    `/order-statuses/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const status = parseOrderStatus(payload);
  if (!status) throw new ApiError(500, null);
  return status;
}

export function createOrderStatus(input: OrderStatusInput) {
  return apiFetch<void>("/order-statuses", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateOrderStatus(id: RecordId, input: OrderStatusUpdate) {
  return apiFetch<void>(
    `/order-statuses/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
}

export function deleteOrderStatus(id: RecordId) {
  return apiFetch<void>(`/order-statuses/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export function getOrderStatusLabel(code: string | null | undefined) {
  if (!code) return "Sin siguiente estado";
  return ORDER_STATUS_LABELS[code] ?? code;
}
