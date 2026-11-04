"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { formatDateTime, formatMoney, formatRate } from "@/lib/format";
import { buildLoginUrl, getCurrentReturnPath } from "@/lib/session-store";
import { canReadModule } from "@/lib/permissions";
import { useSession } from "@/components/erp/session-context";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import {
  documentErrorCopy,
  downloadQuotationPdf,
  fetchQuotationCurrencyCatalog,
  fetchQuotationPreview,
  type DocumentCatalogNotice,
  type DocumentCurrency,
} from "@/components/erp/records/document-api";
import {
  EQUIVALENCE_COPY,
  equivalenceErrorCopy,
  type EquivalenceErrorCopy,
} from "@/components/erp/records/equivalence/equivalence-copy";
import { orderMoney } from "@/components/erp/records/orders-shared";
import type { OrderRecord } from "@/components/erp/records/orders-api";
import type { OrderEquivalence } from "@/lib/finance/equivalence-api";

type CatalogStatus = "loading" | "ready";
type PreviewStatus = "idle" | "loading" | "ready" | "error";

function currencyOptionLabel(currency: DocumentCurrency) {
  const code = currency.code.toUpperCase() === "VES" ? "VES" : currency.code;
  const base = `${currency.name} (${code})`;
  return currency.isOrderCurrency ? `${base} · Moneda del pedido` : base;
}

function rateUpdatedAt(preview: OrderEquivalence | null) {
  return preview?.ratesUpdatedAt?.target ?? preview?.ratesUpdatedAt?.source ?? null;
}

export function QuotationPdfDialog({
  open,
  order,
  onClose,
  onConflict,
}: {
  open: boolean;
  order: OrderRecord;
  onClose: () => void;
  onConflict: (caught: unknown) => void;
}) {
  const { user } = useSession();
  const canReadCurrencies = canReadModule(user.role, "monedas");
  const selectId = useId();
  const helpId = useId();
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const [options, setOptions] = useState<DocumentCurrency[]>([]);
  const [catalogNotice, setCatalogNotice] =
    useState<DocumentCatalogNotice | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [preview, setPreview] = useState<OrderEquivalence | null>(null);
  const [previewError, setPreviewError] = useState<EquivalenceErrorCopy | null>(
    null,
  );
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorCanRetry, setErrorCanRetry] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const selectedOption =
    options.find((option) => String(option.id) === selectedId) ?? null;
  const selectedIsOrderCurrency = selectedOption?.isOrderCurrency === true;
  const selectedCurrencyId = selectedOption?.id ?? null;
  const previewCurrency = preview?.target.currency ?? null;
  const previewTotal =
    typeof preview?.target.total === "number" ? preview.target.total : null;
  const rateUpdate = rateUpdatedAt(preview);

  useEffect(() => {
    if (!open) return;
    let active = true;

    async function loadCatalog() {
      try {
        const catalog = await fetchQuotationCurrencyCatalog(order, {
          includeActiveCurrencies: canReadCurrencies,
        });
        if (!active) return;
        setOptions(catalog.options);
        setCatalogNotice(catalog.notice);
        setSelectedId(
          catalog.options[0] ? String(catalog.options[0].id) : "",
        );
        setCatalogStatus("ready");
      } catch {
        if (!active) return;
        setOptions([]);
        setSelectedId("");
        setCatalogStatus("ready");
        setCatalogNotice({
          tone: "warning",
          message:
            "No pudimos cargar las monedas. Intenta de nuevo en unos momentos.",
        });
      }
    }

    void loadCatalog();
    return () => {
      active = false;
    };
  }, [canReadCurrencies, open, order]);

  useEffect(() => {
    if (!open) return;
    if (selectedIsOrderCurrency || selectedCurrencyId === null) return;

    let active = true;

    async function loadPreview() {
      setPreviewStatus("loading");
      setPreview(null);
      setPreviewError(null);
      try {
        const result = await fetchQuotationPreview(
          order.id,
          selectedCurrencyId,
        );
        if (!active) return;
        setPreview(result);
        setPreviewStatus("ready");
      } catch (caught) {
        if (!active) return;
        setPreview(null);
        setPreviewStatus("error");
        const translated = translateApiError(caught);
        const info = equivalenceErrorCopy(translated);
        setPreviewError(
          translated.status === 404 || translated.status === 422
            ? {
                ...info,
                canRetry: false,
                description:
                  translated.status === 404
                    ? "No encontramos el pedido ni la moneda seleccionada. Cambia de moneda para continuar."
                    : "La moneda seleccionada no está disponible. Corrige la selección o cambia de moneda.",
              }
            : info,
        );
      }
    }

    void loadPreview();
    return () => {
      active = false;
    };
  }, [
    open,
    order.id,
    previewAttempt,
    selectedCurrencyId,
    selectedIsOrderCurrency,
  ]);

  async function handleDownload() {
    if (!selectedOption || busy) return;
    setBusy(true);
    setError(null);
    setErrorStatus(null);
    setErrorCanRetry(false);
    setAnnouncement("");
    try {
      await downloadQuotationPdf(
        order.id,
        order.number,
        selectedIsOrderCurrency ? null : selectedOption.id,
        selectedOption.code,
      );
      setAnnouncement("Cotización descargada.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        onConflict(caught);
        return;
      }
      const info = documentErrorCopy(caught);
      setError(info.message);
      setErrorStatus(info.status);
      setErrorCanRetry(info.canRetry);
    } finally {
      setBusy(false);
    }
  }

  const targetTotal = selectedIsOrderCurrency
    ? orderMoney(order.total, order.currency)
    : selectedCurrencyId === null
      ? "Selecciona una moneda."
      : previewStatus === "ready" &&
          previewTotal !== null &&
          previewCurrency !== null
        ? formatMoney(previewTotal, previewCurrency)
        : previewStatus === "loading"
          ? "Calculando…"
          : "Se calcula al generar el documento.";
  const liveMessage = selectedIsOrderCurrency
    ? `Moneda del pedido. Total ${orderMoney(order.total, order.currency)}.`
    : previewStatus === "loading"
      ? "Calculando la conversión."
      : previewStatus === "ready" &&
          previewTotal !== null &&
          previewCurrency !== null &&
          preview !== null
        ? `Total en ${previewCurrency.name} (${previewCurrency.code}): ${formatMoney(
            previewTotal,
            previewCurrency,
          )}. Tasa ${formatRate(preview.exchangeRate)}.`
        : "";
  const errorAction =
    errorCanRetry || errorStatus === 401 ? (
      <div className="flex flex-wrap gap-2">
        {errorCanRetry && (
          <button
            className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold text-alert-ink transition-colors hover:bg-surface"
            onClick={() => void handleDownload()}
            type="button"
          >
            Reintentar
          </button>
        )}
        {errorStatus === 401 && (
          <Link
            className="inline-flex min-h-11 items-center text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href={buildLoginUrl(getCurrentReturnPath(), "expirada")}
          >
            Iniciar sesión
          </Link>
        )}
      </div>
    ) : undefined;

  return (
    <FormDialog
      closeDisabled={busy}
      description="Elige la moneda de la cotización. El documento es informativo y no modifica el pedido."
      onClose={onClose}
      open={open}
      title={`Cotización del pedido #${order.number}`}
    >
      <div className="mt-6 space-y-5">
        <p aria-live="polite" className="sr-only">
          {busy ? "Generando PDF…" : liveMessage}
        </p>

        {catalogNotice && (
          <NoticeBanner tone={catalogNotice.tone}>
            {catalogNotice.message}
          </NoticeBanner>
        )}

        {error && (
          <NoticeBanner action={errorAction} role="alert" tone="danger">
            {error}
          </NoticeBanner>
        )}

        {announcement && (
          <NoticeBanner tone="success">{announcement}</NoticeBanner>
        )}

        <div>
          <label
            className="mb-2 block text-[13px] font-semibold text-ink"
            htmlFor={selectId}
          >
            Moneda de la cotización
          </label>
          <p className="mb-2 text-[12px] leading-5 text-muted" id={helpId}>
            Si eliges la moneda del pedido no hay conversión. La cotización no
            cambia la moneda ni los importes guardados.
          </p>
          <select
            aria-describedby={helpId}
            className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
            disabled={catalogStatus !== "ready" || options.length === 0 || busy}
            id={selectId}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setPreviewStatus("idle");
              setPreview(null);
              setPreviewError(null);
              setError(null);
              setErrorStatus(null);
              setErrorCanRetry(false);
              setAnnouncement("");
            }}
            value={selectedId}
          >
            {catalogStatus === "loading" ? (
              <option value="">Cargando monedas…</option>
            ) : options.length === 0 ? (
              <option value="">No hay monedas disponibles para cotizar.</option>
            ) : (
              options.map((option) => (
                <option key={`${String(option.id)}-${option.code}`} value={String(option.id)}>
                  {currencyOptionLabel(option)}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Moneda del pedido
          </p>
          <p className="mt-1 text-[14px] font-semibold text-ink">
            {order.currency
              ? `${order.currency.name} (${order.currency.code})`
              : "Sin moneda registrada"}
          </p>
          <p className="mt-1 text-[12px] leading-5 text-muted">
            Solo lectura. La cotización no cambia la moneda del pedido.
          </p>
        </div>

        <dl className="grid gap-4 rounded-2xl border border-line bg-background p-4 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {EQUIVALENCE_COPY.totalOrder}
            </dt>
            <dd className="mt-1 text-[16px] font-semibold tabular-nums text-ink">
              {orderMoney(order.total, order.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Total de la cotización
            </dt>
            <dd className="mt-1 text-[16px] font-semibold tabular-nums text-ink">
              {targetTotal}
            </dd>
          </div>
        </dl>

        {selectedIsOrderCurrency ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] leading-6 text-muted">
            <span className="font-semibold text-ink">
              {EQUIVALENCE_COPY.noConversion}.
            </span>{" "}
            La cotización se genera en la moneda original del pedido.
          </p>
        ) : previewStatus === "loading" ? (
          <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] leading-6 text-muted">
            Calculando la tasa vigente…
          </p>
        ) : previewStatus === "ready" && preview ? (
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {EQUIVALENCE_COPY.rate}
            </p>
            <p className="mt-1 font-mono text-[18px] font-semibold tabular-nums text-ink">
              {formatRate(preview.exchangeRate)}
            </p>
            <dl className="mt-3 grid gap-3 text-[12px] text-muted sm:grid-cols-2">
              <div>
                <dt className="font-semibold uppercase tracking-[0.06em] text-[10px]">
                  Moneda origen
                </dt>
                <dd className="mt-0.5 text-ink">
                  {preview.source.currency
                    ? `${preview.source.currency.name} (${preview.source.currency.code})`
                    : order.currency
                      ? `${order.currency.name} (${order.currency.code})`
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-[0.06em] text-[10px]">
                  Moneda destino
                </dt>
                <dd className="mt-0.5 text-ink">
                  {preview.target.currency
                    ? `${preview.target.currency.name} (${preview.target.currency.code})`
                    : selectedOption
                      ? `${selectedOption.name} (${selectedOption.code})`
                      : "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold uppercase tracking-[0.06em] text-[10px]">
                  {EQUIVALENCE_COPY.rateUpdatedAt}
                </dt>
                <dd className="mt-0.5 tabular-nums text-ink">
                  {rateUpdate ? formatDateTime(rateUpdate) : "Sin fecha registrada"}
                </dd>
              </div>
            </dl>
            {preview.roundingAdjustment !== 0 && (
              <p className="mt-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-line pt-3 text-[12px]">
                <span className="text-muted">{EQUIVALENCE_COPY.rounding}</span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatMoney(
                    preview.roundingAdjustment,
                    previewCurrency ?? selectedOption ?? {},
                  )}
                </span>
              </p>
            )}
          </div>
        ) : previewError ? (
          <NoticeBanner
            action={
              previewError.canRetry ? (
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={() => setPreviewAttempt((current) => current + 1)}
                  type="button"
                >
                  Reintentar
                </button>
              ) : undefined
            }
            tone="warning"
          >
            {previewError.description}
          </NoticeBanner>
        ) : (
          <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] leading-6 text-muted">
            La tasa se calculará al generar el documento.
          </p>
        )}

        <div className="space-y-3">
          <NoticeBanner tone="info">
            La cotización se calcula con la tasa vigente. No modifica el pedido.{" "}
            {EQUIVALENCE_COPY.rateMayChange}
          </NoticeBanner>
          <p className="rounded-2xl border border-olive/35 bg-soft-lime px-4 py-3 text-[13px] font-semibold text-ink">
            Documento no fiscal.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button
            className="button-base button-secondary min-h-11 px-5"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <BusyButton
            busy={busy}
            busyLabel="Generando PDF…"
            className="min-h-11 px-5 text-[13px]"
            disabled={
              catalogStatus !== "ready" || !selectedOption || options.length === 0
            }
            onClick={() => void handleDownload()}
            type="button"
          >
            Descargar cotización
          </BusyButton>
        </div>
      </div>
    </FormDialog>
  );
}
