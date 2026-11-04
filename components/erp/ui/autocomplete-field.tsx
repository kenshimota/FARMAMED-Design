"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { FormField } from "@/components/erp/ui/form";

export type AutocompleteOption = {
  value: string;
  label: string;
  description?: string;
};

type AutocompleteFieldProps = {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onInputChange?: (value: string) => void;
  onClear?: () => void;
  loadOptions: (query: string) => Promise<AutocompleteOption[]>;
  onSelect?: (option: AutocompleteOption) => void;
  placeholder?: string;
  help?: ReactNode;
  error?: string | null;
  emptyLabel?: string;
  loadingLabel?: string;
  errorLabel?: string;
  clearAriaLabel?: string;
  createHref?: string;
  createLabel?: string;
  disabled?: boolean;
  required?: boolean;
  minChars?: number;
  searchOnFocus?: boolean;
};

const DEBOUNCE_MS = 300;

export function AutocompleteField({
  id,
  label,
  value,
  onValueChange,
  onInputChange,
  onClear,
  loadOptions,
  onSelect,
  placeholder,
  help,
  error,
  emptyLabel = "No hay coincidencias.",
  loadingLabel = "Buscando…",
  errorLabel = "No pudimos cargar las coincidencias.",
  clearAriaLabel,
  createHref,
  createLabel,
  disabled = false,
  required = false,
  minChars = 1,
  searchOnFocus = true,
}: AutocompleteFieldProps) {
  const listboxId = useId();
  const panelId = `${listboxId}-panel`;
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const loadOptionsRef = useRef(loadOptions);

  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [retry, setRetry] = useState(0);
  const [settledQuery, setSettledQuery] = useState<string | null>(null);

  const trimmed = value.trim();
  const shouldSearch = dirty && trimmed.length >= minChars;

  useEffect(() => {
    loadOptionsRef.current = loadOptions;
  }, [loadOptions]);

  useEffect(() => {
    if (!shouldSearch) return;

    let active = true;
    const timer = window.setTimeout(async () => {
      try {
        const next = await loadOptionsRef.current(trimmed);
        if (!active) return;
        setOptions(next);
        setStatus("ready");
        setSettledQuery(trimmed);
        setActiveIndex(next.length > 0 ? 0 : -1);
      } catch {
        if (!active) return;
        setOptions([]);
        setStatus("error");
        setSettledQuery(trimmed);
        setActiveIndex(-1);
      }
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [minChars, retry, shouldSearch, trimmed]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const option = listboxRef.current?.children[activeIndex];
    if (option instanceof HTMLElement) {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function selectOption(option: AutocompleteOption) {
    onValueChange(option.label);
    onSelect?.(option);
    setDirty(false);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setDirty(true);
      setActiveIndex((current) =>
        options.length === 0 ? -1 : (current + 1) % options.length,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setDirty(true);
      setActiveIndex((current) =>
        options.length === 0
          ? -1
          : (current - 1 + options.length) % options.length,
      );
      return;
    }

    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) selectOption(option);
    }
  }

  const activeOption = activeIndex >= 0 ? options[activeIndex] : undefined;
  const showPanel = open && shouldSearch;
  const displayStatus =
    showPanel && settledQuery !== trimmed ? "loading" : status;
  const showListbox =
    showPanel && displayStatus === "ready" && options.length > 0;
  const liveMessage = !showPanel
    ? ""
    : displayStatus === "loading"
      ? loadingLabel
      : displayStatus === "error"
        ? errorLabel
        : displayStatus === "ready" && options.length === 0
          ? emptyLabel
          : "";

  return (
    <FormField
      error={error}
      help={help}
      id={id}
      label={label}
      required={required}
    >
      {(aria) => (
        <div className="relative" ref={containerRef}>
          <div className="relative">
            <Icon
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
              name="search"
              size={17}
            />
            <input
              {...aria}
              aria-activedescendant={
                showListbox && activeOption
                  ? `${listboxId}-option-${activeIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls={
                showPanel ? (showListbox ? listboxId : panelId) : undefined
              }
              aria-expanded={showPanel}
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-10 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
              onChange={(event) => {
                setDirty(true);
                setOpen(true);
                setActiveIndex(-1);
                onInputChange?.(event.target.value);
                onValueChange(event.target.value);
              }}
              onBlur={() => {
                window.setTimeout(() => {
                  if (containerRef.current?.contains(document.activeElement)) {
                    return;
                  }
                  setOpen(false);
                  setActiveIndex(-1);
                }, 0);
              }}
              onFocus={() => {
                if (searchOnFocus && trimmed.length >= minChars) {
                  setDirty(true);
                  setOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              role="combobox"
              type="search"
              value={value}
            />
            {value && !disabled && (
              <button
                aria-label={
                  clearAriaLabel ??
                  (label.trim().toLowerCase() === "buscar"
                    ? "Limpiar búsqueda"
                    : `Limpiar ${label.toLowerCase()}`)
                }
                className="absolute right-0.5 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-background hover:text-ink"
                onClick={() => {
                  onValueChange("");
                  onClear?.();
                  setDirty(false);
                  setOpen(false);
                  setOptions([]);
                  setActiveIndex(-1);
                }}
                type="button"
              >
                <Icon aria-hidden="true" name="close" size={16} />
              </button>
            )}
          </div>

          <p aria-live="polite" className="sr-only">
            {liveMessage}
          </p>

          {showPanel && (
            <div
              className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_60px_rgba(27,12,104,0.14)]"
              id={panelId}
            >
              {displayStatus === "loading" && (
                <p className="px-4 py-3 text-[12px] font-semibold text-muted">
                  {loadingLabel}
                </p>
              )}

              {displayStatus === "error" && (
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <p className="text-[12px] leading-5 text-alert-ink">
                    {errorLabel}
                  </p>
                  <button
                    className="min-h-9 rounded-full border border-alert/30 px-3 text-[12px] font-semibold text-alert-ink"
                    onClick={() => {
                      setStatus("loading");
                      setRetry((current) => current + 1);
                    }}
                    type="button"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {displayStatus === "ready" && options.length === 0 && (
                <p className="px-4 py-3 text-[12px] font-semibold text-muted">
                  {emptyLabel}
                </p>
              )}

              {displayStatus === "ready" && options.length > 0 && (
                <ul
                  aria-label={`Sugerencias para ${label.toLowerCase()}`}
                  className="max-h-72 overflow-y-auto py-1"
                  id={listboxId}
                  ref={listboxRef}
                  role="listbox"
                >
                  {options.map((option, index) => (
                    <li
                      aria-selected={index === activeIndex}
                      className={`min-h-11 cursor-pointer px-4 py-2.5 text-[13px] ${
                        index === activeIndex
                          ? "bg-soft-blue text-ink"
                          : "text-ink hover:bg-background"
                      }`}
                      id={`${listboxId}-option-${index}`}
                      key={`${option.value}:${option.label}`}
                      onClick={() => selectOption(option)}
                      onMouseEnter={() => setActiveIndex(index)}
                      role="option"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{option.label}</span>
                        {index === activeIndex && (
                          <Icon
                            aria-hidden="true"
                            className="mt-0.5 shrink-0 text-brand"
                            name="check"
                            size={14}
                          />
                        )}
                      </span>
                      {option.description && (
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {option.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {createHref && createLabel && (
            <Link
              className="mt-2 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={createHref}
            >
              {createLabel}
              <Icon name="arrow-up-right" size={14} />
            </Link>
          )}
        </div>
      )}
    </FormField>
  );
}
