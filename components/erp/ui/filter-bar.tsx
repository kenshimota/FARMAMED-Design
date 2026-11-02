"use client";

import { useState, type ReactNode, type Ref } from "react";
import { Icon } from "@/components/icons";

export type FilterChip = {
  id: string;
  label: string;
  onRemove: () => void;
};

export type FilterBarProps = {
  id: string;
  search?: ReactNode;
  children?: ReactNode;
  chips?: FilterChip[];
  activeCount?: number;
  onClear?: () => void;
  loading?: boolean;
  results?: ReactNode;
  resultsRef?: Ref<HTMLParagraphElement>;
  extra?: ReactNode;
};

export function FilterBar({
  id,
  search,
  children,
  chips = [],
  activeCount = 0,
  onClear,
  loading = false,
  results,
  resultsRef,
  extra,
}: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const panelId = `${id}-panel`;

  return (
    <section
      aria-label="Filtros del listado"
      aria-busy={loading || undefined}
      className="space-y-3"
    >
      {search && <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">{search}</div>}

      <button
        aria-controls={panelId}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 text-left text-[13px] font-semibold text-ink transition-colors hover:border-brand/40 md:hidden"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="flex items-center gap-2">
          <Icon aria-hidden="true" name="search" size={17} />
          Filtros
        </span>
        <span className="flex items-center gap-2 text-[12px] font-medium text-muted">
          {activeCount > 0
            ? `${activeCount} ${activeCount === 1 ? "filtro activo" : "filtros activos"}`
            : "Sin filtros"}
          <Icon
            aria-hidden="true"
            className={`transition-transform motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
            name="chevron-down"
            size={15}
          />
        </span>
      </button>

      <div
        className={`rounded-[24px] border border-line bg-surface p-4 sm:p-5 ${
          open ? "block" : "hidden"
        } md:block`}
        id={panelId}
      >
        <fieldset
          className="min-w-0 space-y-4 disabled:opacity-70"
          disabled={loading}
        >
          {children && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {children}
            </div>
          )}

          {chips.length > 0 && (
            <ul aria-label="Filtros activos" className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip.id}>
                  <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-brand/20 bg-soft-blue pl-3 pr-1 text-[12px] font-semibold text-brand">
                    {chip.label}
                    <button
                      aria-label={`Quitar filtro ${chip.label}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-surface"
                      onClick={chip.onRemove}
                      type="button"
                    >
                      <Icon aria-hidden="true" name="close" size={13} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

        </fieldset>

        {extra}
      </div>

      {(results || activeCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
          <p
            aria-live="polite"
            className="text-[12px] font-semibold text-muted"
            ref={resultsRef}
            tabIndex={-1}
          >
            {results}
          </p>
          {onClear && activeCount > 0 && (
            <button
              className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              onClick={onClear}
              type="button"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </section>
  );
}
