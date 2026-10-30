"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import {
  fetchCurrency,
  fetchCurrencyHistory,
  formatRate,
  type CurrencyHistoryEntry,
} from "@/lib/finance/currencies-api";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsTable, type RecordsTableColumn } from "@/components/erp/records/records-table";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { canReadModule } from "@/lib/permissions";
import { AccessState } from "@/components/erp/access-state";

const NO_HISTORY: CurrencyHistoryEntry[] = [];

function formatDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-VE", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function CurrencyHistoryPage() {
  const { user } = useSession();
  if (!canReadModule(user.role, "monedas")) return <AccessState />;
  return <CurrencyHistoryContent />;
}

function CurrencyHistoryContent() {
  const params = useParams();
  const id = String(params.id);
  const currencyResource = useAsyncResource(() => fetchCurrency(id));
  const historyResource = useAsyncResource(() => fetchCurrencyHistory(id));

  const currency = currencyResource.data;
  const history = historyResource.data ?? NO_HISTORY;

  const loading = currencyResource.status === "loading" || historyResource.status === "loading";
  const error = currencyResource.error ?? historyResource.error;

  const columns: RecordsTableColumn<CurrencyHistoryEntry>[] = [
    {
      key: "fecha",
      header: "Fecha",
      render: (entry) => <span className="text-[13px] text-ink">{formatDate(entry.changed_at)}</span>,
    },
    {
      key: "anterior",
      header: "Tasa anterior",
      render: (entry) => (
        <span className="text-[13px] text-ink">
          {entry.previous_rate !== null ? formatRate(entry.previous_rate) : "—"}
        </span>
      ),
    },
    {
      key: "nueva",
      header: "Tasa nueva",
      render: (entry) => <span className="font-semibold text-ink">{formatRate(entry.new_rate)}</span>,
    },
    {
      key: "usuario",
      header: "Usuario",
      render: (entry) => (
        <span className="text-[13px] text-ink">
          {entry.changed_by ?? "Sistema / Semilla"}
        </span>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      render: (entry) => (
        <span className="line-clamp-2 text-[13px] text-muted">
          {entry.reason ?? "—"}
        </span>
      ),
    },
  ];

  function renderCard(entry: CurrencyHistoryEntry) {
    return (
      <div>
        <p className="text-[15px] font-semibold text-ink">{formatDate(entry.changed_at)}</p>
        <dl className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Tasa anterior</dt>
            <dd className="text-[13px] text-ink">{entry.previous_rate !== null ? formatRate(entry.previous_rate) : "—"}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Tasa nueva</dt>
            <dd className="font-semibold text-ink">{formatRate(entry.new_rate)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Usuario</dt>
            <dd className="text-[13px] text-ink">{entry.changed_by ?? "Sistema / Semilla"}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Motivo</dt>
            <dd className="text-[13px] text-muted">{entry.reason ?? "—"}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/monedas"
          >
            <Icon name="arrow-right" size={17} />
            Volver a monedas
          </Link>
        }
        description={
          currency
            ? `Historial de cambios de tasa de ${currency.name} (${currency.code}).`
            : "Historial de cambios de tasa de la moneda."
        }
        eyebrow="Finanzas"
        title={currency ? `Historial de ${currency.code}` : "Historial de tasas"}
      />

      {loading && (
        <div aria-busy="true" className="space-y-4" role="status">
          <span className="sr-only">Cargando historial…</span>
          <div className="rounded-[24px] border border-line bg-surface p-5">
            <div className="skeleton h-40 w-full" />
          </div>
        </div>
      )}

      {error && (
        <RecordsLoadError
          description={error.message ?? "No pudimos cargar el historial."}
          onRetry={() => {
            currencyResource.reload();
            historyResource.reload();
          }}
          title="No pudimos cargar el historial"
        />
      )}

      {!loading && !error && (
        <section aria-label="Historial de tasas" className="space-y-4">
          {history.length === 0 ? (
            <EmptyState
              description="Esta moneda no tiene cambios de tasa registrados."
              title="Sin historial"
            />
          ) : (
            <RecordsTable
              caption={`Historial de tasas de ${currency?.code ?? "moneda"}`}
              columns={columns}
              getRowKey={(entry) => String(entry.id)}
              getRowLabel={(entry) => formatDate(entry.changed_at)}
              renderCard={renderCard}
              rows={history}
            />
          )}
        </section>
      )}
    </div>
  );
}
