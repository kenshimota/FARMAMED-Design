"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { NoticeBanner } from "@/components/erp/ui/banner";
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
  fetchPaymentHistory,
  type PaymentHistoryEntry,
  type PaymentRecord,
  type PaymentStatusResult,
} from "@/components/erp/records/payments-api";
import {
  currencyInputValue,
  PAYMENT_STATUS_DETAILS,
  paymentMethodLabel,
  paymentMoney,
  paymentReferenceLabel,
} from "@/components/erp/records/payment-shared";
import { PaymentHistoryTimeline } from "@/components/erp/records/payment-history-timeline";
import { PaymentReferenceImage } from "@/components/erp/records/payment-reference-image";
import { PaymentStatusBadge } from "@/components/erp/records/payment-status-badge";
import {
  PaymentStatusDialog,
  type PaymentStatusDialogMode,
} from "@/components/erp/records/payment-status-dialog";
import {
  fetchWallets,
  type CustomerWallet,
} from "@/components/erp/records/wallets-api";
import { ApiError } from "@/lib/api";
import { isOwnCustomerRecord } from "@/lib/customer-finance";
import { formatDateOnly, formatMoney } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type PaymentDetailData = {
  payment: PaymentRecord;
  customer: CustomerRecord | null;
  wallet: CustomerWallet | null;
  history: PaymentHistoryEntry[];
};

export function PaymentDetailPage({ paymentId }: { paymentId: string }) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const activityVisible = useActivityVisible();
  const fichaPagoId = useId();
  const saldoBilleteraPagoId = useId();
  const historialPagoId = useId();
  const isCustomer = user.role === "customer";
  const canRead = canReadModule(user.role, "pagos") || isCustomer;
  const canWrite = canWriteModule(user.role, "pagos");
  const canDelete = user.role === "admin";
  const canSeeHistory = user.role === "admin" || user.role === "seller";
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusMode, setStatusMode] = useState<PaymentStatusDialogMode | null>(
    null,
  );
  const [statusConfirmation, setStatusConfirmation] =
    useState<PaymentStatusResult | null>(null);

  const validId = isPositiveRecordId(paymentId);
  const loader = useCallback(async (): Promise<PaymentDetailData> => {
    const payment = await fetchPayment(paymentId);

    if (isCustomer) {
      if (!isOwnCustomerRecord(payment.customer_id, user.customer_id)) {
        throw new ApiError(404, { message: "Payment not found" });
      }
      return { payment, customer: null, wallet: null, history: [] };
    }

    const customerId = String(payment.customer_id);
    const historyPromise =
      payment.history !== undefined
        ? Promise.resolve(payment.history)
        : canSeeHistory
          ? fetchPaymentHistory(paymentId).catch(
              () => [] as PaymentHistoryEntry[],
            )
          : Promise.resolve<PaymentHistoryEntry[]>([]);
    const [customer, wallets, history] = await Promise.all([
      fetchCustomer(customerId).catch(() => null),
      fetchWallets(customerId).catch(() => [] as CustomerWallet[]),
      historyPromise,
    ]);
    const wallet =
      wallets.find(
        (item) => String(item.currency_id) === String(payment.currency_id),
      ) ?? null;
    return {
      payment,
      customer,
      wallet,
      history,
    };
  }, [canSeeHistory, isCustomer, paymentId, user.customer_id]);

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
        backHref={isCustomer ? "/app/billetera" : "/app/pagos"}
        backLabel={isCustomer ? "Volver a mi billetera" : "Volver a pagos"}
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
              href={isCustomer ? "/app/billetera" : "/app/pagos"}
            >
              {isCustomer ? "Volver a mi billetera" : "Volver a pagos"}
            </Link>
          }
          description={
            isCustomer
              ? "Consulta el estado y el comprobante de tu pago."
              : "Consulta el estado del pago, su comprobante y el efecto en la billetera del cliente."
          }
          eyebrow={isCustomer ? "Mi pago" : "Finanzas"}
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
        backHref={isCustomer ? "/app/billetera" : "/app/pagos"}
        backLabel={isCustomer ? "Volver a mi billetera" : "Volver a pagos"}
        description={
          notFound
            ? "Puede que haya sido eliminado, que el enlace no sea válido o que el pago no pertenezca a tu cuenta."
            : resource.error?.message ?? "No pudimos cargar el pago."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={notFound ? "No encontramos ese pago" : "No pudimos cargar el pago"}
      />
    );
  }

  const { payment, customer, wallet, history } = resource.data;
  const confirmation =
    statusConfirmation &&
    String(statusConfirmation.id) === String(payment.id)
      ? statusConfirmation
      : null;
  const currentStatus = confirmation?.status ?? payment.status;
  const currentRejectionReason =
    confirmation?.rejection_reason ?? payment.rejection_reason;
  const currentWallet =
    currentStatus === "conciliated"
      ? (confirmation?.wallet ?? wallet)
      : null;
  const displayPayment: PaymentRecord = {
    ...payment,
    status: currentStatus,
    rejection_reason: currentRejectionReason,
    wallet: currentWallet,
  };
  const currency = payment.currency ?? currentWallet?.currency ?? null;
  const customerName = isCustomer
    ? user.customer?.fullName || user.name || user.email
    : (customer?.fullName ?? `Cliente #${payment.customer_id}`);
  const referenceLabel = paymentReferenceLabel(payment);
  const walletHref = isCustomer
    ? "/app/billetera"
    : currentWallet
      ? `/app/billeteras/${currentWallet.id}`
      : `/app/billeteras?customer_id=${payment.customer_id}`;

  async function handleDelete() {
    const conciliated = currentStatus === "conciliated";
    await deletePayment(String(payment.id));
    toast.success(
      conciliated
        ? "Pago eliminado. El saldo de la billetera se actualizó."
        : "Pago eliminado. El saldo de la billetera no cambia.",
    );
    router.replace(isCustomer ? "/app/billetera" : "/app/pagos");
  }

  function handleStatusSuccess(
    result: PaymentStatusResult,
    mode: PaymentStatusDialogMode,
  ) {
    setStatusConfirmation(result);
    const creditedWallet = mode === "conciliate" ? result.wallet : null;
    toast.success(
      mode === "reject"
        ? "Pago rechazado."
        : creditedWallet
          ? `Pago conciliado. Nuevo saldo: ${formatMoney(
              creditedWallet.balance,
              creditedWallet.currency ?? currency ?? {},
            )}.`
          : "Pago conciliado. El saldo fue acreditado.",
    );
    setStatusMode(null);
    reloadDetail();
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite || canDelete ? (
            <>
              {canWrite && currentStatus === "pending" && (
                <>
                  <RecordActionButton
                    aria-label={`Conciliar el pago de ${customerName}`}
                    icon="check"
                    onClick={() => setStatusMode("conciliate")}
                  >
                    Conciliar pago
                  </RecordActionButton>
                  <RecordActionButton
                    aria-label={`Rechazar el pago de ${customerName}`}
                    danger
                    icon="close"
                    onClick={() => setStatusMode("reject")}
                  >
                    Rechazar pago
                  </RecordActionButton>
                </>
              )}
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
        description={
          isCustomer
            ? "Consulta el estado, el motivo y el comprobante de tu pago. El saldo se acredita solo cuando el pago se concilia."
            : "Consulta el estado, el comprobante y el efecto del pago en la billetera del cliente."
        }
        eyebrow={isCustomer ? "Mi pago" : "Finanzas"}
        title={`Pago de ${customerName}`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <PaymentStatusBadge status={currentStatus} />
          <CurrencyChip currency={currency} />
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href={isCustomer ? "/app/billetera" : "/app/pagos"}
        >
          {isCustomer ? "Volver a mi billetera" : "Volver a pagos"}
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
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

            <div className="mt-4">
              {currentStatus === "rejected" ? (
                <NoticeBanner tone="danger">
                  <p className="font-semibold">
                    Rechazado:{" "}
                    {currentRejectionReason || "El pago fue rechazado."}
                  </p>
                  <p className="mt-1">
                    El saldo no fue acreditado en la billetera del cliente.
                  </p>
                </NoticeBanner>
              ) : (
                <NoticeBanner
                  tone={currentStatus === "conciliated" ? "success" : "info"}
                >
                  {PAYMENT_STATUS_DETAILS[currentStatus]}
                </NoticeBanner>
              )}
            </div>

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

            <div className="mt-7 border-t border-line pt-5">
              <span className="eyebrow">Comprobante</span>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink">
                Imagen de referencia
              </h3>
              <div className="mt-4">
                <PaymentReferenceImage
                  image={payment.reference_image}
                  referenceLabel={referenceLabel}
                  variant="full"
                />
              </div>
            </div>

            <div className="mt-6 space-y-3 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
              <p>
                El cliente, el método, la moneda y el monto son inmutables. Solo
                puedes actualizar la referencia, las notas, la fecha del pago y
                reemplazar el comprobante.
              </p>
              <p>
                {currentStatus === "conciliated"
                  ? "Este pago está conciliado. Si se elimina, se revierte el depósito y la billetera no puede quedar con saldo negativo."
                  : "Este pago no está conciliado, por lo que no tiene depósito asociado en la billetera."}
                {canDelete
                  ? " Un pago aplicado a una factura no se puede eliminar."
                  : " Solo un administrador puede eliminarlo cuando no tenga asignaciones."}
              </p>
            </div>
          </section>

          {canSeeHistory && (
            <section
              aria-labelledby={historialPagoId}
              className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
            >
              <span className="eyebrow">Auditoría</span>
              <h2
                className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
                id={historialPagoId}
              >
                Historial del pago
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-muted">
                Cambios de estado con su motivo, actor y fecha. El historial es
                solo de consulta y está disponible para administradores y
                vendedores.
              </p>
              <div className="mt-5">
                <PaymentHistoryTimeline history={history} />
              </div>
            </section>
          )}
        </div>

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
              {currentStatus === "conciliated" ? "Saldo actual" : "Estado del saldo"}
            </h2>

            {currentStatus === "pending" && (
              <p className="mt-4 text-[13px] leading-6 text-muted">
                Pendiente de conciliación. El saldo aún no está disponible y no
                se crea ningún movimiento de depósito.
              </p>
            )}

            {currentStatus === "rejected" && (
              <p className="mt-4 text-[13px] leading-6 text-muted">
                Pago rechazado. No se acreditó saldo en la billetera del
                cliente.
              </p>
            )}

            {currentStatus === "conciliated" &&
              (currentWallet ? (
                <>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    {currencyInputValue(currency) || "Moneda del pago"}
                  </p>
                  <p className="mt-1.5 text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink">
                    {formatMoney(currentWallet.balance, currency ?? {})}
                  </p>
                  <Link
                    className="button-base button-secondary mt-5 min-h-11 w-full px-4 text-[13px]"
                    href={walletHref}
                  >
                    {isCustomer ? "Ver mi billetera" : "Ver movimientos"}
                    <Icon name="arrow-right" size={16} />
                  </Link>
                </>
              ) : (
                <p className="mt-4 text-[13px] leading-6 text-muted">
                  {isCustomer
                    ? "El pago está conciliado. Consulta tu saldo en Mi billetera."
                    : "El pago está conciliado. No pudimos consultar el saldo actual de la billetera."}
                </p>
              ))}

            {isCustomer ? (
              <Link
                className="mt-3 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href="/app/billetera"
              >
                Ver mi billetera
                <Icon name="arrow-up-right" size={14} />
              </Link>
            ) : (
              <Link
                className="mt-3 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href={`/app/billeteras?customer_id=${payment.customer_id}`}
              >
                Ver billeteras del cliente
                <Icon name="arrow-up-right" size={14} />
              </Link>
            )}
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
            de {customerName}.{" "}
            {currentStatus === "conciliated"
              ? "Se ajustará el saldo de su billetera."
              : "No se ajusta el saldo porque el pago no está conciliado."}{" "}
            Si el pago ya está aplicado a una factura, no se puede eliminar.
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

      <PaymentStatusDialog
        currency={currency}
        customerName={customerName}
        mode={statusMode ?? "conciliate"}
        onClose={() => setStatusMode(null)}
        onSuccess={handleStatusSuccess}
        open={statusMode !== null}
        payment={displayPayment}
      />
    </div>
  );
}
