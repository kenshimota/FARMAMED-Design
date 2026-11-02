"use client";

import { useState, type FormEvent } from "react";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import { TextAreaField } from "@/components/erp/records/form-controls";
import {
  paymentMoney,
  PAYMENT_REJECTION_SUGGESTIONS,
} from "@/components/erp/records/payment-shared";
import {
  changePaymentStatus,
  type PaymentRecord,
  type PaymentStatusResult,
} from "@/components/erp/records/payments-api";
import type { WalletCurrency } from "@/components/erp/records/wallets-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";

export type PaymentStatusDialogMode = "conciliate" | "reject";

type PaymentStatusDialogProps = {
  open: boolean;
  mode: PaymentStatusDialogMode;
  payment: PaymentRecord | null;
  currency: WalletCurrency | null;
  customerName: string;
  onClose: () => void;
  onSuccess: (payment: PaymentStatusResult, mode: PaymentStatusDialogMode) => void;
};

const REASON_MAX_LENGTH = 500;

export function PaymentStatusDialog({
  open,
  mode,
  payment,
  currency,
  customerName,
  onClose,
  onSuccess,
}: PaymentStatusDialogProps) {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dialogKey = `${open ? "open" : "closed"}:${mode}:${payment?.id ?? ""}`;
  const [previousDialogKey, setPreviousDialogKey] = useState(dialogKey);
  if (dialogKey !== previousDialogKey) {
    setPreviousDialogKey(dialogKey);
    if (open) {
      setReason("");
      setReasonError(null);
      setFormError(null);
      setBusy(false);
    }
  }

  if (!payment) return null;

  const rejecting = mode === "reject";
  const amountLabel = paymentMoney(payment.amount, currency);
  const paymentId = String(payment.id);
  const title = rejecting ? "Rechazar pago" : "Conciliar pago";
  const description = `${
    rejecting
      ? `¿Rechazar el pago de ${amountLabel} de ${customerName}?`
      : `¿Conciliar el pago de ${amountLabel} de ${customerName}?`
  } Esta acción no se puede deshacer.`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const trimmed = reason.trim();
    setReasonError(null);
    setFormError(null);

    if (rejecting && !trimmed) {
      setReasonError("El motivo es obligatorio para rechazar.");
      return;
    }
    if (rejecting && trimmed.length < 3) {
      setReasonError("El motivo debe tener al menos 3 caracteres.");
      return;
    }
    if (trimmed.length > REASON_MAX_LENGTH) {
      setReasonError("El motivo no puede superar los 500 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const updated = await changePaymentStatus(paymentId, {
        status: rejecting ? "rejected" : "conciliated",
        ...(trimmed ? { reason: trimmed } : {}),
      });
      onSuccess(updated, mode);
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 422) {
          if (caught.fieldErrors.status) {
            setFormError("Este pago ya no se puede conciliar.");
          } else if (caught.fieldErrors.reason) {
            setReasonError("Escribe el motivo del rechazo.");
          } else {
            setFormError(translateApiError(caught).message);
          }
        } else if (caught.status === 404) {
          setFormError(
            "No encontramos el pago. Actualiza la lista e intenta de nuevo.",
          );
        } else if (caught.status === 403) {
          setFormError("No tienes permiso para cambiar el estado del pago.");
        } else if (caught.status === 409) {
          setFormError(
            "El pago cambió mientras lo revisabas. Actualiza e intenta de nuevo.",
          );
        } else if (caught.status === 400) {
          setFormError("Faltan datos para cambiar el estado del pago.");
        } else {
          setFormError(translateApiError(caught).message);
        }
      } else {
        setFormError(translateApiError(caught).message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      closeDisabled={busy}
      description={description}
      onClose={onClose}
      open={open}
      title={title}
    >
      <form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit}>
        {formError && (
          <NoticeBanner role="alert" tone="danger">
            {formError}
          </NoticeBanner>
        )}

        <div className="rounded-2xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          {rejecting ? (
            <p>
              El motivo es obligatorio para rechazar. El saldo no se acredita y
              el pago queda registrado como rechazado.
            </p>
          ) : (
            <p>
              Al conciliar el pago, el saldo se acredita a la billetera del
              cliente y se registra el movimiento de depósito.
            </p>
          )}
        </div>

        <TextAreaField
          disabled={busy}
          error={reasonError ?? undefined}
          help={
            rejecting
              ? "Obligatorio. Entre 3 y 500 caracteres."
              : "Opcional. Puedes dejar una nota de conciliación de hasta 500 caracteres."
          }
          id="pago-motivo-estado"
          label="Motivo"
          maxLength={REASON_MAX_LENGTH}
          onChange={(value) => {
            setReason(value);
            setReasonError(null);
            setFormError(null);
          }}
          placeholder={
            rejecting
              ? "Ej. El monto no coincide con el comprobante"
              : "Ej. Transferencia verificada en el banco"
          }
          required={rejecting}
          rows={4}
          value={reason}
        />

        {rejecting && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Sugerencias de motivo
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PAYMENT_REJECTION_SUGGESTIONS.map((suggestion) => (
                <button
                  className="min-h-11 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:border-brand/45 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                  disabled={busy}
                  key={suggestion}
                  onClick={() => {
                    setReason(suggestion);
                    setReasonError(null);
                    setFormError(null);
                  }}
                  type="button"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <button
            className="button-base button-secondary min-h-11 px-5 motion-reduce:transition-none"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <BusyButton
            busy={busy}
            busyLabel={rejecting ? "Rechazando…" : "Conciliando…"}
            className="min-h-11 px-5 motion-reduce:transition-none"
            type="submit"
            variant={rejecting ? "danger" : "primary"}
          >
            {rejecting ? "Rechazar pago" : "Conciliar pago"}
          </BusyButton>
        </div>
      </form>
    </FormDialog>
  );
}
