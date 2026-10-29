"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export function SetupAdminLink() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAvailability() {
      try {
        const payload = await apiFetch<unknown>("/auth/setup-status");
        const hasAdmin =
          typeof payload === "object" && payload !== null && "hasAdmin" in payload
            ? payload.hasAdmin
            : undefined;
        if (typeof hasAdmin !== "boolean") throw new Error("Respuesta inválida");
        if (active) setAvailable(!hasAdmin);
      } catch {
        if (active) setFailed(true);
      }
    }

    checkAvailability();
    return () => {
      active = false;
    };
  }, []);

  if (failed) {
    return (
      <p className="mt-4 text-center text-[12px] leading-5 text-muted">
        No pudimos consultar la disponibilidad del registro inicial.
      </p>
    );
  }

  if (available === null) {
    return (
      <p className="mt-4 text-center text-[12px] text-muted" role="status">
        Consultando el registro inicial…
      </p>
    );
  }

  if (!available) return null;

  return (
    <p className="mt-5 border-t border-line pt-5 text-center text-[12px] leading-5 text-muted">
      ¿Es la primera vez que usas Farmamed?{" "}
      <Link className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline" href="/app/setup-admin">
        Configurar administrador inicial
      </Link>
    </p>
  );
}
