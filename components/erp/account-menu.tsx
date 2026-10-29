"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Icon } from "@/components/icons";
import { ROLE_LABELS } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";

type AccountMenuProps = {
  user: SessionUser;
  onLogout: () => void;
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AccountMenu({ user, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>("[role='menuitem']")?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [],
    );
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + direction + items.length) % items.length;
      items[nextIndex]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      items[event.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Abrir menú de cuenta"
        className="flex min-h-11 items-center gap-2 rounded-full p-1 text-left transition-colors hover:bg-background sm:pr-2"
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        ref={buttonRef}
        type="button"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
          {getInitials(user.name)}
        </span>
        <span className="hidden max-w-40 lg:block">
          <span className="block truncate text-[12px] font-semibold text-ink">{user.name}</span>
          <span className="mt-0.5 block truncate text-[10px] text-muted">
            {ROLE_LABELS[user.role]}
          </span>
        </span>
        <Icon className="hidden text-muted sm:block" name="chevron-down" size={15} />
      </button>

      {open && (
        <div
          className="erp-fade-enter absolute right-0 top-[calc(100%+10px)] z-50 w-72 max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_50px_rgba(27,12,104,0.16)]"
          id={menuId}
          onKeyDown={handleMenuKeyDown}
          ref={menuRef}
          role="menu"
        >
          <div className="border-b border-line bg-background px-5 py-4">
            <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
            <p className="mt-1 truncate text-[12px] text-muted">{user.email}</p>
            <p className="mt-3 inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[10px] font-semibold text-brand">
              {ROLE_LABELS[user.role]}
            </p>
          </div>
          <div className="p-2">
            <Link
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-ink transition-colors hover:bg-soft-blue"
              href="/app/cuenta"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <Icon name="user" size={18} />
              Mi cuenta
            </Link>
            <button
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium text-ink transition-colors hover:bg-soft-blue"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              role="menuitem"
              type="button"
            >
              <Icon name="arrow-right" size={18} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
