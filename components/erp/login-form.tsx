"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useState,
  type FormEvent,
  type FocusEvent,
} from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { CooldownText, useRetryCooldown, type CooldownTrigger } from "@/components/erp/ui/cooldown";
import {
  FormErrorSummary,
  FormField,
  focusFirstInvalidField,
  type FormErrorItem,
} from "@/components/erp/ui/form";
import { translateApiError, type UiErrorKind } from "@/lib/api-errors";
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

const fieldLabels = {
  identificador: "Identificador",
  contrasena: "Contraseña",
} as const;

const credentialKinds: UiErrorKind[] = ["session-expired", "forbidden", "validation"];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [cooldown, setCooldown] = useState<CooldownTrigger | null>(null);
  const remaining = useRetryCooldown(cooldown);

  const noticeKey = searchParams.get("aviso");
  const notice =
    noticeKey === "expirada" || noticeKey === "bloqueada" || noticeKey === "cerrada"
      ? notices[noticeKey]
      : null;
  const returnPath = getSafeReturnPath(searchParams.get("retorno"));

  function validateField(id: keyof typeof fieldLabels) {
    if (id === "identificador" && !identifier.trim()) return "Escribe tu identificador.";
    if (id === "contrasena" && !password) return "Escribe tu contraseña.";
    return null;
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const id = event.target.id as keyof typeof fieldLabels;
    const error = validateField(id);
    setFieldErrors((current) => {
      const next = { ...current };
      if (error) next[id] = error;
      else delete next[id];
      return next;
    });
  }

  function buildSummary(errors: Record<string, string>): FormErrorItem[] {
    return Object.entries(errors).map(([field, error]) => ({
      fieldId: field,
      label: fieldLabels[field as keyof typeof fieldLabels] ?? field,
      message: error,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const identifierError = validateField("identificador");
    const passwordError = validateField("contrasena");
    if (identifierError) errors.identificador = identifierError;
    if (passwordError) errors.contrasena = passwordError;

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setFieldErrors({});
    setShowSummary(false);
    setCooldown(null);

    try {
      const token = await authenticate(identifier.trim(), password);
      saveStoredToken(token);
      router.replace(returnPath);
    } catch (caughtError) {
      const translated = translateApiError(caughtError);
      if (translated.kind === "rate-limit" && translated.retryAfterSeconds) {
        setCooldown({ seconds: translated.retryAfterSeconds, id: Date.now() });
        setMessage("Demasiadas solicitudes.");
      } else if (credentialKinds.includes(translated.kind)) {
        setMessage("El identificador o la contraseña no son correctos.");
      } else {
        setMessage(translated.message);
        if (translated.kind === "bad-request") {
          window.requestAnimationFrame(() => {
            document.getElementById("identificador")?.focus();
          });
        }
      }
      setSubmitting(false);
    }
  }

  const summaryItems = buildSummary(fieldErrors);

  return (
    <div>
      {notice && (
        <NoticeBanner
          className="mb-5"
          role={noticeKey === "cerrada" ? "status" : "alert"}
          tone="info"
        >
          {notice}
        </NoticeBanner>
      )}
      {message && (
        <NoticeBanner className="mb-5" role="alert" tone="danger">
          <span>
            {message}
            {remaining > 0 && (
              <>
                {" "}Podrás intentar de nuevo en <CooldownText remaining={remaining} />.
              </>
            )}
          </span>
        </NoticeBanner>
      )}
      {showSummary && summaryItems.length > 0 && (
        <div className="mb-5">
          <FormErrorSummary errors={summaryItems} />
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <FormField
          error={fieldErrors.identificador}
          id="identificador"
          label="Identificador"
          required
        >
          {(aria) => (
            <input
              {...aria}
              autoComplete="username"
              autoFocus
              className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
              disabled={submitting}
              name="identifier"
              onBlur={handleBlur}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Correo o nombre de usuario"
              type="text"
              value={identifier}
            />
          )}
        </FormField>
        <FormField
          error={fieldErrors.contrasena}
          id="contrasena"
          label="Contraseña"
          required
        >
          {(aria) => (
            <input
              {...aria}
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
              disabled={submitting}
              name="password"
              onBlur={handleBlur}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
              type="password"
              value={password}
            />
          )}
        </FormField>
        <BusyButton
          busy={submitting}
          className="w-full"
          disabled={remaining > 0}
          type="submit"
        >
          Iniciar sesión
          <Icon name="arrow-right" size={18} />
        </BusyButton>
      </form>

      <div className="mt-6 border-t border-line pt-5 text-center text-[13px]">
        <Link className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline" href="/app/recuperar">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </div>
  );
}
