import Link from "next/link";
import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Página no encontrada | Farmamed ERP",
  description:
    "No encontramos la página que buscas. Puede que la dirección haya cambiado.",
};

export default function NotFound() {
  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-5 py-14"
      id="contenido"
      tabIndex={-1}
    >
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <div
        aria-hidden="true"
        className="technical-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_72%)]"
      />
      <div aria-hidden="true" className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-lime/10 blur-[90px]" />
      <div aria-hidden="true" className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan/[0.07] blur-[100px]" />

      <div className="relative w-full max-w-lg">
        <div className="flex justify-center">
          <Link aria-label="Farmamed, volver al inicio" className="rounded-lg" href="/">
            <Brand priority />
          </Link>
        </div>

        <section
          aria-labelledby="titulo-pagina-no-encontrada"
          className="mt-8 rounded-[28px] border border-line bg-surface p-8 text-center shadow-[0_18px_60px_rgba(27,12,104,0.06)] sm:p-12"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-blue text-alert">
            <Icon name="alert" size={23} />
          </span>
          <span className="eyebrow mt-5">Error 404</span>
          <h1
            className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-4xl"
            id="titulo-pagina-no-encontrada"
          >
            Página no encontrada
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-7 text-muted" role="alert">
            No encontramos la página que buscas. Puede que la dirección haya cambiado.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link className="button-base button-primary" href="/">
              Volver al inicio
              <Icon name="arrow-right" size={17} />
            </Link>
            <Link className="button-base button-secondary" href="/app/login">
              Ir al acceso
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
