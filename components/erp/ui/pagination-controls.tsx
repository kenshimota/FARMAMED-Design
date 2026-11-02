"use client";

import { Icon } from "@/components/icons";
import { formatInteger } from "@/lib/format";
import {
  PAGE_SIZE_OPTIONS,
  isPageOutOfRange,
  pageRange,
  type PaginationMeta,
} from "@/lib/pagination";

type PaginationControlsProps = {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onFirstPage?: () => void;
  disabled?: boolean;
  label?: string;
  pageSizeOptions?: readonly number[];
};

function visibleRange(meta: PaginationMeta) {
  const { from, to } = pageRange(meta);
  if (meta.total === 0) return "Sin resultados";
  if (from === 0) return `${formatInteger(meta.total)} resultados en total`;
  return `Mostrando ${formatInteger(from)}–${formatInteger(to)} de ${formatInteger(meta.total)}`;
}

export function PaginationControls({
  meta,
  onPageChange,
  onPageSizeChange,
  onFirstPage,
  disabled = false,
  label = "Paginación",
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationControlsProps) {
  const outOfRange = isPageOutOfRange(meta);
  const sizes = [...new Set([...pageSizeOptions, meta.page_size])].sort(
    (first, second) => first - second,
  );
  const canPrev = !disabled && meta.has_prev && meta.page > 1;
  const canNext = !disabled && meta.has_next;
  const pageLabel = outOfRange
    ? `Página ${formatInteger(meta.page)}`
    : `Página ${formatInteger(meta.page)} de ${formatInteger(
        Math.max(meta.total_pages, 1),
      )}`;

  return (
    <nav
      aria-label={label}
      className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-[12px] font-semibold text-muted">
        {outOfRange ? (
          <>
            La página solicitada está fuera del rango.{" "}
            {formatInteger(meta.total)} resultados en total.
          </>
        ) : (
          visibleRange(meta)
        )}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {onPageSizeChange && (
          <label className="flex min-h-11 items-center gap-2 text-[12px] font-semibold text-muted">
            <span>Filas por página</span>
            <select
              aria-label="Filas por página"
              className="h-10 rounded-xl border border-ink/15 bg-surface px-2 text-[12px] font-semibold text-ink transition-colors hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
              disabled={disabled}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              value={String(meta.page_size)}
            >
              {sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-2">
          <button
            aria-disabled={!canPrev}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand sm:px-4 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink/15 disabled:hover:text-ink"
            disabled={!canPrev}
            onClick={() => onPageChange(meta.page - 1)}
            type="button"
          >
            <Icon aria-hidden="true" name="chevron-left" size={14} />
            Anterior
          </button>
          <span className="min-w-20 text-center text-[12px] font-semibold text-ink">
            {pageLabel}
          </span>
          <button
            aria-disabled={!canNext}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand sm:px-4 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-ink/15 disabled:hover:text-ink"
            disabled={!canNext}
            onClick={() => onPageChange(meta.page + 1)}
            type="button"
          >
            Siguiente
            <Icon aria-hidden="true" name="chevron-right" size={14} />
          </button>
        </div>
      </div>

      {outOfRange && onFirstPage && (
        <button
          className="button-base button-secondary min-h-11 px-5 text-[12px] sm:order-first"
          disabled={disabled}
          onClick={onFirstPage}
          type="button"
        >
          Ir a la primera página
        </button>
      )}
    </nav>
  );
}
