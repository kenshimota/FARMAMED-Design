"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { LoadingRegion, SkeletonTable } from "@/components/erp/ui/skeleton";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { LARGE_LIST_NOTICE, LARGE_LIST_THRESHOLD } from "@/lib/feedback";
import { formatInteger } from "@/lib/format";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  numeric?: boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  rowLabel: (row: T) => string;
  rowActions?: (row: T) => ReactNode;
  search?: {
    placeholder: string;
    match: (row: T, query: string) => boolean;
  };
  emptyState: {
    title: string;
    description: string;
    action?: ReactNode;
  };
  loading?: boolean;
  refreshing?: boolean;
};

function resultsLabel(count: number) {
  return count === 1 ? "1 resultado" : `${formatInteger(count)} resultados`;
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  rowLabel,
  rowActions,
  search,
  emptyState,
  loading = false,
  refreshing = false,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const searchId = useId();

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!search || !normalized) return rows;
    return rows.filter((row) => search.match(row, normalized));
  }, [query, rows, search]);

  if (loading) {
    return (
      <LoadingRegion>
        <SkeletonTable columns={columns.length + (rowActions ? 1 : 0)} rows={5} />
      </LoadingRegion>
    );
  }

  return (
    <div className="space-y-4">
      {refreshing && (
        <div aria-hidden="true" className="reload-bar" />
      )}
      {rows.length > LARGE_LIST_THRESHOLD && (
        <NoticeBanner tone="warning">{LARGE_LIST_NOTICE}</NoticeBanner>
      )}
      {search && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <label className="sr-only" htmlFor={searchId}>
              {search.placeholder}
            </label>
            <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" name="search" size={17} />
            <input
              className="h-11 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
              id={searchId}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={search.placeholder}
              type="search"
              value={query}
            />
          </div>
          <p aria-live="polite" className="text-[12px] font-semibold text-muted">
            {resultsLabel(filteredRows.length)}
          </p>
        </div>
      )}

      {filteredRows.length === 0 ? (
        query.trim() ? (
          <EmptyState
            description="No hay filas que coincidan con la búsqueda. Prueba con otros términos."
            title="Sin resultados"
          />
        ) : (
          <EmptyState {...emptyState} />
        )
      ) : (
        <>
          <table className="hidden w-full border-collapse text-left md:table">
            <thead>
              <tr className="border-b border-line">
                {columns.map((column) => (
                  <th
                    className={`pb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted ${
                      column.numeric ? "text-right" : ""
                    }`}
                    key={column.key}
                    scope="col"
                  >
                    {column.header}
                  </th>
                ))}
                {rowActions && (
                  <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted" scope="col">
                    Acciones
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr className="border-b border-line last:border-b-0" key={getRowKey(row)}>
                  {columns.map((column) => (
                    <td
                      className={`py-3.5 pr-4 text-[13px] text-ink ${column.numeric ? "text-right" : ""}`}
                      key={column.key}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {rowActions && <td className="py-3.5 text-right">{rowActions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="space-y-3 md:hidden">
            {filteredRows.map((row) => (
              <li
                className="rounded-2xl border border-line bg-surface p-4"
                key={getRowKey(row)}
              >
                <p className="text-[13px] font-semibold text-ink">{rowLabel(row)}</p>
                <dl className="mt-3 space-y-2">
                  {columns.map((column) => (
                    <div className="grid grid-cols-[1fr_auto] gap-3" key={column.key}>
                      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
                        {column.header}
                      </dt>
                      <dd className="text-right text-[13px] text-ink">{column.render(row)}</dd>
                    </div>
                  ))}
                </dl>
                {rowActions && <div className="mt-4 flex flex-wrap gap-2">{rowActions(row)}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
