import Link from "next/link";
import { Icon } from "@/components/icons";

type AccessStateProps = {
  headingLevel?: "h1" | "h2";
  description?: string;
};

export function AccessState({
  headingLevel = "h1",
  description = "Tu rol no tiene acceso a este módulo. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible.",
}: AccessStateProps) {
  const Heading = headingLevel;
  return (
    <section aria-labelledby="titulo-sin-permisos" className="rounded-[28px] border border-brand/15 bg-surface p-7 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-10">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-blue text-brand">
        <Icon name="shield" size={24} />
      </span>
      <Heading id="titulo-sin-permisos" className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-ink">Sin permisos</Heading>
      <p className="mt-3 max-w-xl text-[14px] leading-7 text-muted">{description}</p>
      <Link className="button-base button-secondary mt-6" href="/app">
        Volver al inicio
        <Icon name="arrow-right" size={17} />
      </Link>
    </section>
  );
}
