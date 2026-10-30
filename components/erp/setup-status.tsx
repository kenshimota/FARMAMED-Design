"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Icon } from "@/components/icons";
import { SetupAdminForm } from "@/components/erp/setup-admin-form";
import { apiFetch } from "@/lib/api";
import { PanelError } from "@/components/erp/ui/panel-error";
import { LoadingRegion, SkeletonText } from "@/components/erp/ui/skeleton";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";

async function fetchSetupStatus() {
  const payload = await apiFetch<unknown>("/auth/setup-status");
  const hasAdmin =
    typeof payload === "object" && payload !== null && "hasAdmin" in payload
      ? (payload as { hasAdmin?: unknown }).hasAdmin
      : undefined;
  if (typeof hasAdmin !== "boolean") throw new Error("Respuesta inválida");
  return { hasAdmin };
}

function LoginLink() {
  return (
    <Link
      className="mt-3 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
      href="/app/login"
    >
      Inicia sesión
      <Icon name="arrow-right" size={16} />
    </Link>
  );
}

export function SetupStatus() {
  const loader = useCallback(() => fetchSetupStatus(), []);
  const resource = useAsyncResource(loader);

  if (resource.status === "loading" || resource.status === "refreshing") {
    return (
      <LoadingRegion label="Consultando disponibilidad…">
        <div className="rounded-2xl border border-line bg-background p-5">
          <SkeletonText lines={2} />
          <p className="mt-4 text-[13px] font-medium text-muted">Consultando disponibilidad…</p>
          <LoginLink />
        </div>
      </LoadingRegion>
    );
  }

  if (resource.status === "error" || !resource.data) {
    return (
      <div>
        <PanelError
          description={`${resource.error?.message ?? "No pudimos consultar el estado."} No se ha enviado ningún registro.`}
          onRetry={resource.error?.canRetry ? resource.reload : undefined}
          title="No pudimos consultar el estado"
        />
        <LoginLink />
      </div>
    );
  }

  if (resource.data.hasAdmin) {
    return (
      <div className="rounded-2xl border border-brand/20 bg-soft-blue p-5" role="status">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 shrink-0 text-brand" name="shield" size={21} />
          <div>
            <h2 className="text-sm font-semibold text-ink">El sistema ya tiene un administrador</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              No es posible crear otra cuenta inicial.
            </p>
            <LoginLink />
          </div>
        </div>
      </div>
    );
  }

  return <SetupAdminForm />;
}
