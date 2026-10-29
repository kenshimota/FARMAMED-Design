import type { Metadata } from "next";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/erp/login-form";
import { LoginScene } from "@/components/erp/login-scene";
import { SetupAdminLink } from "@/components/erp/setup-admin-link";

export const metadata: Metadata = { title: "Inicia sesión" };

// El segmento lee searchParams y puede bloquear la navegación; se exceptúa de la validación instantánea.
export const instant = false;

export default async function LoginPage(props: PageProps<"/app/login">) {
  const searchParams = await props.searchParams;
  const aviso = typeof searchParams.aviso === "string" ? searchParams.aviso : null;
  const retorno = typeof searchParams.retorno === "string" ? searchParams.retorno : null;

  return (
    <div className="grid min-h-screen bg-surface md:grid-cols-2">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <header className="relative flex flex-col overflow-hidden bg-ink px-5 py-6 sm:px-8 md:min-h-screen md:px-10 md:py-10">
        <div aria-hidden="true" className="technical-grid absolute inset-0 opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div aria-hidden="true" className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-lime/15 blur-[90px]" />
        <div aria-hidden="true" className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-cyan/10 blur-[100px]" />

        <Link
          aria-label="Farmamed ERP, volver al sitio público"
          className="relative z-10 self-start rounded-lg"
          href="/"
        >
          <Brand inverse priority />
        </Link>

        <p className="relative z-10 mt-6 hidden text-balance text-2xl font-semibold leading-tight tracking-[-0.04em] text-white md:block lg:mt-10 lg:text-4xl">
          Toda tu droguería.
          <span className="mt-1 block text-lime">Una sola fórmula.</span>
        </p>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
          <LoginScene />
        </div>
      </header>

      <main
        className="flex items-center px-5 py-10 outline-none sm:px-8 md:min-h-screen"
        id="contenido"
        tabIndex={-1}
      >
        <div className="mx-auto w-full max-w-[420px]">
          <h1 className="text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-4xl">
            Inicia sesión
          </h1>
          <p className="mt-3 text-[14px] leading-6 text-muted">
            Usa tu correo o tu nombre de usuario.
          </p>

          <div className="mt-8">
            <SetupAdminLink />
            <LoginForm aviso={aviso} retorno={retorno} />
          </div>
        </div>
      </main>
    </div>
  );
}
