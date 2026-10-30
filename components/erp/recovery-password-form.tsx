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
import { FormField, focusFirstInvalidField } from "@/components/erp/ui/form";
import { LoadingRegion, Skeleton } from "@/components/erp/ui/skeleton";
import { ApiError } from "@/lib/api";
import { PASSWORD_MIN_MESSAGE } from "@/lib/api-errors";
import { resetRecoveryPassword } from "@/lib/recovery";
import {
  clearRecoveryFlow,
  getRecoveryFlowSnapshot,
  getServerRecoveryFlowSnapshot,
  subscribeRecoveryFlow,
} from "@/lib/recovery-flow";
import { saveStoredToken } from "@/lib/session";

const COPY = {
  empty: "Completa ambos campos.",
  mismatch: "Las contraseñas no coinciden.",
  validation: "Revisa los datos del formulario.",
  success: "Contraseña actualizada.",
  blocked: "Tu cuenta está bloqueada. Contacta a un administrador.",
  forbidden: "No tienes permisos para esta acción.",
  network: "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
  generic: "No pudimos procesar la solicitud. Intenta de nuevo.",
} as const;

const SUCCESS_REDIRECT_MS = 1200;

const inputClass =
  "h-12 w-full rounded-xl border border-ink/15 bg-surface pl-4 pr-12 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60";

function mapPasswordErrors(error: ApiError) {
  const mapped: { contrasena?: string; confirmacion?: string } = {};
  for (const field of Object.keys(error.fieldErrors)) {
    const key = field.toLowerCase();
    if (key === "password") mapped.contrasena = PASSWORD_MIN_MESSAGE;
    else if (key === "passwordconfirmation") mapped.confirmacion = COPY.mismatch;
  }
  return mapped;
}

export function RecoveryPasswordForm() {
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
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    contrasena?: string;
    confirmacion?: string;
  }>({});
  const [canRetry, setCanRetry] = useState(false);
  const guardRanRef = useRef(false);

  const token = flow?.token ?? null;

  useEffect(() => {
    if (!hydrated || guardRanRef.current) return;
    guardRanRef.current = true;
    if (!token) {
      router.replace(flow?.email ? "/app/recuperar/codigo" : "/app/recuperar");
    }
  }, [hydrated, token, flow, router]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => {
      router.replace("/app");
    }, SUCCESS_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [success, router]);

  function markMissingFields() {
    const errors: { contrasena?: string; confirmacion?: string } = {};
    if (!password) errors.contrasena = COPY.empty;
    if (!passwordConfirmation) errors.confirmacion = COPY.empty;
    setFieldErrors(errors);
    window.requestAnimationFrame(() => focusFirstInvalidField());
  }

  function handleFailure(error: unknown) {
    if (!(error instanceof ApiError)) {
      setMessage(COPY.network);
      setCanRetry(true);
      return;
    }
    switch (error.status) {
      case 400:
        if (!password || !passwordConfirmation) {
          markMissingFields();
        } else {
          setMessage(COPY.empty);
        }
        setCanRetry(false);
        break;
      case 401:
        clearRecoveryFlow();
        router.replace("/app/recuperar?aviso=expirado");
        break;
      case 403:
        setMessage(error.isUserBlocked() ? COPY.blocked : COPY.forbidden);
        setCanRetry(false);
        break;
      case 422: {
        const mapped = mapPasswordErrors(error);
        if (mapped.contrasena || mapped.confirmacion) {
          setFieldErrors(mapped);
          window.requestAnimationFrame(() => focusFirstInvalidField());
        } else {
          setMessage(COPY.validation);
          setCanRetry(false);
        }
        break;
      }
      default:
        setMessage(COPY.generic);
        setCanRetry(true);
    }
  }

  async function submit() {
    if (!token) return;

    if (!password || !passwordConfirmation) {
      setMessage(null);
      setSuccess(null);
      setCanRetry(false);
      markMissingFields();
      return;
    }
    if (password.length < 8) {
      setFieldErrors({ contrasena: PASSWORD_MIN_MESSAGE });
      setMessage(null);
      setSuccess(null);
      setCanRetry(false);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }
    if (password !== passwordConfirmation) {
      setFieldErrors({ confirmacion: COPY.mismatch });
      setMessage(null);
      setSuccess(null);
      setCanRetry(false);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setSuccess(null);
    setFieldErrors({});
    setCanRetry(false);
    setShowPassword(false);
    setShowConfirmation(false);

    try {
      await resetRecoveryPassword(token, password, passwordConfirmation);
      saveStoredToken(token);
      clearRecoveryFlow();
      setSuccess(COPY.success);
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

  if (!hydrated) {
    return (
      <LoadingRegion className="space-y-5" label="Cargando el formulario…">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full rounded-full" />
      </LoadingRegion>
    );
  }

  return (
    <div>
      {success && (
        <NoticeBanner className="mb-5" role="status" tone="success">
          {success}
          <p className="mt-2">
            <Link
              className="font-semibold underline underline-offset-4 hover:text-ink"
              href="/app"
            >
              Ir al inicio del ERP
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

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <FormField
          error={fieldErrors.contrasena}
          help="Mínimo 8 caracteres."
          id="contrasena"
          label="Nueva contraseña"
          required
        >
          {(aria) => (
            <div className="relative">
              <input
                {...aria}
                autoComplete="new-password"
                autoFocus
                className={inputClass}
                disabled={submitting || Boolean(success)}
                name="password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFieldErrors((current) => ({ ...current, contrasena: undefined }));
                }}
                placeholder="Tu contraseña nueva"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted transition-colors hover:text-ink"
                disabled={submitting || Boolean(success)}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                <Icon name={showPassword ? "eye-off" : "eye"} size={19} />
              </button>
            </div>
          )}
        </FormField>

        <FormField
          error={fieldErrors.confirmacion}
          id="confirmacion"
          label="Confirmar contraseña"
          required
        >
          {(aria) => (
            <div className="relative">
              <input
                {...aria}
                autoComplete="new-password"
                className={inputClass}
                disabled={submitting || Boolean(success)}
                name="passwordConfirmation"
                onChange={(event) => {
                  setPasswordConfirmation(event.target.value);
                  setFieldErrors((current) => ({
                    ...current,
                    confirmacion: undefined,
                  }));
                }}
                placeholder="Repite la contraseña"
                type={showConfirmation ? "text" : "password"}
                value={passwordConfirmation}
              />
              <button
                aria-label={
                  showConfirmation
                    ? "Ocultar confirmación de contraseña"
                    : "Mostrar confirmación de contraseña"
                }
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted transition-colors hover:text-ink"
                disabled={submitting || Boolean(success)}
                onClick={() => setShowConfirmation((current) => !current)}
                type="button"
              >
                <Icon name={showConfirmation ? "eye-off" : "eye"} size={19} />
              </button>
            </div>
          )}
        </FormField>

        <BusyButton
          busy={submitting}
          busyLabel="Guardando…"
          className="w-full"
          disabled={Boolean(success)}
          type="submit"
        >
          Guardar contraseña
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
