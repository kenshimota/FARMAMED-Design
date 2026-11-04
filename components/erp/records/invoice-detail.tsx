"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { CustomerInvoiceDetail } from "@/components/erp/customer/customer-invoice-detail";
import { useSession } from "@/components/erp/session-context";
import { InvoicePdfAction } from "@/components/erp/records/document-actions";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { SkeletonTable } from "@/components/erp/ui/skeleton";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  InvoicePaymentDialog,
} from "@/components/erp/records/invoice-payment-dialog";
import { InvoiceLinesSection } from "@/components/erp/records/invoice-lines";
import { RecordEquivalencePanel } from "@/components/erp/records/equivalence/equivalence-panel";
import {
  INVOICE_COPY,
  invoiceLoadErrorMessage,
} from "@/components/erp/records/invoices-errors";
import {
  InvoiceStatusBadge,
  invoiceDateLabel,
  invoiceDateTimeLabel,
  invoiceMoney,
  invoiceNumberLabel,
  invoicePaymentMethodLabel,
  invoicePaymentTermDetail,
  invoicePaymentTermLabel,
  invoicePaymentTypeLabel,
} from "@/components/erp/records/invoice-shared";
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
  fetchInvoice,
  fetchInvoicePayments,
  type Invoice,
  type InvoicePaymentAllocation,
} from "@/lib/finance/invoices-api";
import { formatInteger, formatRate } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const { user } = useSession();
  if (user.role === "customer") {
    return <CustomerInvoiceDetail invoiceId={invoiceId} />;
  }
  if (!canReadModule(user.role, "facturas")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de facturas. La consulta y la aplicación de pagos están disponibles para administradores y vendedores." />
    );
  }
  if (!isPositiveRecordId(invoiceId)) {
    return (
      <RecordsLoadError
        backHref="/app/facturas"
        backLabel="Volver a facturas"
        description="Puede que el enlace no sea válido o que la factura ya no exista."
        headingLevel="h1"
        title="No encontramos esa factura"
      />
    );
  }
  return <InvoiceDetailContent invoiceId={invoiceId} />;
}

function InvoicePaymentHistorySection({
  invoice,
  allocations,
  status,
  errorMessage,
  onRetry,
}: {
  invoice: Invoice;
  allocations: readonly InvoicePaymentAllocation[];
  status: "idle" | "loading" | "refreshing" | "ready" | "error";
  errorMessage: string | null;
  onRetry: () => void;
}) {
  const historyCount =
    allocations.length > 0 ? allocations.length : invoice.paymentsCount;
  const historyCountLabel =
    allocations.length === 0 && (status === "loading" || status === "idle")
      ? "Cargando pagos…"
      : historyCount === 1
        ? "1 pago"
        : `${formatInteger(historyCount)} pagos`;

  const columns: RecordsTableColumn<InvoicePaymentAllocation>[] = [
    {
      key: "metodo",
      header: "Método",
      render: (allocation) => (
        <span className="font-semibold text-ink">
          {invoicePaymentMethodLabel(allocation)}
        </span>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (allocation) => (
        <span className="text-muted">{invoicePaymentTypeLabel(allocation)}</span>
      ),
    },
    {
      key: "monto",
      header: "Monto",
      className: "whitespace-nowrap tabular-nums",
      render: (allocation) => invoiceMoney(allocation.amount, allocation.currency),
    },
    {
      key: "aplicado",
      header: "Monto aplicado",
      className: "whitespace-nowrap font-semibold tabular-nums",
      render: (allocation) =>
        invoiceMoney(allocation.appliedAmount, invoice.currency),
    },
    {
      key: "tasa",
      header: "Tasa",
      className: "whitespace-nowrap font-mono tabular-nums text-muted",
      render: (allocation) => formatRate(allocation.exchangeRate),
    },
    {
      key: "fecha",
      header: "Fecha",
      className: "whitespace-nowrap",
      render: (allocation) => (
        <span className="tabular-nums text-muted">
          {invoiceDateTimeLabel(allocation.allocatedAt)}
        </span>
      ),
    },
  ];

  function renderCard(allocation: InvoicePaymentAllocation) {
    return (
      <div>
        <div>
          <p className="text-[15px] font-semibold text-ink">
            {invoicePaymentMethodLabel(allocation)}
          </p>
          <p className="mt-1 text-[12px] text-muted">
            {invoicePaymentTypeLabel(allocation)}
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
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
              Monto del pago
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {invoiceMoney(allocation.amount, allocation.currency)}
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
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Fecha de aplicación
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {invoiceDateTimeLabel(allocation.allocatedAt)}
            </dd>
          </div>
        </dl>
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
            Historial de pagos aplicados
          </h2>
        </div>
        <span className="inline-flex rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
          {historyCountLabel}
        </span>
      </div>

      {(status === "loading" || status === "idle") &&
      allocations.length === 0 ? (
        <div className="mt-5" role="status">
          <span className="sr-only">Cargando pagos aplicados…</span>
          <SkeletonTable columns={6} rows={3} />
        </div>
      ) : status === "error" && allocations.length === 0 ? (
        <div className="mt-5">
          <NoticeBanner
            action={
              <button
                className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                onClick={onRetry}
                type="button"
              >
                Reintentar
              </button>
            }
            tone="warning"
          >
            {errorMessage ??
              "No pudimos cargar el historial de pagos de esta factura."}
          </NoticeBanner>
        </div>
      ) : allocations.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            description="Cuando apliques un pago del cliente, aparecerá aquí con su método, monto, tasa y fecha."
            title={INVOICE_COPY.noPayments}
          />
        </div>
      ) : (
        <div className="mt-5">
          {status === "refreshing" && (
            <div aria-hidden="true" className="reload-bar mb-3" />
          )}
          {status === "error" && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={onRetry}
                  type="button"
                >
                  Reintentar
                </button>
              }
              className="mb-3"
              tone="warning"
            >
              {errorMessage ??
                "No pudimos actualizar el historial. Mostramos los pagos disponibles."}
            </NoticeBanner>
          )}
          <RecordsTable
            caption="Pagos aplicados con método, tipo, monto, monto aplicado, tasa y fecha"
            columns={columns}
            getRowKey={(allocation) => String(allocation.id)}
            getRowLabel={(allocation) =>
              `pago ${allocation.paymentId}`
            }
            renderCard={renderCard}
            rows={[...allocations]}
          />
        </div>
      )}
    </section>
  );
}

function InvoiceDetailContent({ invoiceId }: { invoiceId: string }) {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const canWrite = canWriteModule(user.role, "facturas");
  const [paymentOpen, setPaymentOpen] = useState(false);

  const invoiceLoader = useCallback(() => fetchInvoice(invoiceId), [invoiceId]);
  const invoiceResource = useAsyncResource(invoiceLoader);
  const historyLoader = useCallback(
    () => fetchInvoicePayments(invoiceId),
    [invoiceId],
  );
  const historyResource = useAsyncResource(historyLoader, {
    enabled:
      invoiceResource.status === "ready" ||
      invoiceResource.status === "refreshing",
  });

  if (invoiceResource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/facturas"
            >
              Volver a facturas
            </Link>
          }
          description="Consulta las líneas, los totales, el saldo y los pagos aplicados a la factura."
          eyebrow="Finanzas"
          title="Detalle de la factura"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (invoiceResource.status === "error" || !invoiceResource.data) {
    const notFound = invoiceResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/facturas"
        backLabel="Volver a facturas"
        description={invoiceLoadErrorMessage(
          invoiceResource.error,
          "No pudimos cargar la factura.",
        )}
        headingLevel="h1"
        onRetry={notFound ? undefined : invoiceResource.reload}
        title={
          notFound ? "No encontramos esa factura" : "No pudimos cargar la factura"
        }
      />
    );
  }

  const invoice = invoiceResource.data;
  const allocations = historyResource.data ?? [];
  const canApply =
    canWrite && invoice.paymentStatus !== "paid" && invoice.balanceDue > 0;
  const showDisabledApply =
    canWrite && invoice.paymentStatus !== "paid" && invoice.balanceDue <= 0;
  const customerName =
    invoice.customer?.fullName ?? `Cliente #${invoice.customerId}`;
  const orderLabel =
    invoice.orderNumber !== null
      ? `Pedido #${invoice.orderNumber}`
      : invoice.orderId !== null
        ? `Pedido #${invoice.orderId}`
        : "Sin pedido asociado";

  const historyError = historyResource.error
    ? invoiceLoadErrorMessage(
        historyResource.error,
        "No pudimos cargar el historial de pagos de esta factura.",
      )
    : null;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <RecordsPageHeader
        actions={
          <>
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/facturas"
            >
              Volver a facturas
            </Link>
            {invoice.orderId !== null && (
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={`/app/pedidos/${invoice.orderId}`}
              >
                Ver pedido
                <Icon name="arrow-up-right" size={16} />
              </Link>
            )}
            <InvoicePdfAction
              invoiceId={invoice.id}
              invoiceNumber={invoice.number}
            />
          </>
        }
        description="Factura inmutable con las líneas del pedido, el saldo pendiente y los pagos aplicados."
        eyebrow="Finanzas"
        title={invoiceNumberLabel(invoice.number)}
      >
        <div className="flex flex-wrap items-center gap-3">
          <InvoiceStatusBadge status={invoice.paymentStatus} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
            <Icon name="user" size={14} />
            {customerName}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
            <Icon name="clipboard" size={14} />
            {orderLabel}
          </span>
          <CurrencyChip currency={invoice.currency} />
        </div>
      </RecordsPageHeader>

      {invoiceResource.status === "refreshing" && (
        <div aria-hidden="true" className="reload-bar" />
      )}

      <RecordEquivalencePanel
        documentCash={
          invoice.paymentTerm?.days === 0
            ? { isCash: true, amount: invoice.balanceDue }
            : null
        }
        documentCurrency={invoice.currency}
        recordId={String(invoice.id)}
        scope="invoice"
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                  {invoice.orderId !== null ? (
                    <Link
                      className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                      href={`/app/pedidos/${invoice.orderId}`}
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
                  Cliente
                </dt>
                <dd className="mt-1.5 text-[14px] font-semibold text-ink">
                  {customerName}
                </dd>
                {invoice.customer?.email && (
                  <dd className="mt-0.5 break-all text-[12px] text-muted">
                    {invoice.customer.email}
                  </dd>
                )}
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
                  Término de pago
                </dt>
                <dd className="mt-1.5 text-[14px] text-ink">
                  {invoicePaymentTermLabel(invoice.paymentTerm)}
                </dd>
                <dd className="mt-0.5 text-[12px] text-muted">
                  {invoicePaymentTermDetail(invoice.paymentTerm)}
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
                </dd>
              </div>
              {invoice.invoicedBy && (
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Facturada por
                  </dt>
                  <dd className="mt-1.5 text-[14px] text-ink">
                    {invoice.invoicedBy.username}
                  </dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Notas
                </dt>
                <dd className="mt-1.5 whitespace-pre-line text-[13px] leading-6 text-ink">
                  {invoice.notes || "Sin notas registradas."}
                </dd>
              </div>
            </dl>

            <p className="mt-5 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
              La factura conserva el número, las líneas, los precios y el
              término de pago del momento de emisión. No se edita ni se elimina;
              solo cambian el monto pagado y el estado de pago al aplicar pagos.
            </p>
          </section>

          <InvoiceLinesSection invoice={invoice} />

          <InvoicePaymentHistorySection
            allocations={allocations}
            errorMessage={historyError}
            invoice={invoice}
            onRetry={historyResource.reload}
            status={historyResource.status}
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
            aria-labelledby="acciones-factura"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
          >
            <span className="eyebrow">Acciones</span>
            <h2
              className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
              id="acciones-factura"
            >
              Pago de la factura
            </h2>

            {invoice.paymentStatus === "paid" ? (
              <NoticeBanner className="mt-4" tone="success">
                Factura pagada. No se pueden aplicar más pagos.
              </NoticeBanner>
            ) : !canWrite ? (
              <NoticeBanner className="mt-4" tone="info">
                Tu rol puede consultar la factura, pero no aplicar pagos.
              </NoticeBanner>
            ) : (
              <>
                <p className="mt-3 text-[12px] leading-5 text-muted">
                  {INVOICE_COPY.applyHelp} El monto se descuenta de la billetera
                  del cliente y se registra en el historial.
                </p>
                <button
                  className="button-base button-primary mt-3 min-h-11 px-5 text-[13px]"
                  disabled={!canApply}
                  onClick={() => setPaymentOpen(true)}
                  type="button"
                >
                  Aplicar pago
                  <Icon name="coins" size={16} />
                </button>
                {showDisabledApply && (
                  <p className="mt-3 text-[12px] leading-5 text-muted">
                    El saldo pendiente es cero; no hay monto por aplicar.
                  </p>
                )}
              </>
            )}

            <div className="mt-4 flex flex-col gap-2">
              <a
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href="#historial-pagos"
              >
                Ver historial
                <Icon name="arrow-right" size={16} />
              </a>
            </div>
          </section>
        </aside>
      </div>

      {canApply && (
        <InvoicePaymentDialog
          allocations={allocations}
          currencies={currencyStatus?.currencies ?? []}
          invoice={invoice}
          onApplied={() => {
            invoiceResource.reload();
            historyResource.reload();
          }}
          onClose={() => setPaymentOpen(false)}
          open={paymentOpen}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {`Factura ${invoice.number}, ${customerName}, saldo pendiente ${invoiceMoney(
          invoice.balanceDue,
          invoice.currency,
        )}.`}
      </p>
    </div>
  );
}
