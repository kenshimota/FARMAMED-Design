import { Icon, type IconName } from "@/components/icons";
import type {
  OrderStatusRecord,
  PaymentTermRecord,
} from "@/components/erp/records/orders-api";
import { formatInteger, formatMoney } from "@/lib/format";

export const BASE_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  request: "Solicitado",
  generate: "Generado",
  invoiced: "Facturado",
  cancelled: "Cancelado",
};

const BASE_ORDER_STATUS_ORDER = [
  "draft",
  "request",
  "generate",
  "invoiced",
  "cancelled",
] as const;

export const BASE_ORDER_STATUSES: readonly OrderStatusRecord[] =
  BASE_ORDER_STATUS_ORDER.map((code, index) => ({
    id: code,
    code,
    name: BASE_ORDER_STATUS_LABELS[code],
    description: "",
    sortOrder: (index + 1) * 10,
    nextStatusCode: BASE_ORDER_STATUS_ORDER[index + 1] ?? null,
    isTerminal: index >= 3,
    isSystem: true,
  }));

export function orderStatusLabel(
  code: string,
  statuses: readonly OrderStatusRecord[] = [],
) {
  return (
    statuses.find((status) => status.code === code)?.name ??
    BASE_ORDER_STATUS_LABELS[code] ??
    code.replaceAll("_", " ")
  );
}

export function findOrderStatus(
  code: string | null | undefined,
  statuses: readonly OrderStatusRecord[] = [],
) {
  if (!code) return null;
  return (
    statuses.find((status) => status.code === code) ??
    BASE_ORDER_STATUSES.find((status) => status.code === code) ??
    null
  );
}

export function orderStatusOptions(
  statuses: readonly OrderStatusRecord[] = [],
) {
  const source = statuses.length > 0 ? statuses : BASE_ORDER_STATUSES;
  return source.map((status) => ({
    value: status.code,
    label: status.name,
  }));
}

export function isTerminalOrderStatus(
  code: string,
  statuses: readonly OrderStatusRecord[] = [],
) {
  const status = findOrderStatus(code, statuses);
  if (status) return status.isTerminal;
  return code === "invoiced" || code === "cancelled";
}

const STATUS_PRESENTATION: Record<
  string,
  { icon: IconName; shell: string; iconClass: string }
> = {
  draft: {
    icon: "clock",
    shell: "border-brand/25 bg-soft-blue text-ink",
    iconClass: "text-brand",
  },
  request: {
    icon: "clipboard",
    shell: "border-brand/25 bg-soft-blue text-ink",
    iconClass: "text-brand",
  },
  generate: {
    icon: "box",
    shell: "border-olive/35 bg-soft-lime text-ink",
    iconClass: "text-olive",
  },
  invoiced: {
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

const NEUTRAL_PRESENTATION = {
  icon: "tag" as IconName,
  shell: "border-line bg-background text-ink",
  iconClass: "text-muted",
};

export function OrderStatusBadge({
  status,
  statuses = [],
  className = "",
}: {
  status: string;
  statuses?: readonly OrderStatusRecord[];
  className?: string;
}) {
  const presentation = STATUS_PRESENTATION[status] ?? NEUTRAL_PRESENTATION;
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
      {orderStatusLabel(status, statuses)}
    </span>
  );
}

export type OrderMoneyCurrency = {
  code?: string | null;
  symbol?: string | null;
};

export type OrderDisplayCurrency = {
  code: string;
  name: string;
  symbol: string;
};

export function orderMoney(
  value: number,
  currency: OrderMoneyCurrency | null,
) {
  return formatMoney(value, {
    code: currency?.code ?? undefined,
    symbol: currency?.symbol ?? undefined,
  });
}

export function orderNumberLabel(number: number | string) {
  return `Pedido #${number}`;
}

export function orderCountLabel(count: number) {
  return count === 1 ? "1 pedido" : `${formatInteger(count)} pedidos`;
}

export function paymentTermLabel(term: PaymentTermRecord | null) {
  return term?.name ?? "Sin término de pago";
}

export function paymentTermDetail(term: PaymentTermRecord | null) {
  if (!term) return "Selecciona un término antes de generar o solicitar el pedido.";
  return term.days === 0
    ? "Pago de contado"
    : `${term.days === 1 ? "1 día" : `${term.days} días`} de crédito`;
}

export function isCashPaymentTerm(term: PaymentTermRecord | null) {
  return term !== null && term.days === 0;
}

export function orderItemStateLabel(
  itemState: { label: string } | null,
  fallbackId: string | number,
) {
  return itemState?.label ?? `Estado #${fallbackId}`;
}

export function orderProductLabel(
  product: { name: string; reference: string } | null,
  fallbackId: string | number,
) {
  return product?.name ?? `Producto #${fallbackId}`;
}
