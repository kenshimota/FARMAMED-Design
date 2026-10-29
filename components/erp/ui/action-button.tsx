"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANT_STYLES = {
  primary: "button-primary",
  secondary: "button-secondary",
  danger:
    "border border-alert/35 bg-surface text-alert-ink hover:border-alert hover:bg-alert/[0.06] hover:shadow-[0_10px_28px_rgba(193,39,45,0.14)]",
} as const;

export type BusyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  busy?: boolean;
  busyLabel?: string;
  variant?: keyof typeof VARIANT_STYLES;
  children: ReactNode;
};

export function BusyButton({
  busy = false,
  busyLabel = "Guardando…",
  variant = "primary",
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: BusyButtonProps) {
  return (
    <button
      aria-busy={busy || undefined}
      className={`button-base disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_STYLES[variant]} ${className}`}
      disabled={disabled || busy}
      type={type}
      {...props}
    >
      <span className="grid">
        <span className={busy ? "invisible" : undefined}>{children}</span>
        <span className={`[grid-area:1/1] justify-self-center ${busy ? undefined : "invisible"}`}>
          {busyLabel}
        </span>
      </span>
    </button>
  );
}
