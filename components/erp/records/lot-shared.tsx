import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";
import type {
  LotProduct,
  LotRecord,
  LotShelf,
  LotShelfSection,
} from "@/components/erp/records/lots-api";
import type { ItemStateRecord } from "@/components/erp/records/item-states-api";
import type { ProductRecord } from "@/components/erp/records/records-api";
import { formatDateOnly, formatInteger } from "@/lib/format";

const CARACAS_TIME_ZONE = "America/Caracas";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const LOT_EXPIRING_DAYS = 30;

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

export function lotItemStateLabel(
  lot: Pick<LotRecord, "item_state" | "item_state_id">,
  itemStates: ItemStateRecord[] = [],
) {
  if (lot.item_state?.label) return lot.item_state.label;
  const match = itemStates.find(
    (itemState) => String(itemState.id) === String(lot.item_state_id),
  );
  return match?.label ?? `Estado #${lot.item_state_id}`;
}

export function lotWarehouseName(
  lot: Pick<LotRecord, "warehouse" | "warehouse_id">,
) {
  return lot.warehouse?.name || `Bodega #${lot.warehouse_id}`;
}

export function lotShelfLabel(
  shelf: LotShelf | null,
  shelfId?: string | number,
) {
  if (shelf) {
    return shelf.name && shelf.name !== shelf.code
      ? `${shelf.code} — ${shelf.name}`
      : shelf.code;
  }
  return shelfId !== undefined ? `Estante #${shelfId}` : "Estante";
}

export function lotSectionLabel(
  section: LotShelfSection | null,
  sectionId?: string | number,
) {
  if (section) {
    return section.name && section.name !== section.code
      ? `${section.code} — ${section.name}`
      : section.code;
  }
  return sectionId !== undefined ? `Sección #${sectionId}` : "Sección";
}

export function lotLocationLabel(
  lot: Pick<
    LotRecord,
    "warehouse" | "warehouse_id" | "shelf" | "shelf_id" | "section" | "section_id"
  >,
) {
  const shelf = lot.shelf;
  const section = lot.section;
  return [
    lotWarehouseName(lot),
    shelf?.name || shelf?.code || `Estante #${lot.shelf_id}`,
    section?.name || section?.code || `Sección #${lot.section_id}`,
  ].join(" · ");
}

export function lotCountLabel(count: number) {
  return count === 1 ? "1 lote" : `${formatInteger(count)} lotes`;
}

export function LotSyncNotice({
  variant = "list",
  action,
}: {
  variant?: "list" | "detail";
  action?: ReactNode;
}) {
  return (
    <NoticeBanner role="note" title="Lotes y existencias" action={action}>
      {variant === "detail"
        ? "Este lote no actualiza automáticamente las existencias. Revisa ambas vistas."
        : "Los lotes no actualizan automáticamente las existencias. Revisa ambas vistas."}
    </NoticeBanner>
  );
}
