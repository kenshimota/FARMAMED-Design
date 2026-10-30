"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  CooldownText,
  useRetryCooldown,
  type CooldownTrigger,
} from "@/components/erp/ui/cooldown";
import { FormField, focusFirstInvalidField } from "@/components/erp/ui/form";
import { isValidEmail } from "@/components/erp/ui/account-fields";
import { ApiError } from "@/lib/api";
import { RECOVERY_COOLDOWN_SECONDS } from "@/lib/feedback";
import { formatWaitPhrase } from "@/lib/format";
import { requestRecoveryCode } from "@/lib/recovery";
import {
  cooldownRemainingSeconds,
  getRecoveryFlowSnapshot,
  getServerRecoveryFlowSnapshot,
  subscribeRecoveryFlow,
  updateRecoveryFlow,
} from "@/lib/recovery-flow";

const COPY = {
  emptyEmail: "Ingresa tu correo.",
  invalidEmail: "Ingresa un correo válido.",
  sent: "Si el correo está registrado, enviamos un código de recuperación.",
  mail: "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
  generic: "No pudimos procesar la solicitud. Intenta de nuevo.",
  expiredLink: "Tu enlace de recuperación expiró. Solicita un código nuevo.",
} as const;

const avisoCopy: Record<string, string> = {
  expirado: COPY.expiredLink,
};

const SUCCESS_REDIRECT_MS = 1200;

function cooldownMessage(seconds: number) {
  return `Espera ${formatWaitPhrase(seconds)} antes de solicitar otro código.`;
}

export function RecoveryRequestForm({ aviso }: { aviso: string | null }) {
  const router = useRouter();
  const flow = useSyncExternalStore(
    subscribeRecoveryFlow,
    getRecoveryFlowSnapshot,
    getServerRecoveryFlowSnapshot,
  );
  const [draft, setDraft] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [cooldownOverride, setCooldownOverride] = useState<CooldownTrigger | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const email = draft ?? flow?.email ?? "";
  const sentAt = flow?.sentAt ?? null;
  const flowCooldown = sentAt
    ? { seconds: cooldownRemainingSeconds(sentAt), id: sentAt }
    : null;
  const remaining = useRetryCooldown(cooldownOverride ?? flowCooldown);
  const notice = (aviso && avisoCopy[aviso]) || null;

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      router.push("/app/recuperar/codigo");
    }, SUCCESS_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [success, router]);

  useEffect(() => {
    if (!sentAt) return;
    const wait = cooldownRemainingSeconds(sentAt);
    if (wait <= 0) return;
    const timer = window.setTimeout(() => {
      setAnnouncement(`Podrás solicitar un código en ${formatWaitPhrase(wait)}.`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sentAt]);

  function startCooldown(seconds: number) {
    const wait = Math.max(1, Math.ceil(seconds));
    setCooldownOverride({ seconds: wait, id: Date.now() });
    setAnnouncement(`Podrás solicitar un código en ${formatWaitPhrase(wait)}.`);
  }

  function handleFailure(error: unknown) {
    if (!(error instanceof ApiError)) {
      setMessage(COPY.network);
      setCanRetry(true);
      return;
    }
    switch (error.status) {
      case 400:
        setFieldError(COPY.emptyEmail);
        window.requestAnimationFrame(() => focusFirstInvalidField());
        break;
      case 422:
        setFieldError(COPY.invalidEmail);
        window.requestAnimationFrame(() => focusFirstInvalidField());
        break;
      case 429: {
        const fromFlow = flow?.sentAt ? cooldownRemainingSeconds(flow.sentAt) : 0;
        const wait =
          error.retryAfterSeconds ??
          (fromFlow > 0 ? fromFlow : RECOVERY_COOLDOWN_SECONDS);
        setMessage(cooldownMessage(wait));
        setCanRetry(true);
        startCooldown(wait);
        break;
      }
      case 502:
        setMessage(COPY.mail);
        setCanRetry(true);
        break;
      default:
        setMessage(COPY.generic);
        setCanRetry(true);
    }
  }

  async function submit() {
    const trimmed = email.trim();
    if (!trimmed || !isValidEmail(trimmed)) {
      setFieldError(trimmed ? COPY.invalidEmail : COPY.emptyEmail);
      setMessage(null);
      setSuccess(null);
      setCanRetry(false);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setSuccess(null);
    setFieldError(null);
    setCanRetry(false);
    setAnnouncement(null);

    try {
      await requestRecoveryCode(trimmed);
      setCooldownOverride(null);
      updateRecoveryFlow({ email: trimmed, sentAt: Date.now(), token: null });
      setSuccess(COPY.sent);
    } catch (error) {
      handleFailure(error);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <div>
      {notice && (
        <NoticeBanner className="mb-5" role="alert" tone="warning">
          {notice}
        </NoticeBanner>
      )}
      {success && (
        <NoticeBanner className="mb-5" role="status" tone="success">
          {success}
          <p className="mt-2">
            <Link
              className="font-semibold underline underline-offset-4 hover:text-ink"
              href="/app/recuperar/codigo"
            >
              Ingresar el código
            </Link>
          </p>
        </NoticeBanner>
      )}
      {message && (
        <NoticeBanner
          action={
            canRetry ? (
              <button
                className="text-[12px] font-semibold text-alert-ink underline underline-offset-4 hover:text-ink"
                onClick={() => void submit()}
                type="button"
              >
                Reintentar
              </button>
            ) : undefined
          }
          className="mb-5"
          role="alert"
          tone="danger"
        >
          {message}
        </NoticeBanner>
      )}
      {remaining > 0 && (
        <p aria-hidden="true" className="mb-5 text-[12px] leading-5 text-muted">
          Podrás solicitar un código en <CooldownText remaining={remaining} />.
        </p>
      )}
      {announcement && (
        <p className="sr-only" role="status">
          {announcement}
        </p>
      )}

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FormField error={fieldError} id="correo" label="Correo" required>
          {(aria) => (
            <input
              {...aria}
              autoComplete="email"
              autoFocus
              className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || Boolean(success)}
              name="email"
              onChange={(event) => {
                setDraft(event.target.value);
                setFieldError(null);
              }}
              placeholder="tucorreo@ejemplo.com"
              type="email"
              value={email}
            />
          )}
        </FormField>

        <BusyButton
          busy={submitting}
          busyLabel="Enviando…"
          className="w-full"
          disabled={remaining > 0 || Boolean(success)}
          type="submit"
        >
          Enviar código
          <Icon name="arrow-right" size={18} />
        </BusyButton>
      </form>

      <Link
        className="mt-4 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
        href="/app/login"
      >
        Volver a iniciar sesión
        <Icon name="arrow-right" size={16} />
      </Link>
    </div>
  );
}
