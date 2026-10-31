"use client";

import { useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { FormField } from "@/components/erp/ui/form";
import type {
  MethodPaymentTypeField,
} from "@/components/erp/records/method-payment-types-api";
import type { DetailValues } from "@/components/erp/records/method-payment-errors";
import {
  detailFieldId,
  detailFieldPlaceholder,
  detailInputType,
  EMAIL_MAX_LENGTH,
} from "@/components/erp/records/method-payment-errors";

const CONTROL_CLASS =
  "w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60";

export function fieldHelp(field: MethodPaymentTypeField) {
  const parts: string[] = [];
  if (field.required) parts.push("Obligatorio.");
  switch (field.type) {
    case "text":
      if (field.max_length != null) parts.push(`Máximo ${field.max_length} caracteres.`);
      break;
    case "email":
      parts.push("Formato de correo electrónico.");
      break;
    case "phone":
      parts.push("De 6 a 20 caracteres con dígitos, +, espacios o guiones.");
      break;
    case "integer":
      parts.push("Número entero sin decimales.");
      break;
    default:
      break;
  }
  return parts.join(" ");
}

type MethodSwitchControlProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
  "aria-describedby"?: string;
  "aria-required"?: true;
  "aria-invalid"?: true;
};

export function MethodSwitchControl({
  id,
  checked,
  onChange,
  disabled = false,
  onLabel = "Sí",
  offLabel = "No",
  ...aria
}: MethodSwitchControlProps) {
  const [interacted, setInteracted] = useState(false);
  const stateLabel = checked ? onLabel : offLabel;

  return (
    <div className="flex items-center gap-3">
      <button
        aria-checked={checked}
        aria-describedby={aria["aria-describedby"]}
        aria-invalid={aria["aria-invalid"]}
        aria-required={aria["aria-required"]}
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
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
        <Icon
          className={checked ? "text-olive" : "text-muted"}
          name={checked ? "check" : "close"}
          size={14}
        />
        {stateLabel}
      </span>
      <span aria-live="polite" className="sr-only">
        {interacted ? stateLabel : ""}
      </span>
    </div>
  );
}

type MethodPaymentDetailFieldsProps = {
  fields: readonly MethodPaymentTypeField[];
  values: DetailValues;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (key: string, value: string | boolean) => void;
  onBlur?: (key: string) => void;
};

export function MethodPaymentDetailFields({
  fields,
  values,
  errors,
  disabled = false,
  onChange,
  onBlur,
}: MethodPaymentDetailFieldsProps) {
  return (
    <div className="space-y-5">
      {fields.map((field) => (
        <MethodPaymentDetailField
          disabled={disabled}
          error={errors[detailFieldId(field.key)]}
          field={field}
          key={field.key}
          onBlur={onBlur}
          onChange={onChange}
          value={values[field.key] ?? (field.type === "boolean" ? false : "")}
        />
      ))}
    </div>
  );
}

function MethodPaymentDetailField({
  field,
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: {
  field: MethodPaymentTypeField;
  value: string | boolean;
  error?: string;
  disabled: boolean;
  onChange: (key: string, value: string | boolean) => void;
  onBlur?: (key: string) => void;
}) {
  const help = fieldHelp(field);
  const id = detailFieldId(field.key);

  return (
    <FormField
      error={error}
      help={help || undefined}
      id={id}
      label={field.label}
      required={field.required}
    >
      {(aria) =>
        field.type === "boolean" ? (
          <MethodSwitchControl
            aria-describedby={aria["aria-describedby"]}
            aria-invalid={aria["aria-invalid"]}
            aria-required={aria["aria-required"]}
            checked={value === true}
            disabled={disabled}
            id={id}
            onChange={(checked) => onChange(field.key, checked)}
          />
        ) : (
          <input
            {...aria}
            className={`${CONTROL_CLASS} h-12`}
            disabled={disabled}
            id={id}
            inputMode={
              field.type === "phone"
                ? "tel"
                : field.type === "integer"
                  ? "numeric"
                  : undefined
            }
            maxLength={
              field.max_length ??
              (field.type === "email" ? EMAIL_MAX_LENGTH : undefined)
            }
            name={id}
            onBlur={() => onBlur?.(field.key)}
            onChange={(event) => onChange(field.key, event.target.value)}
            placeholder={detailFieldPlaceholder(field)}
            step={field.type === "integer" ? 1 : undefined}
            type={detailInputType(field.type)}
            value={typeof value === "string" ? value : ""}
          />
        )
      }
    </FormField>
  );
}

export function MethodActiveSwitch({
  id,
  checked,
  onChange,
  disabled = false,
  error,
  help,
  label = "Estado del método",
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
  help?: ReactNode;
  label?: string;
}) {
  return (
    <FormField error={error} help={help} id={id} label={label}>
      {(aria) => (
        <MethodSwitchControl
          aria-describedby={aria["aria-describedby"]}
          aria-invalid={aria["aria-invalid"]}
          checked={checked}
          disabled={disabled}
          id={id}
          offLabel="Inactivo"
          onChange={onChange}
          onLabel="Activo"
        />
      )}
    </FormField>
  );
}
