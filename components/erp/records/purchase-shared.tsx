import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import type {
  PurchaseCurrency,
  PurchaseStatus,
} from "@/components/erp/records/purchases-api";
import { formatInteger, formatMoney } from "@/lib/format";

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  draft: "Borrador",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
};

export const PURCHASE_STATUS_OPTIONS: readonly {
  value: PurchaseStatus;
  label: string;
}[] = [
  { value: "draft", label: "Borrador" },
  { value: "confirmed", label: "Confirmada" },
  { value: "cancelled", label: "Cancelada" },
];

const STATUS_PRESENTATION: Record<
  PurchaseStatus,
  { icon: IconName; shell: string; iconClass: string }
> = {
  draft: {
    icon: "clock",
    shell: "border-brand/25 bg-soft-blue text-ink",
    iconClass: "text-brand",
  },
  confirmed: {
    icon: "check",
    shell: "border-olive/35 bg-soft-lime text-ink",
    iconClass: "text-olive",
  },
  cancelled: {
    icon: "close",
    shell: "border-alert/25 bg-alert/[0.06] text-alert-ink",
    iconClass: "text-alert-ink",
  },
};

export function PurchaseStatusBadge({
  status,
  className = "",
}: {
  status: PurchaseStatus;
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
      {PURCHASE_STATUS_LABELS[status]}
    </span>
  );
}

export type LineAmounts = {
  quantity: number;
  unit_cost: number;
  tax_amount: number;
};

export type PurchaseTotals = {
  subtotal: number;
  tax_amount: number;
  total: number;
};

function toCents(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

export function lineSubtotal(quantity: number, unitCost: number) {
  return Math.round(quantity * toCents(unitCost)) / 100;
}

export function lineTotal(line: LineAmounts) {
  return (
    Math.round(
      lineSubtotal(line.quantity, line.unit_cost) * 100 + toCents(line.tax_amount),
    ) / 100
  );
}

export function computePurchaseTotals(lines: readonly LineAmounts[]): PurchaseTotals {
  let subtotalCents = 0;
  let taxCents = 0;
  for (const line of lines) {
    subtotalCents += Math.round(lineSubtotal(line.quantity, line.unit_cost) * 100);
    taxCents += toCents(line.tax_amount);
  }
  return {
    subtotal: subtotalCents / 100,
    tax_amount: taxCents / 100,
    total: (subtotalCents + taxCents) / 100,
  };
}

export type PurchaseMoney = {
  code?: string | null;
  symbol?: string | null;
};

export type PurchaseDisplayCurrency = {
  code: string;
  name: string;
  symbol: string;
};

export type PurchaseDefaultCurrency = {
  code: string;
  name: string;
  symbol: string;
};

export function resolvePurchaseCurrency(
  nested: PurchaseCurrency | null | undefined,
  catalog: readonly PurchaseCurrency[],
  currencyId: PurchaseCurrency["id"] | null | undefined,
  defaultCurrency?: PurchaseDefaultCurrency | null,
): PurchaseDisplayCurrency | null {
  const source =
    nested && nested.code
      ? nested
      : currencyId !== null && currencyId !== undefined
        ? (catalog.find((item) => String(item.id) === String(currencyId)) ?? null)
        : null;

  if (source) {
    return {
      code: source.code,
      name: source.name.trim() || source.code,
      symbol: source.symbol.trim() || source.code,
    };
  }

  if (defaultCurrency) {
    return {
      code: defaultCurrency.code,
      name: defaultCurrency.name.trim() || defaultCurrency.code,
      symbol: defaultCurrency.symbol.trim() || defaultCurrency.code,
    };
  }

  return null;
}

export function purchaseMoney(value: number, currency: PurchaseMoney | null) {
  return formatMoney(value, {
    code: currency?.code ?? undefined,
    symbol: currency?.symbol ?? undefined,
  });
}

export function purchaseCurrencyLabel(currency: PurchaseDisplayCurrency) {
  return currency.name && currency.name !== currency.code
    ? `${currency.code} — ${currency.name}`
    : currency.code;
}

export function purchaseCountLabel(count: number) {
  return count === 1 ? "1 compra" : `${formatInteger(count)} compras`;
}

export function purchaseNumberLabel(number: number | string) {
  return `Compra #${number}`;
}

type PurchaseTotalsSummaryProps = {
  totals: PurchaseTotals;
  currency: PurchaseMoney | null;
  empty?: boolean;
  notice?: ReactNode;
  title?: string;
  className?: string;
};

export function PurchaseTotalsSummary({
  totals,
  currency,
  empty = false,
  notice,
  title = "Resumen",
  className = "",
}: PurchaseTotalsSummaryProps) {
  return (
    <section
      aria-label={title}
      className={`rounded-[24px] border border-line bg-surface p-5 ${className}`}
    >
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {title}
      </h3>
      <dl className="mt-4 space-y-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Subtotal</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {purchaseMoney(totals.subtotal, currency)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted">Impuesto total</dt>
          <dd className="font-semibold tabular-nums text-ink">
            {purchaseMoney(totals.tax_amount, currency)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <dt className="font-semibold text-ink">Total</dt>
          <dd className="text-lg font-semibold tabular-nums text-ink">
            {purchaseMoney(totals.total, currency)}
          </dd>
        </div>
      </dl>
      <p aria-live="polite" className="sr-only">
        {`Subtotal ${purchaseMoney(totals.subtotal, currency)}. Impuesto total ${purchaseMoney(totals.tax_amount, currency)}. Total ${purchaseMoney(totals.total, currency)}.`}
      </p>
      {empty && (
        <p className="mt-4 rounded-2xl border border-olive/35 bg-soft-lime px-3 py-2.5 text-[12px] leading-5 text-ink">
          {notice}
        </p>
      )}
    </section>
  );
}
