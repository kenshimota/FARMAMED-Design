import type { OrderStatus } from "@/components/erp/records/order-statuses-api";
import { ORDER_STATUS_LABELS } from "@/components/erp/records/order-statuses-api";

function statusName(status: OrderStatus) {
  if (status.name && status.name.toLowerCase() !== status.code.toLowerCase()) {
    return status.name;
  }
  return ORDER_STATUS_LABELS[status.code] ?? status.code;
}

function buildChain(statuses: OrderStatus[]) {
  const byCode = new Map(statuses.map((status) => [status.code, status]));
  const hasIncoming = new Set(
    statuses
      .map((status) => status.next_status_code)
      .filter((code): code is string => Boolean(code)),
  );
  const start =
    byCode.get("draft") ??
    statuses.find((status) => !hasIncoming.has(status.code)) ??
    statuses[0];

  const chain: OrderStatus[] = [];
  const visited = new Set<string>();
  let current: OrderStatus | undefined = start;

  while (current && !visited.has(current.code)) {
    chain.push(current);
    visited.add(current.code);
    current = current.next_status_code
      ? byCode.get(current.next_status_code)
      : undefined;
  }

  return chain;
}

export function OrderStatusChain({ statuses }: { statuses: OrderStatus[] }) {
  const chain = buildChain(statuses);
  const chainCodes = new Set(chain.map((status) => status.code));
  const alternatives = statuses.filter(
    (status) =>
      status.is_terminal &&
      !chainCodes.has(status.code) &&
      status.code !== chain.at(-1)?.code,
  );

  const accessibleChain = chain
    .map((status) => `${statusName(status)} (${status.code})`)
    .join(", luego ");

  return (
    <section
      aria-labelledby="flujo-estados-pedido"
      className="rounded-[24px] border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Ciclo de vida del pedido</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.025em] text-ink"
            id="flujo-estados-pedido"
          >
            Cadena principal de estados
          </h2>
          <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
            El pedido avanza por estas etapas en el orden indicado. Cada estado
            define cuál sigue y si cierra el ciclo.
          </p>
        </div>
        <span className="rounded-full bg-soft-blue px-3 py-1.5 text-[11px] font-semibold text-brand">
          {statuses.length === 1 ? "1 estado" : `${statuses.length} estados`}
        </span>
      </div>

      <p className="sr-only">{`Cadena principal: ${accessibleChain}.`}</p>

      <ol
        aria-label="Cadena principal de estados de pedido"
        className="mt-5 flex flex-wrap items-center gap-2"
      >
        {chain.map((status, index) => (
          <li className="flex items-center gap-2" key={status.code}>
            {index > 0 && (
              <>
                <span aria-hidden="true" className="text-[18px] text-muted">
                  →
                </span>
                <span className="sr-only">, luego </span>
              </>
            )}
            <span className="inline-flex flex-col rounded-xl border border-line bg-background px-3 py-2">
              <span className="text-[13px] font-semibold text-ink">
                {statusName(status)}
              </span>
              <span className="mt-0.5 font-mono text-[11px] text-muted">
                {status.code}
              </span>
              {status.is_terminal && (
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-brand">
                  Terminal
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      {alternatives.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            Estados terminales
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {alternatives.map((status) => (
              <li
                className="inline-flex items-center gap-2 rounded-xl border border-line bg-background px-3 py-2"
                key={status.code}
              >
                <span className="text-[13px] font-semibold text-ink">
                  {statusName(status)}
                </span>
                <span className="font-mono text-[11px] text-muted">
                  {status.code}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
