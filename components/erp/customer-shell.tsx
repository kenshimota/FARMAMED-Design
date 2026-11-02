"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";
import { AccountMenu } from "@/components/erp/account-menu";
import { useSession } from "@/components/erp/session-context";

type CustomerNavItem = {
  label: string;
  href?: string;
  icon: IconName;
  hint?: string;
  activeWhen?: readonly string[];
};

// CLI-03, CLI-04, CLI-05 y CLI-06 completan tienda, carrito, mis pedidos y
// billetera del cliente.
const NAV_ITEMS: readonly CustomerNavItem[] = [
  { label: "Inicio", href: "/app", icon: "home" },
  { label: "Tienda", href: "/app/tienda", icon: "cart" },
  {
    label: "Carrito",
    href: "/app/carrito",
    icon: "cart",
    activeWhen: ["/app/finalizar-pedido"],
  },
  { label: "Mis pedidos", href: "/app/mis-pedidos", icon: "clipboard" },
  { label: "Mi billetera", href: "/app/billetera", icon: "coins" },
  { label: "Mi cuenta", href: "/app/cuenta", icon: "user" },
];

function normalizePathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isActivePath(pathname: string, href: string) {
  if (href === "/app") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CustomerNavigation() {
  const pathname = normalizePathname(usePathname());

  return (
    <ul className="grid grid-cols-2 gap-1 md:flex md:flex-wrap md:items-center md:gap-1">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href !== undefined &&
          (isActivePath(pathname, item.href) ||
            item.activeWhen?.includes(pathname) === true);

        return (
          <li className="min-w-0" key={item.label}>
            {item.href ? (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-[13px] font-semibold transition-colors ${
                  active
                    ? "bg-soft-blue text-brand"
                    : "text-ink hover:bg-background hover:text-brand"
                }`}
                href={item.href}
              >
                <Icon
                  aria-hidden="true"
                  className={active ? "text-brand" : "text-muted"}
                  name={item.icon}
                  size={17}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            ) : (
              <span className="flex min-h-11 flex-col justify-center rounded-xl px-3 py-1.5 text-muted">
                <span className="flex items-center gap-2 text-[13px] font-semibold">
                  <Icon
                    aria-hidden="true"
                    className="text-muted"
                    name={item.icon}
                    size={17}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.hint && (
                  <span className="mt-0.5 block pl-[25px] text-[11px] font-medium leading-4 text-muted">
                    {item.hint}
                  </span>
                )}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CustomerShell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();

  return (
    <div className="min-h-screen bg-background">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6 md:min-h-16 md:flex-nowrap md:gap-6 md:py-0 lg:px-8">
          <div className="order-1 flex min-w-0 items-center">
            <Link
              aria-label="Farmamed, ir al inicio de la tienda"
              className="inline-flex min-h-11 items-center rounded-lg"
              href="/app"
            >
              <Brand />
            </Link>
          </div>

          <nav
            aria-label="Navegación principal"
            className="order-3 w-full md:order-2 md:w-auto md:min-w-0 md:flex-1"
          >
            <CustomerNavigation />
          </nav>

          <div className="order-2 ml-auto min-w-0 md:order-3 md:ml-0">
            <AccountMenu onLogout={logout} user={user} />
          </div>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-[1180px] px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8 lg:py-10"
        id="contenido"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
