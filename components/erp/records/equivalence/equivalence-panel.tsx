"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/erp/session-context";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  CurrencyChip,
  currencyOptionLabel,
} from "@/components/erp/ui/currency-select";
import {
  DocumentCashNotice,
  EquivalenceDetails,
  EquivalenceLoading,
} from "@/components/erp/records/equivalence/equivalence-details";
import {
  EQUIVALENCE_COPY,
  equivalenceErrorCopy,
} from "@/components/erp/records/equivalence/equivalence-copy";
import {
  fetchInvoiceEquivalence,
  fetchOrderEquivalence,
  type EquivalenceCurrency,
  type EquivalenceRecordId,
  type EquivalenceScope,
  type RecordEquivalence,
} from "@/lib/finance/equivalence-api";
import { translateApiError, type UiError } from "@/lib/api-errors";

export type EquivalenceDocumentCash = {
  isCash: boolean;
  amount: number | null;
};

type EquivalencePanelProps = {
  scope: EquivalenceScope;
  recordId: string;
  documentCurrency: EquivalenceCurrency | null;
  documentCash?: EquivalenceDocumentCash | null;
};

type CurrencyOption = {
  value: string;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  isDefault: boolean;
  isDocument: boolean;
  currencyId: EquivalenceRecordId | null;
  label: string;
};

const FALLBACK_CURRENCY: EquivalenceCurrency = {
  id: null,
  code: "—",
  name: "—",
  symbol: "—",
};

type EquivalenceFetchState = {
  status: "loading" | "ready" | "error";
  data: RecordEquivalence | null;
  error: UiError | null;
};

function EquivalenceFetcher({
  scope,
  recordId,
  currencyId,
  currency,
  targetKey,
  documentCurrency,
  onReady,
  onError,
  onRetry,
}: {
  scope: EquivalenceScope;
  recordId: string;
  currencyId: EquivalenceRecordId | null;
  currency: EquivalenceCurrency;
  targetKey: string;
  documentCurrency: EquivalenceCurrency | null;
  onReady: (data: RecordEquivalence, targetKey: string) => void;
  onError: (error: UiError) => void;
  onRetry: () => void;
}) {
  const [state, setState] = useState<EquivalenceFetchState>({
    status: "loading",
    data: null,
    error: null,
  });
  useEffect(() => {
    let active = true;

    const load =
      scope === "order"
        ? () =>
            fetchOrderEquivalence(recordId, currencyId, {
              documentCurrency,
              targetCurrency: currency,
            })
        : () =>
            fetchInvoiceEquivalence(recordId, currencyId, {
              documentCurrency,
              targetCurrency: currency,
            });

    load()
      .then((data) => {
        if (!active) return;
        setState({ status: "ready", data, error: null });
        onReady(data, targetKey);
      })
      .catch((caught) => {
        if (!active) return;
        const error = translateApiError(caught);
        setState({
          status: "error",
          data: null,
          error,
        });
        onError(error);
      });

    return () => {
      active = false;
    };
  }, [
    currency,
    currencyId,
    documentCurrency,
    onError,
    onReady,
    recordId,
    scope,
    targetKey,
  ]);

  if (state.status === "loading") {
    return <EquivalenceLoading />;
  }

  if (state.status === "error" || !state.data) {
    if (state.error?.status === 422) return null;

    const copy = equivalenceErrorCopy(state.error);
    return (
      <NoticeBanner
        action={
          copy.canRetry ? (
            <button
              className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold text-alert-ink transition-colors hover:bg-surface"
              onClick={onRetry}
              type="button"
            >
              Reintentar
            </button>
          ) : undefined
        }
        role="alert"
        title={copy.title}
        tone="danger"
      >
        {copy.description}
      </NoticeBanner>
    );
  }

  return (
    <EquivalenceDetails
      data={state.data}
      documentCurrency={documentCurrency}
      targetCurrency={state.data.target.currency ?? currency ?? FALLBACK_CURRENCY}
    />
  );
}

export function RecordEquivalencePanel({
  scope,
  recordId,
  documentCurrency,
  documentCash = null,
}: EquivalencePanelProps) {
  const baseId = useId();
  const titleId = `${baseId}-titulo`;
  const selectId = `${baseId}-moneda`;
  const noteId = `${baseId}-nota`;
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const isCustomer = user.role === "customer";
  const currencyForbidden = currencyStatus?.errorKind === "forbidden";
  const usingFallback = isCustomer || currencyForbidden;

  const documentCurrencyIdValue = documentCurrency?.id ?? null;
  const documentCurrencyCode = documentCurrency?.code ?? null;
  const documentCurrencyName = documentCurrency?.name ?? null;
  const documentCurrencySymbol = documentCurrency?.symbol ?? null;
  const stableDocumentCurrency = useMemo<EquivalenceCurrency | null>(() => {
    if (!documentCurrencyCode) return null;
    return {
      id: documentCurrencyIdValue,
      code: documentCurrencyCode,
      name: documentCurrencyName ?? documentCurrencyCode,
      symbol: documentCurrencySymbol ?? documentCurrencyCode,
    };
  }, [
    documentCurrencyCode,
    documentCurrencyIdValue,
    documentCurrencyName,
    documentCurrencySymbol,
  ]);

  const currencies = useMemo(
    () => currencyStatus?.currencies ?? [],
    [currencyStatus?.currencies],
  );
  const documentCurrencyId =
    stableDocumentCurrency?.id !== null &&
    stableDocumentCurrency?.id !== undefined
      ? String(stableDocumentCurrency.id)
      : null;

  const options = useMemo(() => {
    if (usingFallback) {
      const documentCode = stableDocumentCurrency?.code.trim() ?? "";
      const documentIsVes = documentCode.toUpperCase() === "VES";
      const list: CurrencyOption[] = [
        {
          value: "fallback-ves",
          code: "VES",
          name: "Bolívar",
          symbol: "Bs",
          isBase: true,
          isDefault: false,
          isDocument: documentIsVes,
          currencyId: null,
          label: documentIsVes
            ? "Bolívar (VES) · Moneda del documento"
            : "Bolívar (VES)",
        },
      ];

      if (stableDocumentCurrency && !documentIsVes) {
        list.push({
          value: "fallback-documento",
          code: stableDocumentCurrency.code,
          name: stableDocumentCurrency.name,
          symbol: stableDocumentCurrency.symbol,
          isBase: false,
          isDefault: false,
          isDocument: true,
          currencyId: stableDocumentCurrency.id,
          label: `Moneda del documento · ${stableDocumentCurrency.code} — ${stableDocumentCurrency.name}`,
        });
      }

      return list;
    }

    const list: CurrencyOption[] = [];
    for (const currency of currencies) {
      if (currency.id === null) continue;
      const value = String(currency.id);
      list.push({
        value,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        isBase: currency.isBase,
        isDefault: currency.isDefaultForTransactions,
        isDocument:
          (documentCurrencyId !== null && value === documentCurrencyId) ||
          (stableDocumentCurrency !== null &&
            currency.code === stableDocumentCurrency.code),
        currencyId: currency.id,
        label: "",
      });
    }

    if (stableDocumentCurrency && !list.some((option) => option.isDocument)) {
      list.push({
        value:
          documentCurrencyId ?? `documento:${stableDocumentCurrency.code}`,
        code: stableDocumentCurrency.code,
        name: stableDocumentCurrency.name,
        symbol: stableDocumentCurrency.symbol,
        isBase: false,
        isDefault: false,
        isDocument: true,
        currencyId: stableDocumentCurrency.id,
        label: "",
      });
    }

    list.sort((first, second) => {
      if (first.isBase !== second.isBase) return first.isBase ? -1 : 1;
      return first.code.localeCompare(second.code, "es");
    });

    return list.map((option) => ({
      ...option,
      label: `${currencyOptionLabel({
        code: option.code,
        name: option.name,
        symbol: option.symbol,
        isBase: option.isBase,
        isDefaultForTransactions: option.isDefault,
      })}${option.isDocument ? " · Moneda del documento" : ""}`,
    }));
  }, [
    currencies,
    documentCurrencyId,
    stableDocumentCurrency,
    usingFallback,
  ]);

  const hasOptions = options.length > 0;
  const documentValue =
    options.find((option) => option.isDocument)?.value ?? documentCurrencyId;
  const baseOption =
    options.find((option) => option.isBase) ??
    options.find((option) => option.code === "VES") ??
    null;
  const initialTargetKey =
    baseOption?.value ?? documentValue ?? options[0]?.value ?? null;

  const [requestedTargetKey, setRequestedTargetKey] = useState<string | null>(
    null,
  );
  const [revision, setRevision] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [selectionError, setSelectionError] = useState<UiError | null>(null);
  const announceRefreshRef = useRef(false);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const lastValidTargetKeyRef = useRef<string | null>(null);
  const initialTargetKeyRef = useRef<string | null>(null);

  useEffect(() => {
    initialTargetKeyRef.current = initialTargetKey;
    if (lastValidTargetKeyRef.current === null) {
      lastValidTargetKeyRef.current = initialTargetKey;
    }
  }, [initialTargetKey]);

  const requestedKey = requestedTargetKey ?? initialTargetKey;
  const targetKey =
    requestedKey !== null &&
    options.some((option) => option.value === requestedKey)
      ? requestedKey
      : initialTargetKey;

  const selectedOption =
    options.find((option) => option.value === targetKey) ?? null;
  const targetCurrency = useMemo<EquivalenceCurrency | null>(
    () =>
      selectedOption
        ? {
            id: selectedOption.currencyId,
            code: selectedOption.code,
            name: selectedOption.name,
            symbol: selectedOption.symbol,
          }
        : null,
    [selectedOption],
  );
  const isSameAsDocument =
    targetKey !== null &&
    (targetKey === documentValue ||
      (selectedOption?.isDocument ?? false) ||
      (stableDocumentCurrency !== null &&
        selectedOption !== null &&
        selectedOption.code.toUpperCase() ===
          stableDocumentCurrency.code.toUpperCase()));

  useEffect(() => {
    if (isSameAsDocument && targetKey !== null) {
      lastValidTargetKeyRef.current = targetKey;
    }
  }, [isSameAsDocument, targetKey]);

  const currencyStatusValue = currencyStatus?.status ?? "idle";
  const currenciesLoading =
    !usingFallback &&
    (currencyStatusValue === "idle" || currencyStatusValue === "loading");
  const currenciesReady =
    usingFallback ||
    currencyStatusValue === "ready" ||
    currencyStatusValue === "refreshing";
  const currencyFailed =
    !usingFallback && currencyStatusValue === "error";
  const currencyErrorMessage = currencyFailed
    ? currencyStatus?.errorMessage ??
      "No pudimos cargar las monedas activas para la conversión."
    : null;
  const currencyCanRetry = currencyStatus?.canRetry ?? true;
  const canConvert =
    selectedOption !== null &&
    targetCurrency !== null &&
    !isSameAsDocument &&
    currenciesReady &&
    hasOptions;

  const handleReady = useCallback(
    (data: RecordEquivalence, loadedTargetKey: string) => {
      lastValidTargetKeyRef.current = loadedTargetKey;
      if (announceRefreshRef.current) {
        announceRefreshRef.current = false;
        setAnnouncement(EQUIVALENCE_COPY.rateUpdated);
        window.requestAnimationFrame(() => selectRef.current?.focus());
        return;
      }
      const code =
        data.target.currency?.code ?? data.source.currency?.code ?? "";
      setAnnouncement(
        `Mostrando el ${scope === "order" ? "pedido" : "factura"} en ${
          code || "la moneda seleccionada"
        }.`,
      );
    },
    [scope],
  );

  const handleError = useCallback((error: UiError) => {
    if (error.status !== 422) return;
    announceRefreshRef.current = false;
    setSelectionError(error);
    const fallbackKey =
      lastValidTargetKeyRef.current ?? initialTargetKeyRef.current;
    if (fallbackKey) setRequestedTargetKey(fallbackKey);
  }, []);

  function handleSelect(value: string) {
    announceRefreshRef.current = false;
    setSelectionError(null);
    setRequestedTargetKey(value || null);
  }

  function refresh() {
    announceRefreshRef.current = true;
    setSelectionError(null);
    setRevision((current) => current + 1);
  }

  function retry() {
    announceRefreshRef.current = false;
    setSelectionError(null);
    setRevision((current) => current + 1);
  }

  function resetToDocument() {
    if (!documentValue) return;
    announceRefreshRef.current = false;
    setSelectionError(null);
    setRequestedTargetKey(documentValue);
  }

  const selectDisabled =
    currenciesLoading || currencyFailed || !hasOptions;
  const noun = scope === "order" ? "pedido" : "factura";
  const selectionErrorCopy = selectionError
    ? equivalenceErrorCopy(selectionError)
    : null;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="eyebrow">Conversión</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id={titleId}
          >
            {EQUIVALENCE_COPY.heading}
          </h2>
          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-muted">
            {EQUIVALENCE_COPY.intro}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-background px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            {EQUIVALENCE_COPY.documentCurrency}
          </p>
          <div className="mt-2">
            <CurrencyChip currency={stableDocumentCurrency} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label
            className="mb-2 block text-[13px] font-semibold text-ink"
            htmlFor={selectId}
          >
            {EQUIVALENCE_COPY.currencyLabel}
          </label>
          <select
            aria-describedby={noteId}
            aria-label={`Moneda para ver el ${noun}`}
            className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
            disabled={selectDisabled}
            id={selectId}
            onChange={(event) => handleSelect(event.target.value)}
            ref={selectRef}
            value={targetKey ?? ""}
          >
            {currenciesLoading && <option value="">Cargando monedas…</option>}
            {currencyFailed && <option value="">No disponible</option>}
            {currenciesReady && !hasOptions && (
              <option value="">No hay monedas activas</option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[12px] leading-5 text-muted" id={noteId}>
            {EQUIVALENCE_COPY.rateMayChange}
            {usingFallback ? ` ${EQUIVALENCE_COPY.fallbackHelp}` : ""}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          {canConvert && (
            <button
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              onClick={refresh}
              type="button"
            >
              {EQUIVALENCE_COPY.refresh}
            </button>
          )}
          {canConvert && documentValue && (
            <button
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              onClick={resetToDocument}
              type="button"
            >
              {EQUIVALENCE_COPY.reset}
            </button>
          )}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {selectionErrorCopy && (
        <NoticeBanner
          action={
            selectionErrorCopy.canRetry ? (
              <button
                className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold text-alert-ink transition-colors hover:bg-surface"
                onClick={retry}
                type="button"
              >
                Reintentar
              </button>
            ) : undefined
          }
          className="mt-5"
          role="alert"
          title={selectionErrorCopy.title}
          tone="danger"
        >
          {selectionErrorCopy.description}
        </NoticeBanner>
      )}

      {currencyErrorMessage && (
        <NoticeBanner
          action={
            currencyCanRetry ? (
              <button
                className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                onClick={currencyStatus?.reload}
                type="button"
              >
                Reintentar
              </button>
            ) : undefined
          }
          className="mt-5"
          tone="warning"
        >
          {currencyErrorMessage}
        </NoticeBanner>
      )}

      <div className="mt-5">
        {currenciesLoading && <EquivalenceLoading />}

        {currenciesReady && !hasOptions && (
          <NoticeBanner className="mt-0" tone="warning">
            No hay monedas activas disponibles para ver el {noun} en otra
            moneda.
          </NoticeBanner>
        )}

        {isSameAsDocument && hasOptions && (
          <div className="space-y-4">
            <NoticeBanner title={EQUIVALENCE_COPY.noConversion} tone="info">
              {EQUIVALENCE_COPY.noConversionHelp}{" "}
              {`${stableDocumentCurrency?.code ?? selectedOption?.code ?? "la moneda del documento"}.`}
            </NoticeBanner>
            {documentCash?.isCash && (
              <DocumentCashNotice
                amount={documentCash.amount}
                currency={targetCurrency ?? stableDocumentCurrency}
              />
            )}
          </div>
        )}

        {canConvert && selectedOption && targetCurrency && (
          <EquivalenceFetcher
            currency={targetCurrency}
            currencyId={selectedOption.currencyId}
            documentCurrency={stableDocumentCurrency}
            key={`${scope}:${recordId}:${selectedOption.value}:${revision}`}
            onError={handleError}
            onReady={handleReady}
            onRetry={retry}
            recordId={recordId}
            scope={scope}
            targetKey={selectedOption.value}
          />
        )}
      </div>
    </section>
  );
}
