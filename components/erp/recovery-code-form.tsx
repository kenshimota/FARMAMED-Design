"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  CooldownText,
  useRetryCooldown,
  type CooldownTrigger,
} from "@/components/erp/ui/cooldown";
import {
  RecoveryOtpInput,
  emptyOtpDigits,
  otpDigitsToString,
  type OtpDigits,
} from "@/components/erp/recovery-otp-input";
import { focusFirstInvalidField } from "@/components/erp/ui/form";
import { LoadingRegion, Skeleton } from "@/components/erp/ui/skeleton";
import { ApiError } from "@/lib/api";
import { RECOVERY_COOLDOWN_SECONDS } from "@/lib/feedback";
import { formatWaitPhrase } from "@/lib/format";
import {
  RecoveryResponseError,
  requestRecoveryCode,
  verifyRecoveryCode,
} from "@/lib/recovery";
import {
  cooldownRemainingSeconds,
  getRecoveryFlowSnapshot,
  getServerRecoveryFlowSnapshot,
  subscribeRecoveryFlow,
  updateRecoveryFlow,
  validityRemainingSeconds,
} from "@/lib/recovery-flow";

const COPY = {
  emptyCode: "Ingresa el código.",
  invalidCode: "El código debe tener 8 dígitos.",
  wrongCode: "El código es incorrecto o expiró. Solicita uno nuevo.",
  blocked: "Tu cuenta está bloqueada. Contacta a un administrador.",
  forbidden: "No tienes permisos para esta acción.",
  verified: "Código verificado.",
  resent: "Si el correo está registrado, enviamos un código de recuperación.",
  mail: "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
  generic: "No pudimos procesar la solicitud. Intenta de nuevo.",
  unexpected: "El servidor envió una respuesta inesperada. Intenta de nuevo.",
  expired: "El código expiró.",
} as const;

const SUCCESS_REDIRECT_MS = 1200;

function cooldownMessage(seconds: number) {
  return `Espera ${formatWaitPhrase(seconds)} antes de solicitar otro código.`;
}

export function RecoveryCodeForm() {
  const router = useRouter();
  const flow = useSyncExternalStore(
    subscribeRecoveryFlow,
    getRecoveryFlowSnapshot,
    getServerRecoveryFlowSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribeRecoveryFlow,
    () => true,
    () => false,
  );
  const [digits, setDigits] = useState<OtpDigits>(emptyOtpDigits);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState<string | null>(null);
  const [resent, setResent] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [cooldownOverride, setCooldownOverride] = useState<CooldownTrigger | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const retryActionRef = useRef<"verify" | "resend">("verify");
  const guardRanRef = useRef(false);
  const requestLinkRef = useRef<HTMLAnchorElement | null>(null);

  const email = flow?.email ?? "";
  const sentAt = flow?.sentAt ?? null;
  const flowCooldown = sentAt
    ? { seconds: cooldownRemainingSeconds(sentAt), id: sentAt }
    : null;
  const validityTrigger = sentAt
    ? { seconds: validityRemainingSeconds(sentAt), id: sentAt }
    : null;
  const cooldownRemaining = useRetryCooldown(cooldownOverride ?? flowCooldown);
  const validityRemaining = useRetryCooldown(validityTrigger);
  const expired = sentAt !== null && validityRemaining === 0;

  useEffect(() => {
    if (!hydrated || guardRanRef.current) return;
    guardRanRef.current = true;
    if (!flow?.email) {
      router.replace("/app/recuperar");
      return;
    }
    if (flow.token) router.replace("/app/recuperar/nueva");
  }, [hydrated, flow, router]);

  useEffect(() => {
    if (expired) requestLinkRef.current?.focus();
  }, [expired]);

  useEffect(() => {
    if (!sentAt) return;
    const validity = validityRemainingSeconds(sentAt);
    const wait = cooldownRemainingSeconds(sentAt);
    const timers: number[] = [];
    if (validity > 60) {
      timers.push(
        window.setTimeout(
          () => setAnnouncement("El código vence en 1 minuto."),
          (validity - 60) * 1000,
        ),
      );
    }
    if (wait > 0) {
      timers.push(
        window.setTimeout(
          () => setAnnouncement(`Podrás reenviar el código en ${formatWaitPhrase(wait)}.`),
          0,
        ),
      );
      timers.push(
        window.setTimeout(
          () => setAnnouncement("Ya puedes reenviar el código."),
          wait * 1000,
        ),
      );
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [sentAt]);

  useEffect(() => {
    if (!verified) return;
    const timer = window.setTimeout(() => {
      router.replace("/app/recuperar/nueva");
    }, SUCCESS_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [verified, router]);

  function startCooldown(seconds: number) {
    const wait = Math.max(1, Math.ceil(seconds));
    setCooldownOverride({ seconds: wait, id: Date.now() });
    setAnnouncement(`Podrás reenviar el código en ${formatWaitPhrase(wait)}.`);
  }

  function handleFailure(error: unknown) {
    if (error instanceof RecoveryResponseError) {
      setMessage(COPY.unexpected);
      setCanRetry(true);
      return;
    }
    if (!(error instanceof ApiError)) {
      setMessage(COPY.network);
      setCanRetry(true);
      return;
    }
    switch (error.status) {
      case 400:
        setFieldError(COPY.emptyCode);
        window.requestAnimationFrame(() => focusFirstInvalidField());
        break;
      case 401:
        setMessage(COPY.wrongCode);
        setCanRetry(false);
        break;
      case 403:
        setMessage(error.isUserBlocked() ? COPY.blocked : COPY.forbidden);
        setCanRetry(false);
        break;
      case 422:
        setFieldError(COPY.invalidCode);
        window.requestAnimationFrame(() => focusFirstInvalidField());
        break;
      case 429: {
        const fromFlow = sentAt ? cooldownRemainingSeconds(sentAt) : 0;
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
    const code = otpDigitsToString(digits);
    if (!code || code.length !== 8) {
      setFieldError(code ? COPY.invalidCode : COPY.emptyCode);
      setMessage(null);
      setVerified(null);
      setCanRetry(false);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    retryActionRef.current = "verify";
    setSubmitting(true);
    setMessage(null);
    setVerified(null);
    setResent(null);
    setFieldError(null);
    setCanRetry(false);

    try {
      const token = await verifyRecoveryCode(email, code);
      updateRecoveryFlow({ token });
      setVerified(COPY.verified);
    } catch (error) {
      handleFailure(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    retryActionRef.current = "resend";
    setResending(true);
    setMessage(null);
    setResent(null);
    setFieldError(null);
    setCanRetry(false);

    try {
      await requestRecoveryCode(email);
      setCooldownOverride(null);
      updateRecoveryFlow({ email, sentAt: Date.now(), token: null });
      setResent(COPY.resent);
    } catch (error) {
      handleFailure(error);
    } finally {
      setResending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  if (!hydrated) {
    return (
      <LoadingRegion className="space-y-5" label="Cargando el formulario…">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full rounded-full" />
      </LoadingRegion>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-background px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            Correo
          </p>
          <p className="mt-1 break-all text-[14px] font-semibold text-ink">{email}</p>
        </div>
        <div className="flex flex-col items-start gap-1">
          <Link
            className="inline-flex min-h-8 items-center text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href="/app/recuperar"
          >
            Cambiar correo
          </Link>
          {expired && (
            <Link
              className="inline-flex min-h-8 items-center text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href="/app/recuperar"
            >
              Volver a solicitar
            </Link>
          )}
        </div>
      </div>

      {verified && (
        <NoticeBanner className="mb-5" role="status" tone="success">
          {verified}
          <p className="mt-2">
            <Link
              className="font-semibold underline underline-offset-4 hover:text-ink"
              href="/app/recuperar/nueva"
            >
              Definir la contraseña
            </Link>
          </p>
        </NoticeBanner>
      )}
      {resent && (
        <NoticeBanner className="mb-5" role="status" tone="success">
          {resent}
        </NoticeBanner>
      )}
      {message && (
        <NoticeBanner
          action={
            canRetry ? (
              <button
                className="text-[12px] font-semibold text-alert-ink underline underline-offset-4 hover:text-ink"
                onClick={() =>
                  void (retryActionRef.current === "resend" ? handleResend() : submit())
                }
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
      {expired && (
        <NoticeBanner
          action={
            <Link
              className="text-[12px] font-semibold text-olive underline underline-offset-4 hover:text-ink"
              href="/app/recuperar"
              ref={requestLinkRef}
            >
              Solicitar nuevo código
            </Link>
          }
          className="mb-5"
          role="alert"
          tone="warning"
        >
          {COPY.expired} Solicita uno nuevo para continuar.
        </NoticeBanner>
      )}
      {cooldownRemaining > 0 && (
        <p aria-hidden="true" className="mb-5 text-[12px] leading-5 text-muted">
          Podrás reenviar el código en <CooldownText remaining={cooldownRemaining} />.
        </p>
      )}
      {announcement && (
        <p className="sr-only" role="status">
          {announcement}
        </p>
      )}

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <RecoveryOtpInput
          autoFocus
          digits={digits}
          disabled={submitting || Boolean(verified)}
          error={fieldError}
          help={
            expired ? (
              "Este código ya no es válido."
            ) : (
              <>
                <span aria-hidden="true">
                  El código vence en <CooldownText remaining={validityRemaining} />.
                </span>
                <span className="sr-only">
                  {sentAt
                    ? `El código vence en ${formatWaitPhrase(validityRemaining)}.`
                    : "El código vence 5 minutos después del envío."}
                </span>
              </>
            )
          }
          invalid={Boolean(fieldError)}
          label="Código de recuperación"
          onChange={(next) => {
            setDigits(next);
            setFieldError(null);
          }}
        />

        <BusyButton
          busy={submitting}
          busyLabel="Verificando…"
          className="w-full"
          disabled={expired || Boolean(verified)}
          type="submit"
        >
          Verificar código
          <Icon name="arrow-right" size={18} />
        </BusyButton>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          className="inline-flex min-h-11 items-center text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
          disabled={resending || cooldownRemaining > 0}
          onClick={() => void handleResend()}
          type="button"
        >
          {resending ? "Reenviando…" : "Reenviar código"}
        </button>
      </div>

      <Link
        className="mt-2 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
        href="/app/login"
      >
        Volver a iniciar sesión
        <Icon name="arrow-right" size={16} />
      </Link>
    </div>
  );
}
