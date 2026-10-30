"use client";

import { Icon } from "@/components/icons";
import {
  getRolePresentation,
  hasOperationalModules,
  isRole,
} from "@/lib/permissions";
import { useSession } from "@/components/erp/session-context";

export function AccountView() {
  const { user, logout } = useSession();
  const role = getRolePresentation(user.role);
  const catalogOnly = isRole(user.role) && !hasOperationalModules(user.role);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section aria-labelledby="titulo-cuenta" className="rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9">
        <span className="eyebrow">Perfil y acceso</span>
        <h1 id="titulo-cuenta" className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
          Mi cuenta
        </h1>
        <p className="mt-4 text-[14px] leading-7 text-muted">
          Estos son los datos que el servicio devolvió al validar tu sesión. No se pueden editar desde aquí.
        </p>
        <dl className="mt-8 divide-y divide-line rounded-2xl border border-line bg-background px-5">
          <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">Nombre de usuario</dt>
            <dd className="break-words text-[14px] font-semibold text-ink">{user.username || "—"}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">Nombre</dt>
            <dd className="break-words text-[14px] font-semibold text-ink">{user.name ?? "—"}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">Correo</dt>
            <dd className="break-words text-[14px] font-semibold text-ink">{user.email}</dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">Rol</dt>
            <dd>
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[11px] font-semibold text-ink">
                  {role.label}
                </span>
                {!role.recognized && (
                  <span className="inline-flex rounded-full bg-alert/[0.08] px-2.5 py-1 text-[10px] font-semibold text-alert-ink">
                    Rol no reconocido
                  </span>
                )}
              </span>
            </dd>
          </div>
        </dl>
        {catalogOnly && (
          <p className="mt-5 rounded-xl border border-olive/20 bg-soft-lime px-4 py-3 text-[12px] leading-6 text-ink">
            Tu cuenta tiene acceso de consulta al catálogo.
          </p>
        )}
      </section>

      <aside aria-labelledby="titulo-sesion" className="h-fit rounded-[28px] border border-brand/15 bg-soft-blue p-6 sm:p-8">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-brand">
          <Icon name="shield" size={22} />
        </span>
        <h2 id="titulo-sesion" className="mt-5 text-xl font-semibold tracking-[-0.025em] text-ink">
          Sesión actual
        </h2>
        <p className="mt-3 text-[13px] leading-6 text-muted">
          Tu sesión tiene vencimiento y no se renueva silenciosamente. Cuando expire, deberás iniciar sesión de nuevo.
        </p>
        <button className="button-base button-secondary mt-6 w-full bg-surface" onClick={logout} type="button">
          Cerrar sesión
          <Icon name="arrow-right" size={17} />
        </button>
      </aside>
    </div>
  );
}
