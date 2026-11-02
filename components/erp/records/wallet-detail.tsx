"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import {
  fetchCustomer,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  currencyInputValue,
  MovementTypeBadge,
  SignedMoney,
} from "@/components/erp/records/payment-shared";
import {
  fetchWallet,
  fetchWalletTransactions,
  type CustomerWallet,
  type WalletTransaction,
} from "@/components/erp/records/wallets-api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type WalletDetailData = {
  wallet: CustomerWallet;
  transactions: WalletTransaction[];
  customer: CustomerRecord | null;
};

async function loadWalletDetail(walletId: string): Promise<WalletDetailData> {
  const wallet = await fetchWallet(walletId);
  const [transactions, customer] = await Promise.all([
    fetchWalletTransactions(walletId),
    fetchCustomer(String(wallet.customer_id)).catch(() => null),
  ]);
  return { wallet, transactions, customer };
}

function transactionDescription(transaction: WalletTransaction) {
  if (transaction.description) return transaction.description;
  if (transaction.transaction_type === "deposit") {
    return transaction.payment_id
      ? `Depósito del pago #${transaction.payment_id}`
      : "Depósito recibido";
  }
  return transaction.invoice_id
    ? `Aplicación a la factura #${transaction.invoice_id}`
    : "Aplicación a factura";
}

export function WalletDetailPage({ walletId }: { walletId: string }) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  const saldoBilleteraId = useId();
  const canRead = canReadModule(user.role, "billeteras");
  const canRegisterPayments = canWriteModule(user.role, "pagos");
  const validId = isPositiveRecordId(walletId);
  const loader = useCallback(() => loadWalletDetail(walletId), [walletId]);
  const resource = useAsyncResource(loader, {
    enabled: canRead && validId,
  });
  const reloadDetail = resource.reload;
  const wasVisible = useRef(activityVisible);
  useEffect(() => {
    if (activityVisible && !wasVisible.current) reloadDetail();
    wasVisible.current = activityVisible;
  }, [activityVisible, reloadDetail]);

  if (!activityVisible) return null;

  if (!canRead) {
    return (
      <AccessState description="No tienes permiso para consultar billeteras de clientes." />
    );
  }

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/billeteras"
        backLabel="Volver a billeteras"
        description="Puede que el enlace no sea válido o que la billetera ya no exista."
        headingLevel="h1"
        title="No encontramos esa billetera"
      />
    );
  }

  if (resource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/billeteras"
            >
              Volver a billeteras
            </Link>
          }
          description="Consulta el saldo actual y los movimientos de la billetera. Solo los pagos conciliados generan depósito."
          eyebrow="Finanzas"
          title="Detalle de la billetera"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (resource.status === "error" || !resource.data) {
    const notFound = resource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/billeteras"
        backLabel="Volver a billeteras"
        description={
          notFound
            ? "Puede que no exista o que pertenezca a otro cliente."
            : resource.error?.message ?? "No pudimos cargar la billetera."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={
          notFound
            ? "No encontramos esa billetera"
            : "No pudimos cargar la billetera"
        }
      />
    );
  }

  const { wallet, transactions, customer } = resource.data;
  const currency = wallet.currency;
  const customerName = customer?.fullName ?? `Cliente #${wallet.customer_id}`;
  const movementCountLabel =
    transactions.length === 1
      ? "1 movimiento"
      : `${transactions.length} movimientos`;

  const columns: RecordsTableColumn<WalletTransaction>[] = [
    {
      key: "fecha",
      header: "Fecha",
      className: "whitespace-nowrap",
      render: (transaction) => (
        <span className="tabular-nums text-ink">
          {transaction.created_at
            ? formatDateTime(transaction.created_at)
            : "—"}
        </span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      className: "whitespace-nowrap",
      render: (transaction) => (
        <MovementTypeBadge type={transaction.transaction_type} />
      ),
    },
    {
      key: "descripcion",
      header: "Descripción",
      render: (transaction) => (
        <div className="space-y-1">
          <p className="break-words text-ink">
            {transactionDescription(transaction)}
          </p>
          {transaction.payment_id && (
            <Link
              className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/pagos/${transaction.payment_id}`}
            >
              Ver pago #{transaction.payment_id}
              <Icon name="arrow-up-right" size={12} />
            </Link>
          )}
        </div>
      ),
    },
    {
      key: "monto",
      header: "Monto",
      className: "whitespace-nowrap",
      render: (transaction) => (
        <SignedMoney
          currency={transaction.currency ?? currency}
          value={transaction.amount}
        />
      ),
    },
    {
      key: "saldo",
      header: "Saldo resultante",
      className: "whitespace-nowrap",
      render: (transaction) => (
        <span className="tabular-nums text-ink">
          {formatMoney(transaction.balance_after, transaction.currency ?? currency ?? {})}
        </span>
      ),
    },
  ];

  function renderCard(transaction: WalletTransaction) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <MovementTypeBadge type={transaction.transaction_type} />
          <span className="text-[11px] tabular-nums text-muted">
            {transaction.created_at
              ? formatDateTime(transaction.created_at)
              : "Sin fecha"}
          </span>
        </div>
        <p className="mt-3 break-words text-[13px] text-ink">
          {transactionDescription(transaction)}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Monto
            </dt>
            <dd className="mt-1">
              <SignedMoney
                currency={transaction.currency ?? currency}
                value={transaction.amount}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Saldo resultante
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {formatMoney(
                transaction.balance_after,
                transaction.currency ?? currency ?? {},
              )}
            </dd>
          </div>
        </dl>
        {transaction.payment_id && (
          <Link
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href={`/app/pagos/${transaction.payment_id}`}
          >
            Ver pago #{transaction.payment_id}
            <Icon name="arrow-up-right" size={14} />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canRegisterPayments ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href={`/app/pagos/nuevo?customer_id=${wallet.customer_id}`}
            >
              Registrar pago
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Los depósitos de pagos conciliados suman saldo y los pagos de factura lo descuentan. Cada movimiento conserva el saldo resultante."
        eyebrow="Billetera"
        title={customerName}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href={`/app/billeteras?customer_id=${wallet.customer_id}`}
        >
          Volver a las billeteras del cliente
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      <section
        aria-labelledby={saldoBilleteraId}
        className="relative overflow-hidden rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <div
          aria-hidden="true"
          className="technical-grid absolute inset-0 opacity-40 [mask-image:linear-gradient(120deg,black,transparent_70%)]"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div>
            <span className="eyebrow">Billetera</span>
            <h2
              className="mt-3 text-lg font-semibold tracking-[-0.025em] text-ink"
              id={saldoBilleteraId}
            >
              Saldo actual
            </h2>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {currencyInputValue(currency) || "Moneda de la billetera"}
            </p>
            <p className="mt-1.5 break-words text-4xl font-semibold tracking-[-0.04em] tabular-nums text-ink">
              {formatMoney(wallet.balance, currency ?? {})}
            </p>
            <p className="mt-3 text-[12px] text-muted">
              {currency
                ? `${currency.name} · ${currency.symbol}`
                : "Moneda no disponible"}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <CurrencyChip currency={currency} />
            <p className="text-[12px] text-muted">
              Billetera #{wallet.id} · {movementCountLabel}
            </p>
            <Link
              className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/pagos?customer_id=${wallet.customer_id}&currency_id=${wallet.currency_id}`}
            >
              Ver pagos en esta moneda
              <Icon name="arrow-up-right" size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Movimientos de la billetera" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Historial</span>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink">
              Movimientos
            </h2>
          </div>
          <p aria-live="polite" className="text-[12px] font-semibold text-muted">
            {movementCountLabel}
          </p>
        </div>

        {resource.status === "refreshing" && (
          <div aria-hidden="true" className="reload-bar" />
        )}

        {transactions.length === 0 ? (
          <EmptyState
            description="Los depósitos de pagos conciliados y los pagos de factura aparecerán aquí con su saldo resultante."
            title="Esta billetera no tiene movimientos."
          />
        ) : (
          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <RecordsTable
              caption={`Movimientos de la billetera de ${customerName} en ${currency?.code ?? "su moneda"}`}
              columns={columns}
              getRowKey={(transaction) => String(transaction.id)}
              getRowLabel={(transaction) =>
                transactionDescription(transaction)
              }
              renderCard={renderCard}
              rows={transactions}
            />
          </div>
        )}
      </section>
    </div>
  );
}
