"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

const ACTION_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60";

const DANGER_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-alert/30 bg-surface px-3.5 text-[12px] font-semibold text-alert-ink transition-colors hover:border-alert hover:bg-alert/[0.06] disabled:cursor-not-allowed disabled:opacity-60";

type RecordActionLinkProps = {
  href: string;
  icon?: IconName;
  children: ReactNode;
  ariaLabel?: string;
};

export function RecordActionLink({
  href,
  icon = "arrow-right",
  children,
  ariaLabel,
}: RecordActionLinkProps) {
  return (
    <Link aria-label={ariaLabel} className={ACTION_CLASS} href={href}>
      {children}
      <Icon name={icon} size={15} />
    </Link>
  );
}

type RecordActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  danger?: boolean;
  icon?: IconName;
};

export function RecordActionButton({
  danger = false,
  icon,
  children,
  className = "",
  type = "button",
  ...props
}: RecordActionButtonProps) {
  return (
    <button
      className={`${danger ? DANGER_CLASS : ACTION_CLASS} ${className}`}
      type={type}
      {...props}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export function RecordActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
}
