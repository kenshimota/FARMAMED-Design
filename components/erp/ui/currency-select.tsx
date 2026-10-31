"use client";

import type { ReactNode } from "react";
import { useSession } from "@/components/erp/session-context";
import { SelectField } from "@/components/erp/records/form-controls";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import {
  DEFAULT_TRANSACTION_CURRENCY_CODE,
  type CurrencyRecord,
} from "@/components/erp/ui/use-currency-status";
import { canReadModule } from "@/lib/permissions";

export const CURRENCY_NOT_CONVERSION =
  "Cambiar la moneda no convierte el monto; solo cambia su interpretación.";

export type CurrencyLike = {
  code: string;
  name: string;
  symbol: string;
  isBase?: boolean;
  isDefaultForTransactions?: boolean;
};

export type CurrencyOptionSource = CurrencyLike & {
  id: number | string;
};

type CurrencySelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  optional?: boolean;
  placeholder?: string;
  allOptionLabel?: string;
  currentCurrency?: CurrencyOptionSource | null;
  help?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  nonConversionNote?: boolean;
};

function currencyTags(currency: CurrencyLike) {
  const tags: string[] = [];
  if (currency.isBase) tags.push("Base");
  if (currency.isDefaultForTransactions) tags.push("Predeterminada");
  return tags;
}

export function currencyOptionLabel(currency: CurrencyLike) {
  const symbol = currency.symbol ? ` (${currency.symbol})` : "";
  const tags = currencyTags(currency);
  return `${currency.code} — ${currency.name}${symbol}${
    tags.length > 0 ? ` · ${tags.join(" · ")}` : ""
  }`;
}

function currencyAccessibleLabel(currency: CurrencyLike) {
  return [
    `Moneda ${currency.name}`,
    currency.code,
    currency.symbol ? `símbolo ${currency.symbol}` : null,
    ...currencyTags(currency),
  ]
    .filter(Boolean)
    .join(", ");
}

export function CurrencyChip({
  currency,
  className = "",
}: {
  currency: CurrencyLike | null;
  className?: string;
}) {
  if (!currency) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-line bg-background px-2.5 py-1 text-[11px] font-semibold text-muted ${className}`}
      >
        Sin moneda
      </span>
    );
  }

  const tags = currencyTags(currency);

  return (
    <span
      aria-label={currencyAccessibleLabel(currency)}
      className={`inline-flex flex-wrap items-center gap-1.5 rounded-full border border-brand/20 bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand ${className}`}
    >
      <span>{currency.code}</span>
      {currency.symbol && (
        <span className="font-mono text-[11px] font-medium text-ink/75">
          {currency.symbol}
        </span>
      )}
      {tags.map((tag) => (
        <span
          className="rounded-full border border-ink/15 bg-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-ink"
          key={tag}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}

export function CurrencyNonConversionNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[12px] leading-5 text-muted ${className}`} role="note">
      {CURRENCY_NOT_CONVERSION}
    </p>
  );
}

export function CurrencySelect({
  id,
  value,
  onChange,
  label = "Moneda",
  optional = false,
  placeholder,
  allOptionLabel,
  currentCurrency,
  help,
  error,
  required = false,
  disabled = false,
  nonConversionNote = false,
}: CurrencySelectProps) {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();

  if (!currencyStatus || !canReadModule(user.role, "monedas")) return null;

  const loading =
    currencyStatus.status === "loading" || currencyStatus.status === "idle";
  const failed = currencyStatus.status === "error";
  const ready = currencyStatus.status === "ready";
  const currencies = currencyStatus.currencies;
  const defaultCurrency = currencyStatus.defaultCurrency;
  const defaultCode = defaultCurrency?.code ?? DEFAULT_TRANSACTION_CURRENCY_CODE;
  const isAdmin = user.role === "admin";
  const hasOptions = currencies.some((currency) => currency.id !== null);

  const options = currencies
    .filter(
      (currency): currency is CurrencyRecord & { id: number } =>
        currency.id !== null,
    )
    .map((currency) => ({
      value: String(currency.id),
      label: currencyOptionLabel(currency),
    }));

  if (currentCurrency) {
    const currentValue = String(currentCurrency.id);
    if (!options.some((option) => option.value === currentValue)) {
      options.unshift({
        value: currentValue,
        label: `${currencyOptionLabel(currentCurrency)} (moneda actual)`,
      });
    }
  }

  const emptyLabel = failed
    ? "No pudimos cargar las monedas."
    : hasOptions
      ? "No hay monedas activas registradas."
      : isAdmin
        ? "No hay monedas activas. Crea o activa una moneda."
        : "No hay monedas activas. Contacta a un administrador.";

  const firstOptionLabel =
    allOptionLabel ??
    (optional
      ? `Moneda por defecto (${defaultCode})`
      : placeholder ?? "Selecciona una moneda");

  return (
    <div>
      <SelectField
        createHref={isAdmin && ready && !hasOptions ? "/app/monedas" : undefined}
        createLabel={
          isAdmin && ready && !hasOptions ? "Administrar monedas" : undefined
        }
        disabled={disabled}
        emptyLabel={emptyLabel}
        error={error}
        help={help}
        id={id}
        label={label}
        loading={loading}
        loadingLabel="Cargando monedas…"
        loadError={failed ? "No pudimos cargar las monedas." : null}
        onChange={onChange}
        onRetry={failed ? currencyStatus.reload : undefined}
        options={options}
        placeholder={firstOptionLabel}
        required={required}
        value={value}
      />

      {!failed && optional && !value && defaultCurrency && (
        <p className="mt-2 text-[12px] leading-5 text-muted">
          Se usará {defaultCode} si no eliges otra.
        </p>
      )}

      {nonConversionNote && (
        <CurrencyNonConversionNote className="mt-2" />
      )}
    </div>
  );
}
