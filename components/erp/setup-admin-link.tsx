"use client";

import Link from "next/link";
import { useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";

async function fetchSetupAvailability() {
  const payload = await apiFetch<unknown>("/auth/setup-status");
  const hasAdmin =
    typeof payload === "object" && payload !== null && "hasAdmin" in payload
      ? (payload as { hasAdmin?: unknown }).hasAdmin
      : undefined;
  if (typeof hasAdmin !== "boolean") throw new Error("Respuesta inválida");
  return !hasAdmin;
}

export function SetupAdminLink() {
  const loader = useCallback(() => fetchSetupAvailability(), []);
  const resource = useAsyncResource(loader);

  if (resource.status === "loading" || resource.status === "refreshing") {
    return (
      <p className="mt-4 text-center text-[12px] text-muted" role="status">
        Consultando el registro inicial…
      </p>
    );
  }

  if (resource.status === "error") {
    return (
      <p className="mt-4 text-center text-[12px] leading-5 text-muted" role="alert">
        {resource.error?.message ?? "No pudimos consultar la disponibilidad del registro inicial."}{" "}
        {resource.error?.canRetry && (
          <button
            className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            onClick={resource.reload}
            type="button"
          >
            Reintentar
          </button>
        )}
      </p>
    );
  }

  if (!resource.data) return null;

  return (
    <p className="mt-5 border-t border-line pt-5 text-center text-[12px] leading-5 text-muted">
      ¿Es la primera vez que usas Farmamed?{" "}
      <Link className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline" href="/app/setup-admin">
        Configurar administrador inicial
      </Link>
    </p>
  );
}
