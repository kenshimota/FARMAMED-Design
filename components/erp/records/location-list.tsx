"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { Tabs, getTabId, getTabPanelId } from "@/components/erp/ui/tabs";
import { useToast } from "@/components/erp/ui/toast";
import {
  useAsyncResource,
  type AsyncResourceStatus,
} from "@/components/erp/ui/use-async-resource";
import { CityFormDialog } from "@/components/erp/records/city-form-dialog";
import { CityResults } from "@/components/erp/records/city-results";
import { SelectField } from "@/components/erp/records/form-controls";
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
import { RecordsTable, type RecordsTableColumn } from "@/components/erp/records/records-table";
import { StateFormDialog } from "@/components/erp/records/state-form-dialog";
import {
  deleteCity,
  deleteState,
  fetchCities,
  fetchStates,
  type CityRecord,
  type StateRecord,
} from "@/components/erp/records/locations-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";
import type { UiError } from "@/lib/api-errors";

const TABS_ID = "ubicaciones";
const EMPTY_STATES: StateRecord[] = [];
const EMPTY_CITIES: CityRecord[] = [];

type DeleteTarget =
  | { kind: "state"; record: StateRecord }
  | { kind: "city"; record: CityRecord };

type FormTarget<T> = { record: T | null } | null;

type CitiesViewProps = {
  cities: CityRecord[];
  states: StateRecord[];
  status: AsyncResourceStatus;
  error: UiError | null;
  onRetry: () => void;
  query: string;
  stateFilterActive: boolean;
  canWrite: boolean;
  onEdit: (city: CityRecord) => void;
  onDelete: (city: CityRecord) => void;
};

function CitiesView({
  cities,
  states,
  status,
  error,
  onRetry,
  query,
  stateFilterActive,
  canWrite,
  onEdit,
  onDelete,
}: CitiesViewProps) {
  if (status === "loading" && cities.length === 0) {
    return <RecordsTableSkeleton columns={3} label="Cargando ciudades…" />;
  }

  if (status === "error" && cities.length === 0) {
    return (
      <RecordsLoadError
        backHref={null}
        description={error?.message ?? "No pudimos cargar las ciudades."}
        headingLevel="h2"
        onRetry={onRetry}
        title="No pudimos cargar las ciudades"
      />
    );
  }

  return (
    <div className="space-y-3">
      {status === "refreshing" && <div aria-hidden="true" className="reload-bar" />}
      {status === "error" && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={onRetry}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          {error?.message ?? "No pudimos actualizar las ciudades. Mostramos los datos disponibles."}
        </NoticeBanner>
      )}
      <CityResults
        canWrite={canWrite}
        cities={cities}
        onDelete={onDelete}
        onEdit={onEdit}
        query={query}
        stateFilterActive={stateFilterActive}
        states={states}
      />
    </div>
  );
}

function FilteredCities({
  stateId,
  states,
  query,
  canWrite,
  onEdit,
  onDelete,
}: {
  stateId: string;
  states: StateRecord[];
  query: string;
  canWrite: boolean;
  onEdit: (city: CityRecord) => void;
  onDelete: (city: CityRecord) => void;
}) {
  const loader = useCallback(() => fetchCities(stateId), [stateId]);
  const resource = useAsyncResource(loader);
  const stateName =
    states.find((state) => String(state.id) === stateId)?.name ?? `Estado #${stateId}`;
  const allCities = resource.data ?? EMPTY_CITIES;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCities = normalizedQuery
    ? allCities.filter((city) => city.name.toLowerCase().includes(normalizedQuery))
    : allCities;
  const totalLabel = `${formatInteger(allCities.length)} ${
    allCities.length === 1 ? "ciudad" : "ciudades"
  }`;
  const countLabel =
    resource.status === "loading" || resource.status === "idle"
      ? `Cargando ciudades de ${stateName}…`
      : resource.status === "error" && resource.data === null
        ? `No disponible para ${stateName}`
        : normalizedQuery
          ? `Mostrando ${formatInteger(visibleCities.length)} de ${totalLabel} de ${stateName}`
          : `${totalLabel} de ${stateName}`;

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="text-[12px] font-semibold text-muted">
        {countLabel}
      </p>
      <CitiesView
        canWrite={canWrite}
        cities={allCities}
        error={resource.error}
        onDelete={onDelete}
        onEdit={onEdit}
        onRetry={resource.reload}
        query={query}
        stateFilterActive
        states={states}
        status={resource.status}
      />
    </div>
  );
}

export function LocationListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const statesResource = useAsyncResource(fetchStates);
  const citiesResource = useAsyncResource(fetchCities);

  const [activeTab, setActiveTab] = useState("estados");
  const [stateFilter, setStateFilter] = useState("");
  const [cityQuery, setCityQuery] = useState("");
  const [citiesVersion, setCitiesVersion] = useState(0);
  const [stateForm, setStateForm] = useState<FormTarget<StateRecord>>(null);
  const [cityForm, setCityForm] = useState<FormTarget<CityRecord>>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const states = statesResource.data ?? EMPTY_STATES;
  const cities = citiesResource.data ?? EMPTY_CITIES;
  const statesError =
    statesResource.status === "error" && states.length === 0
      ? statesResource.error?.message ?? "No pudimos cargar los estados."
      : null;
  const citiesStateCount = new Map<string, number>();
  for (const city of cities) {
    const key = String(city.state_id);
    citiesStateCount.set(key, (citiesStateCount.get(key) ?? 0) + 1);
  }

  function reloadCities() {
    setCitiesVersion((current) => current + 1);
    citiesResource.reload();
  }

  function reloadStatesAndCities() {
    statesResource.reload();
    reloadCities();
  }

  function citiesCountFor(state: StateRecord) {
    if (citiesResource.status === "error" && citiesResource.data === null) return "No disponible";
    if (citiesResource.data === null) return "—";
    return formatInteger(citiesStateCount.get(String(state.id)) ?? 0);
  }

  const stateColumns: RecordsTableColumn<StateRecord>[] = [
    {
      key: "codigo",
      header: "Código",
      render: (state) => (
        <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
          {state.code}
        </span>
      ),
    },
    {
      key: "nombre",
      header: "Estado",
      render: (state) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/ubicaciones/estados/${state.id}`}
        >
          {state.name}
        </Link>
      ),
    },
    {
      key: "ciudades",
      header: "Ciudades",
      render: (state) => <span className="text-muted">{citiesCountFor(state)}</span>,
    },
  ];

  function renderStateActions(state: StateRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver las ciudades de ${state.name}`}
          href={`/app/ubicaciones/estados/${state.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canWrite && (
          <RecordActionButton
            aria-label={`Editar ${state.name}`}
            icon="arrow-right"
            onClick={() => setStateForm({ record: state })}
          >
            Editar
          </RecordActionButton>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar ${state.name}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget({ kind: "state", record: state })}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderStateCard(state: StateRecord) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            href={`/app/ubicaciones/estados/${state.id}`}
          >
            {state.name}
          </Link>
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {state.code}
          </span>
        </div>
        <p className="mt-2 text-[12px] text-muted">
          Ciudades: <span className="text-ink">{citiesCountFor(state)}</span>
        </p>
      </div>
    );
  }

  const statesTabId = getTabId(TABS_ID, "estados");
  const citiesTabId = getTabId(TABS_ID, "ciudades");
  const statesPanelId = getTabPanelId(TABS_ID, "estados");
  const citiesPanelId = getTabPanelId(TABS_ID, "ciudades");
  const activeIsStates = activeTab === "estados";

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <button
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              onClick={() =>
                activeIsStates
                  ? setStateForm({ record: null })
                  : setCityForm({ record: null })
              }
              type="button"
            >
              {activeIsStates ? "Nuevo estado" : "Nueva ciudad"}
              <Icon name="arrow-right" size={17} />
            </button>
          ) : undefined
        }
        description="Consulta y administra los estados y las ciudades de Venezuela usados por proveedores y direcciones."
        eyebrow="Catálogo"
        title="Ubicaciones"
      />

      <NoticeBanner tone="info">
        Los estados geográficos no son los estados de ítem del inventario.{" "}
        <Link
          className="font-semibold text-brand underline underline-offset-4 hover:text-ink"
          href="/app/estados-item"
        >
          Ir a estados de ítem
        </Link>
      </NoticeBanner>

      <Tabs
        idPrefix={TABS_ID}
        label="Secciones de ubicaciones"
        onChange={setActiveTab}
        tabs={[
          {
            id: "estados",
            label: "Estados",
            count: statesResource.data ? states.length : undefined,
          },
          {
            id: "ciudades",
            label: "Ciudades",
            count: citiesResource.data ? cities.length : undefined,
          },
        ]}
        value={activeTab}
      />

      <section
        aria-labelledby={statesTabId}
        className="space-y-4"
        hidden={!activeIsStates}
        id={statesPanelId}
        role="tabpanel"
        tabIndex={0}
      >
        <h2 className="sr-only">Estados geográficos</h2>
        {(statesResource.status === "loading" || statesResource.status === "idle") &&
          states.length === 0 && (
            <RecordsTableSkeleton columns={4} label="Cargando estados…" />
          )}

          {statesResource.status === "error" && states.length === 0 && (
            <RecordsLoadError
              backHref={null}
              description={statesResource.error?.message ?? "No pudimos cargar los estados."}
              headingLevel="h2"
              onRetry={statesResource.reload}
              title="No pudimos cargar los estados"
            />
          )}

          {states.length > 0 && (
            <div className="space-y-3">
              {statesResource.status === "refreshing" && (
                <div aria-hidden="true" className="reload-bar" />
              )}
              {statesResource.status === "error" && (
                <NoticeBanner
                  action={
                    <button
                      className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                      onClick={statesResource.reload}
                      type="button"
                    >
                      Reintentar
                    </button>
                  }
                  tone="warning"
                >
                  {statesResource.error?.message ??
                    "No pudimos actualizar los estados. Mostramos los datos disponibles."}
                </NoticeBanner>
              )}
              <RecordsTable
                caption="Estados geográficos de Venezuela con su código y número de ciudades"
                columns={stateColumns}
                getRowKey={(state) => String(state.id)}
                getRowLabel={(state) => state.name}
                renderCard={renderStateCard}
                rowActions={renderStateActions}
                rows={states}
              />
            </div>
          )}

          {statesResource.status !== "loading" &&
            statesResource.status !== "idle" &&
            statesResource.status !== "error" &&
            states.length === 0 && (
              <EmptyState
                action={
                  canWrite ? (
                    <button
                      className="button-base button-primary min-h-11 px-5"
                      onClick={() => setStateForm({ record: null })}
                      type="button"
                    >
                      Nuevo estado
                      <Icon name="arrow-right" size={17} />
                    </button>
                  ) : undefined
                }
                description="No hay estados configurados. Revisa la semilla del API."
                title="Sin estados"
              />
            )}
      </section>

      <section
        aria-labelledby={citiesTabId}
        className="space-y-4"
        hidden={activeTab !== "ciudades"}
        id={citiesPanelId}
        role="tabpanel"
        tabIndex={0}
      >
        <h2 className="sr-only">Ciudades geográficas</h2>
        <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] sm:items-end">
              <div>
                <label
                  className="mb-2 block text-[12px] font-semibold text-ink"
                  htmlFor="buscar-ciudad"
                >
                  Buscar ciudad
                </label>
                <div className="relative">
                  <Icon
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    name="search"
                    size={17}
                  />
                  <input
                    className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                    id="buscar-ciudad"
                    onChange={(event) => setCityQuery(event.target.value)}
                    placeholder="Nombre de la ciudad"
                    type="search"
                    value={cityQuery}
                  />
                </div>
              </div>

              <SelectField
                emptyLabel="No hay estados configurados."
                help="Filtra las ciudades por su estado geográfico."
                id="filtro-estado-ciudades"
                label="Estado"
                loadError={statesError}
                loading={statesResource.status === "loading" && states.length === 0}
                loadingLabel="Cargando estados…"
                onChange={setStateFilter}
                onRetry={statesResource.reload}
                options={states.map((state) => ({
                  value: String(state.id),
                  label: `${state.name} · ${state.code}`,
                }))}
                placeholder="Todos los estados"
                value={stateFilter}
              />
            </div>

            {(stateFilter || cityQuery) && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p aria-live="polite" className="text-[12px] font-semibold text-muted">
                  {stateFilter ? "Filtro por estado activo." : "Búsqueda local activa."}
                </p>
                <button
                  className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  onClick={() => {
                    setStateFilter("");
                    setCityQuery("");
                  }}
                  type="button"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

          </div>

          {stateFilter ? (
            <FilteredCities
              canWrite={canWrite}
              key={`${stateFilter}-${citiesVersion}`}
              onDelete={(city) => setDeleteTarget({ kind: "city", record: city })}
              onEdit={(city) => setCityForm({ record: city })}
              query={cityQuery}
              stateId={stateFilter}
              states={states}
            />
          ) : (
            <CitiesView
              canWrite={canWrite}
              cities={cities}
              error={citiesResource.error}
              onDelete={(city) => setDeleteTarget({ kind: "city", record: city })}
              onEdit={(city) => setCityForm({ record: city })}
              onRetry={citiesResource.reload}
              query={cityQuery}
              stateFilterActive={false}
              states={states}
              status={citiesResource.status}
            />
          )}
      </section>

      <StateFormDialog
        onClose={() => setStateForm(null)}
        onSaved={reloadStatesAndCities}
        open={stateForm !== null}
        stateRecord={stateForm?.record}
      />

      {cityForm !== null && (
        <CityFormDialog
          cityRecord={cityForm.record}
          onClose={() => setCityForm(null)}
          onSaved={reloadCities}
          open
          onRetryStates={statesResource.reload}
          states={states}
          statesError={statesError}
          statesLoading={statesResource.status === "loading" && states.length === 0}
        />
      )}

      <ConfirmDialog
        confirmLabel={deleteTarget?.kind === "state" ? "Eliminar estado" : "Eliminar ciudad"}
        description={
          deleteTarget?.kind === "state" ? (
            <div className="space-y-2">
              <p>
                Código:{" "}
                <span className="font-semibold text-ink">{deleteTarget.record.code}</span>
              </p>
              <p>
                Si el estado tiene ciudades, el API no permitirá eliminarlo. Esta acción no se
                puede deshacer.
              </p>
            </div>
          ) : deleteTarget?.kind === "city" ? (
            <div className="space-y-2">
              <p>
                Estado:{" "}
                <span className="font-semibold text-ink">
                  {deleteTarget.record.state?.name ??
                    states.find(
                      (state) => String(state.id) === String(deleteTarget.record.state_id),
                    )?.name ??
                    `#${deleteTarget.record.state_id}`}
                </span>
              </p>
              <p>
                Si un proveedor usa esta ciudad, el API no permitirá eliminarla. Esta acción no
                se puede deshacer.
              </p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.kind === "state") {
            await deleteState(deleteTarget.record.id);
            toast.success("Estado eliminado.");
            if (String(deleteTarget.record.id) === stateFilter) setStateFilter("");
            reloadStatesAndCities();
          } else {
            await deleteCity(deleteTarget.record.id);
            toast.success("Ciudad eliminada.");
            reloadCities();
          }
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === "state"
            ? `¿Eliminar el estado ${deleteTarget.record.name}?`
            : deleteTarget?.kind === "city"
              ? `¿Eliminar la ciudad ${deleteTarget.record.name}?`
              : "Eliminar ubicación"
        }
      />
    </div>
  );
}
