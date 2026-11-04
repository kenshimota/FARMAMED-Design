import Link from "next/link";
import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { EmptyState } from "@/components/erp/ui/empty-state";
import {
  LotExpiryBadge,
} from "@/components/erp/records/lot-shared";
import {
  orderItemStateLabel,
  orderProductLabel,
} from "@/components/erp/records/orders-shared";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import type {
  PickingAllocation,
  PickingItem,
  PickingLot,
} from "@/components/erp/records/order-picking-api";
import { formatDateOnly, formatInteger } from "@/lib/format";

type LotRow = {
  item: PickingItem;
  allocation: PickingAllocation;
};

const ALLOCATION_STATUS: Record<
  string,
  { label: string; icon: "box" | "check" | "close"; shell: string; iconClass: string }
> = {
  reserved: {
    label: "Reservado",
    icon: "box",
    shell: "border-brand/25 bg-soft-blue text-ink",
    iconClass: "text-brand",
  },
  consumed: {
    label: "Consumido",
    icon: "check",
    shell: "border-olive/35 bg-soft-lime text-ink",
    iconClass: "text-olive",
  },
  released: {
    label: "Liberado",
    icon: "close",
    shell: "border-alert/25 bg-alert/[0.06] text-alert-ink",
    iconClass: "text-alert-ink",
  },
};

function allocationStatusLabel(status: string) {
  return (
    ALLOCATION_STATUS[status]?.label ??
    status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
  );
}

function reservationStateLabel(status: string) {
  if (status === "released") return "Liberada";
  if (status === "consumed") return "Consumida";
  if (status === "reserved") return "Vigente";
  return allocationStatusLabel(status);
}

function AllocationStatusBadge({ status }: { status: string }) {
  const presentation = ALLOCATION_STATUS[status] ?? {
    label: allocationStatusLabel(status),
    icon: "tag" as const,
    shell: "border-line bg-background text-ink",
    iconClass: "text-muted",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${presentation.shell}`}
    >
      <Icon
        aria-hidden="true"
        className={presentation.iconClass}
        name={presentation.icon}
        size={13}
      />
      {presentation.label}
    </span>
  );
}

function hasCompleteLocation(lot: PickingLot | null) {
  return Boolean(lot?.warehouse && lot.shelf && lot.section);
}

function locationName(lot: PickingLot) {
  const parts = [lot.warehouse?.name, lot.shelf?.code, lot.section?.code].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length === 3 ? parts.join(" · ") : "Sin ubicación asignada";
}

function locationValue(value: string | undefined) {
  return value || "—";
}

function shelfLabel(lot: PickingLot) {
  if (!lot.shelf) return "—";
  return lot.shelf.name && lot.shelf.name !== lot.shelf.code
    ? `${lot.shelf.code} · ${lot.shelf.name}`
    : lot.shelf.code;
}

function sectionLabel(lot: PickingLot) {
  if (!lot.section) return "—";
  return lot.section.name && lot.section.name !== lot.section.code
    ? `${lot.section.code} · ${lot.section.name}`
    : lot.section.code;
}

function LotLink({
  row,
  canReadLots,
}: {
  row: LotRow;
  canReadLots: boolean;
}) {
  const lot = row.allocation.lot;
  if (!canReadLots || !lot) return null;
  return (
    <Link
      aria-label={`Ver lote ${lot.number} de ${orderProductLabel(
        row.item.product,
        row.item.productId,
      )}`}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand print:hidden"
      href={`/app/lotes/${lot.id}`}
    >
      Ver lote
      <Icon name="arrow-up-right" size={14} />
    </Link>
  );
}

export function OrderPickingLines({
  items,
  orderNumber,
  canReadLots,
  status,
}: {
  items: readonly PickingItem[];
  orderNumber: number;
  canReadLots: boolean;
  status: string;
}) {
  const cancelled = status === "cancelled";
  const sectionTitle = cancelled ? "Lotes reservados" : "Lotes a empacar";
  const sectionId = cancelled ? "lotes-reservados" : "lotes-a-empacar";
  if (items.length === 0) {
    return (
      <section aria-labelledby={sectionId}>
        <span className="eyebrow">Almacén</span>
        <h2
          className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
          id={sectionId}
        >
          {sectionTitle}
        </h2>
        <div className="mt-4">
          <EmptyState
            title="Este pedido no tiene líneas registradas"
            description="Cuando el pedido tenga líneas y lotes asignados, la lista de alistamiento mostrará cada producto con su ubicación."
          />
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby={sectionId} className="space-y-5">
      <div>
        <span className="eyebrow">Almacén</span>
        <h2
          className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
          id={sectionId}
        >
          {sectionTitle}
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
          {cancelled
            ? "El pedido está cancelado: la reserva se liberó y no hay unidades por empacar."
            : "Cada línea muestra los lotes asignados en orden FEFO. La cantidad a empacar corresponde a la reserva del pedido."}
        </p>
      </div>

      {items.map((item) => {
        const productName = orderProductLabel(item.product, item.productId);
        const itemState = orderItemStateLabel(item.itemState, item.itemStateId);
        const headingId = `linea-${item.orderItemId}`;
        const rows: LotRow[] = item.lots.map((allocation) => ({
          item,
          allocation,
        }));

        const columns: RecordsTableColumn<LotRow>[] = [
          {
            key: "quantity",
            header: cancelled ? "Reserva en lote" : "A empacar",
            render: (row) =>
              cancelled ? (
                <span className="text-[13px] font-medium text-muted">
                  {reservationStateLabel(row.allocation.status)}
                </span>
              ) : (
                <div>
                  <span className="text-[15px] font-semibold tabular-nums text-ink">
                    {formatInteger(row.allocation.quantity)}
                  </span>
                  {!hasCompleteLocation(row.allocation.lot) && (
                    <span className="mt-1 block text-[11px] font-medium text-muted">
                      Sin ubicación asignada
                    </span>
                  )}
                </div>
              ),
          },
          {
            key: "lot",
            header: "Lote",
            render: (row) => {
              const lot = row.allocation.lot;
              if (!lot) return <span className="text-muted">Sin lote</span>;
              return (
                <div>
                  <span className="font-semibold text-ink">{lot.number}</span>
                  <span className="mt-1 block text-[11px] text-muted">
                    Disponible en lote: {formatInteger(lot.available)}
                  </span>
                </div>
              );
            },
          },
          {
            key: "expiration",
            header: "Vencimiento",
            render: (row) => {
              const lot = row.allocation.lot;
              if (!lot) return <span className="text-muted">—</span>;
              return (
                <div className="space-y-1">
                  <span className="tabular-nums text-ink">
                    {formatDateOnly(lot.expirationDate)}
                  </span>
                  <LotExpiryBadge expirationDate={lot.expirationDate} />
                </div>
              );
            },
          },
          ...(cancelled
            ? []
            : ([
                {
                  key: "status",
                  header: "Estado de la asignación",
                  render: (row: LotRow) => (
                    <AllocationStatusBadge status={row.allocation.status} />
                  ),
                },
              ] satisfies RecordsTableColumn<LotRow>[])),
          {
            key: "warehouse",
            header: "Bodega",
            render: (row) => (
              <span>{locationValue(row.allocation.lot?.warehouse?.name)}</span>
            ),
          },
          {
            key: "shelf",
            header: "Estante",
            render: (row) =>
              row.allocation.lot ? (
                <span>{shelfLabel(row.allocation.lot)}</span>
              ) : (
                <span className="text-muted">—</span>
              ),
          },
          {
            key: "section",
            header: "Sección",
            render: (row) =>
              row.allocation.lot ? (
                <span>{sectionLabel(row.allocation.lot)}</span>
              ) : (
                <span className="text-muted">—</span>
              ),
          },
        ];

        return (
          <section
            aria-labelledby={headingId}
            className="picking-line rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
            key={String(item.orderItemId)}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="eyebrow">Línea del pedido</span>
                <h3
                  className="mt-2 scroll-mt-24 text-[17px] font-semibold tracking-[-0.02em] text-ink"
                  id={headingId}
                >
                  {productName}
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-muted">
                  {item.product?.reference
                    ? `Referencia ${item.product.reference}`
                    : "Sin referencia"}
                  {` · Estado: ${itemState}`}
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-line bg-background px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Pedidas
                  </dt>
                  <dd className="mt-1 text-[15px] font-semibold tabular-nums text-ink">
                    {formatInteger(item.quantity)}
                  </dd>
                </div>
                <div className="rounded-xl border border-line bg-background px-3 py-2">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Asignadas
                  </dt>
                  <dd className="mt-1 text-[15px] font-semibold tabular-nums text-ink">
                    {formatInteger(item.allocatedQuantity)}
                  </dd>
                </div>
                <div
                  className={`rounded-xl border px-3 py-2 ${
                    !cancelled && item.pendingQuantity > 0
                      ? "border-alert/30 bg-alert/[0.06]"
                      : "border-line bg-background"
                  }`}
                >
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {cancelled ? "Reserva" : "Pendientes"}
                  </dt>
                  <dd
                    className={`mt-1 text-[15px] font-semibold tabular-nums ${
                      !cancelled && item.pendingQuantity > 0
                        ? "text-alert-ink"
                        : "text-ink"
                    }`}
                  >
                    {cancelled ? "Liberada" : formatInteger(item.pendingQuantity)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="mt-5">
              {rows.length > 0 ? (
                <RecordsTable
                  caption={`${sectionTitle} del producto ${productName} en el pedido #${orderNumber}`}
                  columns={columns}
                  getRowKey={(row) => String(row.allocation.allocationId)}
                  getRowLabel={(row) =>
                    row.allocation.lot
                      ? `${row.allocation.lot.number} de ${productName}`
                      : `asignación ${row.allocation.allocationId} de ${productName}`
                  }
                  renderCard={(row) => {
                    const lot = row.allocation.lot;
                    return (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                              {cancelled ? "Reserva en lote" : "A empacar"}
                            </p>
                            <p
                              className={`mt-1 font-semibold text-ink ${
                                cancelled
                                  ? "text-[15px]"
                                  : "text-2xl tabular-nums"
                              }`}
                            >
                              {cancelled
                                ? reservationStateLabel(row.allocation.status)
                                : formatInteger(row.allocation.quantity)}
                            </p>
                          </div>
                          {!cancelled && (
                            <AllocationStatusBadge
                              status={row.allocation.status}
                            />
                          )}
                        </div>
                        <dl className="mt-4 space-y-2 text-[12px]">
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted">Lote</dt>
                            <dd className="font-semibold text-ink">
                              {lot?.number ?? "Sin lote"}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted">Vencimiento</dt>
                            <dd className="tabular-nums text-ink">
                              {lot ? formatDateOnly(lot.expirationDate) : "—"}
                            </dd>
                          </div>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-muted">Disponible en lote</dt>
                            <dd className="tabular-nums text-ink">
                              {lot ? formatInteger(lot.available) : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted">Ubicación</dt>
                            <dd className="mt-1 leading-5 text-ink">
                              {lot ? locationName(lot) : "Sin ubicación asignada"}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    );
                  }}
                  rowActions={
                    canReadLots
                      ? (row) => (
                          <LotLink canReadLots={canReadLots} row={row} />
                        )
                      : undefined
                  }
                  rows={rows}
                />
              ) : (
                <NoticeBanner tone="info">
                  {cancelled
                    ? "Esta línea no tiene lotes asignados. La reserva del pedido fue liberada."
                    : `Esta línea no tiene lotes asignados.${
                        item.pendingQuantity > 0
                          ? ` Faltan ${formatInteger(item.pendingQuantity)} unidades por asignar.`
                          : ""
                      }`}
                </NoticeBanner>
              )}
            </div>
          </section>
        );
      })}
    </section>
  );
}
