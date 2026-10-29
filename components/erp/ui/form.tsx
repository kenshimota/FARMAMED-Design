"use client";

import { useId, useEffect, type ReactNode } from "react";

export type FieldAriaProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-required"?: true;
  "aria-invalid"?: true;
};

type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  help?: ReactNode;
  error?: string | null;
  children: (aria: FieldAriaProps) => ReactNode;
};

export function FormField({ id, label, required = false, help, error, children }: FormFieldProps) {
  const helpId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");

  const aria: FieldAriaProps = { id };
  if (describedBy) aria["aria-describedby"] = describedBy;
  if (required) aria["aria-required"] = true;
  if (error) aria["aria-invalid"] = true;

  return (
    <div>
      <label className="mb-2 block text-[13px] font-semibold text-ink" htmlFor={id}>
        {label}
        {required && (
          <span className="ml-2 text-[11px] font-medium text-muted">(obligatorio)</span>
        )}
      </label>
      {help && (
        <p className="mb-2 text-[12px] leading-5 text-muted" id={helpId}>
          {help}
        </p>
      )}
      {children(aria)}
      {error && (
        <p className="mt-2 text-[12px] font-semibold leading-5 text-alert-ink" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export type FormErrorItem = {
  fieldId: string;
  label: string;
  message: string;
};

export function FormErrorSummary({
  errors,
  title = "Revisa los datos del formulario",
}: {
  errors: FormErrorItem[];
  title?: string;
}) {
  const titleId = useId();
  if (errors.length === 0) return null;

  return (
    <div
      aria-labelledby={titleId}
      className="rounded-2xl border border-alert/25 bg-alert/[0.06] px-4 py-3.5"
      role="alert"
      tabIndex={-1}
    >
      <p className="text-[13px] font-semibold text-alert-ink" id={titleId}>
        {title}
      </p>
      <ul className="mt-2 space-y-1.5">
        {errors.map((error) => (
          <li className="text-[12px] leading-5 text-alert-ink" key={error.fieldId}>
            <a
              className="font-semibold underline underline-offset-4 hover:text-ink"
              href={`#${error.fieldId}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(error.fieldId)?.focus();
              }}
            >
              {error.label}
            </a>
            <span>: {error.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function focusFirstInvalidField(container: HTMLElement | Document = document) {
  const field = container.querySelector<HTMLElement>("[aria-invalid='true']");
  field?.focus();
  return field;
}

export function useUnsavedChangesWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [active]);
}
