import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  lotAvailable,
  type LotActor,
  type LotLocationStatus,
  type LotProduct,
  type LotRecord,
  type LotShelf,
  type LotShelfSection,
} from "@/components/erp/records/lots-api";
import type { ItemStateRecord } from "@/components/erp/records/item-states-api";
import type { ProductRecord } from "@/components/erp/records/records-api";
import { formatDateOnly, formatInteger } from "@/lib/format";

const CARACAS_TIME_ZONE = "America/Caracas";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const LOT_EXPIRING_DAYS = 30;

export const LOT_LOCATION_STATUS_LABELS: Record<LotLocationStatus, string> = {
  pending: "Pendiente de ubicar",
  in_progress: "Ubicando",
  located: "Ubicado",
};

export function lotLocationStatusLabel(
  lot: Pick<LotRecord, "location_status">,
  startedBy?: LotActor | null,
) {
  if (lot.location_status === "in_progress" && startedBy?.username) {
    return `Ubicando por ${startedBy.username}`;
  }
  return LOT_LOCATION_STATUS_LABELS[lot.location_status];
}

export function LotLocationStatusBadge({
  lot,
  label,
}: {
  lot: Pick<LotRecord, "location_status">;
  label?: string;
}) {
  const text = label ?? lotLocationStatusLabel(lot);
  if (lot.location_status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-olive/35 bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
        <Icon name="clock" size={13} />
        {text}
      </span>
    );
  }
  if (lot.location_status === "in_progress") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
        <Icon name="warehouse" size={13} />
        {text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-background px-2.5 py-1 text-[11px] font-semibold text-ink">
      <Icon name="check" size={13} />
      {text}
    </span>
  );
}

const caracasDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CARACAS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function caracasIsoDate(date: Date = new Date()) {
  return caracasDateFormatter.format(date);
}

export function addDaysIso(days: number, base: Date = new Date()) {
  const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return caracasIsoDate(target);
}

export function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return "";
}

export function isValidIsoDate(value: string) {
  if (!DATE_ONLY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export type LotExpiryStatus = "vencido" | "proximo" | "vigente" | "desconocido";

export function getLotExpiryStatus(expirationDate: string): LotExpiryStatus {
  const normalized = expirationDate.trim().slice(0, 10);
  if (!DATE_ONLY_PATTERN.test(normalized)) return "desconocido";
  const today = caracasIsoDate();
  if (normalized < today) return "vencido";
  if (normalized <= addDaysIso(LOT_EXPIRING_DAYS)) return "proximo";
  return "vigente";
}

export function lotExpiryLabel(expirationDate: string) {
  return formatDateOnly(expirationDate);
}

export function LotExpiryBadge({
  expirationDate,
}: {
  expirationDate: string;
}) {
  const status = getLotExpiryStatus(expirationDate);
  if (status === "vencido") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-alert/30 bg-alert/[0.06] px-2.5 py-1 text-[11px] font-semibold text-alert-ink">
        <Icon name="alert" size={13} />
        Vencido
      </span>
    );
  }
  if (status === "proximo") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-olive/35 bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
        <Icon name="clock" size={13} />
        Próximo a vencer
      </span>
    );
  }
  return null;
}

export function lotProductName(
  product: ProductRecord | LotProduct | null,
  productId: string | number,
) {
  return product?.name ?? `Producto #${productId}`;
}

export function lotProductReference(
  product: ProductRecord | LotProduct | null,
) {
  return product?.reference?.trim() || null;
}

function isExpiredItemStateName(name: string | null | undefined) {
  return name?.trim().toLowerCase() === "expired";
}

function resolveLotItemState(
  lot: Pick<LotRecord, "item_state" | "item_state_id">,
  itemStates: ItemStateRecord[] = [],
) {
  if (lot.item_state) return lot.item_state;
  return (
    itemStates.find(
      (itemState) => String(itemState.id) === String(lot.item_state_id),
    ) ?? null
  );
}

export function lotItemStateIsExpired(
  lot: Pick<LotRecord, "item_state" | "item_state_id">,
  itemStates: ItemStateRecord[] = [],
) {
  return isExpiredItemStateName(resolveLotItemState(lot, itemStates)?.name);
}

export function lotItemStateLabel(
  lot: Pick<LotRecord, "item_state" | "item_state_id">,
  itemStates: ItemStateRecord[] = [],
) {
  const resolved = resolveLotItemState(lot, itemStates);
  if (isExpiredItemStateName(resolved?.name)) return "Vencido";
  return resolved?.label ?? `Estado #${lot.item_state_id}`;
}

export function LotItemStateBadge({
  itemStates,
  lot,
}: {
  itemStates?: ItemStateRecord[];
  lot: Pick<LotRecord, "item_state" | "item_state_id">;
}) {
  const expired = lotItemStateIsExpired(lot, itemStates);
  return (
    <span
      className={
        expired
          ? "inline-flex items-center gap-1.5 rounded-full border border-alert/25 bg-alert/[0.06] px-2.5 py-1 text-[11px] font-semibold text-alert-ink"
          : "inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand"
      }
    >
      {expired && <Icon name="alert" size={13} />}
      {lotItemStateLabel(lot, itemStates)}
    </span>
  );
}

export function lotExpiredWithReservation(
  lot: Pick<
    LotRecord,
    "expiration_date" | "item_state" | "item_state_id" | "reserved"
  >,
  itemStates: ItemStateRecord[] = [],
) {
  const expiredByDate = getLotExpiryStatus(lot.expiration_date) === "vencido";
  return (
    (expiredByDate || lotItemStateIsExpired(lot, itemStates)) &&
    lot.reserved > 0
  );
}

export function LotExpiredReservationBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-alert/25 bg-alert/[0.06] px-2.5 py-1 text-[11px] font-semibold text-alert-ink">
      <Icon name="alert" size={13} />
      Vencido con reserva
    </span>
  );
}

export function lotSellableAvailable(
  lot: Pick<
    LotRecord,
    | "stock"
    | "reserved"
    | "location_status"
    | "expiration_date"
    | "item_state"
    | "item_state_id"
  >,
  itemStates: ItemStateRecord[] = [],
) {
  if (getLotExpiryStatus(lot.expiration_date) === "vencido") return 0;
  if (lotItemStateIsExpired(lot, itemStates)) return 0;
  return lotAvailable(lot);
}

export function lotWarehouseName(
  lot: Pick<LotRecord, "warehouse" | "warehouse_id">,
) {
  return lot.warehouse?.name || (lot.warehouse_id !== null
    ? `Bodega #${lot.warehouse_id}`
    : "Sin bodega");
}

export function lotShelfLabel(
  shelf: LotShelf | null,
  shelfId?: string | number | null,
) {
  if (shelf) {
    return shelf.name && shelf.name !== shelf.code
      ? `${shelf.code} — ${shelf.name}`
      : shelf.code;
  }
  return shelfId !== undefined && shelfId !== null
    ? `Estante #${shelfId}`
    : "Estante";
}

export function lotSectionLabel(
  section: LotShelfSection | null,
  sectionId?: string | number | null,
) {
  if (section) {
    return section.name && section.name !== section.code
      ? `${section.code} — ${section.name}`
      : section.code;
  }
  return sectionId !== undefined && sectionId !== null
    ? `Sección #${sectionId}`
    : "Sección";
}

export function lotLocationLabel(
  lot: Pick<
    LotRecord,
    | "warehouse"
    | "warehouse_id"
    | "shelf"
    | "shelf_id"
    | "section"
    | "section_id"
    | "location_status"
  >,
) {
  if (lot.location_status !== "located") {
    return LOT_LOCATION_STATUS_LABELS[lot.location_status];
  }
  const shelf = lot.shelf;
  const section = lot.section;
  return [
    lotWarehouseName(lot),
    shelf?.name || shelf?.code || (lot.shelf_id !== null
      ? `Estante #${lot.shelf_id}`
      : "Estante"),
    section?.name || section?.code || (lot.section_id !== null
      ? `Sección #${lot.section_id}`
      : "Sección"),
  ].join(" · ");
}

export function lotCountLabel(count: number) {
  return count === 1 ? "1 lote" : `${formatInteger(count)} lotes`;
}

export function lotActorLabel(actor: LotActor | null | undefined) {
  if (!actor) return "";
  if (actor.username) return actor.username;
  return actor.id !== null ? `Usuario #${actor.id}` : "";
}

export function LotSyncNotice({
  variant = "list",
  action,
  withExpiryAutomation = false,
}: {
  variant?: "list" | "detail";
  action?: ReactNode;
  withExpiryAutomation?: boolean;
}) {
  const description = withExpiryAutomation
    ? variant === "detail"
      ? "Este lote solo actualiza sus existencias con el job diario de vencimiento, que corre una vez al día: mueve los lotes vencidos sin reservas al estado Vencido y ajusta las existencias; los lotes vencidos con reservas se mueven cuando la reserva se libere. Este proceso no se puede ejecutar desde esta pantalla."
      : "Las existencias de los lotes solo se actualizan con el job diario de vencimiento, que corre una vez al día: mueve los lotes vencidos sin reservas al estado Vencido y ajusta las existencias; los lotes vencidos con reservas se mueven cuando la reserva se libere. Este proceso no se puede ejecutar desde esta pantalla."
    : variant === "detail"
      ? "Este lote no actualiza automáticamente las existencias, salvo el job diario de vencimiento, que mueve los lotes vencidos sin reservas al estado Vencido y ajusta las existencias."
      : "Los lotes no actualizan automáticamente las existencias, salvo el job diario de vencimiento, que mueve los lotes vencidos sin reservas al estado Vencido y ajusta las existencias.";
  return (
    <NoticeBanner role="note" title="Lotes y existencias" action={action}>
      {description}
    </NoticeBanner>
  );
}
