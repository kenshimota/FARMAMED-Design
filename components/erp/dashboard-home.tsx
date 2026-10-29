"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { CurrencyStatusPanel } from "@/components/erp/currency-status-panel";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { canReadModule, ROLE_LABELS } from "@/lib/permissions";
import { ERP_ROUTES, getNavigationHref } from "@/lib/routes";
import { useSession } from "@/components/erp/session-context";

export function DashboardHome() {
  const { user } = useSession();
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const availableRoutes = ERP_ROUTES.filter(
    (route) =>
      route.navigation &&
      route.group !== "Inicio" &&
      route.group !== "Cuenta" &&
      canReadModule(user.role, route.module),
  );

  return (
    <div className="space-y-6">
      <CurrencyNoticeBanner />
      <section className="relative overflow-hidden rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9 lg:p-11">
        <div aria-hidden="true" className="technical-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(120deg,black,transparent_65%)]" />
        <div aria-hidden="true" className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[52px] border-lime/10" />
        <div className="relative max-w-3xl">
          <span className="eyebrow">Tu espacio de trabajo</span>
          <h1 className="mt-5 text-balance text-3xl font-semibold leading-tight tracking-[-0.045em] text-ink sm:text-4xl">
            Hola, {firstName}. Continuemos por donde necesites.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">
            Estas son las áreas disponibles para tu rol de {ROLE_LABELS[user.role].toLowerCase()}. No hay métricas ni actividad que mostrar hasta conectar los módulos operativos.
          </p>
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-olive/25 bg-soft-lime px-3.5 py-2 text-[11px] font-semibold text-ink">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-olive" />
            Sesión validada
          </div>
        </div>
      </section>

      <section aria-labelledby="titulo-modulos" className="rounded-[28px] border border-ink/[0.08] bg-surface p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <span className="eyebrow">Accesos directos</span>
            <h2 id="titulo-modulos" className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-ink">
              Módulos disponibles
            </h2>
          </div>
          <p className="text-[12px] text-muted">Según los permisos de tu rol</p>
        </div>
        {availableRoutes.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              description="Tu rol todavía no tiene módulos habilitados. Contacta a un administrador para revisar tus permisos."
              title="Sin módulos disponibles"
            />
          </div>
        ) : (
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableRoutes.map((route) => {
              const href = getNavigationHref(route, user.role);
              const content = (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand shadow-sm">
                    <Icon name={route.icon} size={20} />
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                      {route.label}
                      {href && <Icon className="text-muted transition-transform group-hover:translate-x-0.5" name="arrow-right" size={14} />}
                    </span>
                    <span className="mt-2 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                      {href ? route.group : "Requiere bodega"}
                    </span>
                  </span>
                </>
              );

              return (
                <li key={route.path}>
                  {href ? (
                    <Link
                      className="group flex min-h-28 items-start gap-4 rounded-2xl border border-line bg-background p-4 transition-colors hover:border-brand/30 hover:bg-soft-blue"
                      href={href}
                    >
                      {content}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="flex min-h-28 items-start gap-4 rounded-2xl border border-line bg-background p-4 text-muted"
                    >
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CurrencyStatusPanel />
    </div>
  );
}
