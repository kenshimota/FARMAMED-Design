"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
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
  deleteWarehouse,
  fetchWarehouses,
  type WarehouseRecord,
} from "@/components/erp/records/warehouses-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

const NO_WAREHOUSES: WarehouseRecord[] = [];
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_HELP_ID = "bodegas-busqueda-ayuda";
const DELETE_CONFLICT_COPY =
  "No puedes eliminar esta bodega porque tiene estantes asociados.";

type WarehouseSearchResult = {
  search: string;
  warehouses: WarehouseRecord[];
};

function warehouseCountLabel(count: number) {
  return count === 1 ? "1 bodega" : `${formatInteger(count)} bodegas`;
}

function searchCountLabel(count: number) {
  return count === 1 ? "1 resultado" : `${formatInteger(count)} resultados`;
}

export function WarehouseListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canRead = canReadModule(user.role, "bodegas");
  const canWrite = canWriteModule(user.role, "bodegas");
  const canSeeShelves = canReadModule(user.role, "estantes");

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WarehouseRecord | null>(null);
  const [deleteConflict, setDeleteConflict] = useState<WarehouseRecord | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const initial = (params.get("search") ?? "").trim();
      if (initial) {
        setQuery(initial);
        setSearch(initial);
      }
      setUrlReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams(window.location.search);
    if (search) params.set("search", search);
    else params.delete("search");
    const queryString = params.toString();
    const nextUrl = queryString
      ? `${window.location.pathname}?${queryString}`
      : window.location.pathname;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [search, urlReady]);

  const loader = useCallback(async (): Promise<WarehouseSearchResult> => {
    return { search, warehouses: await fetchWarehouses(search) };
  }, [search]);
  const resource = useAsyncResource(loader, { enabled: canRead });
  const { reload } = resource;
  const previousSearch = useRef(search);

  useEffect(() => {
    if (previousSearch.current === search) return;
    previousSearch.current = search;
    reload();
  }, [reload, search]);

  const currentResult =
    resource.data && resource.data.search === search ? resource.data : null;
  const warehouses = currentResult?.warehouses ?? NO_WAREHOUSES;
  const searchActive = search.length > 0;
  const searchPending = query.trim() !== search;
  const waitingForSearch = searchPending;
  const initialError = currentResult === null && resource.status === "error";
  const loading = currentResult === null && !initialError;
  const countLabel = searchActive
    ? searchCountLabel(warehouses.length)
    : warehouseCountLabel(warehouses.length);

  function clearSearch() {
    setQuery("");
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  const columns: RecordsTableColumn<WarehouseRecord>[] = [
    {
      key: "nombre",
      header: "Nombre",
      render: (warehouse) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/bodegas/${warehouse.id}`}
        >
          {warehouse.name}
        </Link>
      ),
    },
    {
      key: "direccion",
      header: "Dirección",
      className: "max-w-[260px]",
      render: (warehouse) => (
        <span className="block truncate text-muted" title={warehouse.address}>
          {warehouse.address}
        </span>
      ),
    },
    {
      key: "observaciones",
      header: "Observaciones",
      className: "max-w-[280px]",
      render: (warehouse) => (
        <span
          className="block truncate text-muted"
          title={warehouse.observations || undefined}
        >
          {warehouse.observations || "Sin observaciones"}
        </span>
      ),
    },
  ];

  function renderActions(warehouse: WarehouseRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver la bodega ${warehouse.name}`}
          href={`/app/bodegas/${warehouse.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canSeeShelves && (
          <RecordActionLink
            ariaLabel={`Ver los estantes de la bodega ${warehouse.name}`}
            href={`/app/bodegas/${warehouse.id}/estantes`}
            icon="layers"
          >
            Estantes
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar la bodega ${warehouse.name}`}
            href={`/app/bodegas/${warehouse.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar la bodega ${warehouse.name}`}
            danger
            icon="close"
            onClick={() => {
              setDeleteConflict(null);
              setDeleteTarget(warehouse);
            }}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(warehouse: WarehouseRecord) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            href={`/app/bodegas/${warehouse.id}`}
          >
            {warehouse.name}
          </Link>
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            #{warehouse.id}
          </span>
        </div>
        <div className="mt-3 space-y-1 text-[12px] leading-5 text-muted">
          <p>
            <span className="font-semibold text-ink">Dirección:</span>{" "}
            {warehouse.address}
          </p>
          <p>
            <span className="font-semibold text-ink">Observaciones:</span>{" "}
            {warehouse.observations || "Sin observaciones"}
          </p>
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de bodegas. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/bodegas/nueva"
            >
              Nueva bodega
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Bodegas que organizan la ubicación física del inventario. Cada bodega da acceso a sus estantes y secciones."
        eyebrow="Operación"
        title="Bodegas"
      />

      {deleteConflict && (
        <NoticeBanner
          action={
            <div className="flex flex-wrap items-center gap-2">
              {canSeeShelves && (
                <Link
                  className="button-base button-secondary min-h-11 px-4 text-[12px]"
                  href={`/app/bodegas/${deleteConflict.id}/estantes`}
                >
                  Ver estantes
                  <Icon name="layers" size={15} />
                </Link>
              )}
              <button
                className="min-h-11 rounded-full border border-olive/35 px-4 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                onClick={() => setDeleteConflict(null)}
                type="button"
              >
                Cerrar aviso
              </button>
            </div>
          }
          tone="warning"
        >
          <p>{DELETE_CONFLICT_COPY}</p>
        </NoticeBanner>
      )}

      {loading && (
        <RecordsTableSkeleton
          columns={4}
          label="Cargando bodegas…"
          rows={6}
        />
      )}

      {initialError && (
        <RecordsLoadError
          description={
            resource.error?.message ?? "No pudimos cargar el listado de bodegas."
          }
          onRetry={reload}
          title="No pudimos cargar las bodegas"
        />
      )}

      {!loading && !initialError && (
        <section aria-label="Listado de bodegas" className="space-y-4">
          {resource.status === "refreshing" && (
            <div aria-hidden="true" className="reload-bar" />
          )}
          {resource.status === "error" && warehouses.length > 0 && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={reload}
                  type="button"
                >
                  Reintentar
                </button>
              }
              tone="warning"
            >
              {resource.error?.message ??
                "No pudimos actualizar las bodegas. Mostramos los datos disponibles."}
            </NoticeBanner>
          )}

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <label
              className="mb-2 block text-[12px] font-semibold text-ink"
              htmlFor="buscar-bodegas"
            >
              Buscar bodega
            </label>
            <div className="relative">
              <Icon
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                name="search"
                size={17}
              />
              <input
                aria-describedby={SEARCH_HELP_ID}
                className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-11 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                id="buscar-bodegas"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, dirección u observaciones"
                ref={searchInputRef}
                type="search"
                value={query}
              />
              {query && (
                <button
                  aria-label="Limpiar búsqueda"
                  className="absolute right-0.5 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-background hover:text-ink"
                  onClick={clearSearch}
                  type="button"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <p aria-live="polite" className="text-[12px] font-semibold text-muted">
                {waitingForSearch ? "Buscando bodegas…" : countLabel}
              </p>
              <p className="text-[12px] text-muted" id={SEARCH_HELP_ID}>
                La búsqueda revisa nombre, dirección y observaciones.
              </p>
            </div>
          </div>

          {warehouses.length === 0 ? (
            waitingForSearch ? (
              <RecordsTableSkeleton
                columns={4}
                label="Buscando bodegas…"
                rows={4}
              />
            ) : searchActive ? (
              <EmptyState
                action={
                  <button
                    className="button-base button-secondary min-h-11 px-5"
                    onClick={clearSearch}
                    type="button"
                  >
                    Limpiar búsqueda
                  </button>
                }
                description="Ajusta la búsqueda por nombre, dirección u observaciones."
                title="No encontramos bodegas con ese criterio."
              />
            ) : (
              <EmptyState
                action={
                  canWrite ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href="/app/bodegas/nueva"
                    >
                      Nueva bodega
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description={
                  canWrite
                    ? "Crea la primera para organizar el inventario."
                    : "Aún no hay bodegas registradas para consultar."
                }
                title="Todavía no hay bodegas."
              />
            )
          ) : (
            <RecordsTable
              caption="Bodegas con su dirección, observaciones y acciones"
              columns={columns}
              getRowKey={(warehouse) => String(warehouse.id)}
              getRowLabel={(warehouse) => warehouse.name}
              renderCard={renderCard}
              rowActions={renderActions}
              rows={warehouses}
            />
          )}
        </section>
      )}

      <ConfirmDialog
        confirmBusyLabel="Eliminando…"
        confirmLabel="Eliminar bodega"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>Se eliminarán también sus estantes y secciones si no tienen lotes.</p>
              <p>Esta acción no se puede deshacer.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteWarehouse(deleteTarget.id);
          setDeleteConflict(null);
          toast.success("Bodega eliminada.");
          reload();
        }}
        onError={(error) => {
          if (error.kind === "conflict") {
            if (deleteTarget) setDeleteConflict(deleteTarget);
            return;
          }
          toast.error(error.message);
        }}
        open={deleteTarget !== null}
        title={
          deleteTarget
            ? `¿Eliminar la bodega ${deleteTarget.name}?`
            : "Eliminar bodega"
        }
      />
    </div>
  );
}
