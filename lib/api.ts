const DEFAULT_API_BASE_URL = "https://farmamed.strixcryptoapp.site/api/v1";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL
).replace(/\/+$/, "");

type ApiRequestOptions = RequestInit & {
  token?: string;
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

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(getErrorMessage(payload));
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(
  path: string,
  { token, ...options }: ApiRequestOptions = {},
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

  if (!response.ok) throw new ApiError(response.status, payload);
  return payload as T;
}
