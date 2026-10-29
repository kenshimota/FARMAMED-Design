import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/brand";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <a className="fixed left-4 top-3 z-50 -translate-y-24 rounded-lg bg-ink px-4 py-3 text-[13px] font-semibold text-white shadow-lg transition-transform focus:translate-y-0 motion-reduce:transition-none" href="#contenido">
        Saltar al contenido
      </a>
      <div aria-hidden="true" className="technical-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
      <div aria-hidden="true" className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-lime/10 blur-[90px]" />
      <div aria-hidden="true" className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan/[0.07] blur-[100px]" />
      <header className="relative border-b border-ink/[0.06] bg-surface/70 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link aria-label="Farmamed ERP, volver al sitio público" className="rounded-lg" href="/"><Brand priority /></Link>
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-muted sm:block">Gestión para droguerías</span>
        </div>
      </header>
      <main className="relative mx-auto flex min-h-[calc(100vh-81px)] w-full max-w-6xl items-center justify-center px-4 py-10 outline-none sm:px-8 sm:py-14" id="contenido" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
