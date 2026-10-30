import { flagCurrencyNotConfigured } from "@/lib/currency-notice";
import {
  buildLoginUrl,
  clearStoredToken,
  getCurrentReturnPath,
} from "@/lib/session-store";

const DEFAULT_API_BASE_URL = "https://farmamed.strixcryptoapp.site/api/v1";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

type ApiRequestOptions = RequestInit & {
  token?: string;
  skipSessionFlow?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getErrorMessage(payload: unknown) {
  if (!isRecord(payload)) return "No se pudo completar la solicitud.";
  if (typeof payload.message === "string") return payload.message;
  if (isRecord(payload.errors)) {
    const firstError = Object.values(payload.errors).find(
      (value): value is string => typeof value === "string",
    );
    if (firstError) return firstError;
  }
  return "No se pudo completar la solicitud.";
}

function parseRetryAfter(header: string | null) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(header);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;
  readonly retryAfterSeconds: number | null;

  constructor(status: number, payload: unknown, retryAfterSeconds: number | null = null) {
    super(getErrorMessage(payload));
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  get fieldErrors(): Record<string, string> {
    if (!isRecord(this.payload) || !isRecord(this.payload.errors)) return {};
    const entries: Record<string, string> = {};
    for (const [field, message] of Object.entries(this.payload.errors)) {
      if (typeof message === "string") entries[field] = message;
    }
    return entries;
  }

  isUserBlocked() {
    return this.status === 403 && this.message.trim() === "User is blocked";
  }
}

function runSessionFlow(error: ApiError, authenticated: boolean) {
  if (typeof window === "undefined" || !authenticated) return;

  if (error.status === 401) {
    clearStoredToken();
    window.location.replace(buildLoginUrl(getCurrentReturnPath(), "expirada"));
    return;
  }

  if (error.isUserBlocked()) {
    clearStoredToken();
    window.location.replace(buildLoginUrl(undefined, "bloqueada"));
  }
}

export async function apiFetch<T>(
  path: string,
  { token, skipSessionFlow = false, ...options }: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (
    options.body &&
    !headers.has("Content-Type") &&
    (typeof FormData === "undefined" || !(options.body instanceof FormData))
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(
    `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
    { ...options, headers, cache: "no-store" },
  );

  let payload: unknown = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }
  }

  if (!response.ok) {
    const error = new ApiError(
      response.status,
      payload,
      parseRetryAfter(response.headers.get("Retry-After")),
    );
    if (error.status === 503) flagCurrencyNotConfigured();
    runSessionFlow(error, !skipSessionFlow && Boolean(token));
    throw error;
  }

  return payload as T;
}
