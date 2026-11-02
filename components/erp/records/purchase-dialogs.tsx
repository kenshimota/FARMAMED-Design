"use client";

import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import {
  PURCHASE_COPY,
  purchaseErrorMessage,
} from "@/components/erp/records/purchase-errors";
import {
  cancelPurchase,
  confirmPurchase,
  deletePurchase,
  type PurchaseRecord,
} from "@/components/erp/records/purchases-api";

type PurchaseDialogProps = {
  purchase: PurchaseRecord | null;
  onClose: () => void;
  onDone: () => void;
  onRefresh?: () => void;
};

export function PurchaseConfirmDialog({
  purchase,
  onClose,
  onDone,
  onRefresh,
}: PurchaseDialogProps) {
  const toast = useToast();

  return (
    <ConfirmDialog
      confirmBusyLabel="Confirmando…"
      confirmLabel={PURCHASE_COPY.confirmPurchase}
      description={
        purchase ? (
          <>
            <span className="block">{PURCHASE_COPY.confirmIrreversible}</span>
            <span className="mt-1 block">{PURCHASE_COPY.pendingLocation}</span>
          </>
        ) : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!purchase) return;
        try {
          await confirmPurchase(purchase.id);
          toast.success(PURCHASE_COPY.confirmed);
          onDone();
        } catch (caught) {
          toast.error(purchaseErrorMessage(caught));
          onRefresh?.();
        }
      }}
      onError={(error) => toast.error(error.message)}
      open={purchase !== null}
      title={
        purchase
          ? `¿Confirmar la compra #${purchase.number}?`
          : PURCHASE_COPY.confirmPurchase
      }
    />
  );
}

export function PurchaseCancelDialog({
  purchase,
  onClose,
  onDone,
  onRefresh,
}: PurchaseDialogProps) {
  const toast = useToast();

  return (
    <ConfirmDialog
      cancelLabel="Volver"
      confirmBusyLabel="Guardando…"
      confirmLabel={PURCHASE_COPY.cancelPurchase}
      description={
        purchase ? "No se tocarán costos ni existencias." : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!purchase) return;
        try {
          await cancelPurchase(purchase.id);
          toast.success(PURCHASE_COPY.cancelled);
          onDone();
        } catch (caught) {
          toast.error(purchaseErrorMessage(caught));
          onRefresh?.();
        }
      }}
      onError={(error) => toast.error(error.message)}
      open={purchase !== null}
      title={
        purchase
          ? `¿Cancelar la compra #${purchase.number}?`
          : PURCHASE_COPY.cancelPurchase
      }
    />
  );
}

export function PurchaseDeleteDialog({
  purchase,
  onClose,
  onDone,
  onRefresh,
}: PurchaseDialogProps) {
  const toast = useToast();

  return (
    <ConfirmDialog
      confirmBusyLabel="Guardando…"
      confirmLabel={PURCHASE_COPY.deleteDraft}
      description={
        purchase ? "Esta acción no se puede deshacer." : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!purchase) return;
        try {
          await deletePurchase(purchase.id);
          toast.success(PURCHASE_COPY.deleted);
          onDone();
        } catch (caught) {
          toast.error(purchaseErrorMessage(caught));
          onRefresh?.();
        }
      }}
      onError={(error) => toast.error(error.message)}
      open={purchase !== null}
      title={
        purchase
          ? `¿Eliminar el borrador #${purchase.number}?`
          : PURCHASE_COPY.deleteDraft
      }
    />
  );
}
