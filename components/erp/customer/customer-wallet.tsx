"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { CustomerIncompleteContent } from "@/components/erp/customer-incomplete";
import { useSession } from "@/components/erp/session-context";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { LoadingRegion, Skeleton, SkeletonTable } from "@/components/erp/ui/skeleton";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  MovementTypeBadge,
  SignedMoney,
} from "@/components/erp/records/payment-shared";
import {
  fetchWalletTransactions,
  fetchWallets,
  type CustomerWallet,
  type WalletTransaction,
} from "@/components/erp/records/wallets-api";
import {
  CUSTOMER_FINANCE_COPY,
  customerFinanceErrorCopy,
  isOwnCustomerRecord,
} from "@/lib/customer-finance";
import { formatDateTime, formatMoney } from "@/lib/format";

function transactionDescription(transaction: WalletTransaction) {
  if (transaction.description) return transaction.description;
  if (transaction.transaction_type === "deposit") {
    return "Depósito recibido";
  }
  return transaction.invoice_id
    ? `Pago aplicado a la factura #${transaction.invoice_id}`
    : "Pago aplicado a una factura";
}

function transactionTime(transaction: WalletTransaction) {
  return transaction.created_at ? Date.parse(transaction.created_at) : 0;
}

function WalletTransactionsSection({ wallet }: { wallet: CustomerWallet }) {
  const loader = useCallback(
    () => fetchWalletTransactions(String(wallet.id)),
    [wallet.id],
  );
  const resource = useAsyncResource(loader);
  const transactions = useMemo(() => {
    const list = resource.data ?? [];
    return [...list].sort((first, second) => {
      const firstTime = transactionTime(first);
      const secondTime = transactionTime(second);
      if (firstTime !== secondTime) return secondTime - firstTime;
      return Number(second.id) - Number(first.id);
    });
  }, [resource.data]);

  const currency = wallet.currency;
  const errorCopy = resource.error
    ? customerFinanceErrorCopy(resource.error, "wallet")
    : null;
  const countLabel =
    resource.status === "loading" && transactions.length === 0
      ? "Cargando movimientos…"
      : transactions.length === 1
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
          <div className="flex flex-wrap gap-x-4">
            {transaction.payment_id !== null && (
              <Link
                className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href={`/app/pagos/${transaction.payment_id}`}
              >
                Ver pago #{transaction.payment_id}
                <Icon name="arrow-up-right" size={12} />
              </Link>
            )}
            {transaction.invoice_id !== null && (
              <Link
                className="inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href={`/app/facturas/${transaction.invoice_id}`}
              >
                Ver factura #{transaction.invoice_id}
                <Icon name="arrow-up-right" size={12} />
              </Link>
            )}
          </div>
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
          {formatMoney(
            transaction.balance_after,
            transaction.currency ?? currency ?? {},
          )}
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
        <div className="mt-3 flex flex-wrap gap-x-4">
          {transaction.payment_id !== null && (
            <Link
              className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/pagos/${transaction.payment_id}`}
            >
              Ver pago #{transaction.payment_id}
              <Icon name="arrow-up-right" size={14} />
            </Link>
          )}
          {transaction.invoice_id !== null && (
            <Link
              className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/facturas/${transaction.invoice_id}`}
            >
              Ver factura #{transaction.invoice_id}
              <Icon name="arrow-up-right" size={14} />
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="movimientos-billetera-titulo"
      className="space-y-4"
      id="movimientos-billetera"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Historial</span>
          <h2
            className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="movimientos-billetera-titulo"
          >
            Movimientos
          </h2>
          <p className="mt-1 text-[12px] text-muted">
            Billetera en {currency?.code ?? "moneda no disponible"}
          </p>
        </div>
        <p aria-live="polite" className="text-[12px] font-semibold text-muted">
          {countLabel}
        </p>
      </div>

      {resource.status === "refreshing" && (
        <div aria-hidden="true" className="reload-bar" />
      )}

      {resource.status === "loading" && transactions.length === 0 ? (
        <div role="status">
          <span className="sr-only">Cargando movimientos…</span>
          <div className="rounded-[24px] border border-line bg-surface p-5">
            <SkeletonTable columns={5} rows={4} />
          </div>
        </div>
      ) : resource.status === "error" && transactions.length === 0 ? (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={errorCopy?.description ?? CUSTOMER_FINANCE_COPY.genericHelp}
          onRetry={errorCopy?.canRetry ? resource.reload : undefined}
          title={errorCopy?.title ?? CUSTOMER_FINANCE_COPY.genericTitle}
        />
      ) : transactions.length === 0 ? (
        <EmptyState
          description="Los depósitos de pagos conciliados y los pagos de factura aparecerán aquí con su saldo resultante."
          title="Aún no hay movimientos en tu billetera."
        />
      ) : (
        <>
          {resource.status === "error" && errorCopy && (
            <NoticeBanner
              action={
                errorCopy.canRetry ? (
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={resource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                ) : undefined
              }
              tone="warning"
            >
              {errorCopy.description}
            </NoticeBanner>
          )}
          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <RecordsTable
              caption={`Movimientos de tu billetera en ${
                currency?.code ?? "la moneda disponible"
              }`}
              columns={columns}
              getRowKey={(transaction) => String(transaction.id)}
              getRowLabel={(transaction) =>
                transactionDescription(transaction)
              }
              renderCard={renderCard}
              rows={transactions}
            />
          </div>
        </>
      )}
    </section>
  );
}

export function CustomerWalletPage() {
  const { user } = useSession();
  const customerId = user.customer_id;
  const isCustomer = user.role === "customer";
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);

  const loader = useCallback(async () => {
    if (!isCustomer || customerId === null) return [];
    const wallets = await fetchWallets(String(customerId));
    return wallets.filter((wallet) =>
      isOwnCustomerRecord(wallet.customer_id, customerId),
    );
  }, [customerId, isCustomer]);

  const resource = useAsyncResource(loader, {
    enabled: isCustomer && customerId !== null,
  });
  const listErrorCopy = resource.error
    ? customerFinanceErrorCopy(resource.error, "wallet")
    : null;

  if (!isCustomer) {
    return (
      <AccessState description="Esta sección pertenece al portal del cliente. Usa la navegación del ERP para continuar." />
    );
  }

  if (customerId === null) {
    return <CustomerIncompleteContent reason="vinculo" />;
  }

  const wallets = resource.data ?? [];
  const activeWallet =
    wallets.find((wallet) => String(wallet.id) === selectedWalletId) ??
    wallets[0] ??
    null;
  const totalLabel =
    wallets.length === 1 ? "1 billetera" : `${wallets.length} billeteras`;

  if (resource.status === "loading" && resource.data === null) {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          description="Consulta el saldo disponible por moneda y los movimientos de tu billetera. El saldo se acredita cuando un pago se concilia."
          eyebrow="Mi billetera"
          title="Mi billetera"
        />
        <LoadingRegion label="Cargando tu billetera…">
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 2 }, (_, index) => (
              <li
                className="rounded-[24px] border border-line bg-surface p-5"
                key={index}
              >
                <Skeleton className="h-5 w-24" />
                <Skeleton className="mt-5 h-3 w-28" />
                <Skeleton className="mt-2 h-8 w-40" />
                <Skeleton className="mt-6 h-11 w-full" />
              </li>
            ))}
          </ul>
        </LoadingRegion>
      </div>
    );
  }

  if (resource.status === "error" && resource.data === null) {
    const copy = customerFinanceErrorCopy(resource.error, "wallet");
    return (
      <RecordsLoadError
        backHref="/app"
        backLabel="Volver al inicio"
        description={copy.description}
        headingLevel="h1"
        onRetry={copy.canRetry ? resource.reload : undefined}
        title={copy.title}
      />
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/mis-pedidos"
          >
            Ver mis pedidos
            <Icon name="arrow-right" size={16} />
          </Link>
        }
        description="Este saldo es informativo. Solo los pagos conciliados generan un depósito. No puedes registrar pagos ni aplicar saldo desde el portal del cliente."
        eyebrow="Mi billetera"
        title="Mi billetera"
      >
        <p className="text-[12px] font-semibold text-muted">{totalLabel}</p>
      </RecordsPageHeader>

      {resource.status === "refreshing" && (
        <div aria-hidden="true" className="reload-bar" />
      )}

      {resource.status === "error" && resource.data !== null && (
        <NoticeBanner
          action={
            listErrorCopy?.canRetry ? (
              <button
                className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                onClick={resource.reload}
                type="button"
              >
                Reintentar
              </button>
            ) : undefined
          }
          tone="warning"
        >
          No pudimos actualizar tu billetera. Mostramos los datos disponibles.
        </NoticeBanner>
      )}

      {wallets.length === 0 ? (
        <EmptyState
          description="Cuando se concilie un pago o se aplique un pago a una factura, tu saldo aparecerá aquí por moneda."
          headingLevel={2}
          title="Aún no tienes una billetera."
        />
      ) : (
        <>
          <section aria-labelledby="saldos-billetera" className="space-y-4">
            <div>
              <span className="eyebrow">Saldos</span>
              <h2
                className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink"
                id="saldos-billetera"
              >
                Saldo por moneda
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {wallets.map((wallet) => {
                const active =
                  activeWallet !== null &&
                  String(activeWallet.id) === String(wallet.id);
                return (
                  <li
                    className={`flex flex-col rounded-[24px] border bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] ${
                      active ? "border-brand/35" : "border-line"
                    }`}
                    key={String(wallet.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CurrencyChip currency={wallet.currency} />
                      {active && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-soft-blue px-2.5 py-1 text-[10px] font-semibold text-brand">
                          <Icon aria-hidden="true" name="eye" size={12} />
                          Viendo movimientos
                        </span>
                      )}
                    </div>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Saldo disponible
                    </p>
                    <p className="mt-1.5 break-words text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink">
                      {formatMoney(wallet.balance, wallet.currency ?? {})}
                    </p>
                    <p className="mt-2 text-[12px] text-muted">
                      {wallet.currency
                        ? `${wallet.currency.name} · ${wallet.currency.symbol}`
                        : "Moneda no disponible"}
                    </p>
                    <button
                      aria-pressed={active}
                      className={`button-base mt-5 min-h-11 w-full px-4 text-[13px] ${
                        active ? "button-secondary" : "button-primary"
                      }`}
                      onClick={() => setSelectedWalletId(String(wallet.id))}
                      type="button"
                    >
                      Ver movimientos
                      <Icon name="arrow-right" size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {activeWallet && (
            <WalletTransactionsSection
              key={String(activeWallet.id)}
              wallet={activeWallet}
            />
          )}
        </>
      )}
    </div>
  );
}
