"use client";

import Link from "next/link";
import { useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { NoticeBanner } from "@/components/erp/ui/banner";
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
      <p className="mb-6 text-[12px] text-muted" role="status">
        Consultando el registro inicial…
      </p>
    );
  }

  if (resource.status === "error") {
    return (
      <p className="mb-6 text-[12px] leading-5 text-muted" role="alert">
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
    <NoticeBanner className="mb-6" role="status" tone="info">
      El sistema aún no tiene administrador.{" "}
      <Link
        className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
        href="/app/setup-admin"
      >
        Configura la cuenta inicial.
      </Link>
    </NoticeBanner>
  );
}
