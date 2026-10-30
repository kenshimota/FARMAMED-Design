"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { FormField } from "@/components/erp/ui/form";

const CONTROL_CLASS =
  "w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60";

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  help?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  required = false,
  disabled = false,
  maxLength,
  placeholder,
  autoComplete = "off",
  autoFocus = false,
}: TextFieldProps) {
  return (
    <FormField error={error} help={help} id={id} label={label} required={required}>
      {(aria) => (
        <input
          {...aria}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={`${CONTROL_CLASS} h-12`}
          data-autofocus={autoFocus ? "" : undefined}
          disabled={disabled}
          maxLength={maxLength}
          name={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type="text"
          value={value}
        />
      )}
    </FormField>
  );
}

type TextAreaFieldProps = TextFieldProps & {
  rows?: number;
};

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  required = false,
  disabled = false,
  maxLength,
  placeholder,
  rows = 5,
}: TextAreaFieldProps) {
  return (
    <FormField error={error} help={help} id={id} label={label} required={required}>
      {(aria) => (
        <textarea
          {...aria}
          className={`${CONTROL_CLASS} min-h-32 py-3 leading-6`}
          disabled={disabled}
          maxLength={maxLength}
          name={id}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          value={value}
        />
      )}
    </FormField>
  );
}

export type SelectOption = {
  value: string;
  label: string;
};

type SelectFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  error?: string;
  help?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  loadError?: string | null;
  onRetry?: () => void;
  createHref?: string;
  createLabel?: string;
  emptyLabel?: string;
};

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  help,
  required = false,
  disabled = false,
  loading = false,
  loadingLabel,
  loadError,
  onRetry,
  createHref,
  createLabel,
  emptyLabel = "No hay opciones registradas.",
}: SelectFieldProps) {
  const blocked = disabled || loading || Boolean(loadError);
  const firstOptionLabel = loading
    ? loadingLabel ?? "Cargando opciones…"
    : loadError
      ? "No disponible"
      : options.length === 0
        ? emptyLabel
        : placeholder;

  return (
    <FormField error={error} help={help} id={id} label={label} required={required}>
      {(aria) => (
        <div>
          <select
            {...aria}
            aria-describedby={
              [aria["aria-describedby"], loadError ? `${id}-carga-error` : null]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={`${CONTROL_CLASS} h-12`}
            disabled={blocked}
            name={id}
            onChange={(event) => onChange(event.target.value)}
            value={value}
          >
            <option value="">{firstOptionLabel}</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {loadError && (
            <div
              className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-alert/25 bg-alert/[0.06] px-3 py-2 text-[12px] leading-5 text-alert-ink"
              id={`${id}-carga-error`}
              role="alert"
            >
              <span>{loadError}</span>
              {onRetry && (
                <button
                  className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold transition-colors hover:bg-surface"
                  onClick={onRetry}
                  type="button"
                >
                  Reintentar
                </button>
              )}
            </div>
          )}

          {createHref && createLabel && (
            <Link
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={createHref}
            >
              {createLabel}
              <Icon name="arrow-up-right" size={14} />
            </Link>
          )}
        </div>
      )}
    </FormField>
  );
}
