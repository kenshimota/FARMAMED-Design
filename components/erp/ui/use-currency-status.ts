"use client";

import { useCallback } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { UiError } from "@/lib/api-errors";
import {
  clearCurrencyNotConfigured,
  flagCurrencyNotConfigured,
} from "@/lib/currency-notice";
import { getStoredToken } from "@/lib/session-store";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";

export const DEFAULT_TRANSACTION_CURRENCY_CODE = "USD_BCV";

export type CurrencyRecord = {
  id: number | null;
  code: string;
  name: string;
  symbol: string;
  rate: number | string | null;
  isBase: boolean;
  isDefaultForTransactions: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readList(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return null;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.currencies)) return payload.currencies;
  if (isRecord(payload.data)) return readList(payload.data);
  return null;
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

function readId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function parseCurrency(source: unknown): CurrencyRecord | null {
  if (!isRecord(source)) return null;
  const code = readText(source.code);
  if (!code) return null;
  return {
    id: readId(source.id),
    code,
    name: readText(source.name) || code,
    symbol: readText(source.symbol),
    rate: typeof source.rate === "number" || typeof source.rate === "string" ? source.rate : null,
    isBase: source.is_base === true,
    isDefaultForTransactions: source.is_default_for_transactions === true,
  };
}

export type CurrencyStatus = {
  status: "idle" | "loading" | "refreshing" | "ready" | "error";
  currencies: CurrencyRecord[];
  defaultCurrency: CurrencyRecord | null;
  errorMessage: string | null;
  errorKind: UiError["kind"] | null;
  canRetry: boolean;
  reload: () => void;
};

export function useCurrencyStatus(enabled: boolean): CurrencyStatus {
  const loader = useCallback(async () => {
    const payload = await apiFetch<unknown>("/currencies", { token: getStoredToken() ?? undefined });
    const list = readList(payload);
    if (list === null) throw new ApiError(500, null);
    const currencies = list
      .map(parseCurrency)
      .filter((currency): currency is CurrencyRecord => currency !== null);
    if (list.length > 0 && currencies.length === 0) throw new ApiError(500, null);

    const defaultCurrency =
      currencies.find((currency) => currency.isDefaultForTransactions) ??
      currencies.find(
        (currency) => currency.code.toUpperCase() === DEFAULT_TRANSACTION_CURRENCY_CODE,
      ) ??
      null;
    if (defaultCurrency) {
      clearCurrencyNotConfigured();
    } else {
      flagCurrencyNotConfigured();
    }
    return { currencies, defaultCurrency };
  }, []);

  const resource = useAsyncResource(loader, { enabled });
  const error = resource.error;
  const notFound = error?.kind === "not-found";

  return {
    status: resource.status,
    currencies: resource.data?.currencies ?? [],
    defaultCurrency: resource.data?.defaultCurrency ?? null,
    errorMessage: error
      ? notFound
        ? "No pudimos consultar la moneda de transacciones."
        : error.message
      : null,
    errorKind: error ? error.kind : null,
    canRetry: error ? (notFound ? true : error.canRetry) : false,
    reload: resource.reload,
  };
}
