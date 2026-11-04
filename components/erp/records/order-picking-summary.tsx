import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  orderItemStateLabel,
  orderProductLabel,
} from "@/components/erp/records/orders-shared";
import type {
  PickingItem,
  PickingSummary,
} from "@/components/erp/records/order-picking-api";
import { formatInteger } from "@/lib/format";

function packableLotsCount(items: readonly PickingItem[]) {
  return items.reduce(
    (total, item) =>
      total + item.lots.filter((allocation) => allocation.status !== "released").length,
    0,
  );
}

function summaryCards(
  summary: PickingSummary,
  cancelled: boolean,
  lotsToPack: number,
) {
  return [
    { label: "Líneas", value: formatInteger(summary.linesCount) },
    { label: "Lotes a empacar", value: formatInteger(lotsToPack) },
    { label: "Unidades pedidas", value: formatInteger(summary.orderedUnits) },
    { label: "Unidades asignadas", value: formatInteger(summary.allocatedUnits) },
    {
      label: cancelled ? "Reserva" : "Unidades pendientes",
      value: cancelled ? "Liberada" : formatInteger(summary.pendingUnits),
    },
  ];
}

export function OrderPickingSummary({
  summary,
  items,
  status,
}: {
  summary: PickingSummary;
  items: readonly PickingItem[];
  status: string;
}) {
  const cancelled = status === "cancelled";
  const pendingItems = cancelled
    ? []
    : items.filter((item) => item.pendingQuantity > 0);
  const lotsToPack = cancelled ? packableLotsCount(items) : summary.lotsCount;
  const empty = items.length === 0;
  const preparation = cancelled
    ? { label: "Cancelado", icon: "close" as const, tone: "text-muted" }
    : summary.ready
      ? { label: "Listo para armar", icon: "check" as const, tone: "text-olive" }
      : empty
        ? { label: "Sin líneas", icon: "clipboard" as const, tone: "text-muted" }
        : { label: "Faltan unidades", icon: "alert" as const, tone: "text-alert-ink" };

  return (
    <section
      aria-labelledby="resumen-alistamiento"
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
    >
      <span className="eyebrow">Preparación</span>
      <h2
        className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
        id="resumen-alistamiento"
      >
        Resumen
      </h2>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {summaryCards(summary, cancelled, lotsToPack).map((card) => (
          <div
            className="rounded-2xl border border-line bg-background px-4 py-3"
            key={card.label}
          >
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {card.label}
            </dt>
            <dd className="mt-1.5 text-xl font-semibold tabular-nums text-ink">
              {card.value}
            </dd>
          </div>
        ))}
        <div className="rounded-2xl border border-line bg-background px-4 py-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Preparación
          </dt>
          <dd className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold leading-5 text-ink">
            <Icon
              className={`mt-0.5 ${preparation.tone}`}
              name={preparation.icon}
              size={16}
            />
            {preparation.label}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        {cancelled ? (
          <NoticeBanner role="status" title="Pedido cancelado" tone="info">
            La reserva fue liberada; no hay unidades por empacar.
          </NoticeBanner>
        ) : summary.ready ? (
          <NoticeBanner
            role="status"
            title="Pedido listo para armar"
            tone="success"
          >
            Todas las líneas tienen sus unidades asignadas a un lote.
          </NoticeBanner>
        ) : empty ? (
          <NoticeBanner role="status" title="Este pedido no tiene líneas registradas" tone="info">
            Cuando el pedido tenga líneas, el resumen mostrará las unidades
            pedidas, asignadas y pendientes.
          </NoticeBanner>
        ) : (
          <NoticeBanner
            role="status"
            title={`Faltan ${formatInteger(summary.pendingUnits)} unidades por asignar`}
            tone="warning"
          >
            <p>
              Revisa las líneas con unidades pendientes antes de facturar el
              pedido.
            </p>
            {pendingItems.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {pendingItems.map((item) => (
                  <li key={String(item.orderItemId)}>
                    <a
                      className="font-semibold underline underline-offset-4 hover:text-ink print:font-normal print:text-ink print:no-underline"
                      href={`#linea-${item.orderItemId}`}
                    >
                      {orderProductLabel(item.product, item.productId)}
                    </a>
                    {` · ${orderItemStateLabel(item.itemState, item.itemStateId)} · `}
                    {formatInteger(item.pendingQuantity)} pendientes
                  </li>
                ))}
              </ul>
            )}
          </NoticeBanner>
        )}
      </div>

      <p className="mt-4 text-[12px] leading-5 text-muted">
        {cancelled
          ? "Las reservas de este pedido fueron liberadas; no hay cantidades por empacar."
          : "Las cantidades corresponden a la reserva del pedido, no al total disponible del lote."}
      </p>
    </section>
  );
}
