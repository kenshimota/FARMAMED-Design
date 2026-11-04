"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Icon } from "@/components/icons";
import { CustomerIncompleteContent } from "@/components/erp/customer-incomplete";
import { useSession } from "@/components/erp/session-context";
import { InvoicePdfAction } from "@/components/erp/records/document-actions";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { SkeletonTable } from "@/components/erp/ui/skeleton";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { InvoiceLinesSection } from "@/components/erp/records/invoice-lines";
import {
  InvoiceStatusBadge,
  invoiceDateLabel,
  invoiceDateTimeLabel,
  invoiceMoney,
  invoiceNumberLabel,
  invoicePaymentMethodLabel,
  invoicePaymentTermDetail,
  invoicePaymentTermLabel,
} from "@/components/erp/records/invoice-shared";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import {
  CUSTOMER_FINANCE_COPY,
  customerFinanceErrorCopy,
  isInvoiceOverdue,
  isOwnCustomerRecord,
} from "@/lib/customer-finance";
import {
  fetchInvoice,
  fetchInvoicePayments,
  type Invoice,
  type InvoicePaymentAllocation,
} from "@/lib/finance/invoices-api";
import { formatInteger, formatRate } from "@/lib/format";

function CustomerInvoiceHistory({
  invoice,
  allocations,
  loading,
  errorTitle,
  errorMessage,
  onRetry,
}: {
  invoice: Invoice;
  allocations: readonly InvoicePaymentAllocation[];
  loading: boolean;
  errorTitle: string | null;
  errorMessage: string | null;
  onRetry?: () => void;
}) {
  const count = allocations.length;
  const historyCount = count > 0 ? count : invoice.paymentsCount;
  const countLabel =
    loading && count === 0
      ? "Cargando pagos…"
      : historyCount === 1
        ? "1 pago"
        : `${formatInteger(historyCount)} pagos`;
  const hasError = Boolean(errorTitle || errorMessage);

  function retryAction() {
    if (!onRetry) return undefined;
    return (
      <button
        className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
        onClick={onRetry}
        type="button"
      >
        Reintentar
      </button>
    );
  }

  function renderCard(allocation: InvoicePaymentAllocation) {
    return (
      <div>
        <p className="text-[15px] font-semibold text-ink">
          {invoicePaymentMethodLabel(allocation)}
        </p>
        <p className="mt-1 text-[12px] text-muted">
          {allocation.allocatedAt
            ? `Aplicado el ${invoiceDateTimeLabel(allocation.allocatedAt)}`
            : "Sin fecha de aplicación"}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Monto
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {invoiceMoney(
                allocation.amount,
                allocation.currency ?? invoice.currency,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Monto aplicado
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {invoiceMoney(allocation.appliedAmount, invoice.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1">
              <CurrencyChip currency={allocation.currency ?? invoice.currency} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Tasa aplicada
            </dt>
            <dd className="mt-1 font-mono tabular-nums text-ink">
              {formatRate(allocation.exchangeRate)}
            </dd>
          </div>
        </dl>
        <Link
          className="mt-3 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href={`/app/pagos/${allocation.paymentId}`}
        >
          Ver pago #{allocation.paymentId}
          <Icon aria-hidden="true" name="arrow-up-right" size={14} />
        </Link>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="historial-pagos-titulo"
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      id="historial-pagos"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Pagos</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="historial-pagos-titulo"
          >
            Historial de pagos
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            Pagos que se aplicaron a esta factura. No se registran pagos desde
            esta pantalla.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
          {countLabel}
        </span>
      </div>

      {loading && count === 0 ? (
        <div className="mt-5" role="status">
          <span className="sr-only">Cargando pagos aplicados…</span>
          <SkeletonTable columns={6} rows={3} />
        </div>
      ) : hasError && count === 0 ? (
        <div className="mt-5">
          <NoticeBanner action={retryAction()} title={errorTitle ?? undefined} tone="warning">
            {errorMessage ?? "No pudimos cargar el historial de pagos de esta factura."}
          </NoticeBanner>
        </div>
      ) : count === 0 ? (
        <div className="mt-5">
          <EmptyState
            description="Cuando se aplique un pago a esta factura aparecerá aquí con su método, monto y fecha."
            title="Esta factura no tiene pagos aplicados."
          />
        </div>
      ) : (
        <div className="mt-5">
          {hasError && (
            <NoticeBanner
              action={retryAction()}
              className="mb-3"
              title={errorTitle ?? undefined}
              tone="warning"
            >
              {errorMessage ?? "No pudimos actualizar el historial de pagos."}
            </NoticeBanner>
          )}

          <div className="hidden lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                Pagos aplicados a la factura con método, monto, moneda, monto
                aplicado, tasa y fecha
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th
                    className="w-[24%] pb-2 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Método
                  </th>
                  <th
                    className="w-[18%] pb-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Monto
                  </th>
                  <th
                    className="w-[10%] pb-2 pr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Moneda
                  </th>
                  <th
                    className="w-[18%] pb-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Monto aplicado
                  </th>
                  <th
                    className="w-[10%] pb-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Tasa
                  </th>
                  <th
                    className="w-[20%] pb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((allocation) => (
                  <tr
                    className="border-b border-line align-top last:border-b-0"
                    key={String(allocation.id)}
                  >
                    <td className="py-3 pr-2 text-[12px] text-ink">
                      <span className="block break-words font-semibold">
                        {invoicePaymentMethodLabel(allocation)}
                      </span>
                      <Link
                        className="mt-1 inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                        href={`/app/pagos/${allocation.paymentId}`}
                      >
                        Ver pago #{allocation.paymentId}
                        <Icon aria-hidden="true" name="arrow-up-right" size={12} />
                      </Link>
                    </td>
                    <td className="py-3 pr-2 text-right text-[12px] tabular-nums text-ink">
                      <span className="block break-words">
                        {invoiceMoney(
                          allocation.amount,
                          allocation.currency ?? invoice.currency,
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-[10px]">
                      <span className="inline-flex rounded-full border border-line bg-background px-2 py-0.5 font-semibold text-ink">
                        {allocation.currency?.code ??
                          invoice.currency?.code ??
                          "—"}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-right text-[12px] font-semibold tabular-nums text-ink">
                      <span className="block break-words">
                        {invoiceMoney(allocation.appliedAmount, invoice.currency)}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-right font-mono text-[11px] tabular-nums text-muted">
                      {formatRate(allocation.exchangeRate)}
                    </td>
                    <td className="py-3 text-[11px] tabular-nums text-muted">
                      {invoiceDateTimeLabel(allocation.allocatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {allocations.map((allocation) => (
              <li
                className="rounded-2xl border border-line bg-background p-4"
                key={String(allocation.id)}
              >
                {renderCard(allocation)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function CustomerInvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const { user } = useSession();
  const customerId = user.customer_id;
  const validId = isPositiveRecordId(invoiceId);

  const invoiceLoader = useCallback(async () => {
    const invoice = await fetchInvoice(invoiceId);
    if (!isOwnCustomerRecord(invoice.customerId, customerId)) {
      throw new ApiError(404, { message: "Invoice not found" });
    }
    return invoice;
  }, [customerId, invoiceId]);

  const invoiceResource = useAsyncResource(invoiceLoader, {
    enabled: validId && customerId !== null,
  });

  const historyLoader = useCallback(
    () => fetchInvoicePayments(invoiceId),
    [invoiceId],
  );
  const historyResource = useAsyncResource(historyLoader, {
    enabled:
      validId &&
      customerId !== null &&
      (invoiceResource.status === "ready" ||
        invoiceResource.status === "refreshing"),
  });

  if (customerId === null) {
    return <CustomerIncompleteContent reason="vinculo" />;
  }

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/mis-pedidos"
        backLabel="Volver a mis pedidos"
        description={CUSTOMER_FINANCE_COPY.invalidInvoice}
        headingLevel="h1"
        title={CUSTOMER_FINANCE_COPY.invoiceNotFound}
      />
    );
  }

  if (invoiceResource.status === "loading" || invoiceResource.status === "idle") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/mis-pedidos"
            >
              Volver a mis pedidos
            </Link>
          }
          description="Consulta el estado de pago, el saldo pendiente y los pagos aplicados a tu factura."
          eyebrow="Factura"
          title="Factura"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (invoiceResource.status === "error" || !invoiceResource.data) {
    const copy = customerFinanceErrorCopy(invoiceResource.error, "invoice");
    return (
      <RecordsLoadError
        backHref="/app/mis-pedidos"
        backLabel="Volver a mis pedidos"
        description={copy.description}
        headingLevel="h1"
        onRetry={copy.canRetry ? invoiceResource.reload : undefined}
        title={copy.title}
      />
    );
  }

  const invoice = invoiceResource.data;
  const allocations = historyResource.data ?? [];
  const overdue = isInvoiceOverdue(invoice.dueDate, invoice.paymentStatus);
  const historyLoading =
    historyResource.status === "loading" || historyResource.status === "idle";
  const historyErrorCopy = historyResource.error
    ? customerFinanceErrorCopy(historyResource.error, "invoice")
    : null;

  const orderHref =
    invoice.orderId !== null ? `/app/mis-pedidos/${invoice.orderId}` : null;
  const orderLabel =
    invoice.orderNumber !== null
      ? `Pedido #${invoice.orderNumber}`
      : invoice.orderId !== null
        ? `Pedido #${invoice.orderId}`
        : "Sin pedido asociado";

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            {orderHref ? (
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={orderHref}
              >
                Volver al pedido
              </Link>
            ) : (
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href="/app/mis-pedidos"
              >
                Volver a mis pedidos
              </Link>
            )}
            <InvoicePdfAction
              invoiceId={invoice.id}
              invoiceNumber={invoice.number}
            />
          </>
        }
        description="Consulta las líneas, los totales, el saldo pendiente y los pagos aplicados a tu factura."
        eyebrow="Factura"
        title={invoiceNumberLabel(invoice.number)}
      >
        <div className="flex flex-wrap items-center gap-3">
          <InvoiceStatusBadge status={invoice.paymentStatus} />
          {overdue && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-alert/25 bg-alert/[0.06] px-2.5 py-1 text-[11px] font-semibold text-alert-ink">
              <Icon aria-hidden="true" name="alert" size={14} />
              Vencida
            </span>
          )}
          <CurrencyChip currency={invoice.currency} />
        </div>
      </RecordsPageHeader>

      {invoiceResource.status === "refreshing" && (
        <div aria-hidden="true" className="reload-bar" />
      )}

      {invoice.paymentStatus === "paid" && (
        <NoticeBanner tone="success">
          Factura pagada. No tienes saldo pendiente en esta factura.
        </NoticeBanner>
      )}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <section
            aria-labelledby="datos-factura"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <span className="eyebrow">Encabezado</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-factura"
            >
              Datos de la factura
            </h2>

            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Número
                </dt>
                <dd className="mt-1.5 font-mono text-[14px] font-semibold text-ink">
                  #{invoice.number}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Pedido
                </dt>
                <dd className="mt-1.5 text-[14px] text-ink">
                  {orderHref ? (
                    <Link
                      className="inline-flex min-h-11 items-center font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                      href={orderHref}
                    >
                      {orderLabel}
                    </Link>
                  ) : (
                    orderLabel
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Estado de pago
                </dt>
                <dd className="mt-1.5">
                  <InvoiceStatusBadge status={invoice.paymentStatus} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Moneda
                </dt>
                <dd className="mt-1.5">
                  <CurrencyChip currency={invoice.currency} />
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Fecha de emisión
                </dt>
                <dd className="mt-1.5 tabular-nums text-[14px] text-ink">
                  {invoiceDateTimeLabel(invoice.issuedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Vencimiento
                </dt>
                <dd className="mt-1.5 tabular-nums text-[14px] font-semibold text-ink">
                  {invoiceDateLabel(invoice.dueDate)}
                  {overdue && (
                    <span className="ml-2 inline-flex items-center rounded-full border border-alert/25 bg-alert/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-alert-ink">
                      Vencida
                    </span>
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Término de pago
                </dt>
                <dd className="mt-1.5 text-[14px] font-semibold text-ink">
                  {invoicePaymentTermLabel(invoice.paymentTerm)}
                </dd>
                <dd className="mt-0.5 text-[12px] text-muted">
                  {invoicePaymentTermDetail(invoice.paymentTerm)}
                </dd>
              </div>
            </dl>
          </section>

          <InvoiceLinesSection invoice={invoice} />

          <CustomerInvoiceHistory
            allocations={allocations}
            errorMessage={historyErrorCopy?.description ?? null}
            errorTitle={historyErrorCopy?.title ?? null}
            invoice={invoice}
            loading={historyLoading}
            onRetry={
              historyErrorCopy?.canRetry ? historyResource.reload : undefined
            }
          />
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:h-fit">
          <section
            aria-labelledby="totales-factura"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
          >
            <span className="eyebrow">Totales</span>
            <h2
              className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
              id="totales-factura"
            >
              Resumen de pago
            </h2>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {invoiceMoney(invoice.subtotal, invoice.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Impuesto</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {invoiceMoney(invoice.taxAmount, invoice.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="text-lg font-semibold tabular-nums text-ink">
                  {invoiceMoney(invoice.total, invoice.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Pagado</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {invoiceMoney(invoice.paidAmount, invoice.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold text-ink">Saldo pendiente</dt>
                <dd className="text-lg font-semibold tabular-nums text-ink">
                  {invoiceMoney(invoice.balanceDue, invoice.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Vencimiento</dt>
                <dd className="tabular-nums text-ink">
                  {invoiceDateLabel(invoice.dueDate)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Moneda</dt>
                <dd>
                  <CurrencyChip currency={invoice.currency} />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Pagos aplicados</dt>
                <dd className="tabular-nums text-ink">
                  {formatInteger(
                    historyResource.data
                      ? allocations.length
                      : invoice.paymentsCount,
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-labelledby="ayuda-factura"
            className="rounded-[28px] border border-brand/15 bg-soft-blue p-5 sm:p-6"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-brand">
              <Icon name="shield" size={22} />
            </span>
            <h2
              className="mt-5 text-lg font-semibold tracking-[-0.025em] text-ink"
              id="ayuda-factura"
            >
              Consulta de tu factura
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-muted">
              Esta factura es de solo lectura. Si necesitas registrar un pago o
              revisar un cobro, contacta a tu vendedor o al administrador.
            </p>
            {orderHref && (
              <Link
                className="button-base button-secondary mt-5 min-h-11 w-full bg-surface px-4 text-[13px]"
                href={orderHref}
              >
                Volver al pedido
                <Icon name="arrow-right" size={16} />
              </Link>
            )}
          </section>
        </aside>
      </div>

      <p aria-live="polite" className="sr-only">
        {`Factura ${invoice.number}, ${invoice.paymentStatus === "pending" ? "pendiente" : invoice.paymentStatus === "partial" ? "con pago parcial" : "pagada"}, saldo pendiente ${invoiceMoney(
          invoice.balanceDue,
          invoice.currency,
        )}.`}
      </p>
    </div>
  );
}
