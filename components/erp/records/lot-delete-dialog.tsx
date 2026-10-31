"use client";

import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import {
  deleteLot,
  type LotRecord,
} from "@/components/erp/records/lots-api";

type LotDeleteDialogProps = {
  lot: LotRecord | null;
  productName: string;
  onClose: () => void;
  onDeleted: () => void;
  onConflict?: () => void;
};

export function LotDeleteDialog({
  lot,
  productName,
  onClose,
  onDeleted,
  onConflict,
}: LotDeleteDialogProps) {
  const toast = useToast();

  return (
    <ConfirmDialog
      confirmBusyLabel="Eliminando…"
      confirmLabel="Eliminar lote"
      description={
        lot ? (
          <div className="space-y-2">
            <p>
              Lote:{" "}
              <span className="font-semibold text-ink">{lot.number}</span>
            </p>
            <p>
              Producto:{" "}
              <span className="font-semibold text-ink">{productName}</span>
            </p>
            <p>
              Solo puedes eliminar lotes con existencia y reservado en cero.
            </p>
            <p>Esta acción no se puede deshacer.</p>
          </div>
        ) : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!lot) return;
        await deleteLot(lot.id);
        toast.success("Lote eliminado.");
        onDeleted();
      }}
      onError={(error) => {
        if (error.kind === "conflict") {
          onConflict?.();
          toast.error(error.message);
          return;
        }
        toast.error(error.message);
      }}
      open={lot !== null}
      title={
        lot
          ? `¿Eliminar el lote ${lot.number} de ${productName}?`
          : "Eliminar lote"
      }
    />
  );
}
