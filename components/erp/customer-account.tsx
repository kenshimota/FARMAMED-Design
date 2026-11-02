"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { hasCustomerLink } from "@/lib/customer";
import { sessionDisplayName } from "@/lib/session";

export function CustomerAccountView() {
  const { user, logout } = useSession();
  const customer = user.customer;
  const linked = hasCustomerLink(user);
  const customerName =
    customer?.fullName || (linked ? "Detalle no disponible" : "Sin cliente vinculado");
  const customerDirection =
    customer?.direction || (linked ? "Detalle no disponible" : "No registrada");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section
        aria-labelledby="titulo-cuenta"
        className="rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9"
      >
        <span className="eyebrow">Perfil y acceso</span>
        <h1
          className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl"
          id="titulo-cuenta"
        >
          Mi cuenta
        </h1>
        <p className="mt-4 text-[14px] leading-7 text-muted">
          Estos son los datos que el servicio devolvió al validar tu sesión. No
          se pueden editar desde aquí.
        </p>
        <dl className="mt-8 divide-y divide-line rounded-2xl border border-line bg-background px-5">
          <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">Nombre</dt>
            <dd className="break-words text-[14px] font-semibold text-ink">
              {sessionDisplayName(user)}
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">
              Nombre de usuario
            </dt>
            <dd className="break-words text-[14px] font-semibold text-ink">
              {user.username || "—"}
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">Correo</dt>
            <dd className="break-words text-[14px] font-semibold text-ink">
              {user.email}
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">
              Cliente vinculado
            </dt>
            <dd className="break-words text-[14px] font-semibold text-ink">
              {customerName}
            </dd>
          </div>
          <div className="grid gap-1 py-4 sm:grid-cols-[160px_1fr] sm:gap-4">
            <dt className="text-[12px] font-medium text-muted">Dirección</dt>
            <dd className="break-words text-[14px] font-semibold text-ink">
              {customerDirection}
            </dd>
          </div>
        </dl>
      </section>

      <aside
        aria-labelledby="titulo-sesion"
        className="h-fit rounded-[28px] border border-brand/15 bg-soft-blue p-6 sm:p-8"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-brand">
          <Icon name="shield" size={22} />
        </span>
        <h2
          className="mt-5 text-xl font-semibold tracking-[-0.025em] text-ink"
          id="titulo-sesion"
        >
          Sesión actual
        </h2>
        <p className="mt-3 text-[13px] leading-6 text-muted">
          Tu sesión tiene vencimiento y no se renueva silenciosamente. Cuando
          expire, deberás iniciar sesión de nuevo.
        </p>
        <Link
          className="button-base button-secondary mt-6 w-full bg-surface"
          href="/app/billetera"
        >
          Mi billetera
          <Icon name="coins" size={17} />
        </Link>
        <button
          className="button-base button-secondary mt-3 w-full bg-surface"
          onClick={logout}
          type="button"
        >
          Cerrar sesión
          <Icon name="arrow-right" size={17} />
        </button>
      </aside>
    </div>
  );
}
