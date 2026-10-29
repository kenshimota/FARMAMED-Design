import { apiFetch } from "@/lib/api";
import { isRole, type Role } from "@/lib/permissions";

const TOKEN_STORAGE_KEY = "farmamed.session.token";

export type SessionUser = {
  name: string;
  email: string;
  role: Role;
};

export type LoginNotice = "expirada" | "bloqueada" | "cerrada";

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
  if (isRole(value)) return value;
  if (isRecord(value) && isRole(value.name)) return value.name;
  return null;
}

export function parseSessionUser(payload: unknown): SessionUser | null {
  const source = getUserSource(payload);
  if (!isRecord(source)) return null;

  const role = getRole(source.role ?? source.role_name ?? source.roleName);
  if (!role) return null;

  const email = getString(source.email) ?? "Correo no disponible";
  const name =
    getString(source.name, source.fullName, source.full_name, source.username) ??
    email;

  return { name, email, role };
}

function getToken(payload: unknown) {
  const container = getPayloadContainer(payload);
  if (!isRecord(container)) return null;
  return getString(container.token, container.accessToken, container.access_token, container.jwt) ?? null;
}

export function getStoredToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function saveStoredToken(token: string) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearStoredToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
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

export function getSafeReturnPath(value: string | null) {
  if (
    !value ||
    (!value.startsWith("/app/") && value !== "/app") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return "/app";
  }

  const pathname = value.split(/[?#]/, 1)[0];
  if (
    pathname === "/app/login" ||
    pathname === "/app/setup-admin" ||
    pathname === "/app/recuperar" ||
    pathname.startsWith("/app/recuperar/")
  ) {
    return "/app";
  }

  return value;
}

export function buildLoginUrl(returnPath?: string, notice?: LoginNotice) {
  const params = new URLSearchParams();
  if (returnPath) params.set("retorno", getSafeReturnPath(returnPath));
  if (notice) params.set("aviso", notice);
  const query = params.toString();
  return `/app/login${query ? `?${query}` : ""}`;
}
