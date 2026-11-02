"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { useToast } from "@/components/erp/ui/toast";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordActionButton } from "@/components/erp/records/record-actions";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import {
  fetchCustomer,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  deletePayment,
  fetchPayment,
  type PaymentRecord,
} from "@/components/erp/records/payments-api";
import {
  currencyInputValue,
  paymentMethodLabel,
  paymentMoney,
} from "@/components/erp/records/payment-shared";
import {
  fetchWallets,
  type CustomerWallet,
} from "@/components/erp/records/wallets-api";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type PaymentDetailData = {
  payment: PaymentRecord;
  customer: CustomerRecord | null;
  wallet: CustomerWallet | null;
};

async function loadPaymentDetail(paymentId: string): Promise<PaymentDetailData> {
  const payment = await fetchPayment(paymentId);
  const customerId = String(payment.customer_id);
  const [customer, wallets] = await Promise.all([
    fetchCustomer(customerId).catch(() => null),
    fetchWallets(customerId).catch(() => [] as CustomerWallet[]),
  ]);
  const wallet =
    wallets.find(
      (item) => String(item.currency_id) === String(payment.currency_id),
    ) ?? null;
  return { payment, customer, wallet };
}

export function PaymentDetailPage({ paymentId }: { paymentId: string }) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const activityVisible = useActivityVisible();
  const fichaPagoId = useId();
  const saldoBilleteraPagoId = useId();
  const canRead = canReadModule(user.role, "pagos");
  const canWrite = canWriteModule(user.role, "pagos");
  const canDelete = user.role === "admin";
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validId = isPositiveRecordId(paymentId);
  const loader = useCallback(
    () => loadPaymentDetail(paymentId),
    [paymentId],
  );
  const resource = useAsyncResource(loader, {
    enabled: canRead && validId,
  });
  const reloadDetail = resource.reload;
  const wasVisible = useRef(activityVisible);
  useEffect(() => {
    if (activityVisible && !wasVisible.current) reloadDetail();
    wasVisible.current = activityVisible;
  }, [activityVisible, reloadDetail]);

  if (!activityVisible) return null;

  if (!canRead) {
    return (
      <AccessState description="No tienes permiso para consultar pagos recibidos." />
    );
  }

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/pagos"
        backLabel="Volver a pagos"
        description="Puede que el enlace no sea válido o que el pago ya no exista."
        headingLevel="h1"
        title="No encontramos ese pago"
      />
    );
  }

  if (resource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/pagos"
            >
              Volver a pagos
            </Link>
          }
          description="Consulta el pago recibido y el saldo actual de la billetera del cliente."
          eyebrow="Finanzas"
          title="Detalle del pago"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (resource.status === "error" || !resource.data) {
    const notFound = resource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/pagos"
        backLabel="Volver a pagos"
        description={
          notFound
            ? "Puede que haya sido eliminado o que el enlace no sea válido."
            : resource.error?.message ?? "No pudimos cargar el pago."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={notFound ? "No encontramos ese pago" : "No pudimos cargar el pago"}
      />
    );
  }

  const { payment, customer, wallet } = resource.data;
  const currency = payment.currency ?? wallet?.currency ?? null;
  const customerName = customer?.fullName ?? `Cliente #${payment.customer_id}`;

  async function handleDelete() {
    await deletePayment(String(payment.id));
    toast.success("Pago eliminado. El saldo de la billetera se actualizó.");
    router.replace("/app/pagos");
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite || canDelete ? (
            <>
              {canWrite && (
                <Link
                  aria-label={`Editar el pago de ${customerName}`}
                  className="button-base button-secondary min-h-11 px-5 text-[13px]"
                  href={`/app/pagos/${payment.id}/editar`}
                >
                  Editar pago
                  <Icon name="arrow-right" size={16} />
                </Link>
              )}
              {canDelete && (
                <RecordActionButton
                  aria-label={`Eliminar el pago de ${customerName}`}
                  danger
                  icon="close"
                  onClick={() => setDeleteOpen(true)}
                >
                  Eliminar pago
                </RecordActionButton>
              )}
            </>
          ) : undefined
        }
        description="Consulta los datos del pago recibido y su efecto en la billetera del cliente."
        eyebrow="Finanzas"
        title={`Pago de ${customerName}`}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/pagos"
        >
          Volver a pagos
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-labelledby={fichaPagoId}
          className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
        >
          <span className="eyebrow">Pago recibido</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id={fichaPagoId}
          >
            Datos registrados
          </h2>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Cliente
              </dt>
              <dd className="mt-1.5 text-[14px] font-semibold text-ink">
                {customerName}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Método de pago
              </dt>
              <dd className="mt-1.5 text-[14px] text-ink">
                {paymentMethodLabel(
                  payment.method_payment,
                  payment.method_payment_id,
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Moneda
              </dt>
              <dd className="mt-1.5">
                <CurrencyChip currency={currency} />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Monto recibido
              </dt>
              <dd className="mt-1.5 text-[15px] font-semibold tabular-nums text-ink">
                {paymentMoney(payment.amount, currency)}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Fecha del pago
              </dt>
              <dd className="mt-1.5 tabular-nums text-[14px] text-ink">
                {payment.paid_at ? formatDateOnly(payment.paid_at) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Identificador
              </dt>
              <dd className="mt-1.5 font-mono text-[13px] text-ink">
                #{payment.id}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Referencia
              </dt>
              <dd className="mt-1.5 break-words text-[14px] text-ink">
                {payment.reference || "Sin referencia"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Notas
              </dt>
              <dd className="mt-1.5 whitespace-pre-line break-words text-[14px] leading-7 text-ink">
                {payment.notes || "Sin notas"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 space-y-3 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
            <p>
              El cliente, el método, la moneda y el monto son inmutables. Solo
              puedes actualizar la referencia, las notas y la fecha del pago.
            </p>
            <p>
              Un pago aplicado a una factura no se puede modificar ni eliminar.
              {canDelete
                ? " Si el pago no tiene asignaciones, al eliminarlo se ajusta la billetera y no puede quedar con saldo negativo."
                : " Solo un administrador puede eliminarlo cuando no tenga asignaciones."}
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <section
            aria-labelledby={saldoBilleteraPagoId}
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
          >
            <span className="eyebrow">Billetera</span>
            <h2
              className="mt-3 text-lg font-semibold tracking-[-0.025em] text-ink"
              id={saldoBilleteraPagoId}
            >
              Saldo actual
            </h2>
            {wallet ? (
              <>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {currencyInputValue(currency) || "Moneda del pago"}
                </p>
                <p className="mt-1.5 text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink">
                  {formatMoney(wallet.balance, currency ?? {})}
                </p>
                <Link
                  className="button-base button-secondary mt-5 min-h-11 w-full px-4 text-[13px]"
                  href={`/app/billeteras/${wallet.id}`}
                >
                  Ver movimientos
                  <Icon name="arrow-right" size={16} />
                </Link>
              </>
            ) : (
              <p className="mt-4 text-[13px] leading-6 text-muted">
                No pudimos consultar el saldo actual de la billetera. El pago
                registrado sigue disponible.
              </p>
            )}
            <Link
              className="mt-3 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/billeteras?customer_id=${payment.customer_id}`}
            >
              Ver billeteras del cliente
              <Icon name="arrow-up-right" size={14} />
            </Link>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmBusyLabel="Eliminando…"
        confirmLabel="Eliminar pago"
        description={
          <span>
            Se eliminará el pago de{" "}
            <strong className="font-semibold text-ink">
              {paymentMoney(payment.amount, currency)}
            </strong>{" "}
            de {customerName} y se ajustará el saldo de su billetera. Si el pago
            ya está aplicado a una factura, no se puede eliminar.
          </span>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        onError={(error) =>
          toast.error(
            error.status === 404
              ? "No encontramos el pago. Actualiza la lista e intenta de nuevo."
              : error.message,
          )
        }
        open={deleteOpen}
        title="Eliminar pago"
      />
    </div>
  );
}
