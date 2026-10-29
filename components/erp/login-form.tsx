"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { ApiError } from "@/lib/api";
import {
  authenticate,
  getSafeReturnPath,
  saveStoredToken,
} from "@/lib/session";

const notices = {
  expirada: "Tu sesión expiró. Inicia sesión de nuevo.",
  bloqueada: "Tu cuenta está bloqueada. Contacta a un administrador.",
  cerrada: "Tu sesión se cerró correctamente.",
} as const;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noticeKey = searchParams.get("aviso");
  const notice =
    noticeKey === "expirada" || noticeKey === "bloqueada" || noticeKey === "cerrada"
      ? notices[noticeKey]
      : null;
  const returnPath = getSafeReturnPath(searchParams.get("retorno"));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError("Escribe tu identificador y tu contraseña.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await authenticate(identifier.trim(), password);
      saveStoredToken(token);
      router.replace(returnPath);
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        if (caughtError.status === 403 && caughtError.message === "User is blocked") {
          setError("Tu cuenta está bloqueada. Contacta a un administrador.");
        } else if (caughtError.status === 429) {
          setError("Demasiados intentos. Espera un momento antes de intentar otra vez.");
        } else if ([400, 401, 403, 422].includes(caughtError.status)) {
          setError("El identificador o la contraseña no son correctos.");
        } else {
          setError("No pudimos iniciar tu sesión. Intenta otra vez.");
        }
      } else {
        setError("No pudimos conectar con el servicio. Revisa tu conexión e intenta otra vez.");
      }
      setSubmitting(false);
    }
  }

  return (
    <div>
      {notice && (
        <div className="mb-5 rounded-xl border border-brand/20 bg-soft-blue px-4 py-3 text-[13px] leading-5 text-ink" role={noticeKey === "cerrada" ? "status" : "alert"}>
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-xl border border-[#c1272d]/25 bg-[#c1272d]/[0.06] px-4 py-3 text-[13px] leading-5 text-[#8f1d22]" role="alert">
          {error}
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-ink" htmlFor="identificador">
            Identificador
          </label>
          <input
            autoComplete="username"
            autoFocus
            className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
            disabled={submitting}
            id="identificador"
            name="identifier"
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Correo o nombre de usuario"
            required
            type="text"
            value={identifier}
          />
        </div>
        <div>
          <label className="mb-2 block text-[13px] font-semibold text-ink" htmlFor="contrasena">
            Contraseña
          </label>
          <input
            autoComplete="current-password"
            className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
            disabled={submitting}
            id="contrasena"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Tu contraseña"
            required
            type="password"
            value={password}
          />
        </div>
        <button className="button-base button-primary w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">
          {submitting ? "Ingresando…" : "Iniciar sesión"}
          {!submitting && <Icon name="arrow-right" size={18} />}
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-5 text-center text-[13px]">
        <Link className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline" href="/app/recuperar">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </div>
  );
}
