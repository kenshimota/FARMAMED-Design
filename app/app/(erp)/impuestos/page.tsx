"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import {
  deleteTax,
  fetchTaxes,
  formatTaxRate,
  type Tax,
} from "@/lib/finance/taxes-api";
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

const NO_TAXES: Tax[] = [];

function taxesLabel(count: number) {
  return count === 1 ? "1 impuesto" : `${formatInteger(count)} impuestos`;
}

function TaxStatusBadge({ tax }: { tax: Tax }) {
  if (!tax.is_active) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted">
        <Icon name="eye-off" size={13} />
        Inactivo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
      <Icon name="check" size={13} />
      Activo
    </span>
  );
}

export default function TaxesPage() {
  const { user } = useSession();
  const canWrite = canWriteModule(user.role, "impuestos");
  return <TaxesContent canWrite={canWrite} />;
}

function TaxesContent({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const resource = useAsyncResource(() => fetchTaxes(statusFilter ? statusFilter === "activos" : undefined), {
    enabled: true,
  });
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Tax | null>(null);

  const taxes = resource.data ?? NO_TAXES;

  const filteredTaxes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return taxes;
    return taxes.filter(
      (tax) =>
        tax.code.toLowerCase().includes(normalized) ||
        tax.name.toLowerCase().includes(normalized),
    );
  }, [query, taxes]);

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteTax(String(deleteTarget.id));
    toast.success("Impuesto eliminado.");
    resource.reload();
    setDeleteTarget(null);
  }

  function renderActions(tax: Tax) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Editar ${tax.code}`}
          href={`/app/impuestos/${tax.id}/editar`}
          icon="arrow-right"
        >
          Editar
        </RecordActionLink>
        <RecordActionButton
          aria-label={`Eliminar ${tax.code}`}
          danger
          icon="close"
          onClick={() => setDeleteTarget(tax)}
        >
          Eliminar
        </RecordActionButton>
      </RecordActions>
    );
  }

  function renderCard(tax: Tax) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {tax.code}
          </span>
          <span className="text-[15px] font-semibold text-ink">{tax.name}</span>
        </div>
        <dl className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Tasa</dt>
            <dd className="text-[13px] text-ink">{formatTaxRate(tax.rate)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Descripción</dt>
            <dd className="line-clamp-2 text-[13px] text-muted">{tax.description || "Sin descripción"}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Estado</dt>
            <dd><TaxStatusBadge tax={tax} /></dd>
          </div>
        </dl>
      </div>
    );
  }

  const columns: RecordsTableColumn<Tax>[] = [
    {
      key: "codigo",
      header: "Código",
      render: (tax) => (
        <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
          {tax.code}
        </span>
      ),
    },
    { key: "nombre", header: "Nombre", render: (tax) => <span className="font-semibold text-ink">{tax.name}</span> },
    {
      key: "tasa",
      header: "Tasa",
      render: (tax) => <span className="text-[13px] text-ink">{formatTaxRate(tax.rate)}</span>,
    },
    {
      key: "descripcion",
      header: "Descripción",
      render: (tax) => <span className="line-clamp-2 text-muted">{tax.description || "Sin descripción"}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      render: (tax) => <TaxStatusBadge tax={tax} />,
    },
  ];

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/impuestos/nuevo"
            >
              Nuevo impuesto
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Mantén las definiciones de impuestos que se usarán en pedidos futuros. Las compras registran el impuesto como monto por línea y no usan este catálogo."
        eyebrow="Finanzas"
        title="Impuestos"
      />

      {resource.status === "loading" && (
        <div aria-busy="true" className="space-y-4" role="status">
          <span className="sr-only">Cargando impuestos…</span>
          <div className="rounded-[24px] border border-line bg-surface p-5">
            <div className="skeleton h-16 w-full sm:max-w-xs" />
            <div className="skeleton mt-4 h-40 w-full" />
          </div>
        </div>
      )}

      {resource.status === "error" && (
        <RecordsLoadError
          description={resource.error?.message ?? "No pudimos cargar los impuestos."}
          onRetry={resource.reload}
          title="No pudimos cargar los impuestos"
        />
      )}

      {resource.status !== "loading" && resource.status !== "error" && (
        <section aria-label="Listado de impuestos" className="space-y-4">
          {resource.status === "refreshing" && <div aria-hidden="true" className="reload-bar" />}

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(170px,220px)] sm:items-end">
              <div className="relative w-full">
                <label className="sr-only" htmlFor="buscar-impuestos">Buscar impuestos</label>
                <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" name="search" size={17} />
                <input
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                  id="buscar-impuestos"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por código o nombre"
                  type="search"
                  value={query}
                />
              </div>

              <div>
                <label className="mb-2 block text-[12px] font-semibold text-ink" htmlFor="filtro-estado">
                  Estado
                </label>
                <select
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[14px] text-ink transition-colors hover:border-brand/45 focus:border-brand"
                  id="filtro-estado"
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    resource.reload();
                  }}
                  value={statusFilter}
                >
                  <option value="">Todos</option>
                  <option value="activos">Activos</option>
                  <option value="inactivos">Inactivos</option>
                </select>
              </div>
            </div>

            <p aria-live="polite" className="mt-4 text-[12px] font-semibold text-muted">
              {query.trim()
                ? `Mostrando ${formatInteger(filteredTaxes.length)} de ${taxesLabel(taxes.length)}`
                : taxesLabel(taxes.length)}
            </p>
          </div>

          {taxes.length === 0 ? (
            <EmptyState
              action={
                canWrite ? (
                  <Link className="button-base button-primary min-h-11 px-5" href="/app/impuestos/nuevo">
                    Nuevo impuesto
                    <Icon name="arrow-right" size={17} />
                  </Link>
                ) : undefined
              }
              description="Todavía no hay impuestos. Crea el primero cuando definas las tasas."
              title="Todavía no hay impuestos"
            />
          ) : filteredTaxes.length === 0 ? (
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
              description="No hay impuestos que coincidan con la búsqueda."
              title="Sin resultados"
            />
          ) : (
            <RecordsTable
              caption="Impuestos con su código, nombre, tasa, descripción y estado"
              columns={columns}
              getRowKey={(tax) => String(tax.id)}
              getRowLabel={(tax) => tax.code}
              renderCard={renderCard}
              rowActions={canWrite ? renderActions : undefined}
              rows={filteredTaxes}
            />
          )}
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar impuesto"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Código: <span className="font-semibold text-ink">{deleteTarget.code}</span>
              </p>
              <p>Esta acción es permanente. Si está en uso, se ofrecerá desactivar en su lugar.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={deleteTarget ? `¿Eliminar ${deleteTarget.code}?` : "Eliminar impuesto"}
      />
    </div>
  );
}
