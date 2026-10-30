import { apiFetch } from "@/lib/api";
import { isRole } from "@/lib/permissions";
import type { LoginNotice } from "@/lib/session-store";

export type { LoginNotice };

export type SessionUser = {
  id: number | string | null;
  username: string;
  name: string | null;
  email: string;
  role: string;
};

export function sessionDisplayName(user: SessionUser) {
  return user.name?.trim() || user.username || user.email;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getPayloadContainer(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function getUserSource(payload: unknown) {
  const container = getPayloadContainer(payload);
  if (isRecord(container) && isRecord(container.user)) return container.user;
  return container;
}

function getString(...values: unknown[]) {
  return values.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

function getRole(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value) && typeof value.name === "string" && value.name.trim()) {
    return value.name.trim();
  }
  return null;
}

function getId(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  }
  return null;
}

export function parseSessionUser(payload: unknown): SessionUser | null {
  const source = getUserSource(payload);
  if (!isRecord(source)) return null;

  const role = getRole(source.role ?? source.role_name ?? source.roleName);
  if (!role) return null;
  if (!isRole(role)) {
    console.warn(
      `[Farmamed] Rol de sesión no reconocido "${role}". Registrar para revisión.`,
    );
  }

  const email = getString(source.email) ?? "Correo no disponible";
  const username = getString(source.username) ?? "";
  const name = getString(source.name, source.fullName, source.full_name) ?? null;

  return { id: getId(source.id), username, name, email, role };
}

export function getToken(payload: unknown) {
  const container = getPayloadContainer(payload);
  if (!isRecord(container)) return null;
  return getString(container.token, container.accessToken, container.access_token, container.jwt) ?? null;
}

export async function authenticate(identifier: string, password: string) {
  const payload = await apiFetch<unknown>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });
  const token = getToken(payload);
  if (!token) throw new Error("La respuesta de acceso no contiene un token.");
  return token;
}

export async function getSessionUser(token: string) {
  const payload = await apiFetch<unknown>("/auth/me", { token });
  const user = parseSessionUser(payload);
  if (!user) throw new Error("La respuesta de sesión no contiene un rol válido.");
  return user;
}

export {
  TOKEN_STORAGE_KEY,
  buildLoginUrl,
  clearStoredToken,
  getCurrentReturnPath,
  getSafeReturnPath,
  getStoredToken,
  saveStoredToken,
} from "@/lib/session-store";
