"use client";

import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";

export type CustomerIncompleteReason = "vinculo" | "lista" | "general";

const COPY: Record<
  CustomerIncompleteReason,
  { title: string; description: string }
> = {
  vinculo: {
    title: "Tu cuenta aún no está vinculada a un cliente.",
    description:
      "Contacta al administrador para vincular tu usuario a un cliente. Mientras tanto no puedes entrar a la tienda ni a los pedidos.",
  },
  lista: {
    title: "Tu cuenta no tiene una lista de precios asignada.",
    description:
      "Contacta al administrador para asignar una lista de precios. Mientras tanto no puedes entrar a la tienda ni a los pedidos.",
  },
  general: {
    title: "Tu cuenta todavía no tiene acceso a la tienda.",
    description:
      "Contacta al administrador para revisar el vínculo del cliente y la lista de precios. Mientras tanto no puedes entrar a la tienda ni a los pedidos.",
  },
};

export function CustomerIncompleteContent({
  reason = "general",
}: {
  reason?: CustomerIncompleteReason;
}) {
  const { logout } = useSession();
  const copy = COPY[reason];

  return (
    <section
      aria-labelledby="titulo-cuenta-incompleta"
      className="mx-auto w-full max-w-2xl rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9"
    >
      <span className="eyebrow">Acceso a la tienda</span>
      <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-lime text-olive">
        <Icon name="shield" size={23} />
      </span>
      <h1
        className="mt-5 text-balance text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl"
        id="titulo-cuenta-incompleta"
      >
        Cuenta incompleta
      </h1>
      <p className="mt-4 text-[15px] font-semibold leading-7 text-ink" role="status">
        {copy.title}
      </p>
      <p className="mt-2 text-[14px] leading-7 text-muted">{copy.description}</p>
      <button
        className="button-base button-secondary mt-7"
        onClick={logout}
        type="button"
      >
        Cerrar sesión
        <Icon name="arrow-right" size={17} />
      </button>
    </section>
  );
}

export function CustomerIncompleteScreen({
  reason = "vinculo",
}: {
  reason?: CustomerIncompleteReason;
}) {
  return (
    <div className="min-h-screen bg-background">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-[1180px] items-center px-4 sm:px-6 lg:px-8">
          <Brand />
        </div>
      </header>
      <main
        className="mx-auto w-full max-w-[1180px] px-4 py-8 outline-none sm:px-6 sm:py-10 lg:px-8 lg:py-14"
        id="contenido"
        tabIndex={-1}
      >
        <CustomerIncompleteContent reason={reason} />
      </main>
    </div>
  );
}

export function CustomerIncompleteRoute({
  reason = "general",
}: {
  reason?: CustomerIncompleteReason;
}) {
  const { user } = useSession();

  if (user.role !== "customer") {
    return (
      <AccessState description="Esta pantalla pertenece al portal del cliente. Usa la navegación del ERP para continuar." />
    );
  }

  return <CustomerIncompleteContent reason={reason} />;
}
