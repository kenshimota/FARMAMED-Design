"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import type { AsyncResource } from "@/components/erp/ui/use-async-resource";
import { BusyButton } from "@/components/erp/ui/action-button";
import { DataTable, type DataTableColumn } from "@/components/erp/ui/data-table";
import { PanelError } from "@/components/erp/ui/panel-error";
import type { CountedRows, DraftPurchase, SupplierRow } from "@/lib/dashboard";
import { formatInteger, formatMoney } from "@/lib/format";

type PurchaseCurrency = {
  code: string;
  symbol: string;
};

export type PendingPurchasesPanelProps = {
  resource: AsyncResource<CountedRows<DraftPurchase>>;
  suppliersById: Map<number, SupplierRow>;
  currenciesById: Map<number, PurchaseCurrency>;
  canConfirm: boolean;
  confirmingId: number | null;
  onConfirm: (purchase: DraftPurchase) => Promise<void>;
};

function rowCurrency(row: DraftPurchase, currenciesById: Map<number, PurchaseCurrency>) {
  return (
    row.currency ??
    (row.currencyId !== null ? currenciesById.get(row.currencyId) : undefined) ??
    null
  );
}

export function PendingPurchasesPanel({
  resource,
  suppliersById,
  currenciesById,
  canConfirm,
  confirmingId,
  onConfirm,
}: PendingPurchasesPanelProps) {
  const rows = resource.data?.items ?? [];
  const loading = resource.status === "loading" || resource.status === "idle";
  const refreshing = resource.status === "refreshing";

  const columns: DataTableColumn<DraftPurchase>[] = [
    {
      key: "number",
      header: "Número",
      render: (row) => (
        <span className="font-semibold text-ink">Nro. {formatInteger(row.number)}</span>
      ),
    },
    {
      key: "supplier",
      header: "Proveedor",
      render: (row) =>
        (row.supplierId !== null ? suppliersById.get(row.supplierId)?.name : null) ?? "—",
    },
    {
      key: "currency",
      header: "Moneda",
      render: (row) => rowCurrency(row, currenciesById)?.code ?? "—",
    },
    {
      key: "total",
      header: "Total",
      numeric: true,
      render: (row) => {
        const currency = rowCurrency(row, currenciesById);
        return row.total === null
          ? "—"
          : formatMoney(row.total, {
              code: currency?.code ?? null,
              symbol: currency?.symbol ?? null,
            });
      },
    },
  ];

  return (
    <section
      aria-labelledby="titulo-pendientes-compra"
      className="rounded-[28px] border border-ink/[0.08] bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-7 lg:col-span-2"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Compras</span>
          <h2
            className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-ink"
            id="titulo-pendientes-compra"
          >
            Pendientes de compra
          </h2>
        </div>
        <p className="text-[12px] text-muted">Borradores listos para revisar y confirmar</p>
      </div>

      <div className="mt-6">
        {resource.status === "error" ? (
          <PanelError
            description={
              resource.error?.message ?? "No pudimos cargar las compras en borrador."
            }
            onRetry={resource.reload}
          />
        ) : (
          <DataTable
            columns={columns}
            emptyState={{
              title: "No hay compras en borrador.",
              description:
                "Las compras que dejes en borrador aparecerán aquí para que puedas revisarlas y confirmarlas.",
            }}
            getRowKey={(row) => row.id}
            loading={loading}
            refreshing={refreshing}
            rowActions={
              canConfirm
                ? (row) => (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Link
                        className="inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                        href={`/app/compras/${row.id}`}
                      >
                        Abrir borrador
                        <Icon name="arrow-right" size={14} />
                      </Link>
                      <BusyButton
                        busy={confirmingId === row.id}
                        busyLabel="Confirmando…"
                        className="min-h-11 px-5 text-[12px]"
                        disabled={confirmingId !== null}
                        onClick={() => void onConfirm(row)}
                        variant="secondary"
                      >
                        Confirmar
                      </BusyButton>
                    </div>
                  )
                : undefined
            }
            rowLabel={(row) => `Compra Nro. ${formatInteger(row.number)}`}
            rows={rows}
          />
        )}
      </div>
    </section>
  );
}
