import { PaymentStatusBadge } from "@/components/erp/records/payment-status-badge";
import { paymentStatusLabel } from "@/components/erp/records/payment-shared";
import type { PaymentHistoryEntry } from "@/components/erp/records/payments-api";
import { formatDateTime } from "@/lib/format";

export function PaymentHistoryTimeline({
  history,
}: {
  history: readonly PaymentHistoryEntry[];
}) {
  if (history.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-background px-4 py-5 text-center text-[12px] text-muted">
        Sin historial disponible.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {history.map((event) => (
        <li
          className="rounded-2xl border border-line bg-surface px-4 py-3.5"
          key={String(event.id)}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink">
              {event.from_status ? (
                <>
                  <span>{paymentStatusLabel(event.from_status)}</span>
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                </>
              ) : (
                <>
                  <span>Registro del pago</span>
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                </>
              )}
              <PaymentStatusBadge status={event.to_status} />
            </div>
            <span className="text-[11px] tabular-nums text-muted">
              {event.created_at ? formatDateTime(event.created_at) : "Sin fecha"}
            </span>
          </div>

          {event.reason && (
            <p className="mt-2 break-words text-[12px] leading-6 text-ink">
              <span className="font-semibold">Motivo: </span>
              {event.reason}
            </p>
          )}

          {event.actor && (
            <p className="mt-2 break-words text-[11px] leading-5 text-muted">
              Actor: {event.actor.username}
              {event.actor.email && event.actor.email !== event.actor.username
                ? ` · ${event.actor.email}`
                : ""}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
