"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { FilterBar } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { Tabs, getTabId, getTabPanelId } from "@/components/erp/ui/tabs";
import { useToast } from "@/components/erp/ui/toast";
import { useServerList } from "@/components/erp/ui/use-server-list";
import { CustomerMap } from "@/components/erp/records/customer-map";
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
  type RecordsRowAttributes,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  deleteCustomer,
  fetchCustomerPage,
  hasCoordinates,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatCoordinate, formatInteger } from "@/lib/format";

const TABS_ID = "clientes-vista";
const DESKTOP_QUERY = "(min-width: 1024px)";

function subscribeToDesktop(callback: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function readIsDesktop() {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function readServerIsDesktop() {
  return false;
}

function customerCountLabel(count: number) {
  return count === 1 ? "1 cliente" : `${formatInteger(count)} clientes`;
}

function coordinatesLabel(customer: CustomerRecord) {
  if (!hasCoordinates(customer)) return "Sin ubicación registrada";
  return `Lat. ${formatCoordinate(customer.latitude)} · Lon. ${formatCoordinate(
    customer.longitude,
  )}`;
}

type CenterRequest = {
  latitude: number;
  longitude: number;
};

export function CustomerListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canRead = canReadModule(user.role, "clientes");
  const canWrite = canWriteModule(user.role, "clientes");
  const list = useServerList<CustomerRecord>({
    loader: (request) => fetchCustomerPage(request),
    enabled: canRead,
  });
  const [activeTab, setActiveTab] = useState("listado");
  const [mapCollapsed, setMapCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [centerRequest, setCenterRequest] = useState<CenterRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null);
  const [mapFocusToken, setMapFocusToken] = useState(0);
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    readIsDesktop,
    readServerIsDesktop,
  );

  const customers = list.items;
  const locatedCount = customers.filter(hasCoordinates).length;
  const totalLocatedCount = locatedCount;
  const filtersActive = Boolean(list.request.q);
  const countLabel = customerCountLabel(list.meta.total);

  const selectedCustomer =
    customers.find((customer) => String(customer.id) === selectedId) ?? null;
  const effectiveSelectedId = selectedCustomer
    ? String(selectedCustomer.id)
    : null;

  const listTabId = getTabId(TABS_ID, "listado");
  const mapTabId = getTabId(TABS_ID, "mapa");
  const listPanelId = getTabPanelId(TABS_ID, "listado");
  const mapPanelId = getTabPanelId(TABS_ID, "mapa");

  function selectCustomer(customer: CustomerRecord) {
    setSelectedId(String(customer.id));
  }

  function centerOnCustomer(customer: CustomerRecord) {
    if (!hasCoordinates(customer)) return;
    setSelectedId(String(customer.id));
    setMapCollapsed(false);
    setActiveTab("mapa");
    setCenterRequest({
      latitude: customer.latitude,
      longitude: customer.longitude,
    });
    setMapFocusToken((current) => current + 1);
  }

  useEffect(() => {
    if (mapFocusToken === 0) return;
    mapPanelRef.current?.focus();
  }, [mapFocusToken]);

  function rowAttributes(customer: CustomerRecord): RecordsRowAttributes {
    const selected = String(customer.id) === effectiveSelectedId;
    return {
      ariaCurrent: selected,
      className: selected
        ? "bg-soft-blue outline outline-2 -outline-offset-2 outline-brand"
        : undefined,
    };
  }

  function renderActions(customer: CustomerRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver ${customer.fullName}`}
          href={`/app/clientes/${customer.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar ${customer.fullName}`}
            href={`/app/clientes/${customer.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {hasCoordinates(customer) && (
          <RecordActionButton
            aria-label={`Centrar ${customer.fullName} en el mapa`}
            icon="map-pin"
            onClick={() => centerOnCustomer(customer)}
          >
            Centrar
          </RecordActionButton>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar ${customer.fullName}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(customer)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(customer: CustomerRecord) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            href={`/app/clientes/${customer.id}`}
          >
            {customer.fullName}
          </Link>
          {String(customer.id) === effectiveSelectedId && (
            <span className="rounded-full bg-soft-lime px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
              Seleccionado
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1 text-[12px] leading-5 text-muted">
          <p className="break-all">
            <span className="font-semibold text-ink">Correo:</span>{" "}
            {customer.email || "No registrado"}
          </p>
          <p>
            <span className="font-semibold text-ink">Dirección:</span>{" "}
            {customer.direction || "No registrada"}
          </p>
          <p>
            <span className="font-semibold text-ink">Ubicación:</span>{" "}
            {hasCoordinates(customer) ? (
              <span className="font-mono">{coordinatesLabel(customer)}</span>
            ) : (
              "Sin ubicación registrada"
            )}
          </p>
        </div>
      </div>
    );
  }

  if (!canRead) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de clientes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  const loading = list.status === "loading" && customers.length === 0;
  const initialError = list.status === "error" && customers.length === 0;
  const locatedSummary = `${formatInteger(locatedCount)} de ${formatInteger(
    customers.length,
  )} con ubicación en esta página`;

  const columns: RecordsTableColumn<CustomerRecord>[] = [
    {
      key: "nombre",
      header: "Nombre",
      render: (customer) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/clientes/${customer.id}`}
        >
          {customer.fullName}
        </Link>
      ),
    },
    {
      key: "correo",
      header: "Correo",
      className: "max-w-[220px]",
      render: (customer) => (
        <span className="block truncate text-muted" title={customer.email}>
          {customer.email || "No registrado"}
        </span>
      ),
    },
    {
      key: "direccion",
      header: "Dirección",
      className: "max-w-[240px]",
      render: (customer) => (
        <span className="block truncate text-muted" title={customer.direction}>
          {customer.direction || "No registrada"}
        </span>
      ),
    },
    {
      key: "coordenadas",
      header: "Coordenadas",
      render: (customer) =>
        hasCoordinates(customer) ? (
          <span className="whitespace-nowrap font-mono text-[12px] text-ink">
            {coordinatesLabel(customer)}
          </span>
        ) : (
          <span className="inline-flex rounded-lg bg-soft-lime px-2 py-1 text-[11px] font-semibold text-ink">
            Sin ubicación registrada
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/clientes/nuevo"
            >
              Nuevo cliente
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Directorio de clientes con su contacto y ubicación. La tabla es la fuente principal; el mapa es complementario."
        eyebrow="Operación"
        title="Clientes"
      />

      <FilterBar
        activeCount={Number(filtersActive)}
        chips={
          filtersActive
            ? [
                {
                  id: "q",
                  label: `Búsqueda: ${list.request.q}`,
                  onRemove: () => {
                    list.setSearch("");
                    list.commitSearch();
                  },
                },
              ]
            : []
        }
        extra={
          <div className="mt-4 flex justify-end border-t border-line pt-3">
            <button
              aria-controls={mapPanelId}
              aria-expanded={!mapCollapsed}
              className="hidden min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-surface px-4 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand lg:inline-flex"
              onClick={() => setMapCollapsed((current) => !current)}
              type="button"
            >
              <Icon name="map-pin" size={16} />
              {mapCollapsed ? "Mostrar mapa" : "Ocultar mapa"}
            </button>
          </div>
        }
        id="clientes-filtros"
        loading={loading}
        onClear={list.clearFilters}
        results={
          loading
            ? "Cargando clientes…"
            : initialError
              ? "No pudimos cargar los clientes"
              : `${countLabel} · ${locatedSummary}`
        }
        search={
          <AutocompleteField
            help="La búsqueda se aplica en el servidor sobre nombre, correo y dirección."
            id="buscar-clientes"
            label="Buscar por nombre, correo o dirección"
            loadOptions={async (query) => {
              const page = await fetchCustomerPage({ q: query, pageSize: 10 });
              return page.data.map((customer) => ({
                value: String(customer.id),
                label: customer.fullName,
                description: customer.email || customer.direction || undefined,
              }));
            }}
            onSelect={(option) => {
              list.setSearch(option.label);
              list.commitSearch();
            }}
            onValueChange={list.setSearch}
            placeholder="Buscar por nombre, correo o dirección"
            value={list.searchDraft}
          />
        }
      />

      {loading && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <RecordsTableSkeleton
            columns={5}
            label="Cargando clientes…"
            rows={6}
          />
          <div
            aria-busy="true"
            className="flex min-h-72 items-center justify-center rounded-[24px] border border-line bg-surface p-5 text-[13px] font-semibold text-muted"
            role="status"
          >
            <span className="inline-flex items-center gap-2">
              <Icon name="map-pin" size={17} />
              Cargando mapa…
            </span>
          </div>
        </div>
      )}

      {initialError && (
        <RecordsLoadError
          description={
            list.error?.message ?? "No pudimos cargar el listado de clientes."
          }
          onRetry={list.reload}
          title="No pudimos cargar los clientes"
        />
      )}

      {!loading && !initialError && (
        <section className="space-y-4">
          {list.status === "refreshing" && (
            <div aria-hidden="true" className="reload-bar" />
          )}
          {list.status === "error" && customers.length > 0 && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={list.reload}
                  type="button"
                >
                  Reintentar
                </button>
              }
              tone="warning"
            >
              {list.error?.message ??
                "No pudimos actualizar los clientes. Mostramos los datos disponibles."}
            </NoticeBanner>
          )}

          <div
            className={`grid gap-5 ${
              mapCollapsed
                ? "lg:grid-cols-1"
                : "lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
            }`}
          >
            <div className="min-w-0">
              <div className="lg:hidden">
                <Tabs
                  idPrefix={TABS_ID}
                  label="Vistas de clientes"
                  onChange={setActiveTab}
                  tabs={[
                    {
                      id: "listado",
                      label: "Listado",
                      count: list.meta.total,
                    },
                    { id: "mapa", label: "Mapa", count: locatedCount },
                  ]}
                  value={activeTab}
                />
              </div>

              <div
                aria-label={isDesktop ? "Listado de clientes" : undefined}
                aria-labelledby={isDesktop ? undefined : listTabId}
                className={`mt-4 lg:mt-0 ${
                  activeTab === "listado" ? "block" : "hidden"
                } lg:block`}
                id={listPanelId}
                role={isDesktop ? "region" : "tabpanel"}
              >
                {customers.length === 0 ? (
                  list.meta.total === 0 && !filtersActive ? (
                    <EmptyState
                      action={
                        canWrite ? (
                          <Link
                            className="button-base button-primary min-h-11 px-5"
                            href="/app/clientes/nuevo"
                          >
                            Nuevo cliente
                            <Icon name="arrow-right" size={17} />
                          </Link>
                        ) : undefined
                      }
                      description="Registra el primero para asignarle un vendedor."
                      title="Todavía no hay clientes."
                    />
                  ) : (
                    <EmptyState
                      action={
                        <button
                          className="button-base button-secondary min-h-11 px-5"
                          onClick={
                            list.isPageOutOfRange
                              ? list.goToFirstPage
                              : list.clearFilters
                          }
                          type="button"
                        >
                          {list.isPageOutOfRange
                            ? "Ir a la primera página"
                            : "Limpiar filtros"}
                        </button>
                      }
                      description={
                        list.isPageOutOfRange
                          ? `Hay ${formatInteger(
                              list.meta.total,
                            )} clientes en total, pero esta página no tiene filas.`
                          : "Ajusta la búsqueda para encontrar al cliente."
                      }
                      title={
                        list.isPageOutOfRange
                          ? "No hay resultados en esta página"
                          : "Sin resultados con estos filtros."
                      }
                    />
                  )
                ) : (
                  <>
                    <RecordsTable
                      busy={list.status === "refreshing"}
                      caption="Clientes con su correo, dirección, coordenadas y acciones"
                      columns={columns}
                      getRowAttributes={rowAttributes}
                      getRowKey={(customer) => String(customer.id)}
                      getRowLabel={(customer) => customer.fullName}
                      renderCard={renderCard}
                      rowActions={renderActions}
                      rows={customers}
                    />
                    <div className="mt-4">
                      <PaginationControls
                        meta={list.meta}
                        onFirstPage={list.goToFirstPage}
                        onPageChange={list.setPage}
                        onPageSizeChange={list.setPageSize}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div
              aria-labelledby={isDesktop ? "mapa-clientes-titulo" : mapTabId}
              className={`${
                activeTab === "mapa" ? "block" : "hidden"
              } ${mapCollapsed ? "lg:hidden" : "lg:block"}`}
              id={mapPanelId}
              ref={mapPanelRef}
              role={isDesktop ? "region" : "tabpanel"}
              tabIndex={-1}
            >
              <div className="rounded-[24px] border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    className="text-[13px] font-semibold text-ink"
                    id="mapa-clientes-titulo"
                  >
                    Mapa de clientes
                  </h2>
                  <span className="rounded-full bg-soft-blue px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
                    OpenStreetMap
                  </span>
                </div>
                <p aria-live="polite" className="sr-only">
                  {selectedCustomer
                    ? `Cliente seleccionado: ${selectedCustomer.fullName}. Fila resaltada en la tabla.`
                    : ""}
                </p>
                <div className="mt-3 h-[340px] sm:h-[420px] lg:h-[520px]">
                  <CustomerMap
                    centerRequest={centerRequest}
                    customers={customers}
                    onSelect={selectCustomer}
                    selectedId={effectiveSelectedId}
                    totalLocatedCount={totalLocatedCount}
                  />
                </div>
                <p className="mt-3 text-[12px] leading-5 text-muted">
                  El mapa muestra los clientes de esta página. Los clientes sin
                  coordenadas aparecen solo en la tabla con «Sin ubicación
                  registrada».
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar cliente"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Correo:{" "}
                <span className="font-semibold text-ink">
                  {deleteTarget.email || "No registrado"}
                </span>
              </p>
              <p>No se puede deshacer.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteCustomer(deleteTarget.id);
          toast.success("Cliente eliminado.");
          if (String(deleteTarget.id) === selectedId) setSelectedId(null);
          list.reload();
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={
          deleteTarget
            ? `¿Eliminar el cliente ${deleteTarget.fullName}?`
            : "Eliminar cliente"
        }
      />
    </div>
  );
}
