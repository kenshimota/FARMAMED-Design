"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type FormEvent,
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
import { ApiError } from "@/lib/api";
import {
  PASSWORD_MIN_MESSAGE,
  translateApiError,
  translateFieldMessage,
} from "@/lib/api-errors";
import { formatWaitPhrase } from "@/lib/format";
import {
  authenticate,
  getSafeReturnPath,
  saveStoredToken,
} from "@/lib/session";

const COPY = {
  empty: "Completa tu identificador y tu contraseña.",
  missing: "Completa todos los campos.",
  invalid: "El correo, el usuario o la contraseña no son correctos.",
  network: "No pudimos conectar con el servidor. Intenta de nuevo.",
  generic: "No pudimos iniciar sesión. Intenta de nuevo.",
  success: "Sesión iniciada.",
} as const;

const notices = {
  expirada: "Tu sesión expiró. Inicia sesión de nuevo.",
  bloqueada: "Tu cuenta está bloqueada. Contacta a un administrador.",
  cerrada: "Tu sesión se cerró correctamente.",
} as const;

const fieldLabels = {
  identificador: "Identificador",
  contrasena: "Contraseña",
} as const;

const apiFieldToForm: Record<string, keyof typeof fieldLabels> = {
  identifier: "identificador",
  identificador: "identificador",
  email: "identificador",
  password: "contrasena",
  contrasena: "contrasena",
};

function mapLoginFieldErrors(error: unknown): Record<string, string> {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;
  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const target = apiFieldToForm[field.toLowerCase()];
    if (target) mapped[target] = translateFieldMessage(rawMessage);
  }
  return mapped;
}

export function LoginForm({ aviso, retorno }: { aviso: string | null; retorno: string | null }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [cooldown, setCooldown] = useState<CooldownTrigger | null>(null);
  const [cooldownAnnouncement, setCooldownAnnouncement] = useState<string | null>(null);
  const remaining = useRetryCooldown(cooldown);

  const noticeKey = aviso;
  const notice =
    noticeKey === "expirada" || noticeKey === "bloqueada" || noticeKey === "cerrada"
      ? notices[noticeKey]
      : null;
  const returnPath = getSafeReturnPath(retorno);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => router.replace(returnPath), 600);
    return () => window.clearTimeout(timer);
  }, [success, returnPath, router]);

  function buildSummary(errors: Record<string, string>): FormErrorItem[] {
    return Object.entries(errors).map(([field, error]) => ({
      fieldId: field,
      label: fieldLabels[field as keyof typeof fieldLabels] ?? field,
      message: error,
    }));
  }

  function clearFieldError(field: keyof typeof fieldLabels) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function focusField(id: string) {
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedIdentifier = identifier.trim();

    if (!trimmedIdentifier || !password) {
      setMessage(COPY.empty);
      setSuccess(null);
      setFieldErrors({});
      setShowSummary(false);
      focusField(!trimmedIdentifier ? "identificador" : "contrasena");
      return;
    }

    if (password.length < 8) {
      setFieldErrors({ contrasena: PASSWORD_MIN_MESSAGE });
      setShowSummary(true);
      setMessage(null);
      setSuccess(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setSuccess(null);
    setFieldErrors({});
    setShowSummary(false);
    setShowPassword(false);
    setCooldown(null);
    setCooldownAnnouncement(null);

    try {
      const token = await authenticate(trimmedIdentifier, password);
      saveStoredToken(token);
      setSuccess(COPY.success);
    } catch (caughtError) {
      const translated = translateApiError(caughtError);
      if (translated.kind === "rate-limit" && translated.retryAfterSeconds) {
        setCooldown({ seconds: translated.retryAfterSeconds, id: Date.now() });
        setCooldownAnnouncement(
          `Podrás intentar de nuevo en ${formatWaitPhrase(translated.retryAfterSeconds)}.`,
        );
        setMessage("Demasiadas solicitudes.");
      } else if (translated.kind === "blocked") {
        setMessage(translated.message);
      } else if (translated.kind === "validation") {
        const mapped = mapLoginFieldErrors(caughtError);
        if (Object.keys(mapped).length > 0) {
          setFieldErrors(mapped);
          setShowSummary(true);
          setMessage(null);
          window.requestAnimationFrame(() => focusFirstInvalidField());
        } else {
          setMessage(translated.message);
        }
      } else if (translated.kind === "session-expired" || translated.kind === "forbidden") {
        setMessage(COPY.invalid);
      } else if (translated.kind === "bad-request") {
        setMessage(COPY.missing);
        focusField("identificador");
      } else if (translated.kind === "network") {
        setMessage(caughtError instanceof TypeError ? COPY.network : COPY.generic);
      } else {
        setMessage(translated.message);
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
      {success && (
        <NoticeBanner className="mb-5" role="status" tone="success">
          {success}
        </NoticeBanner>
      )}
      {message && (
        <NoticeBanner className="mb-5" role="alert" tone="danger">
          {message}
        </NoticeBanner>
      )}
      {remaining > 0 && (
        <p aria-hidden="true" className="mb-5 text-[12px] leading-5 text-muted">
          Podrás intentar de nuevo en <CooldownText remaining={remaining} />.
        </p>
      )}
      {cooldownAnnouncement && (
        <p className="sr-only" role="status">
          {cooldownAnnouncement}
        </p>
      )}
      {showSummary && summaryItems.length > 0 && (
        <div className="mb-5">
          <FormErrorSummary errors={summaryItems} />
        </div>
      )}

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FormField
          error={fieldErrors.identificador}
          help="Puedes usar tu correo o tu nombre de usuario."
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
              onChange={(event) => {
                setIdentifier(event.target.value);
                clearFieldError("identificador");
              }}
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
            <div>
              <div className="relative">
                <input
                  {...aria}
                  autoComplete="current-password"
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-4 pr-12 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                  disabled={submitting}
                  name="password"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    clearFieldError("contrasena");
                  }}
                  placeholder="Tu contraseña"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted transition-colors hover:text-ink"
                  disabled={submitting}
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  <Icon name={showPassword ? "eye-off" : "eye"} size={19} />
                </button>
              </div>
              <Link
                className="inline-flex min-h-11 items-center text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href="/app/recuperar"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          )}
        </FormField>
        <BusyButton
          busy={submitting}
          busyLabel="Iniciando sesión…"
          className="w-full"
          disabled={remaining > 0}
          type="submit"
        >
          Iniciar sesión
          <Icon name="arrow-right" size={18} />
        </BusyButton>
      </form>
    </div>
  );
}
