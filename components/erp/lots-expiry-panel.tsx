import Link from "next/link";
import { Icon } from "@/components/icons";
import type { AsyncResource } from "@/components/erp/ui/use-async-resource";
import { PanelError } from "@/components/erp/ui/panel-error";
import { LoadingRegion, SkeletonText } from "@/components/erp/ui/skeleton";
import {
  EXPIRING_SOON_DAYS,
  expiringBeforeDate,
  type CountedRows,
  type LotRow,
} from "@/lib/dashboard";
import { formatDateOnly, formatUnits } from "@/lib/format";

const MAX_ROWS_PER_GROUP = 5;

type LotGroupProps = {
  title: string;
  caption?: string;
  emptyCopy: string;
  linkLabel: string;
  href: string;
  resource: AsyncResource<CountedRows<LotRow>>;
};

function LotGroup({
  title,
  caption,
  emptyCopy,
  linkLabel,
  href,
  resource,
}: LotGroupProps) {
  const loading = resource.status === "loading" || resource.status === "idle";
  const rows = resource.data?.items ?? [];
  const total = resource.data?.count ?? rows.length;
  const visibleRows = rows.slice(0, MAX_ROWS_PER_GROUP);

  return (
    <div>
      <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h3 className="text-[15px] font-semibold text-ink">
          {title}
          {caption && (
            <span className="ml-2 text-[12px] font-medium text-muted">
              {" "}
              {caption}
            </span>
          )}
        </h3>
        {rows.length > 0 && (
          <Link
            className="inline-flex min-h-11 items-center gap-1.5 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href={href}
          >
            {linkLabel}
            <Icon name="arrow-right" size={14} />
          </Link>
        )}
      </div>

      <div className="mt-3">
        {resource.status === "error" ? (
          <PanelError
            description={resource.error?.message ?? "No pudimos cargar los lotes."}
            onRetry={resource.reload}
          />
        ) : loading ? (
          <LoadingRegion>
            <SkeletonText lines={2} />
          </LoadingRegion>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-line bg-background px-5 py-4 text-[13px] text-muted">
            {emptyCopy}
          </p>
        ) : (
          <>
            <ul className="space-y-2.5">
              {visibleRows.map((lot) => (
                <li
                  className="rounded-2xl border border-line bg-background px-5 py-3.5"
                  key={lot.id}
                >
                  <p className="text-[13px] font-semibold text-ink">
                    Lote {lot.number}
                    {lot.productName && (
                      <span className="font-medium text-muted"> · {lot.productName}</span>
                    )}
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    Vencimiento {formatDateOnly(lot.expirationDate)} · {formatUnits(lot.stock)}
                  </p>
                </li>
              ))}
            </ul>
            {total > visibleRows.length && (
              <p className="mt-3 text-[12px] text-muted">
                Mostrando {visibleRows.length} de {total} lotes.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function LotsExpiryPanel({
  expiredLots,
  expiringLots,
}: {
  expiredLots: AsyncResource<CountedRows<LotRow>>;
  expiringLots: AsyncResource<CountedRows<LotRow>>;
}) {
  return (
    <section
      aria-labelledby="titulo-lotes-vencimiento"
      className="rounded-[28px] border border-ink/[0.08] bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-7"
    >
      <div>
        <span className="eyebrow">Vencimientos</span>
        <h2
          className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-ink"
          id="titulo-lotes-vencimiento"
        >
          Lotes vencidos y próximos a vencer
        </h2>
        <p className="mt-2 text-[12px] text-muted">
          Información para tu revisión; no es una alerta automática.
        </p>
      </div>

      <div className="mt-6 space-y-7">
        <LotGroup
          emptyCopy="No hay lotes vencidos."
          href="/app/lotes?expired=true"
          linkLabel="Ver lotes vencidos"
          resource={expiredLots}
          title="Vencidos"
        />
        <LotGroup
          caption={`en los próximos ${EXPIRING_SOON_DAYS} días`}
          emptyCopy="No hay lotes próximos a vencer."
          href={`/app/lotes?expired=false&expiring_before=${expiringBeforeDate(EXPIRING_SOON_DAYS)}`}
          linkLabel="Ver próximos a vencer"
          resource={expiringLots}
          title="Próximos a vencer"
        />
      </div>
    </section>
  );
}
