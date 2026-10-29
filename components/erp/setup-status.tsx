"use client";

import { useCallback } from "react";
import { Icon } from "@/components/icons";
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

export function SetupStatus() {
  const loader = useCallback(() => fetchSetupStatus(), []);
  const resource = useAsyncResource(loader);

  if (resource.status === "loading" || resource.status === "refreshing") {
    return (
      <LoadingRegion label="Consultando disponibilidad…">
        <div className="rounded-2xl border border-line bg-background p-5">
          <SkeletonText lines={2} />
          <p className="mt-4 text-[13px] font-medium text-muted">Consultando disponibilidad…</p>
        </div>
      </LoadingRegion>
    );
  }

  if (resource.status === "error" || !resource.data) {
    return (
      <PanelError
        description={`${resource.error?.message ?? "No pudimos consultar el estado."} No se ha enviado ningún registro.`}
        onRetry={resource.reload}
        title="No pudimos consultar el estado"
      />
    );
  }

  const available = !resource.data.hasAdmin;
  return (
    <div className={`rounded-2xl border p-5 ${available ? "border-olive/30 bg-soft-lime" : "border-brand/20 bg-soft-blue"}`} role="status">
      <div className="flex items-start gap-3">
        <Icon className={available ? "mt-0.5 shrink-0 text-olive" : "mt-0.5 shrink-0 text-brand"} name={available ? "check" : "shield"} size={21} />
        <div>
          <h2 className="text-sm font-semibold text-ink">
            {available ? "Registro inicial disponible" : "El registro inicial ya no está disponible"}
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            {available
              ? "Todavía no hay un administrador registrado. El formulario de registro se incorporará en una próxima etapa."
              : "Ya existe un administrador registrado. Inicia sesión con tu cuenta o contacta a un administrador."}
          </p>
        </div>
      </div>
    </div>
  );
}
