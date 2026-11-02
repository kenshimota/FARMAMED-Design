"use client";

import { useMemo, useState, type FormEvent } from "react";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import {
  INVOICE_COPY,
  invoicePaymentErrorMessage,
  mapInvoicePaymentFieldErrors,
} from "@/components/erp/records/invoices-errors";
import {
  invoiceDateTimeLabel,
  invoiceMoney,
} from "@/components/erp/records/invoice-shared";
import type { CurrencyRecord } from "@/components/erp/ui/use-currency-status";
import {
  applyInvoicePayment,
  fetchCustomerPayments,
  type CustomerPayment,
  type Invoice,
  type InvoicePaymentAllocation,
} from "@/lib/finance/invoices-api";
import { formatMoney, formatRate } from "@/lib/format";

type InvoicePaymentDialogProps = {
  invoice: Invoice;
  allocations: readonly InvoicePaymentAllocation[];
  currencies: readonly CurrencyRecord[];
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
};

const AMOUNT_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

function parseAmount(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!AMOUNT_PATTERN.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function floorMoney(value: number) {
  return Math.floor(Math.max(0, value) * 100) / 100;
}

function rateFor(currencies: readonly CurrencyRecord[], id: string | number | null) {
  if (id === null) return null;
  const currency = currencies.find(
    (candidate) => candidate.id !== null && String(candidate.id) === String(id),
  );
  const rate = currency ? Number(currency.rate) : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function paymentLabel(payment: CustomerPayment) {
  const amount = formatMoney(payment.amount, payment.currency ?? {});
  const method = payment.methodPayment?.label
    ? ` · ${payment.methodPayment.label}`
    : "";
  const date = payment.paidAt ? ` · ${invoiceDateTimeLabel(payment.paidAt)}` : "";
  return `Pago #${payment.id} · ${amount}${method}${date}`;
}

export function InvoicePaymentDialog({
  invoice,
  allocations,
  currencies,
  open,
  onClose,
  onApplied,
}: InvoicePaymentDialogProps) {
  const toast = useToast();
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const resource = useAsyncResource(
    () => fetchCustomerPayments(invoice.customerId),
    { enabled: open },
  );

  const appliedPaymentIds = useMemo(
    () => new Set(allocations.map((allocation) => String(allocation.paymentId))),
    [allocations],
  );

  const payments = useMemo(() => resource.data ?? [], [resource.data]);
  const availablePayments = useMemo(
    () =>
      payments.filter(
        (payment) => !appliedPaymentIds.has(String(payment.id)),
      ),
    [appliedPaymentIds, payments],
  );

  const selectedPayment =
    availablePayments.find((payment) => String(payment.id) === paymentId) ?? null;

  const sameCurrency =
    selectedPayment !== null &&
    selectedPayment.currency !== null &&
    invoice.currency !== null &&
    String(selectedPayment.currency.id) === String(invoice.currency.id);

  const paymentRate = selectedPayment
    ? rateFor(currencies, selectedPayment.currency?.id ?? null)
    : null;
  const invoiceRate = rateFor(currencies, invoice.currency?.id ?? null);
  const exchangeRate = sameCurrency
    ? 1
    : paymentRate !== null && invoiceRate !== null
      ? Number((paymentRate / invoiceRate).toFixed(6))
      : null;

  const parsedAmount = parseAmount(amount);
  const appliedPreview =
    parsedAmount !== null && exchangeRate !== null
      ? roundMoney(parsedAmount * exchangeRate)
      : null;

  function defaultAmountFor(payment: CustomerPayment) {
    if (invoice.currency === null || payment.currency === null) {
      return payment.amount.toFixed(2);
    }
    if (String(payment.currency.id) === String(invoice.currency.id)) {
      return floorMoney(Math.min(payment.amount, invoice.balanceDue)).toFixed(2);
    }
    const currentPaymentRate = rateFor(currencies, payment.currency.id);
    const currentInvoiceRate = rateFor(currencies, invoice.currency.id);
    if (
      currentPaymentRate === null ||
      currentInvoiceRate === null ||
      currentPaymentRate <= 0
    ) {
      return payment.amount.toFixed(2);
    }
    const rate = currentPaymentRate / currentInvoiceRate;
    return floorMoney(
      Math.min(payment.amount, invoice.balanceDue / rate),
    ).toFixed(2);
  }

  function handlePaymentChange(value: string) {
    setPaymentId(value);
    setPaymentError(null);
    setAmountError(null);
    setFormError(null);
    const payment = availablePayments.find(
      (candidate) => String(candidate.id) === value,
    );
    setAmount(payment ? defaultAmountFor(payment) : "");
  }

  function validate() {
    let valid = true;

    if (!selectedPayment) {
      setPaymentError(INVOICE_COPY.invalidPayment);
      valid = false;
    } else {
      setPaymentError(null);
    }

    if (parsedAmount === null || parsedAmount <= 0) {
      setAmountError(INVOICE_COPY.invalidAmount);
      valid = false;
    } else if (
      appliedPreview !== null &&
      appliedPreview - invoice.balanceDue > 0.005
    ) {
      setAmountError(
        `${INVOICE_COPY.amountExceedsBalance} Saldo disponible: ${invoiceMoney(
          invoice.balanceDue,
          invoice.currency,
        )}.`,
      );
      valid = false;
    } else {
      setAmountError(null);
    }

    return valid;
  }

  function resetForm() {
    setPaymentId("");
    setAmount("");
    setFormError(null);
    setPaymentError(null);
    setAmountError(null);
  }

  function handleClose() {
    if (busy) return;
    resetForm();
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selectedPayment || parsedAmount === null) {
      validate();
      return;
    }
    if (!validate()) return;

    setBusy(true);
    setFormError(null);
    setPaymentError(null);
    setAmountError(null);
    try {
      await applyInvoicePayment(invoice.id, {
        paymentId: selectedPayment.id,
        amount: parsedAmount,
      });
      toast.success("Pago aplicado a la factura.");
      resetForm();
      onApplied();
      onClose();
    } catch (caught) {
      const mapped = mapInvoicePaymentFieldErrors(caught);
      setPaymentError(mapped.paymentId ?? null);
      setAmountError(mapped.amount ?? null);
      setFormError(invoicePaymentErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const loadingPayments =
    resource.status === "loading" || resource.status === "idle";
  const noAvailablePayments =
    (resource.status === "ready" || resource.status === "refreshing") &&
    availablePayments.length === 0;

  return (
    <FormDialog
      closeDisabled={busy}
      description={`${INVOICE_COPY.applyHelp} El monto se descuenta de la billetera del cliente.`}
      onClose={handleClose}
      open={open}
      title={`Aplicar pago a la factura #${invoice.number}`}
    >
      <form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit}>
        {formError && (
          <NoticeBanner role="alert" tone="danger">
            {formError}
          </NoticeBanner>
        )}

        <div className="rounded-2xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          <p className="font-semibold">
            Saldo pendiente: {invoiceMoney(invoice.balanceDue, invoice.currency)}
          </p>
          <p className="mt-1 text-muted">
            {invoice.customer?.fullName ?? `Cliente #${invoice.customerId}`} ·
            Moneda de la factura {invoice.currency?.code ?? "sin moneda"}
          </p>
        </div>

        <SelectField
          emptyLabel={
            payments.length === 0
              ? INVOICE_COPY.noCustomerPayments
              : INVOICE_COPY.allPaymentsApplied
          }
          error={paymentError ?? undefined}
          help={INVOICE_COPY.applyHelp}
          id="pago-factura-seleccion"
          label="Pago recibido"
          loading={loadingPayments}
          loadingLabel="Cargando pagos del cliente…"
          loadError={
            resource.status === "error"
              ? resource.error?.status === 503
                ? INVOICE_COPY.service
                : resource.error?.message ??
                  "No pudimos cargar los pagos del cliente."
              : null
          }
          onChange={handlePaymentChange}
          onRetry={resource.reload}
          options={availablePayments.map((payment) => ({
            value: String(payment.id),
            label: paymentLabel(payment),
          }))}
          placeholder="Selecciona un pago"
          required
          value={paymentId}
        />

        <TextField
          disabled={!selectedPayment || busy}
          error={amountError ?? undefined}
          help="Monto en la moneda del pago. Debe ser mayor que cero y con máximo dos decimales."
          id="pago-factura-monto"
          inputMode="decimal"
          label="Monto a aplicar"
          onChange={(value) => {
            setAmount(value.replace(/[^\d.,]/g, ""));
            setAmountError(null);
            setFormError(null);
          }}
          placeholder="0,00"
          required
          value={amount}
        />

        {selectedPayment && (
          <div className="space-y-3 rounded-2xl border border-line bg-background px-4 py-3.5 text-[12px] leading-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">
                  Pago #{selectedPayment.id}
                </p>
                <p className="mt-1 text-muted">
                  {selectedPayment.methodPayment?.label ??
                    "Método de pago no registrado"}
                  {selectedPayment.paidAt
                    ? ` · ${invoiceDateTimeLabel(selectedPayment.paidAt)}`
                    : ""}
                </p>
                {selectedPayment.reference && (
                  <p className="mt-1 font-mono text-[11px] text-muted">
                    Referencia {selectedPayment.reference}
                  </p>
                )}
              </div>
              <p className="font-semibold tabular-nums text-ink">
                {invoiceMoney(selectedPayment.amount, selectedPayment.currency)}
              </p>
            </div>

            {sameCurrency ? (
              <p className="text-muted">
                El pago y la factura usan la misma moneda; no requiere
                conversión.
              </p>
            ) : exchangeRate === null ? (
              <p className="text-muted">
                No pudimos calcular la conversión con las tasas disponibles. El
                servidor calculará el monto aplicado al confirmar.
              </p>
            ) : (
              <div className="space-y-1 border-t border-line pt-3">
                <p className="flex flex-wrap items-baseline justify-between gap-2 font-semibold text-ink">
                  <span>Monto aplicado a la factura</span>
                  <span className="tabular-nums">
                    {appliedPreview === null
                      ? "—"
                      : invoiceMoney(appliedPreview, invoice.currency)}
                  </span>
                </p>
                <p className="flex flex-wrap items-baseline justify-between gap-2 text-muted">
                  <span>Tasa de conversión</span>
                  <span className="font-mono tabular-nums">
                    {formatRate(exchangeRate)}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}

        {noAvailablePayments && (
          <NoticeBanner role="status" tone="info">
            {payments.length === 0
              ? INVOICE_COPY.noCustomerPayments
              : INVOICE_COPY.allPaymentsApplied}
          </NoticeBanner>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <button
            className="button-base button-secondary min-h-11 px-5"
            disabled={busy}
            onClick={handleClose}
            type="button"
          >
            Cancelar
          </button>
          <BusyButton
            busy={busy}
            busyLabel="Aplicando…"
            className="min-h-11 px-5"
            disabled={!selectedPayment || noAvailablePayments}
            type="submit"
          >
            Aplicar pago
          </BusyButton>
        </div>
      </form>
    </FormDialog>
  );
}
