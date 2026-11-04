import type { ReactNode } from "react";
import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";
import type { ItemStateRecord } from "@/components/erp/records/item-states-api";
import type { ProductRecord } from "@/components/erp/records/records-api";
import type {
  AvailableStockRecord,
  StockRecord,
} from "@/components/erp/records/stocks-api";
import { formatInteger } from "@/lib/format";

function isExpiredItemStateName(name: string | null | undefined) {
  return name?.trim().toLowerCase() === "expired";
}

export function stockProductName(product: ProductRecord | null, productId: string | number) {
  return product?.name ?? `Producto #${productId}`;
}

export function stockItemStateLabel(
  stock: Pick<StockRecord, "item_state" | "item_state_id">,
  itemStates: ItemStateRecord[] = [],
) {
  if (isExpiredItemStateName(stock.item_state?.name)) return "Vencido";
  if (stock.item_state?.label) return stock.item_state.label;
  const match = itemStates.find(
    (itemState) => String(itemState.id) === String(stock.item_state_id),
  );
  if (isExpiredItemStateName(match?.name)) return "Vencido";
  return match?.label ?? `Estado #${stock.item_state_id}`;
}

export function stockCountLabel(count: number) {
  return count === 1 ? "1 existencia" : `${formatInteger(count)} existencias`;
}

export function StockQuantity({ quantity }: { quantity: number }) {
  const inStock = quantity > 0;
  return (
    <div>
      <span className="font-semibold tabular-nums text-ink">
        {formatInteger(quantity)}
      </span>
      {!inStock && (
        <span className="ml-2 inline-flex rounded-full border border-ink/15 bg-background px-2 py-0.5 text-[11px] font-semibold text-ink">
          Sin stock
        </span>
      )}
    </div>
  );
}

export function stockNonSellableQuantity(
  stock: Pick<AvailableStockRecord, "quantity" | "locatedQuantity">,
) {
  return Math.max(0, stock.quantity - stock.locatedQuantity);
}

export function StockLocatedQuantity({
  physicalQuantity,
  locatedQuantity,
}: {
  physicalQuantity: number;
  locatedQuantity: number;
}) {
  const showMissingAvailability = physicalQuantity > 0 && locatedQuantity <= 0;
  return (
    <div>
      <span className="font-semibold tabular-nums text-ink">
        {formatInteger(locatedQuantity)}
      </span>
      {showMissingAvailability && (
        <span className="mt-1 block">
          <span className="inline-flex items-center gap-1 rounded-full border border-olive/35 bg-soft-lime px-2 py-0.5 text-[10px] font-semibold text-ink">
            <Icon name="alert" size={12} />
            Sin disponibilidad vendible
          </span>
        </span>
      )}
    </div>
  );
}

export function StockNonSellableQuantity({ quantity }: { quantity: number }) {
  if (quantity <= 0) {
    return <span className="tabular-nums text-muted">0</span>;
  }
  return (
    <span className="font-semibold tabular-nums text-alert-ink">
      {formatInteger(quantity)}
    </span>
  );
}

export function StockSyncNotice({ action }: { action?: ReactNode }) {
  return (
    <NoticeBanner role="note" title="Existencias y lotes" action={action}>
      Las existencias son el agregado por producto y estado; los lotes son el
      detalle físico. El job diario mueve los lotes vencidos sin reservas al
      estado Vencido y actualiza las existencias. El resto de cambios no se
      sincroniza automáticamente y no se edita desde esta pantalla.
    </NoticeBanner>
  );
}

export function StockAvailabilityNotice({ action }: { action?: ReactNode }) {
  return (
    <NoticeBanner role="note" title="Disponibilidad vendible" action={action}>
      <p>
        Solo los lotes ubicados y no vencidos cuentan para la venta. Un lote
        pendiente de ubicación no es vendible.
      </p>
      <p className="mt-2">
        El job diario corre una vez al día y mueve los lotes vencidos sin
        reservas al estado Vencido. Los lotes vencidos con reservas se mueven
        cuando la reserva se libere. No se puede ejecutar desde esta pantalla.
      </p>
      <p className="mt-2">Esta vista es de solo lectura.</p>
    </NoticeBanner>
  );
}
