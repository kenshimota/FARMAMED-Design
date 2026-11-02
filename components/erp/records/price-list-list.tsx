"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
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
import {
  RecordsLoadError,
  RecordsTableSkeleton,
} from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  deletePriceList,
  fetchPriceLists,
  type PriceList,
} from "@/components/erp/records/price-lists-api";
import { formatInteger, formatPercent } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const NO_PRICE_LISTS: PriceList[] = [];

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function priceListsLabel(count: number) {
  return count === 1 ? "1 lista" : `${formatInteger(count)} listas`;
}

export function PriceListListPage() {
  const { user } = useSession();
  const canRead = canReadModule(user.role, "listas_precios");
  const canWrite = canWriteModule(user.role, "listas_precios");

  if (!canRead) {
    return <AccessState description="No tienes permiso para administrar listas." />;
  }

  return <PriceListListContent canWrite={canWrite} />;
}

function PriceListListContent({ canWrite }: { canWrite: boolean }) {
  const toast = useToast();
  const resource = useAsyncResource(fetchPriceLists, { enabled: true });
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PriceList | null>(null);

  const priceLists = resource.data ?? NO_PRICE_LISTS;

  const filteredPriceLists = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return priceLists;
    return priceLists.filter(
      (priceList) =>
        normalizeSearch(priceList.name).includes(normalized) ||
        normalizeSearch(priceList.description).includes(normalized),
    );
  }, [priceLists, query]);

  async function handleDelete() {
    if (!deleteTarget) return;
    await deletePriceList(String(deleteTarget.id));
    toast.success("Lista eliminada.");
    resource.reload();
  }

  function renderActions(priceList: PriceList) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver la lista ${priceList.name}`}
          href={`/app/listas-de-precios/${priceList.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar la lista ${priceList.name}`}
            href={`/app/listas-de-precios/${priceList.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar la lista ${priceList.name}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(priceList)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(priceList: PriceList) {
    return (
      <div>
        <Link
          className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/listas-de-precios/${priceList.id}`}
        >
          {priceList.name}
        </Link>
        <dl className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Porcentaje
            </dt>
            <dd className="text-[13px] font-semibold text-ink">
              {formatPercent(priceList.percentage)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Descripción
            </dt>
            <dd className="line-clamp-2 text-right text-[13px] text-muted">
              {priceList.description || "Sin descripción"}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const columns: RecordsTableColumn<PriceList>[] = [
    {
      key: "nombre",
      header: "Nombre",
      render: (priceList) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/listas-de-precios/${priceList.id}`}
        >
          {priceList.name}
        </Link>
      ),
    },
    {
      key: "descripcion",
      header: "Descripción",
      render: (priceList) => (
        <span className="line-clamp-2 text-muted">
          {priceList.description || "Sin descripción"}
        </span>
      ),
    },
    {
      key: "porcentaje",
      header: "Porcentaje",
      render: (priceList) => (
        <span className="whitespace-nowrap text-[13px] font-semibold text-ink">
          {formatPercent(priceList.percentage)}
        </span>
      ),
    },
  ];

  const loading = resource.status === "loading" && priceLists.length === 0;
  const initialError =
    resource.status === "error" && priceLists.length === 0;
  const refreshError =
    resource.status === "error" && priceLists.length > 0;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/listas-de-precios/nueva"
            >
              Nueva lista
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Administra los márgenes sobre el costo que se asignan a tus clientes. El porcentaje es interno; el cliente solo ve el precio final."
        eyebrow="Catálogo"
        title="Listas de precios"
      />

      {loading && (
        <RecordsTableSkeleton
          columns={4}
          label="Cargando listas de precios…"
          rows={5}
        />
      )}

      {initialError && (
        <RecordsLoadError
          description={
            resource.error?.message ?? "No pudimos cargar las listas de precios."
          }
          onRetry={resource.reload}
          title="No pudimos cargar las listas de precios"
        />
      )}

      {!loading && !initialError && (
        <section aria-label="Listado de listas de precios" className="space-y-4">
          {resource.status === "refreshing" && (
            <div aria-hidden="true" className="reload-bar" />
          )}

          {refreshError && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={resource.reload}
                  type="button"
                >
                  Reintentar
                </button>
              }
              tone="warning"
            >
              {resource.error?.message ??
                "No pudimos actualizar las listas de precios. Mostramos los datos disponibles."}
            </NoticeBanner>
          )}

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="relative w-full sm:max-w-md">
              <label className="sr-only" htmlFor="buscar-listas-de-precios">
                Buscar listas de precios
              </label>
              <Icon
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                name="search"
                size={17}
              />
              <input
                className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                id="buscar-listas-de-precios"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o descripción"
                type="search"
                value={query}
              />
            </div>

            <p aria-live="polite" className="mt-4 text-[12px] font-semibold text-muted">
              {query.trim()
                ? `Mostrando ${formatInteger(filteredPriceLists.length)} de ${priceListsLabel(priceLists.length)}`
                : priceListsLabel(priceLists.length)}
            </p>
          </div>

          {priceLists.length === 0 ? (
            <EmptyState
              action={
                canWrite ? (
                  <Link
                    className="button-base button-primary min-h-11 px-5"
                    href="/app/listas-de-precios/nueva"
                  >
                    Nueva lista
                    <Icon name="arrow-right" size={17} />
                  </Link>
                ) : undefined
              }
              description="Crea la primera lista para asignarla a tus clientes."
              title="Aún no hay listas de precios."
            />
          ) : filteredPriceLists.length === 0 ? (
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
              description="No hay listas que coincidan con la búsqueda."
              title="Sin resultados"
            />
          ) : (
            <RecordsTable
              caption="Listas de precios con su nombre, descripción, porcentaje y acciones"
              columns={columns}
              getRowKey={(priceList) => String(priceList.id)}
              getRowLabel={(priceList) => priceList.name}
              renderCard={renderCard}
              rowActions={canWrite ? renderActions : undefined}
              rows={filteredPriceLists}
            />
          )}
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar lista"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Lista:{" "}
                <span className="font-semibold text-ink">{deleteTarget.name}</span>
              </p>
              <p>
                Esta acción es permanente. Si la lista está asignada a clientes,
                no se podrá eliminar.
              </p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={
          deleteTarget
            ? `¿Eliminar la lista ${deleteTarget.name}?`
            : "Eliminar lista"
        }
      />
    </div>
  );
}
