import { ApiError, apiFetch } from "@/lib/api";
import type { UiError } from "@/lib/api-errors";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type AssignmentCustomer = {
  id: RecordId;
  fullName: string;
  email: string;
  direction: string;
};

export type AssignmentSeller = {
  id: RecordId;
  username: string;
  email: string;
  name: string | null;
};

export type AssignmentRecord = {
  id: RecordId;
  customer_id: RecordId;
  seller_id: RecordId;
  assigned_at: string | null;
  customer: AssignmentCustomer | null;
  seller: AssignmentSeller | null;
};

export type AssignmentFilters = {
  customer_id?: RecordId;
  seller_id?: RecordId;
};

export type AssignmentInput = {
  customer_id: RecordId;
  seller_id: RecordId;
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

function readTimestamp(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  return null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function parseAssignmentCustomer(source: unknown): AssignmentCustomer | null {
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

export function parseAssignmentSeller(source: unknown): AssignmentSeller | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const username = readText(source.username);
  if (id === null || !username) return null;
  return {
    id,
    username,
    email: readText(source.email),
    name: readText(source.name) || null,
  };
}

export function parseAssignment(source: unknown): AssignmentRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const customerId = readId(record.customer_id);
  const sellerId = readId(record.seller_id);
  if (id === null || customerId === null || sellerId === null) return null;

  return {
    id,
    customer_id: customerId,
    seller_id: sellerId,
    assigned_at: readTimestamp(record.assigned_at),
    customer: parseAssignmentCustomer(record.customer),
    seller: parseAssignmentSeller(record.seller),
  };
}

export function parseAssignmentList(payload: unknown): AssignmentRecord[] {
  const list = readCollection(payload);
  const assignments = list
    .map(parseAssignment)
    .filter((assignment): assignment is AssignmentRecord => assignment !== null);
  if (list.length > 0 && assignments.length === 0) throw new ApiError(500, null);
  return assignments.sort((first, second) => {
    const firstCustomer = Number(first.customer_id);
    const secondCustomer = Number(second.customer_id);
    if (Number.isFinite(firstCustomer) && Number.isFinite(secondCustomer)) {
      return firstCustomer - secondCustomer;
    }
    return String(first.customer_id).localeCompare(String(second.customer_id), "es");
  });
}

export function assignmentCustomerLabel(customer: AssignmentCustomer | null) {
  return customer?.fullName || "Cliente no disponible";
}

export function assignmentSellerLabel(seller: AssignmentSeller | null) {
  return seller?.name?.trim() || seller?.username || "Vendedor no disponible";
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function buildQuery(filters: AssignmentFilters) {
  const params = new URLSearchParams();
  if (filters.customer_id !== undefined) {
    params.set("customer_id", String(filters.customer_id));
  }
  if (filters.seller_id !== undefined) {
    params.set("seller_id", String(filters.seller_id));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchAssignments(filters: AssignmentFilters = {}) {
  const payload = await apiFetch<unknown>(
    `/customer-sellers${buildQuery(filters)}`,
    authOptions(),
  );
  return parseAssignmentList(payload);
}

export async function fetchAssignment(id: string) {
  const payload = await apiFetch<unknown>(
    `/customer-sellers/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const assignment = parseAssignment(payload);
  if (!assignment) throw new ApiError(500, null);
  return assignment;
}

export async function createAssignment(values: AssignmentInput) {
  const payload = await apiFetch<unknown>("/customer-sellers", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
  const assignment = parseAssignment(payload);
  if (!assignment) throw new ApiError(500, null);
  return assignment;
}

export async function updateAssignment(
  id: RecordId,
  values: { seller_id: RecordId },
) {
  const payload = await apiFetch<unknown>(
    `/customer-sellers/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(values),
    },
  );
  const assignment = parseAssignment(payload);
  if (!assignment) throw new ApiError(500, null);
  return assignment;
}

export function deleteAssignment(id: RecordId) {
  return apiFetch<void>(`/customer-sellers/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export type AssignmentActionContext = "load" | "create" | "update" | "delete";

export function assignmentErrorMessage(
  error: UiError,
  context: AssignmentActionContext,
) {
  switch (error.kind) {
    case "forbidden":
      if (context === "create" || context === "update") {
        return "No tienes permisos para esta acción.";
      }
      return "Solo puedes gestionar tus propias asignaciones.";
    case "not-found":
      return context === "load"
        ? "No encontramos esta asignación. Puede que ya haya sido eliminada."
        : "No encontramos esta asignación.";
    case "conflict":
      return "Este cliente ya tiene un vendedor. Puedes reasignarlo.";
    case "validation":
      if (error.fieldErrors.customer_id) return "Selecciona un cliente válido.";
      return "Selecciona un vendedor activo con rol Vendedor.";
    case "bad-request":
      return "Faltan datos obligatorios. Revisa el formulario.";
    case "session-expired":
    case "blocked":
    case "rate-limit":
      return error.message;
    case "network":
    case "server":
      return context === "load"
        ? "No pudimos cargar las asignaciones. Revisa tu conexión e intenta de nuevo."
        : "No pudimos completar la acción. Intenta de nuevo.";
    default:
      return error.message;
  }
}
