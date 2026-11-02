"use client";

import { useState } from "react";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import {
  USER_CUSTOMER_SEARCH_SUFFIX,
  UserCustomerSelector,
  useUserCustomers,
} from "@/components/erp/user-customer-picker";
import {
  updateUserCustomer,
  userCustomerLinkErrorMessage,
  type UserRecord,
} from "@/components/erp/users-api";
import { toApiId } from "@/components/erp/records/records-api";

type UserCustomerLinkDialogProps = {
  open: boolean;
  user: UserRecord;
  onClose: () => void;
  onLinked: (user: UserRecord) => void;
};

export function UserCustomerLinkDialog({
  open,
  user,
  onClose,
  onLinked,
}: UserCustomerLinkDialogProps) {
  const customers = useUserCustomers(open);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelectedId("");
      setError(null);
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (saving) return;
    if (!selectedId) {
      setError("Selecciona un cliente o usa Desvincular.");
      document
        .getElementById(`cliente-vinculo${USER_CUSTOMER_SEARCH_SUFFIX}`)
        ?.focus();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const updated = await updateUserCustomer(user.id, toApiId(selectedId));
      onLinked(updated);
    } catch (caught) {
      setError(userCustomerLinkErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      closeDisabled={saving}
      description="Selecciona el cliente que corresponde a esta cuenta. Cada cliente solo puede estar vinculado a una cuenta."
      mobileFullscreen
      onClose={onClose}
      open={open}
      title="Vincular cliente"
    >
      {error && (
        <NoticeBanner className="mt-5" role="alert" tone="danger">
          {error}
        </NoticeBanner>
      )}

      <div className="mt-5">
        <UserCustomerSelector
          currentCustomerId={
            user.customer_id === null ? null : String(user.customer_id)
          }
          customers={customers.customers}
          disabled={saving}
          help="Escribe para filtrar por nombre, correo o dirección. Vuelve a seleccionar el cliente para quitar la selección."
          idPrefix="cliente-vinculo"
          loadError={customers.loadError}
          loading={customers.loading}
          onRetry={customers.retry}
          onSelect={(value) => {
            setSelectedId(value);
            setError(null);
          }}
          selectedId={selectedId}
        />
      </div>

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          className="button-base button-secondary min-h-11 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          Cancelar
        </button>
        <BusyButton
          busy={saving}
          busyLabel="Guardando vínculo…"
          className="sm:min-w-[170px]"
          onClick={() => void handleSubmit()}
          type="button"
        >
          Guardar vínculo
        </BusyButton>
      </div>
    </FormDialog>
  );
}
