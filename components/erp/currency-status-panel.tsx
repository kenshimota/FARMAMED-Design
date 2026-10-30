"use client";

import Link from "next/link";
import { useSession } from "@/components/erp/session-context";
import { Icon } from "@/components/icons";
import { PanelError } from "@/components/erp/ui/panel-error";
import { SkeletonPanel } from "@/components/erp/ui/skeleton";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { CURRENCY_NOT_CONFIGURED_DETAIL } from "@/lib/feedback";
import { formatRate } from "@/lib/format";

export function CurrencyStatusPanel() {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();

  if (!currencyStatus || currencyStatus.status === "idle") return null;

  return (
    <section
      aria-labelledby="titulo-moneda-transacciones"
      className="rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-8"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Configuración</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="titulo-moneda-transacciones"
          >
            Moneda de transacciones
          </h2>
        </div>
        {user.role === "admin" && (
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href="/app/monedas"
          >
            Administrar monedas
            <Icon name="arrow-right" size={15} />
          </Link>
        )}
      </div>

      <div className="mt-5">
        {currencyStatus.status === "loading" || currencyStatus.status === "refreshing" ? (
          <SkeletonPanel lines={2} />
        ) : currencyStatus.status === "error" ? (
          currencyStatus.errorKind === "currency" ? (
            <NoticeBanner
              action={
                currencyStatus.canRetry ? (
                  <button
                    className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                    onClick={currencyStatus.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                ) : undefined
              }
              role="status"
              tone="warning"
            >
              {CURRENCY_NOT_CONFIGURED_DETAIL}
            </NoticeBanner>
          ) : (
            <PanelError
              description={currencyStatus.errorMessage ?? "No pudimos cargar esta sección."}
              onRetry={currencyStatus.canRetry ? currencyStatus.reload : undefined}
            />
          )
        ) : currencyStatus.defaultCurrency ? (
          <dl className="grid gap-4 rounded-2xl border border-line bg-background px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Nombre
              </dt>
              <dd className="mt-1 text-[14px] font-semibold text-ink">
                {currencyStatus.defaultCurrency.name}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Código
              </dt>
              <dd className="mt-1 text-[14px] font-semibold text-ink">
                {currencyStatus.defaultCurrency.code}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Símbolo
              </dt>
              <dd className="mt-1 text-[14px] font-semibold text-ink">
                {currencyStatus.defaultCurrency.symbol || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                Tasa
              </dt>
              <dd className="mt-1 text-[14px] font-semibold text-ink">
                {currencyStatus.defaultCurrency.rate === null
                  ? "—"
                  : formatRate(currencyStatus.defaultCurrency.rate)}
              </dd>
            </div>
          </dl>
        ) : (
          <NoticeBanner role="status" tone="warning">
            {CURRENCY_NOT_CONFIGURED_DETAIL}
          </NoticeBanner>
        )}
      </div>
    </section>
  );
}
