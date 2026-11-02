"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { useServerList } from "@/components/erp/ui/use-server-list";
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
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  deleteSupplier,
  fetchSupplierPage,
  type SupplierRecord,
} from "@/components/erp/records/suppliers-api";
import { fetchCities, fetchStates } from "@/components/erp/records/locations-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

type StateOption = {
  value: string;
  label: string;
  name: string;
};

type CityOption = {
  value: string;
  label: string;
  stateId: string;
};

export function SupplierListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const list = useServerList<SupplierRecord>({
    loader: (request) => fetchSupplierPage(request),
    filterKeys: ["state_id", "city_id"],
    defaultSort: "name",
    defaultOrder: "asc",
  });
  const [deleteTarget, setDeleteTarget] = useState<SupplierRecord | null>(null);
  const stateFilter = list.filters.state_id ?? "";
  const cityFilter = list.filters.city_id ?? "";
  const suppliers = list.items;

  const statesResource = useAsyncResource(fetchStates);
  const citiesLoader = useCallback(
    () => fetchCities(stateFilter || undefined),
    [stateFilter],
  );
  const citiesResource = useAsyncResource(citiesLoader);
  const previousStateId = useRef(stateFilter);
  const reloadCities = citiesResource.reload;

  useEffect(() => {
    if (previousStateId.current === stateFilter) return;
    previousStateId.current = stateFilter;
    reloadCities();
  }, [reloadCities, stateFilter]);

  const stateOptions = useMemo<StateOption[]>(
    () =>
      (statesResource.data ?? []).map((state) => ({
        value: String(state.id),
        label: state.code ? `${state.name} · ${state.code}` : state.name,
        name: state.name,
      })),
    [statesResource.data],
  );

  const cityOptions = useMemo<CityOption[]>(
    () =>
      (citiesResource.data ?? []).map((city) => ({
        value: String(city.id),
        label: `${city.name} · ${
          city.state?.name ?? stateOptions.find(
            (state) => state.value === String(city.state_id),
          )?.name ?? `Estado #${city.state_id}`
        }`,
        stateId: String(city.state_id),
      })),
    [citiesResource.data, stateOptions],
  );

  const filtersActive = Boolean(
    list.request.q || stateFilter || cityFilter,
  );

  const chips: FilterChip[] = [];
  if (list.request.q) {
    chips.push({
      id: "q",
      label: `Búsqueda: ${list.request.q}`,
      onRemove: () => {
        list.setSearch("");
        list.commitSearch();
      },
    });
  }
  if (stateFilter) {
    chips.push({
      id: "state_id",
      label: `Estado: ${
        stateOptions.find((option) => option.value === stateFilter)?.name ??
        `#${stateFilter}`
      }`,
      onRemove: () => list.setFilter("state_id", ""),
    });
  }
  if (cityFilter) {
    chips.push({
      id: "city_id",
      label: `Ciudad: ${
        cityOptions.find((option) => option.value === cityFilter)?.label ??
        `#${cityFilter}`
      }`,
      onRemove: () => list.setFilter("city_id", ""),
    });
  }

  function handleStateFilter(value: string) {
    list.setFilters({ state_id: value, city_id: "" });
  }

  function cityNameFor(supplier: SupplierRecord) {
    return supplier.city?.name ?? `Ciudad #${supplier.city_id}`;
  }

  function stateNameFor(supplier: SupplierRecord) {
    return supplier.state?.name ?? `Estado #${supplier.state_id}`;
  }

  const columns: RecordsTableColumn<SupplierRecord>[] = [
    {
      key: "nombre",
      header: "Nombre",
      render: (supplier) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/proveedores/${supplier.id}`}
        >
          {supplier.name}
        </Link>
      ),
    },
    {
      key: "identificacion",
      header: "Identificación",
      render: (supplier) => (
        <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
          {supplier.identification}
        </span>
      ),
    },
    {
      key: "correo",
      header: "Correo",
      className: "max-w-[220px]",
      render: (supplier) => (
        <span className="block truncate text-muted">
          {supplier.email || "No registrado"}
        </span>
      ),
    },
    {
      key: "telefono",
      header: "Teléfono",
      render: (supplier) => (
        <span className="block whitespace-nowrap text-muted">
          {supplier.phone || "No registrado"}
        </span>
      ),
    },
    {
      key: "ubicacion",
      header: "Ciudad / estado",
      render: (supplier) => (
        <span className="block">
          <span className="block text-ink">{cityNameFor(supplier)}</span>
          <span className="block text-[12px] text-muted">
            {stateNameFor(supplier)}
          </span>
        </span>
      ),
    },
  ];

  function renderActions(supplier: SupplierRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver ${supplier.name}`}
          href={`/app/proveedores/${supplier.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar ${supplier.name}`}
            href={`/app/proveedores/${supplier.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar ${supplier.name}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(supplier)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(supplier: SupplierRecord) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            href={`/app/proveedores/${supplier.id}`}
          >
            {supplier.name}
          </Link>
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {supplier.identification}
          </span>
        </div>
        <div className="mt-3 space-y-1 text-[12px] leading-5 text-muted">
          <p>
            <span className="font-semibold text-ink">Correo:</span>{" "}
            {supplier.email || "No registrado"}
          </p>
          <p>
            <span className="font-semibold text-ink">Teléfono:</span>{" "}
            {supplier.phone || "No registrado"}
          </p>
          <p>
            <span className="font-semibold text-ink">Ubicación:</span>{" "}
            {cityNameFor(supplier)}, {stateNameFor(supplier)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/proveedores/nuevo"
            >
              Nuevo proveedor
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Directorio de proveedores con su identificación, contacto y ubicación."
        eyebrow="Catálogo"
        title="Proveedores"
      />

      <FilterBar
        activeCount={
          Number(Boolean(list.request.q)) +
          Number(Boolean(stateFilter)) +
          Number(Boolean(cityFilter))
        }
        chips={chips}
        id="proveedores-filtros"
        loading={list.status === "loading"}
        onClear={list.clearFilters}
        results={
          list.status === "loading"
            ? "Cargando proveedores…"
            : list.status === "error" && suppliers.length === 0
              ? "No pudieron cargarse los proveedores"
              : list.meta.total === 0
                ? "Sin proveedores"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="La búsqueda se aplica en el servidor sobre nombre e identificación."
            id="buscar-proveedores"
            label="Buscar"
            loadOptions={async (query) => {
              const page = await fetchSupplierPage({ q: query, pageSize: 10 });
              return page.data.map((supplier) => ({
                value: String(supplier.id),
                label: supplier.name,
                description: supplier.identification,
              }));
            }}
            onSelect={(option) => {
              list.setSearch(option.label);
              list.commitSearch();
            }}
            onValueChange={list.setSearch}
            placeholder="Buscar por nombre o identificación"
            value={list.searchDraft}
          />
        }
      >
        <SelectField
          emptyLabel="Todos los estados"
          id="filtro-estado-proveedores"
          label="Estado"
          loadError={
            statesResource.status === "error"
              ? "No pudimos cargar los estados."
              : null
          }
          loading={statesResource.status === "loading"}
          loadingLabel="Cargando estados…"
          onChange={handleStateFilter}
          onRetry={statesResource.reload}
          options={stateOptions}
          placeholder="Todos los estados"
          value={stateFilter}
        />

        <SelectField
          emptyLabel="Todas las ciudades"
          id="filtro-ciudad-proveedores"
          label="Ciudad"
          loadError={
            citiesResource.status === "error"
              ? "No pudimos cargar las ciudades."
              : null
          }
          loading={citiesResource.status === "loading"}
          loadingLabel="Cargando ciudades…"
          onChange={(value) => list.setFilter("city_id", value)}
          onRetry={reloadCities}
          options={cityOptions}
          placeholder="Todas las ciudades"
          value={cityFilter}
        />
      </FilterBar>

      {list.status === "loading" && (
        <RecordsTableSkeleton
          columns={6}
          label="Cargando proveedores…"
          rows={6}
        />
      )}

      {list.status === "error" && suppliers.length === 0 && (
        <RecordsLoadError
          description={
            list.error?.message ?? "No pudimos cargar los proveedores."
          }
          onRetry={list.reload}
          title="No pudimos cargar los proveedores"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && suppliers.length === 0) && (
          <section aria-label="Listado de proveedores" className="space-y-4">
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}
            {list.status === "error" && suppliers.length > 0 && (
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
                  "No pudimos actualizar los proveedores. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {suppliers.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={
                    canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/proveedores/nuevo"
                      >
                        Nuevo proveedor
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description="Registra el primero para usarlo en compras."
                  title="Todavía no hay proveedores."
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
                        )} proveedores en total, pero esta página no tiene filas.`
                      : "Ajusta la búsqueda o los filtros para encontrar el proveedor."
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : "Sin resultados con estos filtros."
                  }
                />
              )
            ) : (
              <RecordsTable
                busy={list.status === "refreshing"}
                caption="Proveedores con su identificación, correo, teléfono y ubicación"
                columns={columns}
                getRowKey={(supplier) => String(supplier.id)}
                getRowLabel={(supplier) => supplier.name}
                renderCard={renderCard}
                rowActions={renderActions}
                rows={suppliers}
              />
            )}

            <PaginationControls
              meta={list.meta}
              onFirstPage={list.goToFirstPage}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
          </section>
        )}

      <ConfirmDialog
        confirmLabel="Eliminar proveedor"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Identificación:{" "}
                <span className="font-semibold text-ink">
                  {deleteTarget.identification}
                </span>
              </p>
              <p>Esta acción no se puede deshacer.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteSupplier(deleteTarget.id);
          toast.success("Proveedor eliminado.");
          list.reload();
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={
          deleteTarget
            ? `¿Eliminar el proveedor ${deleteTarget.name}?`
            : "Eliminar proveedor"
        }
      />
    </div>
  );
}
