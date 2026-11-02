import { Icon, type IconName } from "@/components/icons";
import {
  INVOICE_PAYMENT_STATUSES,
  type InvoiceCurrency,
  type InvoicePaymentAllocation,
  type InvoicePaymentStatus,
  type InvoicePaymentTerm,
} from "@/lib/finance/invoices-api";
import { formatDateOnly, formatDateTime, formatInteger, formatMoney } from "@/lib/format";

export const INVOICE_STATUS_LABELS: Record<InvoicePaymentStatus, string> = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Pagada",
};

export function invoiceStatusLabel(status: InvoicePaymentStatus) {
  return INVOICE_STATUS_LABELS[status];
}

export function invoiceStatusOptions() {
  return INVOICE_PAYMENT_STATUSES.map((status) => ({
    value: status,
    label: INVOICE_STATUS_LABELS[status],
  }));
}

const STATUS_PRESENTATION: Record<
  InvoicePaymentStatus,
  { icon: IconName; shell: string; iconClass: string }
> = {
  pending: {
    icon: "clock",
    shell: "border-brand/25 bg-soft-blue text-ink",
    iconClass: "text-brand",
  },
  partial: {
    icon: "coins",
    shell: "border-olive/35 bg-soft-lime text-ink",
    iconClass: "text-olive",
  },
  paid: {
    icon: "check",
    shell: "border-olive/35 bg-soft-lime text-ink",
    iconClass: "text-olive",
  },
};

export function InvoiceStatusBadge({
  status,
  className = "",
}: {
  status: InvoicePaymentStatus;
  className?: string;
}) {
  const presentation = STATUS_PRESENTATION[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${presentation.shell} ${className}`}
    >
      <Icon
        aria-hidden="true"
        className={presentation.iconClass}
        name={presentation.icon}
        size={14}
      />
      {invoiceStatusLabel(status)}
    </span>
  );
}

export function invoiceMoney(
  value: number,
  currency: InvoiceCurrency | null,
) {
  return formatMoney(value, {
    code: currency?.code ?? undefined,
    symbol: currency?.symbol ?? undefined,
  });
}

export function invoiceNumberLabel(number: number | string) {
  return `Factura #${number}`;
}

export function invoiceCountLabel(count: number) {
  return count === 1 ? "1 factura" : `${formatInteger(count)} facturas`;
}

export function invoicePaymentTermLabel(term: InvoicePaymentTerm | null) {
  return term?.name ?? "Sin término de pago";
}

export function invoicePaymentTermDetail(term: InvoicePaymentTerm | null) {
  if (!term) return "Sin término de pago registrado.";
  return term.days === 0
    ? "Pago de contado"
    : `${term.days === 1 ? "1 día" : `${term.days} días`} de crédito`;
}

export function invoiceDateLabel(value: string | null) {
  return value ? formatDateOnly(value) : "—";
}

export function invoiceDateTimeLabel(value: string | null) {
  return value ? formatDateTime(value) : "—";
}

export function invoicePaymentMethodLabel(
  allocation: InvoicePaymentAllocation,
) {
  return allocation.methodPayment?.label ?? "Sin método registrado";
}

export function invoicePaymentTypeLabel(
  allocation: InvoicePaymentAllocation,
) {
  if (!allocation.methodPaymentType) return "Sin tipo registrado";
  return (
    allocation.methodPaymentType.name ||
    allocation.methodPaymentType.code ||
    "Sin tipo registrado"
  );
}
