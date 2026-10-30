"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { FormField, type FormErrorItem } from "@/components/erp/ui/form";
import { ApiError } from "@/lib/api";
import {
  INVALID_EMAIL_MESSAGE,
  PASSWORD_MIN_MESSAGE,
  translateFieldMessage,
} from "@/lib/api-errors";

export { INVALID_EMAIL_MESSAGE };

export type AccountFieldKey = "username" | "name" | "email" | "password";

export type AccountValues = Record<AccountFieldKey, string>;

export const EMPTY_ACCOUNT_VALUES: AccountValues = {
  username: "",
  name: "",
  email: "",
  password: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

export const ACCOUNT_FIELD_IDS: Record<AccountFieldKey, string> = {
  username: "nombre-usuario",
  name: "nombre",
  email: "correo",
  password: "contrasena",
};

const ACCOUNT_FIELD_LABELS: Record<AccountFieldKey, string> = {
  username: "Nombre de usuario",
  name: "Nombre",
  email: "Correo",
  password: "Contraseña",
};

const API_FIELD_KEYS: Record<string, AccountFieldKey> = {
  username: "username",
  name: "name",
  email: "email",
  password: "password",
};

export function mapAccountFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(error.fieldErrors)) {
    const key = API_FIELD_KEYS[field.toLowerCase()];
    if (!key) continue;
    mapped[key] =
      key === "password" ? PASSWORD_MIN_MESSAGE : translateFieldMessage(rawMessage);
  }

  return mapped;
}

export function accountSummaryItems(errors: Record<string, string>): FormErrorItem[] {
  return (Object.keys(ACCOUNT_FIELD_IDS) as AccountFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: ACCOUNT_FIELD_IDS[key],
      label: ACCOUNT_FIELD_LABELS[key],
      message: errors[key],
    }));
}

type AccountFieldsProps = {
  values: AccountValues;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (field: AccountFieldKey, value: string) => void;
};

const inputClass =
  "h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60";

export function AccountFields({
  values,
  errors,
  disabled = false,
  onChange,
}: AccountFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <FormField
        error={errors.username}
        help="Se usará para iniciar sesión."
        id={ACCOUNT_FIELD_IDS.username}
        label="Nombre de usuario"
        required
      >
        {(aria) => (
          <input
            {...aria}
            autoComplete="username"
            className={inputClass}
            disabled={disabled}
            name="username"
            onChange={(event) => onChange("username", event.target.value)}
            placeholder="maria"
            type="text"
            value={values.username}
          />
        )}
      </FormField>

      <FormField
        error={errors.name}
        help="Nombre visible en la aplicación."
        id={ACCOUNT_FIELD_IDS.name}
        label="Nombre"
      >
        {(aria) => (
          <input
            {...aria}
            autoComplete="name"
            className={inputClass}
            disabled={disabled}
            name="name"
            onChange={(event) => onChange("name", event.target.value)}
            placeholder="María"
            type="text"
            value={values.name}
          />
        )}
      </FormField>

      <FormField
        error={errors.email}
        help="Aquí se enviará la bienvenida."
        id={ACCOUNT_FIELD_IDS.email}
        label="Correo"
        required
      >
        {(aria) => (
          <input
            {...aria}
            autoComplete="email"
            className={inputClass}
            disabled={disabled}
            inputMode="email"
            name="email"
            onChange={(event) => onChange("email", event.target.value)}
            placeholder="nombre@dominio.com"
            type="email"
            value={values.email}
          />
        )}
      </FormField>

      <FormField
        error={errors.password}
        help="Mínimo 8 caracteres."
        id={ACCOUNT_FIELD_IDS.password}
        label="Contraseña"
        required
      >
        {(aria) => (
          <div className="relative">
            <input
              {...aria}
              autoComplete="new-password"
              className={`${inputClass} pr-12`}
              disabled={disabled}
              name="password"
              onChange={(event) => onChange("password", event.target.value)}
              placeholder="Mínimo 8 caracteres"
              type={showPassword ? "text" : "password"}
              value={values.password}
            />
            <button
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
              onClick={() => setShowPassword((current) => !current)}
              type="button"
            >
              <Icon name={showPassword ? "eye-off" : "eye"} size={19} />
            </button>
          </div>
        )}
      </FormField>
    </>
  );
}
