import { Icon, type IconName } from "@/components/icons";
import type {
  PaymentRecord,
  PaymentMethodSummary,
} from "@/components/erp/records/payments-api";
import type {
  WalletCurrency,
  WalletTransactionType,
} from "@/components/erp/records/wallets-api";
import { formatInteger, formatMoney } from "@/lib/format";

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
