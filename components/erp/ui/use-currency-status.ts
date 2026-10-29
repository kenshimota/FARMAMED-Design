"use client";

import { useCallback } from "react";
import { apiFetch } from "@/lib/api";
import {
  clearCurrencyNotConfigured,
  flagCurrencyNotConfigured,
} from "@/lib/currency-notice";
import { getStoredToken } from "@/lib/session-store";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";

export type CurrencyRecord = {
  id: number | null;
  code: string;
  name: string;
  symbol: string;
  rate: number | string | null;
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

function readString(...values: unknown[]) {
  return (
    values.find((value): value is string => typeof value === "string" && value.trim().length > 0) ??
    ""
  );
}

function parseCurrency(source: unknown): CurrencyRecord | null {
  if (!isRecord(source)) return null;
  const code = readString(source.code, source.currency_code);
  if (!code) return null;
  return {
    id: typeof source.id === "number" ? source.id : null,
    code,
    name: readString(source.name) || code,
    symbol: readString(source.symbol),
    rate: typeof source.rate === "number" || typeof source.rate === "string" ? source.rate : null,
    isDefaultForTransactions:
      source.is_default_for_transactions === true || source.isDefaultForTransactions === true,
  };
}

export type CurrencyStatus = {
  status: "idle" | "loading" | "refreshing" | "ready" | "error";
  currencies: CurrencyRecord[];
  defaultCurrency: CurrencyRecord | null;
  errorMessage: string | null;
  canRetry: boolean;
  reload: () => void;
};

export function useCurrencyStatus(enabled: boolean): CurrencyStatus {
  const loader = useCallback(async () => {
    const payload = await apiFetch<unknown>("/currencies", { token: getStoredToken() ?? undefined });
    const list = readList(payload);
    if (list === null) throw new Error("Respuesta inválida");
    const currencies = list
      .map(parseCurrency)
      .filter((currency): currency is CurrencyRecord => currency !== null);
    const defaultCurrency = currencies.find((currency) => currency.isDefaultForTransactions) ?? null;
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
    canRetry: error ? (notFound ? true : error.canRetry) : false,
    reload: resource.reload,
  };
}
