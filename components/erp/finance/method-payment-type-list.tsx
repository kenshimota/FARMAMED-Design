"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { fetchCurrencies } from "@/lib/finance/currencies-api";
import { formatInteger } from "@/lib/format";
import {
  deleteMethodPaymentType,
  fetchMethodPaymentTypes,
  getMethodPaymentFieldTypeLabel,
  updateMethodPaymentType,
  type MethodPaymentField,
  type MethodPaymentType,
} from "@/lib/finance/method-payment-types-api";
import { canWriteModule } from "@/lib/permissions";

const NO_TYPES: MethodPaymentType[] = [];
const CATALOG_NOTICE =
  "Este catálogo define los datos de cobro. No procesa pagos ni guarda credenciales.";

type StatusFilter = "" | "true" | "false";

function typesLabel(count: number) {
  return count === 1 ? "1 tipo" : `${formatInteger(count)} tipos`;
}

function fieldsLabel(count: number) {
  return count === 1 ? "1 campo" : `${formatInteger(count)} campos`;
}

function TypeStatusBadge({ type }: { type: MethodPaymentType }) {
  if (!type.is_active) {
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

function CurrencyCell({ type }: { type: MethodPaymentType }) {
  if (!type.currency) {
    return <span className="text-[13px] text-muted">Sin moneda</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1.5">
      <span className="font-mono text-[12px] font-semibold text-ink">
        {type.currency.code}
      </span>
      <span className="text-[13px] text-muted">{type.currency.symbol}</span>
    </span>
  );
}

function FieldsDetails({ fields }: { fields: MethodPaymentField[] }) {
  if (fields.length === 0) {
    return <p className="text-[12px] leading-5 text-muted">Sin campos definidos.</p>;
  }

  return (
    <ol className="space-y-2.5">
      {fields.map((field, index) => (
        <li
          className="rounded-xl border border-line bg-surface px-3 py-2.5"
          key={`${field.key}-${index}`}
        >
          <p className="text-[12px] font-semibold text-ink">
            {index + 1}. {field.label}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            Clave: <span className="font-mono">{field.key}</span> ·{" "}
            {getMethodPaymentFieldTypeLabel(field.type)} ·{" "}
            {field.required ? "Obligatorio" : "Opcional"}
            {field.max_length ? ` · Máximo ${field.max_length} caracteres` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function MethodPaymentTypeListPage() {
  const { user } = useSession();
  const canWrite = canWriteModule(user.role, "tipos_metodos_pago");
  return <MethodPaymentTypeListContent canWrite={canWrite} />;
}

function MethodPaymentTypeListContent({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [query, setQuery] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<MethodPaymentType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MethodPaymentType | null>(null);

  const resource = useAsyncResource(
    () =>
      fetchMethodPaymentTypes({
        currencyId: currencyFilter || undefined,
        isActive:
          statusFilter === "" ? undefined : statusFilter === "true",
      }),
    { enabled: true },
  );
  const currenciesResource = useAsyncResource(() => fetchCurrencies(true), {
    enabled: true,
  });

  const types = resource.data ?? NO_TYPES;
  const hasServerFilters = Boolean(currencyFilter || statusFilter);

  const filteredTypes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return types;
    return types.filter(
      (type) =>
        type.code.toLowerCase().includes(normalized) ||
        type.name.toLowerCase().includes(normalized),
    );
  }, [query, types]);

  const currenciesLoading = currenciesResource.status === "loading";
  const currenciesError = currenciesResource.status === "error";

  function reloadWithFilters() {
    resource.reload();
  }

  function clearFilters() {
    setCurrencyFilter("");
    setStatusFilter("");
    setQuery("");
    reloadWithFilters();
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    try {
      await updateMethodPaymentType(String(deactivateTarget.id), {
        is_active: false,
      });
      toast.success("Tipo desactivado.");
      resource.reload();
    } catch (caught) {
      toast.error(translateApiError(caught).message);
    }
    setDeactivateTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMethodPaymentType(String(deleteTarget.id));
      toast.success("Tipo eliminado.");
      resource.reload();
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        toast.error(
          "No puedes eliminar este tipo porque tiene métodos registrados.",
        );
      } else {
        toast.error(translateApiError(caught).message);
      }
    }
    setDeleteTarget(null);
  }

  function renderActions(type: MethodPaymentType) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Editar ${type.code}`}
          href={`/app/tipos-metodo-pago/${type.id}/editar`}
          icon="arrow-right"
        >
          Editar
        </RecordActionLink>
        {type.is_active && (
          <RecordActionButton
            aria-label={`Desactivar ${type.code}`}
            icon="eye-off"
            onClick={() => setDeactivateTarget(type)}
          >
            Desactivar
          </RecordActionButton>
        )}
        <RecordActionButton
          aria-label={`Eliminar ${type.code}`}
          danger
          icon="close"
          onClick={() => setDeleteTarget(type)}
        >
          Eliminar
        </RecordActionButton>
      </RecordActions>
    );
  }

  function renderCard(type: MethodPaymentType) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {type.code}
          </span>
          <span className="text-[15px] font-semibold text-ink">{type.name}</span>
        </div>

        <dl className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Moneda
            </dt>
            <dd className="text-right">
              <CurrencyCell type={type} />
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Campos definidos
            </dt>
            <dd className="text-[13px] text-ink">{fieldsLabel(type.fields.length)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Estado
            </dt>
            <dd>
              <TypeStatusBadge type={type} />
            </dd>
          </div>
        </dl>

        <details className="mt-3 border-t border-line pt-3">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full text-[12px] font-semibold text-brand">
            Ver campos definidos
            <Icon name="chevron-down" size={14} />
          </summary>
          <div className="mt-2">
            <FieldsDetails fields={type.fields} />
          </div>
        </details>
      </div>
    );
  }

  const columns: RecordsTableColumn<MethodPaymentType>[] = [
    {
      key: "codigo",
      header: "Código",
      render: (type) => (
        <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
          {type.code}
        </span>
      ),
    },
    {
      key: "nombre",
      header: "Nombre",
      render: (type) => <span className="font-semibold text-ink">{type.name}</span>,
    },
    {
      key: "moneda",
      header: "Moneda",
      render: (type) => <CurrencyCell type={type} />,
    },
    {
      key: "campos",
      header: "Campos definidos",
      render: (type) => (
        <span className="text-[13px] text-ink">{fieldsLabel(type.fields.length)}</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (type) => <TypeStatusBadge type={type} />,
    },
  ];

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/tipos-metodo-pago/nuevo"
            >
              Nuevo tipo
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta los tipos configurados, su moneda y los campos que exigirá el registro de métodos de pago."
        eyebrow="Finanzas"
        title="Tipos de métodos de pago"
      />

      <NoticeBanner tone="info">{CATALOG_NOTICE}</NoticeBanner>

      {resource.status === "loading" && (
        <div aria-busy="true" className="space-y-4" role="status">
          <span className="sr-only">Cargando tipos de métodos de pago…</span>
          <div className="rounded-[24px] border border-line bg-surface p-5">
            <div className="skeleton h-16 w-full sm:max-w-xs" />
            <div className="skeleton mt-4 h-40 w-full" />
          </div>
        </div>
      )}

      {resource.status === "error" && (
        <RecordsLoadError
          description={resource.error?.message ?? "No pudimos cargar los tipos."}
          onRetry={resource.reload}
          title="No pudimos cargar los tipos de métodos de pago"
        />
      )}

      {resource.status !== "loading" && resource.status !== "error" && (
        <section aria-label="Listado de tipos de métodos de pago" className="space-y-4">
          {resource.status === "refreshing" && <div aria-hidden="true" className="reload-bar" />}

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_minmax(160px,200px)] xl:items-end">
              <div className="relative w-full">
                <label className="sr-only" htmlFor="buscar-tipos-metodo-pago">
                  Buscar tipos de métodos de pago
                </label>
                <Icon
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                  name="search"
                  size={17}
                />
                <input
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                  id="buscar-tipos-metodo-pago"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por código o nombre"
                  type="search"
                  value={query}
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-[12px] font-semibold text-ink"
                  htmlFor="filtro-moneda-tipo"
                >
                  Moneda
                </label>
                <select
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[14px] text-ink transition-colors hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={currenciesLoading || currenciesError}
                  id="filtro-moneda-tipo"
                  onChange={(event) => {
                    setCurrencyFilter(event.target.value);
                    reloadWithFilters();
                  }}
                  value={currencyFilter}
                >
                  <option value="">
                    {currenciesLoading
                      ? "Cargando monedas…"
                      : currenciesError
                        ? "Monedas no disponibles"
                        : "Todas las monedas"}
                  </option>
                  {(currenciesResource.data ?? []).map((currency) => (
                    <option key={String(currency.id)} value={String(currency.id)}>
                      {currency.code} · {currency.symbol}
                      {currency.is_active ? "" : " · Inactiva"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-2 block text-[12px] font-semibold text-ink"
                  htmlFor="filtro-estado-tipo"
                >
                  Estado
                </label>
                <select
                  className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[14px] text-ink transition-colors hover:border-brand/45 focus:border-brand"
                  id="filtro-estado-tipo"
                  onChange={(event) => {
                    setStatusFilter(event.target.value as StatusFilter);
                    reloadWithFilters();
                  }}
                  value={statusFilter}
                >
                  <option value="">Todos</option>
                  <option value="true">Activos</option>
                  <option value="false">Inactivos</option>
                </select>
              </div>
            </div>

            {currenciesError && (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-[12px] leading-5 text-alert-ink" role="alert">
                No pudimos cargar las monedas para el filtro.
                <button
                  className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold transition-colors hover:bg-surface"
                  onClick={currenciesResource.reload}
                  type="button"
                >
                  Reintentar
                </button>
              </p>
            )}

            <p aria-live="polite" className="mt-4 text-[12px] font-semibold text-muted">
              {query.trim() || hasServerFilters
                ? `Mostrando ${formatInteger(filteredTypes.length)} de ${typesLabel(types.length)}`
                : typesLabel(types.length)}
            </p>
          </div>

          {types.length === 0 ? (
            hasServerFilters ? (
              <EmptyState
                action={
                  <button
                    className="button-base button-secondary min-h-11 px-5"
                    onClick={clearFilters}
                    type="button"
                  >
                    Limpiar filtros
                  </button>
                }
                description="No hay tipos que coincidan con los filtros."
                title="Sin resultados"
              />
            ) : (
              <EmptyState
                action={
                  canWrite ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href="/app/tipos-metodo-pago/nuevo"
                    >
                      Nuevo tipo
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description="No hay tipos configurados. Revisa la semilla del API."
                title="No hay tipos configurados"
              />
            )
          ) : filteredTypes.length === 0 ? (
            <EmptyState
              action={
                <button
                  className="button-base button-secondary min-h-11 px-5"
                  onClick={clearFilters}
                  type="button"
                >
                  Limpiar filtros
                </button>
              }
              description="No hay tipos que coincidan con los filtros."
              title="Sin resultados"
            />
          ) : (
            <RecordsTable
              caption="Tipos de métodos de pago con su código, nombre, moneda, campos definidos y estado"
              columns={columns}
              getRowKey={(type) => String(type.id)}
              getRowLabel={(type) => type.code}
              renderCard={renderCard}
              rowActions={canWrite ? renderActions : undefined}
              rows={filteredTypes}
            />
          )}
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Desactivar tipo"
        description={
          deactivateTarget ? (
            <div className="space-y-2">
              <p>
                Código:{" "}
                <span className="font-semibold text-ink">{deactivateTarget.code}</span>
              </p>
              <p>El tipo quedará inactivo y no se ofrecerá al registrar métodos de pago.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        onError={(error) => toast.error(error.message)}
        open={deactivateTarget !== null}
        title={
          deactivateTarget
            ? `¿Desactivar el tipo ${deactivateTarget.code}?`
            : "Desactivar tipo"
        }
      />

      <ConfirmDialog
        confirmLabel="Eliminar tipo"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Código: <span className="font-semibold text-ink">{deleteTarget.code}</span>
              </p>
              <p>
                Esta acción es permanente. Si el tipo tiene métodos registrados, no se
                podrá eliminar; puedes desactivarlo en su lugar.
              </p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={deleteTarget ? `¿Eliminar el tipo ${deleteTarget.code}?` : "Eliminar tipo"}
      />
    </div>
  );
}
