"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export const OTP_LENGTH = 8;

export type OtpDigits = string[];

export function emptyOtpDigits(): OtpDigits {
  return Array.from({ length: OTP_LENGTH }, () => "");
}

export function otpDigitsToString(digits: OtpDigits) {
  return digits.slice(0, OTP_LENGTH).join("");
}

const boxClass =
  "h-11 min-w-0 rounded-xl border border-ink/15 bg-surface px-0 text-center text-[16px] font-semibold tabular-nums text-ink transition-colors hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60 sm:h-12";

const digitOnly = (value: string) => value.replace(/\D+/g, "");

type RecoveryOtpInputProps = {
  label: string;
  digits: OtpDigits;
  onChange: (digits: OtpDigits) => void;
  disabled?: boolean;
  invalid?: boolean;
  help?: ReactNode;
  error?: string | null;
  autoFocus?: boolean;
};

export function RecoveryOtpInput({
  label,
  digits,
  onChange,
  disabled = false,
  invalid = false,
  help,
  error,
  autoFocus = false,
}: RecoveryOtpInputProps) {
  const baseId = useId();
  const labelId = `${baseId}-etiqueta`;
  const helpId = `${baseId}-ayuda`;
  const errorId = `${baseId}-error`;
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const describedBy = [help ? helpId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  function focusIndex(index: number) {
    const clamped = Math.max(0, Math.min(OTP_LENGTH - 1, index));
    const input = inputsRef.current[clamped];
    input?.focus();
    input?.select();
  }

  function updateAt(index: number, digit: string, advance: boolean) {
    setNotice(null);
    const next = [...digits];
    next[index] = digit;
    onChange(next);
    if (advance) focusIndex(index + 1);
  }

  function distribute(clean: string, startIndex: number) {
    const fitsFromStart =
      clean.length < OTP_LENGTH && startIndex + clean.length <= OTP_LENGTH;
    const start = fitsFromStart ? startIndex : 0;
    const used = clean.slice(0, OTP_LENGTH);
    setNotice(
      clean.length > OTP_LENGTH
        ? `El texto pegado tiene ${clean.length} dígitos; se usaron los primeros ${OTP_LENGTH}.`
        : null,
    );
    const next = [...digits];
    let index = start;
    for (const char of used) {
      if (index >= OTP_LENGTH) break;
      next[index] = char;
      index += 1;
    }
    onChange(next);
    focusIndex(Math.min(index, OTP_LENGTH - 1));
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const clean = digitOnly(event.target.value);
    const current = digits[index] ?? "";
    if (!clean) {
      updateAt(index, "", false);
      return;
    }
    if (clean.length === 1) {
      updateAt(index, clean, true);
      return;
    }
    if (clean.length === 2 && clean[0] === current) {
      updateAt(index, clean[1], true);
      return;
    }
    distribute(clean, index);
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (!(digits[index] ?? "") && index > 0) {
        event.preventDefault();
        const next = [...digits];
        next[index - 1] = "";
        onChange(next);
        focusIndex(index - 1);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusIndex(index - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusIndex(index + 1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusIndex(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusIndex(OTP_LENGTH - 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const clean = digitOnly(event.clipboardData.getData("text"));
    if (clean) distribute(clean, index);
  }

  return (
    <div
      aria-describedby={describedBy || undefined}
      aria-labelledby={labelId}
      role="group"
    >
      <span className="mb-2 block text-[13px] font-semibold text-ink" id={labelId}>
        {label}
        <span className="ml-2 text-[11px] font-medium text-muted">(obligatorio)</span>
      </span>
      {help && (
        <p className="mb-2 text-[12px] leading-5 text-muted" id={helpId}>
          {help}
        </p>
      )}
      <div className="grid grid-cols-8 gap-1.5 sm:gap-2">
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <input
            aria-describedby={
              index === 0 ? describedBy || undefined : undefined
            }
            aria-invalid={invalid || undefined}
            aria-label={`Dígito ${index + 1} de ${OTP_LENGTH}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            className={boxClass}
            disabled={disabled}
            inputMode="numeric"
            key={index}
            maxLength={2}
            onChange={(event) => handleChange(index, event)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            ref={(node) => {
              inputsRef.current[index] = node;
            }}
            type="text"
            value={digits[index] ?? ""}
          />
        ))}
      </div>
      {notice && (
        <p className="mt-2 text-[12px] leading-5 text-muted" role="status">
          {notice}
        </p>
      )}
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
