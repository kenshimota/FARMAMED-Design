"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { apiFetch } from "@/lib/api";

type SetupState =
  | { status: "loading" }
  | { status: "ready"; hasAdmin: boolean }
  | { status: "error" };

export function SetupStatus() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SetupState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function checkSetupStatus() {
      try {
        const payload = await apiFetch<unknown>("/auth/setup-status");
        const hasAdmin =
          typeof payload === "object" && payload !== null && "hasAdmin" in payload
            ? payload.hasAdmin
            : undefined;
        if (typeof hasAdmin !== "boolean") throw new Error("Respuesta inválida");
        if (active) setState({ status: "ready", hasAdmin });
      } catch {
        if (active) setState({ status: "error" });
      }
    }

    checkSetupStatus();
    return () => {
      active = false;
    };
  }, [attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  if (state.status === "loading") {
    return (
      <div className="rounded-2xl border border-line bg-background p-5" role="status">
        <div className="h-3 w-28 rounded-full bg-line" />
        <div className="mt-3 h-3 w-full rounded-full bg-line" />
        <p className="mt-4 text-[13px] font-medium text-muted">Consultando disponibilidad…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-2xl border border-[#c1272d]/25 bg-[#c1272d]/[0.05] p-5" role="alert">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 shrink-0 text-[#8f1d22]" name="alert" size={20} />
          <div>
            <h2 className="text-sm font-semibold text-ink">No pudimos consultar el estado</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">Revisa tu conexión e intenta otra vez. No se ha enviado ningún registro.</p>
          </div>
        </div>
        <button className="button-base button-secondary mt-5 min-h-11 px-5" onClick={retry} type="button">
          Reintentar
        </button>
      </div>
    );
  }

  const available = !state.hasAdmin;
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
