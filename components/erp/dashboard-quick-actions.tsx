import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import {
  canReadModule,
  canWriteModule,
  type ModuleKey,
  type Role,
} from "@/lib/permissions";
import { FUTURE_MODULES } from "@/lib/routes";

export type QuickAction = {
  label: string;
  href: string;
  icon: IconName;
  module: ModuleKey;
  write: boolean;
};

const QUICK_ACTIONS: Record<Role, QuickAction[]> = {
  admin: [
    { label: "Nueva compra", href: "/app/compras", icon: "clipboard", module: "compras", write: true },
    { label: "Nuevo producto", href: "/app/productos", icon: "package", module: "catalogo", write: true },
    { label: "Nuevo usuario", href: "/app/usuarios/nuevo", icon: "users", module: "usuarios", write: true },
    { label: "Nueva moneda", href: "/app/monedas", icon: "coins", module: "monedas", write: true },
  ],
  seller: [
    { label: "Nueva compra", href: "/app/compras", icon: "clipboard", module: "compras", write: true },
    { label: "Nuevo cliente", href: "/app/clientes/nuevo", icon: "users", module: "clientes", write: true },
    { label: "Nuevo producto", href: "/app/productos", icon: "package", module: "catalogo", write: true },
    { label: "Ver existencias", href: "/app/existencias", icon: "box", module: "existencias", write: false },
  ],
  dispatcher: [
    { label: "Ver clientes", href: "/app/clientes", icon: "users", module: "clientes", write: false },
    { label: "Ver bodegas", href: "/app/bodegas", icon: "warehouse", module: "bodegas", write: false },
    { label: "Ver lotes", href: "/app/lotes", icon: "layers", module: "lotes", write: false },
    { label: "Ver asignaciones", href: "/app/asignaciones", icon: "link", module: "asignaciones", write: false },
  ],
  manager_warehouse: [
    { label: "Nueva bodega", href: "/app/bodegas/nueva", icon: "warehouse", module: "bodegas", write: true },
    { label: "Ver estantes", href: "/app/bodegas", icon: "layers", module: "estantes", write: false },
    { label: "Ver lotes", href: "/app/lotes", icon: "layers", module: "lotes", write: false },
    { label: "Ver existencias", href: "/app/existencias", icon: "box", module: "existencias", write: false },
  ],
  support: [
    { label: "Ver productos", href: "/app/productos", icon: "package", module: "catalogo", write: false },
    { label: "Ver proveedores", href: "/app/proveedores", icon: "truck", module: "catalogo", write: false },
    { label: "Ver ubicaciones", href: "/app/ubicaciones", icon: "map-pin", module: "catalogo", write: false },
  ],
  customer: [
    { label: "Ver catálogo", href: "/app/productos", icon: "package", module: "catalogo", write: false },
  ],
};

export function getQuickActions(role: string) {
  return (QUICK_ACTIONS[role as Role] ?? []).filter((action) =>
    action.write
      ? canWriteModule(role, action.module)
      : canReadModule(role, action.module),
  );
}

export function getPrimaryAction(role: string) {
  return getQuickActions(role)[0] ?? null;
}

export function DashboardQuickActions({ role }: { role: string }) {
  const actions = getQuickActions(role);

  return (
    <section
      aria-labelledby="titulo-accesos-rapidos"
      className="rounded-[28px] border border-ink/[0.08] bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-7"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Acciones</span>
          <h2
            className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-ink"
            id="titulo-accesos-rapidos"
          >
            Accesos rápidos
          </h2>
        </div>
        <p className="text-[12px] text-muted">Según los permisos de tu rol</p>
      </div>

      {actions.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-background px-5 py-4 text-[13px] text-muted">
          Tu rol no tiene acciones disponibles por ahora. Usa la navegación para consultar los
          módulos habilitados.
        </p>
      ) : (
        <ul className="mt-6 flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
          {actions.map((action) => (
            <li className="shrink-0 sm:shrink" key={action.label}>
              <Link
                className="group flex min-h-11 min-w-44 items-center gap-3 rounded-2xl border border-line bg-background px-4 py-3.5 transition-colors hover:border-brand/30 hover:bg-soft-blue"
                href={action.href}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand shadow-sm">
                  <Icon name={action.icon} size={18} />
                </span>
                <span className="flex-1 text-[13px] font-semibold text-ink">{action.label}</span>
                <Icon
                  className="text-muted transition-transform group-hover:translate-x-0.5"
                  name="arrow-right"
                  size={14}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 border-t border-line pt-6">
        <h3 className="text-[13px] font-semibold text-ink">Módulos en preparación</h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {FUTURE_MODULES.map((module) => (
            <li key={module.label}>
              <span
                aria-disabled="true"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[12px] font-semibold text-muted"
              >
                <Icon name={module.icon} size={15} />
                {module.label}
                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold">
                  Próximamente
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
