import { ApiError, apiFetch } from "@/lib/api";
import type { UiError } from "@/lib/api-errors";
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

  return {
    id,
    username,
    name: readText(record.name) || null,
    email,
    role,
    isBlocked: record.isBlocked,
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

export type UserActionContext = "load" | "status" | "delete";

export function userErrorMessage(error: UiError, context: UserActionContext) {
  switch (error.kind) {
    case "forbidden":
      return "Solo un administrador puede gestionar usuarios.";
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
