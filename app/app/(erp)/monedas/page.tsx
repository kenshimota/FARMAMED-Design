"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import {
  deactivateCurrency,
  fetchCurrencies,
  formatRate,
  isBaseCurrency,
  isDefaultTransactionCurrency,
  type Currency,
} from "@/lib/finance/currencies-api";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsTable, type RecordsTableColumn } from "@/components/erp/records/records-table";
import { RecordActionButton, RecordActionLink, RecordActions } from "@/components/erp/records/record-actions";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

const NO_CURRENCIES: Currency[] = [];

function currenciesLabel(count: number) {
  return count === 1 ? "1 moneda" : `${formatInteger(count)} monedas`;
}

function CurrencyStatusBadge({ currency }: { currency: Currency }) {
  if (!currency.is_active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted">
        <Icon name="eye-off" size={13} />
        Inactiva
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
      <Icon name="check" size={13} />
      Activa
    </span>
  );
}

function CurrencyBadges({ currency }: { currency: Currency }) {
  return (
    <div className="flex flex-wrap gap-2">
      {currency.is_base && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          <Icon name="check" size={13} />
          Base
        </span>
      )}
      {currency.is_default_for_transactions && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-olive/30 bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
          <Icon name="arrow-right" size={13} />
          Predeterminada
        </span>
      )}
    </div>
  );
}

export default function CurrenciesPage() {
  const { user } = useSession();
  const canWrite = canWriteModule(user.role, "monedas");
  return <CurrenciesContent canWrite={canWrite} />;
}

function CurrenciesContent({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [includeInactive, setIncludeInactive] = useState(false);
  const resource = useAsyncResource(() => fetchCurrencies(includeInactive), {
    enabled: true,
  });
  const [query, setQuery] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<Currency | null>(null);

  const currencies = resource.data ?? NO_CURRENCIES;

  const filteredCurrencies = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return currencies;
    return currencies.filter(
      (currency) =>
        currency.code.toLowerCase().includes(normalized) ||
        currency.name.toLowerCase().includes(normalized) ||
        currency.symbol.toLowerCase().includes(normalized),
    );
  }, [query, currencies]);

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    await deactivateCurrency(String(deactivateTarget.id));
    toast.success("Moneda desactivada.");
    resource.reload();
    setDeactivateTarget(null);
  }

  function renderActions(currency: Currency) {
    const editReason = isBaseCurrency(currency)
      ? "El bolívar no se puede editar."
      : !canWrite
        ? "No tienes permiso para editar monedas."
        : null;
    const deactivateReason = isBaseCurrency(currency)
      ? "El bolívar no se puede desactivar."
      : isDefaultTransactionCurrency(currency)
        ? "La moneda de transacciones no se puede desactivar."
        : !canWrite
          ? "No tienes permiso para desactivar monedas."
          : null;

    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver historial de ${currency.code}`}
          href={`/app/monedas/${currency.id}/historial`}
          icon="chart"
        >
          Historial
        </RecordActionLink>
        {editReason ? (
          <RecordActionButton
            aria-label={`Editar ${currency.code}`}
            disabled
            icon="arrow-right"
            title={editReason}
          >
            Editar
          </RecordActionButton>
        ) : (
          <RecordActionLink
            ariaLabel={`Editar ${currency.code}`}
            href={`/app/monedas/${currency.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        <RecordActionButton
          aria-describedby={deactivateReason ? undefined : undefined}
          aria-label={deactivateReason ?? `Desactivar ${currency.code}`}
          danger
          disabled={Boolean(deactivateReason)}
          icon="eye-off"
          onClick={() => setDeactivateTarget(currency)}
          title={deactivateReason ?? undefined}
        >
          Desactivar
        </RecordActionButton>
      </RecordActions>
    );
  }

  function renderCard(currency: Currency) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {currency.code}
          </span>
          <span className="text-[15px] font-semibold text-ink">{currency.name}</span>
        </div>
        <dl className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Símbolo</dt>
            <dd className="text-[13px] text-ink">{currency.symbol}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Tasa</dt>
            <dd className="text-[13px] text-ink">1 {currency.code} = {formatRate(currency.rate)} VES</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Indicadores</dt>
            <dd><CurrencyBadges currency={currency} /></dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Estado</dt>
            <dd><CurrencyStatusBadge currency={currency} /></dd>
          </div>
        </dl>
      </div>
    );
  }

  const columns: RecordsTableColumn<Currency>[] = [
    {
      key: "codigo",
      header: "Código",
      render: (currency) => (
        <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
          {currency.code}
        </span>
      ),
    },
    { key: "nombre", header: "Nombre", render: (currency) => <span className="font-semibold text-ink">{currency.name}</span> },
    { key: "simbolo", header: "Símbolo", render: (currency) => <span>{currency.symbol}</span> },
    {
      key: "tasa",
      header: "Tasa",
      render: (currency) => <span className="text-[13px] text-ink">1 {currency.code} = {formatRate(currency.rate)} VES</span>,
    },
    {
      key: "indicadores",
      header: "Indicadores",
      render: (currency) => <CurrencyBadges currency={currency} />,
    },
    {
      key: "estado",
      header: "Estado",
      render: (currency) => <CurrencyStatusBadge currency={currency} />,
    },
  ];

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/monedas/nueva"
            >
              Nueva moneda
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta las monedas activas, sus tasas de referencia y el historial de cambios. La tasa es informativa y no convierte montos automáticamente."
        eyebrow="Finanzas"
        title="Monedas"
      />

      {resource.status === "loading" && (
        <div aria-busy="true" className="space-y-4" role="status">
          <span className="sr-only">Cargando monedas…</span>
          <div className="rounded-[24px] border border-line bg-surface p-5">
            <div className="skeleton h-16 w-full sm:max-w-xs" />
            <div className="skeleton mt-4 h-40 w-full" />
          </div>
        </div>
      )}

      {resource.status === "error" && (
        <RecordsLoadError
          description={resource.error?.message ?? "No pudimos cargar las monedas."}
          onRetry={resource.reload}
          title="No pudimos cargar las monedas"
        />
      )}

      {resource.status !== "loading" && resource.status !== "error" && (
        <section aria-label="Listado de monedas" className="space-y-4">
          {resource.status === "refreshing" && <div aria-hidden="true" className="reload-bar" />}

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <label className="sr-only" htmlFor="buscar-monedas">Buscar monedas</label>
                <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" name="search" size={17} />
                <input
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                  id="buscar-monedas"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por código, nombre o símbolo"
                  type="search"
                  value={query}
                />
              </div>

              {canWrite && (
                <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-background px-4 py-3 text-[13px] text-ink">
                  <input
                    checked={includeInactive}
                    className="h-5 w-5 accent-brand"
                    onChange={(event) => {
                      setIncludeInactive(event.target.checked);
                      resource.reload();
                    }}
                    type="checkbox"
                  />
                  Incluir inactivas
                </label>
              )}
            </div>

            <p aria-live="polite" className="mt-4 text-[12px] font-semibold text-muted">
              {query.trim()
                ? `Mostrando ${formatInteger(filteredCurrencies.length)} de ${currenciesLabel(currencies.length)}`
                : currenciesLabel(currencies.length)}
            </p>
          </div>

          {currencies.length === 0 ? (
            <EmptyState
              action={
                canWrite ? (
                  <Link className="button-base button-primary min-h-11 px-5" href="/app/monedas/nueva">
                    Nueva moneda
                    <Icon name="arrow-right" size={17} />
                  </Link>
                ) : undefined
              }
              description="No hay monedas configuradas. Revisa la semilla del API."
              title="No hay monedas configuradas"
            />
          ) : filteredCurrencies.length === 0 ? (
            <EmptyState
              action={
                <button
                  className="button-base button-secondary min-h-11 px-5"
                  onClick={() => setQuery("")}
                  type="button"
                >
                  Limpiar búsqueda
                </button>
              }
              description="No hay monedas que coincidan con la búsqueda."
              title="Sin resultados"
            />
          ) : (
            <RecordsTable
              caption="Monedas con su código, nombre, símbolo, tasa, indicadores y estado"
              columns={columns}
              getRowKey={(currency) => String(currency.id)}
              getRowLabel={(currency) => currency.code}
              renderCard={renderCard}
              rowActions={renderActions}
              rows={filteredCurrencies}
            />
          )}
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Desactivar moneda"
        description={
          deactivateTarget ? (
            <div className="space-y-2">
              <p>
                Código: <span className="font-semibold text-ink">{deactivateTarget.code}</span>
              </p>
              <p>La moneda quedará inactiva pero no se eliminará.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        onError={(error) => toast.error(error.message)}
        open={deactivateTarget !== null}
        title={deactivateTarget ? `¿Desactivar ${deactivateTarget.code}?` : "Desactivar moneda"}
      />
    </div>
  );
}
