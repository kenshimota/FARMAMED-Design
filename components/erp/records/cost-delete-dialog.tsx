"use client";

import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import {
  deleteCost,
  type CostRecord,
} from "@/components/erp/records/costs-api";
import { formatMoney } from "@/lib/format";

type CostDeleteDialogProps = {
  cost: CostRecord | null;
  productName: string;
  itemStateLabel: string;
  onClose: () => void;
  onDeleted: () => void;
};

export function CostDeleteDialog({
  cost,
  productName,
  itemStateLabel,
  onClose,
  onDeleted,
}: CostDeleteDialogProps) {
  const toast = useToast();
  const currency = cost?.currency ?? null;

  return (
    <ConfirmDialog
      confirmLabel="Eliminar costo"
      description={
        cost ? (
          <div className="space-y-2">
            <p>
              Costo:{" "}
              <span className="font-semibold text-ink">
                {cost.cost === null
                  ? "—"
                  : formatMoney(cost.cost, {
                      code: currency?.code,
                      symbol: currency?.symbol,
                    })}
              </span>
            </p>
            <p>
              Moneda:{" "}
              <span className="font-semibold text-ink">
                {currency ? `${currency.code} — ${currency.name}` : "Sin moneda registrada"}
              </span>
            </p>
            <p>
              Esta acción no se puede deshacer. No modifica existencias ni
              compras.
            </p>
          </div>
        ) : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!cost) return;
        await deleteCost(cost.id);
        toast.success("Costo eliminado.");
        onDeleted();
      }}
      onError={(error) => toast.error(error.message)}
      open={cost !== null}
      title={
        cost
          ? `¿Eliminar el costo de ${productName} en estado ${itemStateLabel}?`
          : "Eliminar costo"
      }
    />
  );
}
