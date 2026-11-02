"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { PanelError } from "@/components/erp/ui/panel-error";
import { Skeleton } from "@/components/erp/ui/skeleton";
import { useSession } from "@/components/erp/session-context";
import { CustomerIncompleteContent } from "@/components/erp/customer-incomplete";
import {
  fetchOrders,
  type OrderRecord,
} from "@/components/erp/records/orders-api";
import {
  OrderStatusBadge,
  orderMoney,
  orderNumberLabel,
} from "@/components/erp/records/orders-shared";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { getCustomerAccessIssue } from "@/lib/customer";
import { formatDateOnly } from "@/lib/format";
import {
  buildLoginUrl,
  clearStoredToken,
  getCurrentReturnPath,
  sessionDisplayName,
} from "@/lib/session";

type OrdersState =
  | { status: "loading" }
  | { status: "ready"; orders: OrderRecord[] }
  | { status: "error"; error: unknown };

function StoreAction({ variant = "primary" }: { variant?: "primary" | "secondary" }) {
  return (
    <Link
      className={`button-base ${variant === "primary" ? "button-primary" : "button-secondary"}`}
      href="/app/tienda"
    >
      Ver la tienda
      <Icon name="arrow-right" size={17} />
    </Link>
  );
}

function CustomerHomeLoading() {
  return (
    <div aria-busy="true" className="space-y-6" role="status">
      <span className="sr-only">Cargando tu tienda…</span>
      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
        Inicio de tienda
      </h1>
      <section className="rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9 lg:p-11">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-6 h-9 w-64 max-w-full" />
        <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <Skeleton className="mt-8 h-12 w-40 rounded-full" />
      </section>
      <section className="rounded-[28px] border border-line bg-surface p-6 sm:p-8">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-5 h-7 w-48 max-w-full" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="mt-3 h-4 w-2/3" />
      </section>
    </div>
  );
}

function orderErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.isUserBlocked()) {
      return {
        title: "Tu cuenta está bloqueada.",
        description: "Contacta al administrador.",
        canRetry: false,
      };
    }
    if (error.status === 503) {
      return {
        title: "La tienda no está disponible en este momento.",
        description: "Intenta de nuevo más tarde.",
        canRetry: true,
      };
    }
    if (error.status === 403) {
      return {
        title: "No pudimos habilitar la tienda de tu cuenta.",
        description: "Contacta al administrador para revisar el acceso de tu cuenta.",
        canRetry: false,
      };
    }
  }

  const translated = translateApiError(error);
  return {
    title: "No pudimos cargar tu cuenta.",
    description: translated.message,
    canRetry: translated.canRetry,
  };
}

export function CustomerHome() {
  const { user } = useSession();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OrdersState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function loadOrders() {
      try {
        const orders = await fetchOrders();
        if (active) setState({ status: "ready", orders });
      } catch (error) {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          clearStoredToken();
          window.location.replace(
            buildLoginUrl(getCurrentReturnPath(), "expirada"),
          );
          return;
        }
        if (error instanceof ApiError && error.isUserBlocked()) {
          clearStoredToken();
          window.location.replace(
            buildLoginUrl(getCurrentReturnPath(), "bloqueada"),
          );
          return;
        }
        setState({ status: "error", error });
      }
    }

    void loadOrders();
    return () => {
      active = false;
    };
  }, [attempt]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }

  if (state.status === "loading") return <CustomerHomeLoading />;

  if (state.status === "error") {
    const issue = getCustomerAccessIssue(state.error);
    if (issue) return <CustomerIncompleteContent reason={issue} />;

    const copy = orderErrorCopy(state.error);
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">
          Inicio de tienda
        </h1>
        <PanelError
          description={copy.description}
          onRetry={copy.canRetry ? retry : undefined}
          title={copy.title}
        />
      </div>
    );
  }

  const displayName = sessionDisplayName(user);
  const firstName = displayName.trim().split(/\s+/)[0] || displayName;
  const latestOrder = state.orders[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9 lg:p-11">
        <div
          aria-hidden="true"
          className="technical-grid absolute inset-0 opacity-60 [mask-image:linear-gradient(120deg,black,transparent_65%)]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[52px] border-lime/10"
        />
        <div className="relative max-w-3xl">
          <span className="eyebrow">Tu tienda</span>
          <h1 className="mt-5 text-balance text-3xl font-semibold leading-tight tracking-[-0.045em] text-ink sm:text-4xl">
            Hola, {firstName}.
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">
            Tu cuenta está vinculada. Aquí verás el estado de tu tienda y tu
            actividad reciente.
          </p>
          <div className="mt-7">
            <StoreAction />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="titulo-mi-pedido"
        className="rounded-[28px] border border-line bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-8"
      >
        <span className="eyebrow">Actividad reciente</span>
        <h2
          className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-ink"
          id="titulo-mi-pedido"
        >
          Mi pedido
        </h2>

        {latestOrder ? (
          <article className="mt-6 rounded-2xl border border-line bg-background p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  Más reciente
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-ink">
                  {orderNumberLabel(latestOrder.number)}
                </h3>
              </div>
              <OrderStatusBadge status={latestOrder.status} />
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[12px] font-medium text-muted">Fecha</dt>
                <dd className="mt-1 text-[14px] font-semibold text-ink">
                  {latestOrder.createdAt
                    ? formatDateOnly(latestOrder.createdAt)
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium text-muted">Total</dt>
                <dd className="mt-1 text-[14px] font-semibold text-ink">
                  {orderMoney(latestOrder.total, latestOrder.currency)}
                </dd>
              </div>
            </dl>
          </article>
        ) : (
          <div className="mt-6">
            <EmptyState
              action={<StoreAction variant="secondary" />}
              description="Cuando realices tu primer pedido, aparecerá aquí."
              headingLevel={3}
              title="Aún no tienes pedidos."
            />
          </div>
        )}
      </section>
    </div>
  );
}
