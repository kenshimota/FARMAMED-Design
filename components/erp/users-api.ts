import { ApiError, apiFetch } from "@/lib/api";
import { translateApiError, type UiError } from "@/lib/api-errors";
import {
  parseCustomer,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";
import { getStoredToken } from "@/lib/session";

export type UserRecord = {
  id: RecordId;
  username: string;
  name: string | null;
  email: string;
  role: string;
  isBlocked: boolean;
  customer_id: RecordId | null;
  customer: CustomerRecord | null;
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

export function parseUser(source: unknown): UserRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const username = readText(record.username);
  const email = readText(record.email);
  const role = readText(record.role);
  if (id === null || !username || !email || !role) return null;
  if (typeof record.isBlocked !== "boolean") return null;

  const customer = parseCustomer(record.customer);
  const customerId = readId(record.customer_id) ?? customer?.id ?? null;

  return {
    id,
    username,
    name: readText(record.name) || null,
    email,
    role,
    isBlocked: record.isBlocked,
    customer_id: customerId,
    customer,
  };
}

export function parseUserList(payload: unknown): UserRecord[] {
  const list = readCollection(payload);
  const users = list
    .map(parseUser)
    .filter((user): user is UserRecord => user !== null);
  if (list.length > 0 && users.length === 0) throw new ApiError(500, null);
  return users.sort((first, second) => Number(first.id) - Number(second.id));
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchUsers() {
  const payload = await apiFetch<unknown>("/users", authOptions());
  return parseUserList(payload);
}

export async function fetchUser(id: RecordId) {
  const users = await fetchUsers();
  const user = users.find((entry) => String(entry.id) === String(id));
  if (!user) throw new ApiError(404, { message: "User not found" });
  return user;
}

export async function updateUserCustomer(
  id: RecordId,
  customerId: RecordId | null,
) {
  const payload = await apiFetch<unknown>(
    `/users/${encodeURIComponent(String(id))}/customer`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify({ customer_id: customerId }),
    },
  );
  const user = parseUser(payload);
  if (!user) throw new ApiError(500, null);
  return user;
}

export function customerLinkFieldMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  if (normalized === "user is not a customer") {
    return "Solo los usuarios con rol customer pueden vincularse.";
  }
  return "Cliente inválido.";
}

export function userCustomerLinkErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "No pudimos guardar el vínculo. Revisa tu conexión e intenta de nuevo.";
  }

  switch (error.status) {
    case 400:
      return "Selecciona un cliente o usa Desvincular.";
    case 401:
      return "Tu sesión expiró. Inicia sesión de nuevo.";
    case 403:
      return "No tienes permiso para administrar usuarios.";
    case 404:
      return "No encontramos ese usuario.";
    case 409:
      return translateApiError(error).message;
    case 422: {
      const message = error.fieldErrors.customer_id;
      if (message) return customerLinkFieldMessage(message);
      return "Revisa los datos del vínculo.";
    }
    case 503:
      return "No pudimos guardar el vínculo. Inténtalo de nuevo.";
    default:
      return "No pudimos guardar el vínculo. Inténtalo de nuevo.";
  }
}

export async function setUserBlocked(id: RecordId, isBlocked: boolean) {
  await apiFetch<unknown>(`/users/${encodeURIComponent(String(id))}/status`, {
    ...authOptions(),
    method: "PATCH",
    body: JSON.stringify({ isBlocked }),
  });
}

export async function deleteUser(id: RecordId) {
  await apiFetch<void>(`/users/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export type UserActionContext = "load" | "status" | "delete" | "link";

export function userErrorMessage(error: UiError, context: UserActionContext) {
  switch (error.kind) {
    case "forbidden":
      return "No tienes permiso para administrar usuarios.";
    case "not-found":
      return "No encontramos ese usuario.";
    case "validation":
      if (error.fieldErrors.id) return "El usuario indicado no es válido.";
      if (error.fieldErrors.isBlocked) return "El estado de acceso no es válido.";
      return context === "delete"
        ? "El usuario indicado no es válido."
        : "El estado de acceso no es válido.";
    case "conflict":
    case "session-expired":
    case "blocked":
      return error.message;
    case "bad-request":
    case "network":
    case "server":
      return "No pudimos completar la acción. Intenta de nuevo.";
    default:
      return error.message;
  }
}
