"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { ErpLoading } from "@/components/erp/erp-loading";
import { ErpShell } from "@/components/erp/erp-shell";
import { SessionProvider } from "@/components/erp/session-context";
import { CurrencyStatusProvider } from "@/components/erp/ui/currency-status-context";
import { ToastProvider } from "@/components/erp/ui/toast";
import { ApiError } from "@/lib/api";
import {
  buildLoginUrl,
  clearStoredToken,
  getSessionUser,
  getStoredToken,
  type SessionUser,
} from "@/lib/session";

type SessionState =
  | { status: "loading" }
  | { status: "authenticated"; user: SessionUser }
  | { status: "forbidden" }
  | { status: "error" };

export function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function validateSession() {
      const token = getStoredToken();
      if (!token) {
        const returnPath = `${window.location.pathname}${window.location.search}`;
        router.replace(buildLoginUrl(returnPath));
        return;
      }

      try {
        const user = await getSessionUser(token);
        if (active) setState({ status: "authenticated", user });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          clearStoredToken();
          const returnPath = `${window.location.pathname}${window.location.search}`;
          router.replace(buildLoginUrl(returnPath, "expirada"));
        } else if (
          error instanceof ApiError &&
          error.status === 403 &&
          error.message === "User is blocked"
        ) {
          clearStoredToken();
          router.replace(buildLoginUrl(undefined, "bloqueada"));
        } else if (error instanceof ApiError && error.status === 403) {
          setState({ status: "forbidden" });
        } else {
          setState({ status: "error" });
        }
      }
    }

    validateSession();
    return () => {
      active = false;
    };
  }, [attempt, router]);

  const logout = useCallback(() => {
    clearStoredToken();
    setState({ status: "loading" });
    router.replace(buildLoginUrl(undefined, "cerrada"));
  }, [router]);

  if (state.status === "loading") return <ErpLoading />;

  if (state.status === "forbidden" || state.status === "error") {
    const forbidden = state.status === "forbidden";
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-5" id="contenido">
        <section className="w-full max-w-lg rounded-[28px] border border-line bg-surface p-7 text-center shadow-[0_18px_60px_rgba(27,12,104,0.06)] sm:p-9">
          <div className="flex justify-center"><Brand /></div>
          <span className="mx-auto mt-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-blue text-brand">
            <Icon name={forbidden ? "shield" : "alert"} size={23} />
          </span>
          <h1 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-ink">
            {forbidden ? "Sin permisos" : "No pudimos validar tu sesión"}
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-muted" role={forbidden ? undefined : "alert"}>
            {forbidden
              ? "Tu rol no tiene acceso a la ruta solicitada. Tu sesión sigue activa."
              : "Revisa tu conexión e intenta otra vez. Tu sesión no se ha eliminado."}
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <button
              className="button-base button-primary"
              onClick={() => {
                setState({ status: "loading" });
                setAttempt((current) => current + 1);
              }}
              type="button"
            >
              Reintentar
            </button>
            <button className="button-base button-secondary" onClick={logout} type="button">
              Cerrar sesión
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <SessionProvider logout={logout} user={state.user}>
      <CurrencyStatusProvider>
        <ToastProvider>
          <ErpShell>{children}</ErpShell>
        </ToastProvider>
      </CurrencyStatusProvider>
    </SessionProvider>
  );
}
