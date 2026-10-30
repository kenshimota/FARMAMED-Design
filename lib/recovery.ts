import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/session";

export class RecoveryResponseError extends Error {
  constructor(message = "La respuesta del servidor no es válida.") {
    super(message);
    this.name = "RecoveryResponseError";
  }
}

export async function requestRecoveryCode(email: string) {
  await apiFetch<unknown>("/auth/forgot-password", {
    body: JSON.stringify({ email }),
    method: "POST",
  });
}

export async function verifyRecoveryCode(email: string, code: string) {
  const payload = await apiFetch<unknown>("/auth/verify-reset-code", {
    body: JSON.stringify({ code, email }),
    method: "POST",
  });
  const token = getToken(payload);
  if (!token) throw new RecoveryResponseError();
  return token;
}

export async function resetRecoveryPassword(
  token: string,
  password: string,
  passwordConfirmation: string,
) {
  await apiFetch<unknown>("/auth/reset-password", {
    body: JSON.stringify({ password, passwordConfirmation }),
    method: "POST",
    skipSessionFlow: true,
    token,
  });
}
