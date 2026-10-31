"use client";

import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import {
  METHOD_PAYMENT_COPY,
  methodPaymentErrorMessage,
} from "@/components/erp/records/method-payment-errors";
import {
  deleteMethodPayment,
  updateMethodPayment,
  type MethodPayment,
} from "@/components/erp/records/method-payments-api";

type MethodPaymentDialogProps = {
  method: MethodPayment | null;
  onClose: () => void;
  onDone: () => void;
  onRefresh?: () => void;
};

function typePhrase(method: MethodPayment | null) {
  const type = method?.method_payment_type;
  return type ? `Tipo: ${type.code} — ${type.name}.` : "";
}

export function MethodPaymentDeactivateDialog({
  method,
  onClose,
  onDone,
  onRefresh,
}: MethodPaymentDialogProps) {
  const toast = useToast();

  return (
    <ConfirmDialog
      confirmBusyLabel="Guardando…"
      confirmLabel="Desactivar método"
      description={
        method
          ? `${typePhrase(method)} El método seguirá registrado y podrás reactivarlo cuando lo necesites.`
          : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!method) return;
        try {
          await updateMethodPayment(String(method.id), {
            label: method.label,
            details: method.details,
            is_active: false,
          });
          toast.success(METHOD_PAYMENT_COPY.deactivated);
          onDone();
        } catch (caught) {
          toast.error(methodPaymentErrorMessage(caught));
          onRefresh?.();
        }
      }}
      onError={(error) => toast.error(error.message)}
      open={method !== null}
      title={
        method
          ? `¿Desactivar el método ${method.label}?`
          : "Desactivar método"
      }
    />
  );
}

export function MethodPaymentReactivateDialog({
  method,
  onClose,
  onDone,
  onRefresh,
  blocked = null,
}: MethodPaymentDialogProps & { blocked?: boolean | null }) {
  const toast = useToast();

  return (
    <ConfirmDialog
      confirmBusyLabel="Guardando…"
      confirmDisabled={blocked === true}
      confirmLabel="Reactivar método"
      description={
        method
          ? `${typePhrase(method)} El método volverá a estar disponible.${
              blocked ? ` ${METHOD_PAYMENT_COPY.reactivateBlocked}` : ""
            }`
          : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!method) return;
        try {
          await updateMethodPayment(String(method.id), {
            label: method.label,
            details: method.details,
            is_active: true,
          });
          toast.success(METHOD_PAYMENT_COPY.reactivated);
          onDone();
        } catch (caught) {
          toast.error(
            methodPaymentErrorMessage(caught, { reactivating: true }),
          );
          onRefresh?.();
        }
      }}
      onError={(error) => toast.error(error.message)}
      open={method !== null}
      title={
        method
          ? `¿Reactivar el método ${method.label}?`
          : "Reactivar método"
      }
    />
  );
}

export function MethodPaymentDeleteDialog({
  method,
  onClose,
  onDone,
  onRefresh,
}: MethodPaymentDialogProps) {
  const toast = useToast();

  return (
    <ConfirmDialog
      confirmBusyLabel="Guardando…"
      confirmLabel="Eliminar método"
      description={
        method
          ? `${typePhrase(method)} Esta acción es permanente y no se puede deshacer.`
          : undefined
      }
      onClose={onClose}
      onConfirm={async () => {
        if (!method) return;
        try {
          await deleteMethodPayment(String(method.id));
          toast.success(METHOD_PAYMENT_COPY.deleted);
          onDone();
        } catch (caught) {
          toast.error(methodPaymentErrorMessage(caught));
          onRefresh?.();
        }
      }}
      onError={(error) => toast.error(error.message)}
      open={method !== null}
      title={
        method ? `¿Eliminar el método ${method.label}?` : "Eliminar método"
      }
    />
  );
}
