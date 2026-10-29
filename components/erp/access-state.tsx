import Link from "next/link";
import { Icon } from "@/components/icons";

export function AccessState() {
  return (
    <section aria-labelledby="titulo-sin-permisos" className="rounded-[28px] border border-brand/15 bg-surface p-7 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-10">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-blue text-brand">
        <Icon name="shield" size={24} />
      </span>
      <h1 id="titulo-sin-permisos" className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-ink">Sin permisos</h1>
      <p className="mt-3 max-w-xl text-[14px] leading-7 text-muted">
        Tu rol no tiene acceso a este módulo. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible.
      </p>
      <Link className="button-base button-secondary mt-6" href="/app">
        Volver al inicio
        <Icon name="arrow-right" size={17} />
      </Link>
    </section>
  );
}
