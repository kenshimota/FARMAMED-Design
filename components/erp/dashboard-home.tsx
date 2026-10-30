"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { CurrencyStatusPanel } from "@/components/erp/currency-status-panel";
import { DashboardCards } from "@/components/erp/dashboard-cards";
import {
  DashboardQuickActions,
  getPrimaryAction,
} from "@/components/erp/dashboard-quick-actions";
import { LotsExpiryPanel } from "@/components/erp/lots-expiry-panel";
import { PendingPurchasesPanel } from "@/components/erp/pending-purchases-panel";
import { useSession } from "@/components/erp/session-context";
import { StockStatesPanel } from "@/components/erp/stock-states-panel";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { useDashboardData } from "@/components/erp/ui/use-dashboard-data";
import { useToast } from "@/components/erp/ui/toast";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import {
  confirmDraftPurchase,
  type DraftPurchase,
  type SupplierRow,
} from "@/lib/dashboard";
import { PURCHASE_WITHOUT_ITEMS, SUCCESS_MESSAGES } from "@/lib/feedback";
import { formatCurrentDate } from "@/lib/format";
import { canReadModule, canWriteModule, ROLE_LABELS } from "@/lib/permissions";

const PURCHASE_WITHOUT_ITEMS_MESSAGE = "purchase has no items";

function isPurchaseWithoutItems(error: ApiError) {
  return (
    error.status === 422 &&
    error.message.trim().toLowerCase() === PURCHASE_WITHOUT_ITEMS_MESSAGE
  );
}

export function DashboardHome() {
  const { user } = useSession();
  const toast = useToast();
  const data = useDashboardData(user.role);
  const currencyStatus = useCurrencyStatusContext();
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const confirmingRef = useRef(false);

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const primaryAction = getPrimaryAction(user.role);

  const suppliersById = useMemo(() => {
    const map = new Map<number, SupplierRow>();
    for (const supplier of data.suppliers.data ?? []) {
      map.set(supplier.id, supplier);
    }
    return map;
  }, [data.suppliers.data]);

  const currenciesById = useMemo(() => {
    const map = new Map<number, { code: string; symbol: string }>();
    for (const currency of currencyStatus?.currencies ?? []) {
      if (currency.id !== null) {
        map.set(currency.id, { code: currency.code, symbol: currency.symbol });
      }
    }
    return map;
  }, [currencyStatus]);

  async function handleConfirm(purchase: DraftPurchase) {
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirmingId(purchase.id);
    try {
      await confirmDraftPurchase(purchase.id);
      toast.success(SUCCESS_MESSAGES.purchaseConfirmed);
      data.purchases.reload();
      data.stocks.reload();
    } catch (caught) {
      const uiError = translateApiError(caught);
      const message =
        caught instanceof ApiError && isPurchaseWithoutItems(caught)
          ? PURCHASE_WITHOUT_ITEMS
          : uiError.message;
      toast.error(message, {
        retry: uiError.canRetry ? () => void handleConfirm(purchase) : undefined,
      });
      if (caught instanceof ApiError && (caught.status === 404 || caught.status === 409)) {
        data.purchases.reload();
      }
    } finally {
      confirmingRef.current = false;
      setConfirmingId(null);
    }
  }

  const readsPurchases = canReadModule(user.role, "compras");
  const readsStocks = canReadModule(user.role, "existencias");
  const readsLots = canReadModule(user.role, "lotes");
  const readsCurrencies = canReadModule(user.role, "monedas");

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
          <span className="eyebrow">Tu espacio de trabajo</span>
          <h1 className="mt-5 text-balance text-3xl font-semibold leading-tight tracking-[-0.045em] text-ink sm:text-4xl">
            Buenos días, {firstName}.
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-soft-blue px-3.5 py-2 text-[11px] font-semibold text-ink">
              <Icon aria-hidden="true" className="text-brand" name="user" size={14} />
              {ROLE_LABELS[user.role]}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-background px-3.5 py-2 text-[11px] font-semibold text-muted">
              <Icon aria-hidden="true" className="text-muted" name="clock" size={14} />
              {formatCurrentDate()}
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted">
            Este es el estado operativo de tu droguería.
          </p>
          {primaryAction && (
            <Link
              className="button-base button-primary mt-7"
              href={primaryAction.href}
            >
              {primaryAction.label}
              <Icon name="arrow-right" size={17} />
            </Link>
          )}
        </div>
      </section>

      <DashboardCards
        currencies={currencyStatus}
        data={data}
        role={user.role}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {readsPurchases && (
          <PendingPurchasesPanel
            canConfirm={canWriteModule(user.role, "compras")}
            confirmingId={confirmingId}
            currenciesById={currenciesById}
            onConfirm={handleConfirm}
            resource={data.purchases}
            suppliersById={suppliersById}
          />
        )}
        {readsStocks && <StockStatesPanel resource={data.stocks} />}
        {readsLots && (
          <LotsExpiryPanel expiredLots={data.expiredLots} expiringLots={data.expiringLots} />
        )}
        {readsCurrencies && (
          <div className="lg:col-span-2">
            <CurrencyStatusPanel />
          </div>
        )}
      </div>

      <DashboardQuickActions role={user.role} />
    </div>
  );
}
