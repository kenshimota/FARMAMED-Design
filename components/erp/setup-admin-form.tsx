"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  AccountFields,
  EMPTY_ACCOUNT_VALUES,
  INVALID_EMAIL_MESSAGE,
  accountSummaryItems,
  isValidEmail,
  mapAccountFieldErrors,
  type AccountFieldKey,
} from "@/components/erp/ui/account-fields";
import {
  FormErrorSummary,
  focusFirstInvalidField,
} from "@/components/erp/ui/form";
import { ApiError, apiFetch } from "@/lib/api";
import { PASSWORD_MIN_MESSAGE } from "@/lib/api-errors";
import { ROLE_LABELS } from "@/lib/permissions";

const COPY = {
  required: "Completa los campos obligatorios.",
  invalidEmail: INVALID_EMAIL_MESSAGE,
  success: "Administrador creado. Inicia sesión con tus credenciales.",
  conflict: "Ya existe un administrador. Inicia sesión.",
  forbidden: "No tienes permisos para crear el administrador.",
  generic: "No pudimos crear el administrador. Intenta de nuevo.",
  validation: "Revisa los datos del formulario.",
} as const;

const SUCCESS_REDIRECT_MS = 5000;

function validate(values: typeof EMPTY_ACCOUNT_VALUES) {
  const errors: Record<string, string> = {};
  if (!values.username.trim()) errors.username = COPY.required;
  if (!values.email.trim()) errors.email = COPY.required;
  else if (!isValidEmail(values.email)) errors.email = COPY.invalidEmail;
  if (!values.password) errors.password = COPY.required;
  else if (values.password.length < 8) errors.password = PASSWORD_MIN_MESSAGE;
  return errors;
}

export function SetupAdminForm() {
  const router = useRouter();
  const [values, setValues] = useState(EMPTY_ACCOUNT_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => router.replace("/app/login"), SUCCESS_REDIRECT_MS);
    return () => window.clearTimeout(timer);
  }, [success, router]);

  function handleChange(field: AccountFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || success || needsLogin) return;

    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      setMessage(null);
      setNeedsLogin(false);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);
    setNeedsLogin(false);

    try {
      await apiFetch("/auth/register-admin", {
        method: "POST",
        body: JSON.stringify({
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
          ...(values.name.trim() ? { name: values.name.trim() } : {}),
        }),
      });
      setSuccess(COPY.success);
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 409) {
          setMessage(COPY.conflict);
          setNeedsLogin(true);
        } else if (caught.status === 403) {
          setMessage(COPY.forbidden);
        } else if (caught.status === 400) {
          setMessage(COPY.required);
        } else if (caught.status === 422) {
          const mapped = mapAccountFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(COPY.validation);
          }
        } else {
          setMessage(COPY.generic);
        }
      } else {
        setMessage(COPY.generic);
      }
      setSubmitting(false);
    }
  }

  const summaryItems = accountSummaryItems(errors);
  const disabled = submitting || Boolean(success) || needsLogin;

  return (
    <div>
      {success && (
        <NoticeBanner className="mb-5" role="status" tone="success">
          {success}
          <p className="mt-2">
            <Link
              className="font-semibold underline underline-offset-4 hover:text-ink"
              href="/app/login"
            >
              Iniciar sesión
            </Link>
          </p>
        </NoticeBanner>
      )}
      {message && (
        <NoticeBanner className="mb-5" role="alert" tone="danger">
          {message}
          {needsLogin && (
            <p className="mt-2">
              <Link
                className="font-semibold underline underline-offset-4 hover:text-ink"
                href="/app/login"
              >
                Iniciar sesión
              </Link>
            </p>
          )}
        </NoticeBanner>
      )}
      {showSummary && summaryItems.length > 0 && (
        <div className="mb-5">
          <FormErrorSummary errors={summaryItems} />
        </div>
      )}

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <AccountFields
          disabled={disabled}
          errors={errors}
          onChange={handleChange}
          values={values}
        />

        <div>
          <p className="mb-2 text-[13px] font-semibold text-ink">Rol</p>
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-line bg-background px-4">
            <span className="text-[15px] font-medium text-ink">{ROLE_LABELS.admin}</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              Fijo
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-5 text-muted">
            Se asigna automáticamente al administrador inicial.
          </p>
        </div>

        <BusyButton
          busy={submitting}
          busyLabel="Creando administrador…"
          className="w-full"
          disabled={disabled}
          type="submit"
        >
          Crear administrador
          <Icon name="arrow-right" size={18} />
        </BusyButton>
      </form>

      <p className="mt-4 text-[12px] leading-5 text-muted">
        La cuenta se crea sin iniciar sesión. Al terminar, vuelve al acceso con tus credenciales.
      </p>
      <Link
        className="mt-3 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
        href="/app/login"
      >
        Iniciar sesión
        <Icon name="arrow-right" size={16} />
      </Link>
    </div>
  );
}
