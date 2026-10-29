export const TOKEN_STORAGE_KEY = "farmamed.session.token";

export type LoginNotice = "expirada" | "bloqueada" | "cerrada";

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

export function getCurrentReturnPath() {
  if (typeof window === "undefined") return "/app";
  return `${window.location.pathname}${window.location.search}`;
}
