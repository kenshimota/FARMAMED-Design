"use client";

import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { canWriteModule } from "@/lib/permissions";
import { getRouteDefinition } from "@/lib/routes";

type ModulePlaceholderProps = {
  routePath: string;
};

export function ModulePlaceholder({ routePath }: ModulePlaceholderProps) {
  const { user } = useSession();
  const route = getRouteDefinition(routePath);
  if (!route) throw new Error(`Ruta no registrada: ${routePath}`);
  const canWrite = canWriteModule(user.role, route.module);
  const inventoryNote =
    route.module === "existencias" || route.module === "lotes"
      ? "Las existencias agregadas y los lotes son fuentes independientes y pueden diferir."
      : null;
  const tracksCurrency = route.module === "costos" || route.module === "compras";

  return (
    <div className="space-y-6">
      {tracksCurrency && <CurrencyNoticeBanner />}
      <section
        aria-labelledby="titulo-modulo"
        className="relative overflow-hidden rounded-[28px] border border-ink/[0.08] bg-surface shadow-[0_18px_60px_rgba(27,12,104,0.05)]"
      >
        <div aria-hidden="true" className="technical-grid absolute inset-0 opacity-50 [mask-image:linear-gradient(135deg,black,transparent_58%)]" />
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[44px] border-lime/10" />
        <div className="relative max-w-3xl p-6 sm:p-10 lg:p-12">
          <span className="eyebrow">{route.group}</span>
          <h1 id="titulo-modulo" className="mt-5 text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-4xl">
            {route.title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">
            {route.description}
          </p>

          <div className="mt-9 flex max-w-2xl items-start gap-4 rounded-2xl border border-brand/15 bg-soft-blue p-5 sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface text-brand shadow-sm">
              <Icon name={route.icon} size={22} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">Módulo en preparación</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-muted">
                La ruta, la navegación y el control de acceso ya están definidos. El contenido operativo se incorporará en una próxima etapa, sin datos de demostración.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-semibold">
            <span className={`rounded-full px-3 py-1.5 ${canWrite ? "bg-soft-lime text-ink" : "bg-soft-blue text-brand"}`}>
              {canWrite ? "Permiso de lectura y edición" : "Permiso de solo lectura"}
            </span>
            <span className="rounded-full bg-background px-3 py-1.5 text-muted">Sin acciones operativas en esta etapa</span>
          </div>
          {inventoryNote && (
            <p className="mt-5 max-w-2xl rounded-xl border border-olive/20 bg-soft-lime px-4 py-3 text-[12px] leading-6 text-ink">
              {inventoryNote}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
