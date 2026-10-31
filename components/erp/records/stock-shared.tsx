import type { ReactNode } from "react";
import { NoticeBanner } from "@/components/erp/ui/banner";
import type { ItemStateRecord } from "@/components/erp/records/item-states-api";
import type { ProductRecord } from "@/components/erp/records/records-api";
import type { StockRecord } from "@/components/erp/records/stocks-api";
import { formatInteger } from "@/lib/format";

export function stockProductName(product: ProductRecord | null, productId: string | number) {
  return product?.name ?? `Producto #${productId}`;
}

export function stockItemStateLabel(
  stock: Pick<StockRecord, "item_state" | "item_state_id">,
  itemStates: ItemStateRecord[] = [],
) {
  if (stock.item_state?.label) return stock.item_state.label;
  const match = itemStates.find(
    (itemState) => String(itemState.id) === String(stock.item_state_id),
  );
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

export function StockSyncNotice({ action }: { action?: ReactNode }) {
  return (
    <NoticeBanner role="note" title="Existencias y lotes" action={action}>
      Las existencias son el agregado por producto y estado. Los lotes son el
      detalle físico y no se sincronizan automáticamente.
    </NoticeBanner>
  );
}
