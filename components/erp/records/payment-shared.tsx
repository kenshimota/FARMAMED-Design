import { Icon, type IconName } from "@/components/icons";
import {
  PAYMENT_STATUSES,
  type PaymentRecord,
  type PaymentMethodSummary,
  type PaymentStatus,
} from "@/components/erp/records/payments-api";
import type {
  WalletCurrency,
  WalletTransactionType,
} from "@/components/erp/records/wallets-api";
import { formatInteger, formatMoney } from "@/lib/format";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  conciliated: "Conciliado",
  rejected: "Rechazado",
  unknown: "Desconocido",
};

export const PAYMENT_STATUS_DETAILS: Record<PaymentStatus, string> = {
  pending:
    "Pendiente de conciliación. El saldo aún no está disponible.",
  conciliated: "Conciliado. El saldo fue acreditado.",
  rejected: "Rechazado. El saldo no fue acreditado.",
  unknown:
    "No pudimos identificar el estado del pago. Actualiza la información para volver a consultarlo.",
};

export const PAYMENT_REJECTION_SUGGESTIONS = [
  "El monto no coincide con el comprobante.",
  "No se encontró el pago en el banco.",
  "El comprobante no es legible.",
  "El pago fue duplicado.",
] as const;

export function paymentStatusLabel(status: PaymentStatus) {
  return PAYMENT_STATUS_LABELS[status];
}

export function paymentStatusOptions() {
  return PAYMENT_STATUSES.map((status) => ({
    value: status,
    label: PAYMENT_STATUS_LABELS[status],
  }));
}

export function paymentReferenceLabel(payment: PaymentRecord) {
  return payment.reference || `#${payment.id}`;
}

const TRANSACTION_PRESENTATION: Record<
  WalletTransactionType,
  { label: string; icon: IconName; shell: string }
> = {
  deposit: {
    label: "Depósito",
    icon: "check",
    shell: "border-olive/35 bg-soft-lime text-ink",
  },
  invoice_payment: {
    label: "Pago de factura",
    icon: "arrow-right",
    shell: "border-brand/25 bg-soft-blue text-ink",
  },
};

export function MovementTypeBadge({
  type,
}: {
  type: WalletTransactionType;
}) {
  const presentation = TRANSACTION_PRESENTATION[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${presentation.shell}`}
    >
      <Icon aria-hidden="true" name={presentation.icon} size={13} />
      {presentation.label}
    </span>
  );
}

export function paymentMoney(
  value: number,
  currency: WalletCurrency | null | undefined,
) {
  return formatMoney(value, currency ?? {});
}

export function SignedMoney({
  value,
  currency,
}: {
  value: number;
  currency: WalletCurrency | null | undefined;
}) {
  const negative = value < 0;
  return (
    <span className="font-semibold tabular-nums text-ink">
      <span aria-hidden="true">{negative ? "−" : "+"} </span>
      <span className="sr-only">{negative ? "Monto negativo, " : "Monto positivo, "}</span>
      {formatMoney(Math.abs(value), currency ?? {})}
    </span>
  );
}

export function PaymentAmount({
  payment,
  currency,
}: {
  payment: PaymentRecord;
  currency: WalletCurrency | null | undefined;
}) {
  if (payment.status === "conciliated") {
    return <SignedMoney currency={currency} value={payment.amount} />;
  }
  return (
    <span className="inline-flex flex-col font-semibold tabular-nums text-muted">
      <span>{paymentMoney(payment.amount, currency)}</span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em]">
        No acreditado
      </span>
      <span className="sr-only">Monto no acreditado.</span>
    </span>
  );
}

export function paymentCountLabel(count: number) {
  return count === 1
    ? "1 pago registrado"
    : `${formatInteger(count)} pagos registrados`;
}

export function walletCountLabel(count: number) {
  return count === 1 ? "1 billetera" : `${formatInteger(count)} billeteras`;
}

export function paymentMethodLabel(
  method: PaymentMethodSummary | null | undefined,
  methodId: PaymentRecord["method_payment_id"] | null | undefined,
) {
  if (method?.label) return method.label;
  if (methodId !== null && methodId !== undefined) {
    return `Método #${methodId}`;
  }
  return "Sin método";
}

export function currencyInputValue(currency: WalletCurrency | null) {
  if (!currency) return "";
  return `${currency.code} — ${currency.name}`;
}
