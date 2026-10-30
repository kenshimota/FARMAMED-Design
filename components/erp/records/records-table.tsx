import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

export type RecordsTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type RecordsTableProps<T> = {
  caption: string;
  columns: RecordsTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string | number;
  getRowLabel: (row: T) => string;
  rowActions?: (row: T) => ReactNode;
  renderCard: (row: T) => ReactNode;
};

export function RecordsTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  getRowLabel,
  rowActions,
  renderCard,
}: RecordsTableProps<T>) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line">
              {columns.map((column) => (
                <th
                  className={`pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted ${column.headerClassName ?? ""}`}
                  key={column.key}
                  scope="col"
                >
                  {column.header}
                </th>
              ))}
              {rowActions && (
                <th
                  className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                  scope="col"
                >
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-line align-middle last:border-b-0" key={getRowKey(row)}>
                {columns.map((column) => (
                  <td className={`py-3.5 pr-4 text-[13px] text-ink ${column.className ?? ""}`} key={column.key}>
                    {column.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className="py-3.5">
                    <div
                      aria-label={`Acciones para ${getRowLabel(row)}`}
                      className="hidden justify-end xl:flex"
                      role="group"
                    >
                      {rowActions(row)}
                    </div>
                    <details className="xl:hidden">
                      <summary
                        aria-label={`Acciones para ${getRowLabel(row)}`}
                        className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand"
                      >
                        Acciones
                        <Icon name="chevron-down" size={14} />
                      </summary>
                      <div
                        aria-label={`Acciones para ${getRowLabel(row)}`}
                        className="mt-2 flex flex-col gap-2"
                        role="group"
                      >
                        {rowActions(row)}
                      </div>
                    </details>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li className="rounded-2xl border border-line bg-surface p-4" key={getRowKey(row)}>
            {renderCard(row)}
            {rowActions && (
              <div
                aria-label={`Acciones para ${getRowLabel(row)}`}
                className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4"
                role="group"
              >
                {rowActions(row)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
