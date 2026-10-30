import { ApiError, apiFetch } from "@/lib/api";
import type { UiError } from "@/lib/api-errors";
import { isRole } from "@/lib/permissions";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";
import { getStoredToken } from "@/lib/session";

export type RoleRecord = {
  id: RecordId;
  name: string;
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

export function parseRole(source: unknown): RoleRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const name = readText(record.name);
  if (id === null || !name) return null;

  return { id, name };
}

export function parseRoleList(payload: unknown): RoleRecord[] {
  const list = readCollection(payload);
  const roles = list
    .map(parseRole)
    .filter((role): role is RoleRecord => role !== null);
  if (list.length > 0 && roles.length === 0) throw new ApiError(500, null);

  for (const role of roles) {
    if (!isRole(role.name)) {
      console.warn(
        `[Farmamed] Rol no reconocido "${role.name}". Registrar para revisión.`,
      );
    }
  }

  return roles.sort((first, second) => Number(first.id) - Number(second.id));
}

export async function fetchRoles() {
  const payload = await apiFetch<unknown>("/roles", {
    token: getStoredToken() ?? undefined,
  });
  return parseRoleList(payload);
}

export function rolesErrorMessage(error: UiError) {
  switch (error.kind) {
    case "session-expired":
      return "Tu sesión expiró. Inicia sesión de nuevo.";
    case "forbidden":
      return "Solo un administrador puede ver los roles.";
    case "blocked":
      return error.message;
    default:
      return "Intenta de nuevo.";
  }
}
