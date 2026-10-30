"use client";

import Link from "next/link";
import { useState } from "react";
import { Brand } from "./brand";
import { Icon } from "./icons";

const navigation = [
  { label: "La plataforma", href: "#producto" },
  { label: "Módulos", href: "#modulos" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Beneficios", href: "#beneficios" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-ink/[0.07] bg-background/90 backdrop-blur-xl">
      <div className="section-shell relative flex h-[78px] items-center justify-between gap-6">
        <a
          aria-label="Farmamed ERP, ir al inicio"
          href="#inicio"
          onClick={() => setOpen(false)}
        >
          <Brand priority />
        </a>

        <nav aria-label="Navegación principal" className="hidden items-center gap-7 lg:flex">
          {navigation.map((item) => (
            <a
              className="text-[13px] font-medium text-ink/65 transition-colors hover:text-brand"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <Link
          className="hidden text-[13px] font-medium text-ink/65 transition-colors hover:text-brand md:inline-flex"
          href="/app/login"
        >
          Iniciar sesión
        </Link>

        <a className="button-base button-primary !min-h-[42px] !px-5 !text-[12px] max-md:!hidden md:inline-flex" href="#producto">
          Explorar plataforma
          <Icon name="arrow-up-right" size={15} />
        </a>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-white text-ink md:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <Icon name={open ? "close" : "menu"} size={21} />
        </button>

        {open ? (
          <nav
            aria-label="Navegación móvil"
            className="absolute left-5 right-5 top-[70px] rounded-2xl border border-ink/10 bg-white p-3 shadow-2xl shadow-ink/10 md:hidden"
            id="mobile-navigation"
          >
            {navigation.map((item) => (
              <a
                className="flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-soft-blue hover:text-brand"
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
                <Icon name="arrow-right" size={17} />
              </a>
            ))}
            <div aria-hidden="true" className="my-2 h-px bg-ink/10" />
            <Link
              className="flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-medium text-ink transition-colors hover:bg-soft-blue hover:text-brand"
              href="/app/login"
              onClick={() => setOpen(false)}
            >
              Iniciar sesión
              <Icon name="arrow-right" size={17} />
            </Link>
          </nav>
        ) : null}
      </div>
    </header>
  );
}
