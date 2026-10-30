import Link from "next/link";
import { Icon } from "@/components/icons";
import type { AsyncResource } from "@/components/erp/ui/use-async-resource";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { PanelError } from "@/components/erp/ui/panel-error";
import { LoadingRegion, SkeletonPanel } from "@/components/erp/ui/skeleton";
import type { CountedRows, StockRow } from "@/lib/dashboard";
import { formatUnits } from "@/lib/format";

function groupByState(rows: StockRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    totals.set(row.itemStateLabel, (totals.get(row.itemStateLabel) ?? 0) + row.quantity);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

export function StockStatesPanel({
  resource,
}: {
  resource: AsyncResource<CountedRows<StockRow>>;
}) {
  const loading = resource.status === "loading" || resource.status === "idle";
  const groups = groupByState(resource.data?.items ?? []);

  return (
    <section
      aria-labelledby="titulo-existencias-estado"
      className="rounded-[28px] border border-ink/[0.08] bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-7"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Inventario</span>
          <h2
            className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-ink"
            id="titulo-existencias-estado"
          >
            Existencias por estado
          </h2>
        </div>
        <Link
          className="inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/existencias"
        >
          Ver existencias
          <Icon name="arrow-right" size={15} />
        </Link>
      </div>

      <div className="mt-6">
        {resource.status === "error" ? (
          <PanelError
            description={
              resource.error?.message ?? "No pudimos cargar las existencias."
            }
            onRetry={resource.reload}
          />
        ) : loading ? (
          <LoadingRegion>
            <SkeletonPanel lines={3} />
          </LoadingRegion>
        ) : groups.length === 0 ? (
          <EmptyState
            description="Se crean al confirmar una compra."
            title="Todavía no hay existencias registradas."
          />
        ) : (
          <ul className="space-y-3">
            {groups.map(([label, quantity]) => (
              <li
                className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-background px-5 py-4"
                key={label}
              >
                <span className="text-[13px] font-semibold text-ink">{label}</span>
                <span className="text-[13px] text-muted">{formatUnits(quantity)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-5 rounded-xl border border-olive/20 bg-soft-lime px-4 py-3 text-[12px] leading-6 text-ink">
        Las existencias agregadas y los lotes son fuentes independientes y pueden diferir.
      </p>
    </section>
  );
}
