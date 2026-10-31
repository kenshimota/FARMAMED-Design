"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { FormField } from "@/components/erp/ui/form";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import {
  DEFAULT_TRANSACTION_CURRENCY_CODE,
  type CurrencyRecord,
} from "@/components/erp/ui/use-currency-status";
import { canReadModule } from "@/lib/permissions";

export const CURRENCY_NOT_CONVERSION =
  "Cambiar la moneda no convierte el monto; solo cambia su interpretación.";

const CONTROL_CLASS =
  "w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60";

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
  filter?: boolean;
};

type CurrencyOption = {
  value: string;
  label: string;
  searchText: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function currencyTags(currency: CurrencyLike) {
  const tags: string[] = [];
  if (currency.isBase) tags.push("Base");
  if (currency.isDefaultForTransactions) tags.push("Predeterminada");
  return tags;
}

export function currencyOptionLabel(currency: CurrencyLike) {
  const symbol =
    currency.symbol && currency.symbol.toLowerCase() !== currency.code.toLowerCase()
      ? ` (${currency.symbol})`
      : "";
  const tags = currencyTags(currency);
  return `${currency.code} — ${currency.name}${symbol}${
    tags.length > 0 ? ` · ${tags.join(" · ")}` : ""
  }`;
}

function currencyAccessibleLabel(currency: CurrencyLike) {
  return [
    `Moneda ${currency.name}`,
    currency.code,
    currency.symbol && currency.symbol.toLowerCase() !== currency.code.toLowerCase()
      ? `símbolo ${currency.symbol}`
      : null,
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
      {currency.symbol &&
        currency.symbol.toLowerCase() !== currency.code.toLowerCase() && (
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
  filter = false,
}: CurrencySelectProps) {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<number | null>(null);
  const activeOptionRef = useRef<HTMLLIElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function cancelBlurTimer() {
    if (blurTimer.current !== null) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
  }

  useEffect(() => {
    return () => {
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    activeOptionRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const catalogCurrencies = currencyStatus?.currencies;
  const options = useMemo(() => {
    const list: CurrencyOption[] = (catalogCurrencies ?? [])
      .filter(
        (currency): currency is CurrencyRecord & { id: number } =>
          currency.id !== null,
      )
      .map((currency) => ({
        value: String(currency.id),
        label: currencyOptionLabel(currency),
        searchText: normalizeSearch(`${currency.code} ${currency.name}`),
      }));

    if (
      currentCurrency &&
      !list.some((option) => option.value === String(currentCurrency.id))
    ) {
      list.unshift({
        value: String(currentCurrency.id),
        label: `${currencyOptionLabel(currentCurrency)} (moneda actual)`,
        searchText: normalizeSearch(
          `${currentCurrency.code} ${currentCurrency.name}`,
        ),
      });
    }
    return list;
  }, [catalogCurrencies, currentCurrency]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearch(query.trim());
    return options.filter(
      (option) =>
        !normalizedQuery || option.searchText.includes(normalizedQuery),
    );
  }, [options, query]);

  if (!currencyStatus || !canReadModule(user.role, "monedas")) return null;

  const loading =
    currencyStatus.status === "loading" || currencyStatus.status === "idle";
  const failed = currencyStatus.status === "error";
  const ready = currencyStatus.status === "ready";
  const defaultCurrency = currencyStatus.defaultCurrency;
  const defaultCode = defaultCurrency?.code ?? DEFAULT_TRANSACTION_CURRENCY_CODE;
  const isAdmin = user.role === "admin";
  const hasOptions = options.length > 0;
  const blocked = disabled || loading || failed;

  const selectedOption = options.find((option) => option.value === value) ?? null;
  const clearLabel =
    allOptionLabel ??
    placeholder ??
    (optional
      ? defaultCurrency
        ? `Moneda por defecto (${defaultCurrency.code})`
        : "Moneda por defecto"
      : "Selecciona una moneda");
  const visibleOptions: CurrencyOption[] = [
    { value: "", label: clearLabel, searchText: "" },
    ...filteredOptions,
  ];
  const resolvedActiveIndex = Math.min(
    activeIndex,
    Math.max(visibleOptions.length - 1, 0),
  );
  const activeOption = visibleOptions[resolvedActiveIndex] ?? visibleOptions[0];

  const inputValue = open
    ? query
    : selectedOption?.label ?? (value ? value : "");

  function initialActiveIndex() {
    const selectedIndex = options.findIndex(
      (option) => option.value !== "" && option.value === value,
    );
    if (selectedIndex >= 0) return selectedIndex + 1;
    return options.length > 0 ? 1 : 0;
  }

  function openList() {
    if (blocked) return;
    if (open) return;
    setOpen(true);
    setQuery("");
    setActiveIndex(initialActiveIndex());
  }

  function closeList() {
    setOpen(false);
    setQuery("");
  }

  function selectOption(option: CurrencyOption) {
    onChange(option.value);
    closeList();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (blocked) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((current) =>
        Math.min(current + 1, visibleOptions.length - 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      if (!open) {
        event.preventDefault();
        openList();
        return;
      }
      if (query.trim() && filteredOptions.length === 0) {
        event.preventDefault();
        return;
      }
      if (activeOption) {
        event.preventDefault();
        selectOption(activeOption);
      }
      return;
    }
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        closeList();
      }
    }
  }

  const emptyLabel = failed
    ? "No pudimos cargar las monedas."
    : hasOptions
      ? "No hay monedas activas registradas."
      : isAdmin
        ? "No hay monedas activas. Crea o activa una moneda."
        : "No hay monedas activas. Contacta a un administrador.";

  return (
    <FormField error={error} help={help} id={id} label={label} required={required}>
      {(aria) => (
        <div>
          <div className="relative">
            <input
              {...aria}
              aria-activedescendant={
                open && activeOption
                  ? `${id}-opcion-${resolvedActiveIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls={`${id}-lista`}
              aria-expanded={open}
              autoComplete="off"
              className={`${CONTROL_CLASS} h-12 pr-11`}
              disabled={blocked}
              name={id}
              onBlur={() => {
                cancelBlurTimer();
                blurTimer.current = window.setTimeout(() => {
                  blurTimer.current = null;
                  if (inputRef.current === document.activeElement) return;
                  setOpen(false);
                  setQuery("");
                }, 120);
              }}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setOpen(true);
                setQuery(nextQuery);
                const normalizedQuery = normalizeSearch(nextQuery.trim());
                if (!normalizedQuery) {
                  setActiveIndex(initialActiveIndex());
                  return;
                }
                const hasMatch = options.some((option) =>
                  option.searchText.includes(normalizedQuery),
                );
                setActiveIndex(hasMatch ? 1 : 0);
              }}
              onClick={openList}
              onFocus={() => {
                cancelBlurTimer();
                openList();
              }}
              onKeyDown={handleKeyDown}
              placeholder={
                loading
                  ? "Cargando monedas…"
                  : failed
                    ? "No disponible"
                    : selectedOption?.label ?? clearLabel
              }
              ref={inputRef}
              role="combobox"
              type="text"
              value={inputValue}
            />
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
              name="search"
              size={18}
            />

            {open && (
              <ul
                className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-[0_18px_60px_rgba(27,12,104,0.12)]"
                id={`${id}-lista`}
                role="listbox"
              >
                {visibleOptions.map((option, index) => {
                  const selected = option.value === value;
                  const active = index === resolvedActiveIndex;
                  return (
                    <li
                      aria-selected={selected}
                      className={`flex min-h-11 cursor-pointer items-center px-4 py-3 text-[13px] leading-5 ${
                        active
                          ? "bg-soft-blue text-ink ring-2 ring-inset ring-brand"
                          : "text-ink hover:bg-background"
                      } ${selected ? "font-semibold" : ""}`}
                      id={`${id}-opcion-${index}`}
                      key={option.value || "sin-moneda"}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectOption(option);
                      }}
                      ref={active ? activeOptionRef : undefined}
                      role="option"
                    >
                      {option.label}
                    </li>
                  );
                })}

                {!hasOptions && (
                  <li
                    className="px-4 py-2.5 text-[13px] leading-5 text-muted"
                    role="presentation"
                  >
                    {emptyLabel}
                  </li>
                )}

                {hasOptions && filteredOptions.length === 0 && (
                  <li
                    className="px-4 py-2.5 text-[13px] leading-5 text-muted"
                    role="presentation"
                  >
                    No hay monedas que coincidan con la búsqueda.
                  </li>
                )}
              </ul>
            )}
          </div>

          {failed && (
            <div
              className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-alert/25 bg-alert/[0.06] px-3 py-2 text-[12px] leading-5 text-alert-ink"
              id={`${id}-carga-error`}
              role="alert"
            >
              <span>No pudimos cargar las monedas.</span>
              <button
                className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold transition-colors hover:bg-surface"
                onClick={currencyStatus.reload}
                type="button"
              >
                Reintentar
              </button>
            </div>
          )}

          {isAdmin && ready && !hasOptions && (
            <Link
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href="/app/monedas"
            >
              Administrar monedas
              <Icon name="arrow-up-right" size={14} />
            </Link>
          )}

          {!filter && ready && !defaultCurrency && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] leading-5 text-muted">
              No hay una moneda predeterminada configurada.
              <button
                className="min-h-11 font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                onClick={currencyStatus.reload}
                type="button"
              >
                Reintentar
              </button>
            </p>
          )}

          {optional && !value && defaultCurrency && (
            <p className="mt-2 text-[12px] leading-5 text-muted">
              Se usará {defaultCode} si no eliges otra.
            </p>
          )}

          {nonConversionNote && <CurrencyNonConversionNote className="mt-2" />}
        </div>
      )}
    </FormField>
  );
}
