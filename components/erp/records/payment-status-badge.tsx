import { Icon, type IconName } from "@/components/icons";
import {
  PAYMENT_STATUS_LABELS,
  paymentStatusLabel,
} from "@/components/erp/records/payment-shared";
import type { PaymentStatus } from "@/components/erp/records/payments-api";

const STATUS_PRESENTATION: Record<
  PaymentStatus,
  { icon: IconName; shell: string; iconClass: string }
> = {
  pending: {
    icon: "clock",
    shell: "border-brand/25 bg-soft-blue text-ink",
    iconClass: "text-brand",
  },
  conciliated: {
    icon: "check",
    shell: "border-olive/35 bg-soft-lime text-ink",
    iconClass: "text-olive",
  },
  rejected: {
    icon: "close",
    shell: "border-alert/30 bg-alert/[0.06] text-alert-ink",
    iconClass: "text-alert-ink",
  },
  unknown: {
    icon: "alert",
    shell: "border-line bg-background text-muted",
    iconClass: "text-muted",
  },
};

export function PaymentStatusBadge({
  status,
  className = "",
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const presentation = STATUS_PRESENTATION[status];
  const label = paymentStatusLabel(status);

  return (
    <span
      aria-label={`Estado del pago: ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${presentation.shell} ${className}`}
    >
      <Icon
        aria-hidden="true"
        className={presentation.iconClass}
        name={presentation.icon}
        size={14}
      />
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
