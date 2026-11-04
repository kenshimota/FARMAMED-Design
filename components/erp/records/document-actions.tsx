"use client";

import { useEffect, useId, useState } from "react";
import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  documentErrorCopy,
  downloadInvoicePdf,
} from "@/components/erp/records/document-api";
import { DownloadDocumentButton } from "@/components/erp/records/download-document-button";
import { QuotationPdfDialog } from "@/components/erp/records/quotation-pdf-dialog";
import type { OrderInvoiceRef, OrderRecord } from "@/components/erp/records/orders-api";
import type { RecordId } from "@/components/erp/records/records-api";
import { fetchOrderInvoice } from "@/lib/finance/invoices-api";

const invoiceRefCache = new Map<string, OrderInvoiceRef>();
const invoiceRefRequests = new Map<string, Promise<OrderInvoiceRef>>();

async function loadOrderInvoiceRef(orderId: string): Promise<OrderInvoiceRef> {
  const cached = invoiceRefCache.get(orderId);
  if (cached) return cached;

  const pending = invoiceRefRequests.get(orderId);
  if (pending) return pending;

  const request = fetchOrderInvoice(orderId).then((invoice) => {
    const value: OrderInvoiceRef = { id: invoice.id, number: invoice.number };
    invoiceRefCache.set(orderId, value);
    return value;
  });

  invoiceRefRequests.set(orderId, request);
  try {
    return await request;
  } finally {
    invoiceRefRequests.delete(orderId);
  }
}

export function InvoicePdfAction({
  invoiceId,
  invoiceNumber,
  accessibleLabel,
  variant = "primary",
  className = "",
  supportingText = "La factura conserva la moneda en que fue emitida.",
  fullWidth = false,
}: {
  invoiceId: RecordId;
  invoiceNumber: number | string;
  accessibleLabel?: string;
  variant?: "primary" | "secondary";
  className?: string;
  supportingText?: string;
  fullWidth?: boolean;
}) {
  return (
    <DownloadDocumentButton
      accessibleLabel={
        accessibleLabel ??
        `Descargar factura PDF de la factura #${invoiceNumber}`
      }
      className={className}
      fullWidth={fullWidth}
      label="Descargar factura PDF"
      onDownload={() => downloadInvoicePdf(invoiceId, invoiceNumber)}
      successMessage="Descarga iniciada."
      supportingText={supportingText}
      variant={variant}
    />
  );
}

type InvoiceLookupStatus = "idle" | "loading" | "ready" | "error";

export function OrderDocumentActions({
  order,
  onReload,
  onOpenQuotation,
  showDialog = true,
  className = "",
}: {
  order: OrderRecord;
  onReload?: () => void | Promise<void>;
  onOpenQuotation?: () => void;
  showDialog?: boolean;
  className?: string;
}) {
  const linesHelpId = useId();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [fetchedInvoice, setFetchedInvoice] = useState<OrderInvoiceRef | null>(
    null,
  );
  const [lookupStatus, setLookupStatus] =
    useState<InvoiceLookupStatus>("idle");
  const [invoiceAttempt, setInvoiceAttempt] = useState(0);

  const quoteable =
    order.status === "draft" ||
    order.status === "request" ||
    order.status === "generate";
  const invoiced = order.status === "invoiced";
  const cancelled = order.status === "cancelled";
  const hasLines =
    (order.items?.length ?? 0) > 0 ||
    (order.items === null && order.itemsCount > 0);
  const knownInvoice = order.invoice;
  const invoiceRef =
    knownInvoice?.id !== null && knownInvoice?.id !== undefined
      ? knownInvoice
      : fetchedInvoice;
  const invoiceStatus: InvoiceLookupStatus = !invoiced
    ? "idle"
    : invoiceRef?.id !== null && invoiceRef?.id !== undefined
      ? "ready"
      : lookupStatus;

  useEffect(() => {
    if (
      !invoiced ||
      (order.invoice?.id !== null && order.invoice?.id !== undefined)
    ) {
      return;
    }
    let active = true;

    async function loadInvoice() {
      setLookupStatus("loading");
      setFetchedInvoice(null);
      try {
        const invoice = await loadOrderInvoiceRef(String(order.id));
        if (!active) return;
        setFetchedInvoice(invoice);
        setLookupStatus("ready");
      } catch {
        if (!active) return;
        setLookupStatus("error");
      }
    }

    void loadInvoice();
    return () => {
      active = false;
    };
  }, [invoiced, order.id, order.invoice?.id, invoiceAttempt]);

  function handleConflict(caught: unknown) {
    setNotice(documentErrorCopy(caught).message);
    setQuoteOpen(false);
    void onReload?.();
  }

  if (!quoteable && !invoiced && !cancelled) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {notice && !cancelled && (
        <NoticeBanner role="alert" tone="warning">
          {notice}
        </NoticeBanner>
      )}

      {cancelled && (
        <NoticeBanner tone="warning">
          Este pedido está cancelado y no se puede cotizar.
        </NoticeBanner>
      )}

      {quoteable && (
        <>
          <button
            aria-describedby={hasLines ? undefined : linesHelpId}
            aria-haspopup="dialog"
            aria-label={`Generar cotización PDF del pedido #${order.number}`}
            className="button-base button-primary min-h-11 w-full px-5 text-[13px]"
            disabled={!hasLines}
            onClick={() => {
              setNotice(null);
              if (!showDialog) {
                onOpenQuotation?.();
                return;
              }
              setQuoteOpen(true);
            }}
            type="button"
          >
            <Icon aria-hidden="true" name="download" size={16} />
            Generar cotización PDF
          </button>
          {!hasLines && (
            <p
              className="text-[12px] leading-5 text-muted"
              id={linesHelpId}
            >
              El pedido no tiene líneas para cotizar.
            </p>
          )}
        </>
      )}

      {invoiced && (
        <>
          {invoiceStatus === "loading" && (
            <button
              className="button-base button-secondary min-h-11 w-full px-5 text-[13px]"
              disabled
              type="button"
            >
              Buscando la factura…
            </button>
          )}

          {invoiceStatus === "error" && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={() => setInvoiceAttempt((current) => current + 1)}
                  type="button"
                >
                  Reintentar
                </button>
              }
              tone="warning"
            >
              No pudimos localizar la factura de este pedido.
            </NoticeBanner>
          )}

          {invoiceStatus === "ready" &&
            invoiceRef?.id !== null &&
            invoiceRef?.id !== undefined && (
              <InvoicePdfAction
                accessibleLabel={`Descargar factura PDF del pedido #${order.number}`}
                fullWidth
                invoiceId={invoiceRef.id}
                invoiceNumber={invoiceRef.number ?? invoiceRef.id}
                supportingText="Este pedido ya fue facturado. Descarga la factura."
              />
            )}
        </>
      )}

      {showDialog && quoteOpen && (
        <QuotationPdfDialog
          onClose={() => setQuoteOpen(false)}
          onConflict={handleConflict}
          open={quoteOpen}
          order={order}
        />
      )}
    </div>
  );
}
