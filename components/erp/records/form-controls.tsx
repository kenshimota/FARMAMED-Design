"use client";

import Link from "next/link";
import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icons";
import { FormField } from "@/components/erp/ui/form";
import { formatDateOnly } from "@/lib/format";

const CONTROL_CLASS =
  "w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60";

type TextFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  help?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
  mono?: boolean;
  readOnly?: boolean;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  help,
  required = false,
  disabled = false,
  maxLength,
  placeholder,
  autoComplete = "off",
  autoFocus = false,
  inputMode,
  mono = false,
  readOnly = false,
}: TextFieldProps) {
  return (
    <FormField error={error} help={help} id={id} label={label} required={required}>
      {(aria) => (
        <input
          {...aria}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={`${CONTROL_CLASS} h-12 read-only:bg-background read-only:text-muted ${mono ? "font-mono text-[14px]" : ""}`}
          data-autofocus={autoFocus ? "" : undefined}
          disabled={disabled}
          inputMode={inputMode}
          maxLength={maxLength}
          name={id}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          type="text"
          value={value}
        />
      )}
    </FormField>
  );
}

type DateFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  help?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
};

export function DateField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  required = false,
  disabled = false,
  min,
  max,
}: DateFieldProps) {
  const normalized = value.trim().slice(0, 10);
  const displayValue = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? formatDateOnly(normalized)
    : null;

  return (
    <FormField error={error} help={help} id={id} label={label} required={required}>
      {(aria) => (
        <div>
          <input
            {...aria}
            aria-describedby={
              [aria["aria-describedby"], `${id}-formato`]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={`${CONTROL_CLASS} h-12`}
            disabled={disabled}
            max={max}
            min={min}
            name={id}
            onChange={(event) => onChange(event.target.value)}
            type="date"
            value={value}
          />
          <p className="mt-1.5 text-[12px] leading-5 text-muted" id={`${id}-formato`}>
            {displayValue
              ? `Se mostrará como ${displayValue}.`
              : "Selecciona una fecha; se mostrará como dd/mm/aaaa."}
          </p>
        </div>
      )}
    </FormField>
  );
}

type TextAreaFieldProps = Omit<TextFieldProps, "mono"> & {
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

type SwitchFieldProps = {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  help?: ReactNode;
  error?: string;
  disabled?: boolean;
};

export function SwitchField({
  id,
  label,
  checked,
  onChange,
  help,
  error,
  disabled = false,
}: SwitchFieldProps) {
  const [interacted, setInteracted] = useState(false);
  const labelId = `${id}-etiqueta`;
  const helpId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const stateLabel = checked ? "Sí, se puede vender." : "No se puede vender.";

  return (
    <div>
      <div
        className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 ${
          error ? "border-alert/40" : "border-ink/15"
        }`}
      >
        <label
          className={`min-w-0 ${disabled ? "" : "cursor-pointer"}`}
          htmlFor={id}
        >
          <span className="block text-[13px] font-semibold text-ink" id={labelId}>
            {label}
          </span>
          {help && (
            <span className="mt-1 block text-[12px] leading-5 text-muted" id={helpId}>
              {help}
            </span>
          )}
        </label>
        <button
          aria-checked={checked}
          aria-describedby={describedBy || undefined}
          aria-invalid={error ? true : undefined}
          aria-labelledby={labelId}
          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${
            checked
              ? "border-olive bg-olive hover:bg-[color-mix(in_srgb,var(--olive)_85%,var(--ink))]"
              : "border-ink/60 bg-ink/50 hover:bg-ink/60"
          }`}
          disabled={disabled}
          id={id}
          onClick={() => {
            setInteracted(true);
            onChange(!checked);
          }}
          role="switch"
          type="button"
        >
          <span
            aria-hidden="true"
            className={`h-6 w-6 rounded-full bg-surface shadow-[0_2px_8px_rgba(27,12,104,0.2)] transition-transform motion-reduce:transition-none ${
              checked ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <p
        className={`mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold ${
          checked ? "text-ink" : "text-muted"
        }`}
      >
        <Icon
          className={checked ? "text-olive" : undefined}
          name={checked ? "check" : "close"}
          size={14}
        />
        {stateLabel}
      </p>
      <span aria-live="polite" className="sr-only">
        {interacted ? stateLabel : ""}
      </span>
      {error && (
        <p
          className="mt-2 text-[12px] font-semibold leading-5 text-alert-ink"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

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
