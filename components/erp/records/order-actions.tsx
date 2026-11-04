"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { OrderDocumentActions } from "@/components/erp/records/document-actions";
import { documentErrorCopy } from "@/components/erp/records/document-api";
import { QuotationPdfDialog } from "@/components/erp/records/quotation-pdf-dialog";
import {
  ORDER_COPY,
  mapPaymentTermFieldError,
  orderErrorMessage,
  readStockShortage,
  type OrderStockShortage,
} from "@/components/erp/records/orders-errors";
import {
  fetchPaymentTerms,
  updateOrderPaymentTerm,
  updateOrderStatus,
  type OrderInvoiceRef,
  type OrderRecord,
  type OrderStatusRecord,
} from "@/components/erp/records/orders-api";
import {
  findOrderStatus,
  isCashPaymentTerm,
  isTerminalOrderStatus,
  orderItemStateLabel,
  orderProductLabel,
  orderMoney,
  paymentTermDetail,
  paymentTermLabel,
  type OrderDisplayCurrency,
} from "@/components/erp/records/orders-shared";
import { SelectField } from "@/components/erp/records/form-controls";
import { toApiId } from "@/components/erp/records/records-api";

type OrderDialog = "generate" | "invoice" | "cancel" | "payment" | null;

type ActionError = {
  message: string;
  shortage: OrderStockShortage | null;
};

export function OrderActionsSection({
  order,
  statuses,
  currency,
  canWrite,
  onReload,
}: {
  order: OrderRecord;
  statuses: readonly OrderStatusRecord[];
  currency: OrderDisplayCurrency | null;
  canWrite: boolean;
  onReload: () => void;
}) {
  const toast = useToast();
  const [dialog, setDialog] = useState<OrderDialog>(null);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [resultInvoice, setResultInvoice] = useState<OrderInvoiceRef | null>(null);
  const [selectedTerm, setSelectedTerm] = useState("");
  const [termError, setTermError] = useState<string | null>(null);
  const [termMessage, setTermMessage] = useState<string | null>(null);
  const [termBusy, setTermBusy] = useState(false);
  const [quotationOpen, setQuotationOpen] = useState(false);
  const [documentNotice, setDocumentNotice] = useState<string | null>(null);
  const mobileActionsButtonRef = useRef<HTMLButtonElement>(null);

  const currentStatus = findOrderStatus(order.status, statuses);
  const terminal =
    currentStatus?.isTerminal ?? isTerminalOrderStatus(order.status, statuses);
  const canChangeTerm =
    canWrite && (order.status === "draft" || order.status === "request");
  const showApprove = canWrite && order.status === "request" && !terminal;
  const showGenerate = canWrite && order.status === "draft" && !terminal;
  const showInvoice = canWrite && order.status === "generate" && !terminal;
  const showCancel = canWrite && !terminal;

  const termsResource = useAsyncResource(fetchPaymentTerms, {
    enabled: canChangeTerm,
  });
  const terms = termsResource.data ?? [];
  const selectedTermRecord =
    terms.find((term) => String(term.id) === selectedTerm) ?? null;
  const invoice = resultInvoice ?? order.invoice;

  function openPaymentDialog() {
    setSelectedTerm(
      order.paymentTermId !== null ? String(order.paymentTermId) : "",
    );
    setTermError(null);
    setTermMessage(null);
    setMobileActionsOpen(false);
    setDialog("payment");
  }

  function closePaymentDialog() {
    if (termBusy) return;
    setDialog(null);
    setTermError(null);
    setTermMessage(null);
  }

  function openQuotation() {
    setDocumentNotice(null);
    setMobileActionsOpen(false);
    setQuotationOpen(true);
  }

  function focusMobileActions() {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      window.setTimeout(() => mobileActionsButtonRef.current?.focus(), 0);
    }
  }

  function closeQuotation() {
    setQuotationOpen(false);
    focusMobileActions();
  }

  function handleQuotationConflict(caught: unknown) {
    setDocumentNotice(documentErrorCopy(caught).message);
    setQuotationOpen(false);
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 767px)").matches
    ) {
      setMobileActionsOpen(true);
    }
    onReload();
  }

  async function runStatus(target: string) {
    setActionError(null);
    try {
      const result = await updateOrderStatus(order.id, target);
      if (target === "invoiced") {
        setResultInvoice(result.invoice ?? result.order.invoice);
        toast.success(ORDER_COPY.invoiced);
      } else if (target === "generate") {
        toast.success(ORDER_COPY.generated);
      } else if (target === "cancelled") {
        toast.success(ORDER_COPY.cancelled);
      } else {
        toast.success(ORDER_COPY.updated);
      }
      onReload();
    } catch (caught) {
      setActionError({
        message: orderErrorMessage(caught),
        shortage: readStockShortage(caught),
      });
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches
      ) {
        setMobileActionsOpen(true);
      }
      onReload();
    }
  }

  async function handlePaymentTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (termBusy) return;
    if (!selectedTerm) {
      setTermError(ORDER_COPY.paymentTermRequired);
      return;
    }
    setTermBusy(true);
    setTermError(null);
    setTermMessage(null);
    try {
      await updateOrderPaymentTerm(
        order.id,
        selectedTermRecord?.id ?? toApiId(selectedTerm),
      );
      toast.success(ORDER_COPY.paymentTermChanged);
      setActionError(null);
      setDialog(null);
      onReload();
    } catch (caught) {
      setTermMessage(
        mapPaymentTermFieldError(caught) ?? orderErrorMessage(caught),
      );
    } finally {
      setTermBusy(false);
    }
  }

  function shortageInfo(
    productId: string | number,
    itemStateId: string | number | null,
  ) {
    const item = (order.items ?? []).find(
      (candidate) =>
        String(candidate.productId) === String(productId) &&
        (itemStateId === null ||
          String(candidate.itemStateId) === String(itemStateId)),
    );
    return {
      productId,
      productName: item
        ? orderProductLabel(item.product, item.productId)
        : `Producto #${productId}`,
      stateName: item
        ? orderItemStateLabel(item.itemState, item.itemStateId)
        : null,
    };
  }

  const primaryAction:
    | { label: string; dialog: "generate" | "invoice" }
    | null = showApprove
    ? { label: "Aprobar pedido", dialog: "generate" }
    : showGenerate
      ? { label: "Generar pedido", dialog: "generate" }
      : showInvoice
        ? { label: "Facturar", dialog: "invoice" }
        : null;

  function openAction(next: Exclude<OrderDialog, null>) {
    setMobileActionsOpen(false);
    setDialog(next);
  }

  const actionsContent = (
    <>
      {documentNotice && (
        <NoticeBanner className="mb-4" role="alert" tone="warning">
          {documentNotice}
        </NoticeBanner>
      )}

      <div className="rounded-2xl border border-line bg-background px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          Término de pago
        </p>
        <p className="mt-1 text-[14px] font-semibold text-ink">
          {paymentTermLabel(order.paymentTerm)}
        </p>
        <p className="mt-1 text-[12px] leading-5 text-muted">
          {paymentTermDetail(order.paymentTerm)}
        </p>
        {canChangeTerm && (
          <button
            className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            onClick={openPaymentDialog}
            type="button"
          >
            Cambiar término
            <Icon name="arrow-right" size={14} />
          </button>
        )}
      </div>

      {canWrite &&
        (order.status === "generate" || order.status === "invoiced") && (
          <Link
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-ink/15 bg-surface px-5 text-[13px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand"
            href={`/app/pedidos/${order.id}/alistamiento`}
          >
            <Icon name="box" size={17} />
            {order.status === "generate" ? "Preparar pedido" : "Ver alistamiento"}
          </Link>
        )}

      {isCashPaymentTerm(order.paymentTerm) &&
        (order.status === "draft" || order.status === "request") && (
          <NoticeBanner className="mt-4" tone="info">
            Para un pedido de contado, la billetera del cliente debe cubrir el
            total antes de generarlo.
          </NoticeBanner>
        )}

      {!terminal && !order.paymentTerm && (
        <NoticeBanner className="mt-4" role="status" tone="warning">
          Este pedido no tiene término de pago. Antes de generar o solicitar el
          pedido debes asignar uno activo.
        </NoticeBanner>
      )}

      {actionError && (
        <NoticeBanner className="mt-4" role="alert" tone="danger">
          <p>{actionError.message}</p>
          {actionError.shortage && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {actionError.shortage.items.map((item, index) => {
                const info = shortageInfo(item.productId, item.itemStateId);
                return (
                  <li key={`${item.productId}-${item.itemStateId ?? "all"}-${index}`}>
                    <Link
                      className="font-semibold underline underline-offset-4 hover:text-ink"
                      href={`/app/productos/${info.productId}`}
                    >
                      {info.productName}
                    </Link>
                    {info.stateName ? ` · ${info.stateName}` : ""}
                  </li>
                );
              })}
            </ul>
          )}
          {actionError.message === ORDER_COPY.walletBalance && (
            <p className="mt-2 text-[12px] leading-5">
              No disponible en esta versión.
            </p>
          )}
        </NoticeBanner>
      )}

      {terminal && (
        <NoticeBanner className="mt-4" role="status" tone="info">
          Este pedido está en un estado terminal y solo admite consulta.
        </NoticeBanner>
      )}

      {!canWrite && !terminal && (
        <NoticeBanner className="mt-4" role="status" tone="info">
          Tu rol puede consultar este pedido, pero no tiene permisos para
          cambiar su estado ni su término de pago.
        </NoticeBanner>
      )}

      {canWrite && !terminal && (
        <div className="mt-5 flex flex-wrap gap-3">
          {showApprove && (
            <button
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              onClick={() => openAction("generate")}
              type="button"
            >
              Aprobar pedido
              <Icon name="check" size={17} />
            </button>
          )}
          {showGenerate && (
            <button
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              onClick={() => openAction("generate")}
              type="button"
            >
              Generar pedido
              <Icon name="arrow-right" size={17} />
            </button>
          )}
          {showInvoice && (
            <button
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              onClick={() => openAction("invoice")}
              type="button"
            >
              Facturar
              <Icon name="check" size={17} />
            </button>
          )}
          {showCancel && (
            <button
              className="button-base min-h-11 border border-alert/35 bg-surface px-5 text-[13px] text-alert-ink hover:border-alert hover:bg-alert/[0.06] hover:shadow-[0_10px_28px_rgba(193,39,45,0.14)]"
              onClick={() => openAction("cancel")}
              type="button"
            >
              Cancelar pedido
              <Icon name="close" size={17} />
            </button>
          )}
        </div>
      )}

      {order.status === "invoiced" && (
        <div className="mt-5 rounded-2xl border border-olive/30 bg-soft-lime px-4 py-3.5 text-[12px] leading-5 text-ink">
          <p className="font-semibold">
            {invoice?.number ?? invoice?.id
              ? `Factura #${invoice?.number ?? invoice?.id} registrada.`
              : "El pedido quedó facturado."}
          </p>
          {invoice?.id !== null && invoice?.id !== undefined ? (
            <Link
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/facturas/${invoice.id}`}
            >
              Ver factura
              <Icon name="arrow-right" size={14} />
            </Link>
          ) : (
            <p className="mt-1 text-muted">
              La factura no está disponible para consulta en este momento.
            </p>
          )}
        </div>
      )}

      {order.status === "generate" && (
        <p className="mt-4 text-[12px] leading-5 text-muted">
          La existencia está reservada. El stock se descuenta al facturar y la
          reserva se libera si cancelas el pedido.
        </p>
      )}

      <OrderDocumentActions
        className="mt-4"
        onOpenQuotation={openQuotation}
        onReload={onReload}
        order={order}
        showDialog={false}
      />
    </>
  );

  return (
    <>
      <section
        aria-labelledby="acciones-pedido"
        className="hidden rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] md:block sm:p-7"
      >
        <span className="eyebrow">Acciones</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="acciones-pedido"
        >
          Acciones del pedido
        </h2>
        <div className="mt-4">{actionsContent}</div>
      </section>

      <div
        aria-label="Acciones del pedido"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pb-4 pt-3 shadow-[0_-12px_40px_rgba(27,12,104,0.1)] backdrop-blur md:hidden"
        role="region"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {primaryAction && (
            <button
              className="button-base button-primary min-h-11 flex-1 px-4 text-[13px]"
              onClick={() => openAction(primaryAction.dialog)}
              type="button"
            >
              {primaryAction.label}
            </button>
          )}
          <button
            aria-haspopup="dialog"
            className="button-base button-secondary min-h-11 flex-1 px-4 text-[13px]"
            onClick={() => setMobileActionsOpen(true)}
            ref={mobileActionsButtonRef}
            type="button"
          >
            Acciones
            <Icon name="menu" size={16} />
          </button>
        </div>
      </div>

      <FormDialog
        description={`Pedido #${order.number}. Elige una acción disponible según su estado.`}
        onClose={() => setMobileActionsOpen(false)}
        open={mobileActionsOpen}
        title="Acciones del pedido"
      >
        <div className="mt-5">{actionsContent}</div>
      </FormDialog>

      <ConfirmDialog
        confirmBusyLabel="Procesando…"
        confirmLabel={showApprove ? "Aprobar pedido" : "Generar pedido"}
        description={
          <div className="space-y-2">
            <p>
              Se reservará existencia para las líneas del pedido. Si falta stock,
              el pedido no cambia.
            </p>
            {isCashPaymentTerm(order.paymentTerm) && (
              <p>
                Pedido de contado: la billetera del cliente debe cubrir{" "}
                <span className="font-semibold text-ink">
                  {orderMoney(order.total, currency)}
                </span>{" "}
                antes de generarlo.
              </p>
            )}
          </div>
        }
        onClose={() => setDialog(null)}
        onConfirm={() => runStatus("generate")}
        onError={(error) => toast.error(error.message)}
        open={dialog === "generate"}
        title={
          order.status === "request"
            ? `¿Aprobar el pedido #${order.number}?`
            : `¿Generar el pedido #${order.number}?`
        }
      />

      <ConfirmDialog
        confirmBusyLabel="Facturando…"
        confirmLabel="Facturar"
        description={
          <div className="space-y-2">
            <p>
              Se creará la factura y se descontará la existencia reservada.
            </p>
            <p>Esta acción no se puede deshacer.</p>
            <p className="font-semibold text-ink">
              Total a facturar: {orderMoney(order.total, currency)}
            </p>
          </div>
        }
        onClose={() => setDialog(null)}
        onConfirm={() => runStatus("invoiced")}
        onError={(error) => toast.error(error.message)}
        open={dialog === "invoice"}
        title={`¿Facturar el pedido #${order.number}?`}
      />

      <ConfirmDialog
        confirmBusyLabel="Cancelando…"
        confirmLabel="Cancelar pedido"
        description={
          <div className="space-y-2">
            <p>
              Se liberará la reserva de existencia si el pedido ya estaba
              generado.
            </p>
            <p>Esta acción no se puede deshacer.</p>
          </div>
        }
        onClose={() => setDialog(null)}
        onConfirm={() => runStatus("cancelled")}
        onError={(error) => toast.error(error.message)}
        open={dialog === "cancel"}
        title={`¿Cancelar el pedido #${order.number}?`}
      />

      <FormDialog
        closeDisabled={termBusy}
        description="Solo se puede cambiar en pedidos en borrador o solicitados."
        onClose={closePaymentDialog}
        open={dialog === "payment"}
        title="Cambiar término de pago"
      >
        <form className="mt-6 space-y-5" noValidate onSubmit={handlePaymentTerm}>
          {termMessage && (
            <NoticeBanner role="alert" tone="danger">
              {termMessage}
            </NoticeBanner>
          )}
          <SelectField
            emptyLabel="No hay términos de pago activos."
            error={termError ?? undefined}
            id="pedido-termino-pago"
            label="Término de pago"
            loading={termsResource.status === "loading"}
            loadingLabel="Cargando términos de pago…"
            loadError={
              termsResource.status === "error"
                ? termsResource.error?.message ??
                  "No pudimos cargar los términos de pago."
                : null
            }
            onChange={(value) => {
              setSelectedTerm(value);
              setTermError(null);
              setTermMessage(null);
            }}
            onRetry={termsResource.reload}
            options={terms.map((term) => ({
              value: String(term.id),
              label: `${term.name} · ${paymentTermDetail(term)}`,
            }))}
            placeholder="Selecciona un término"
            required
            value={selectedTerm}
          />
          {isCashPaymentTerm(selectedTermRecord) && (
            <NoticeBanner tone="info">
              Para un pedido de contado, la billetera del cliente debe cubrir el
              total antes de generarlo.
            </NoticeBanner>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="button-base button-secondary min-h-11 px-5"
              disabled={termBusy}
              onClick={closePaymentDialog}
              type="button"
            >
              Cancelar
            </button>
            <BusyButton busy={termBusy} busyLabel="Guardando…" type="submit">
              Guardar término
            </BusyButton>
          </div>
        </form>
      </FormDialog>

      {quotationOpen && (
        <QuotationPdfDialog
          onClose={closeQuotation}
          onConflict={handleQuotationConflict}
          open={quotationOpen}
          order={order}
        />
      )}
    </>
  );
}
