"use client";

import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import {
  deleteImage,
  type ImageRecord,
} from "@/components/erp/records/images-api";

type ImageDeleteDialogProps = {
  image: ImageRecord | null;
  onClose: () => void;
  onDeleted: () => void;
};

export function ImageDeleteDialog({
  image,
  onClose,
  onDeleted,
}: ImageDeleteDialogProps) {
  const toast = useToast();

  return (
    <ConfirmDialog
      confirmBusyLabel="Eliminando…"
      confirmLabel="Eliminar imagen"
      description={
        image ? (
          <div className="space-y-2">
            <p>
              Referencia:{" "}
              <span className="font-semibold text-ink">{image.reference}</span>
            </p>
            <p>Esta acción no se puede deshacer.</p>
          </div>
        ) : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!image) return;
        await deleteImage(image.id);
        toast.success("Imagen eliminada.");
        onDeleted();
      }}
      onError={(error) =>
        toast.error(
          error.kind === "not-found"
            ? "No encontramos esta imagen. Puede que haya sido eliminada."
            : error.message,
        )
      }
      open={image !== null}
      title={
        image
          ? `¿Eliminar la imagen ${image.reference}?`
          : "Eliminar imagen"
      }
    />
  );
}
