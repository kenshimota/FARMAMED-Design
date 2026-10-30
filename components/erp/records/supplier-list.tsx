"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
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
  fetchSuppliers,
  type SupplierRecord,
} from "@/components/erp/records/suppliers-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

const NO_SUPPLIERS: SupplierRecord[] = [];

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

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function supplierCountLabel(count: number) {
  return count === 1 ? "1 proveedor" : `${formatInteger(count)} proveedores`;
}

export function SupplierListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const suppliersResource = useAsyncResource(fetchSuppliers);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SupplierRecord | null>(null);

  const suppliers = suppliersResource.data ?? NO_SUPPLIERS;

  const stateOptions = useMemo<StateOption[]>(() => {
    const map = new Map<string, StateOption>();
    for (const supplier of suppliers) {
      const key = String(supplier.state_id);
      if (map.has(key)) continue;
      const name = supplier.state?.name ?? `Estado #${supplier.state_id}`;
      map.set(key, {
        value: key,
        label: supplier.state?.code ? `${name} · ${supplier.state.code}` : name,
        name,
      });
    }
    return Array.from(map.values()).sort((first, second) =>
      first.name.localeCompare(second.name, "es", { sensitivity: "base" }),
    );
  }, [suppliers]);

  const cityOptions = useMemo<CityOption[]>(() => {
    const map = new Map<string, CityOption>();
    for (const supplier of suppliers) {
      const key = String(supplier.city_id);
      if (map.has(key)) continue;
      const cityName = supplier.city?.name ?? `Ciudad #${supplier.city_id}`;
      const stateName = supplier.state?.name ?? `Estado #${supplier.state_id}`;
      map.set(key, {
        value: key,
        label: `${cityName} · ${stateName}`,
        stateId: String(supplier.state_id),
      });
    }
    return Array.from(map.values()).sort((first, second) =>
      first.label.localeCompare(second.label, "es", { sensitivity: "base" }),
    );
  }, [suppliers]);

  const visibleCityOptions = stateFilter
    ? cityOptions.filter((city) => city.stateId === stateFilter)
    : cityOptions;

  const filteredSuppliers = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    return suppliers.filter((supplier) => {
      if (stateFilter && String(supplier.state_id) !== stateFilter) return false;
      if (cityFilter && String(supplier.city_id) !== cityFilter) return false;
      if (!normalizedQuery) return true;
      return (
        normalizeSearch(supplier.name).includes(normalizedQuery) ||
        normalizeSearch(supplier.identification).includes(normalizedQuery)
      );
    });
  }, [cityFilter, query, stateFilter, suppliers]);

  const filtersActive = Boolean(query.trim() || stateFilter || cityFilter);
  const totalLabel = supplierCountLabel(suppliers.length);
  const countLabel = filtersActive
    ? `Mostrando ${formatInteger(filteredSuppliers.length)} de ${totalLabel}`
    : totalLabel;

  function clearFilters() {
    setQuery("");
    setStateFilter("");
    setCityFilter("");
  }

  function handleStateFilter(value: string) {
    setStateFilter(value);
    if (!value) return;
    setCityFilter((current) => {
      if (!current) return current;
      const city = cityOptions.find((option) => option.value === current);
      return city?.stateId === value ? current : "";
    });
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

      {suppliersResource.status === "loading" && (
        <RecordsTableSkeleton
          columns={6}
          label="Cargando proveedores…"
          rows={6}
        />
      )}

      {suppliersResource.status === "error" && suppliers.length === 0 && (
        <RecordsLoadError
          description={
            suppliersResource.error?.message ??
            "No pudimos cargar los proveedores."
          }
          onRetry={suppliersResource.reload}
          title="No pudimos cargar los proveedores"
        />
      )}

      {suppliersResource.status !== "loading" &&
        !(suppliersResource.status === "error" && suppliers.length === 0) && (
          <section aria-label="Listado de proveedores" className="space-y-4">
            {suppliersResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}
            {suppliersResource.status === "error" && suppliers.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={suppliersResource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {suppliersResource.error?.message ??
                  "No pudimos actualizar los proveedores. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(200px,250px)_minmax(220px,280px)] lg:items-end">
                <div className="sm:col-span-2 lg:col-span-1">
                  <label
                    className="mb-2 block text-[12px] font-semibold text-ink"
                    htmlFor="buscar-proveedores"
                  >
                    Buscar
                  </label>
                  <div className="relative">
                    <Icon
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                      name="search"
                      size={17}
                    />
                    <input
                      className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                      id="buscar-proveedores"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por nombre o identificación"
                      type="search"
                      value={query}
                    />
                  </div>
                </div>

                <SelectField
                  emptyLabel="Todos los estados"
                  id="filtro-estado-proveedores"
                  label="Estado"
                  onChange={handleStateFilter}
                  options={stateOptions}
                  placeholder="Todos los estados"
                  value={stateFilter}
                />

                <SelectField
                  emptyLabel="Todas las ciudades"
                  id="filtro-ciudad-proveedores"
                  label="Ciudad"
                  onChange={setCityFilter}
                  options={visibleCityOptions}
                  placeholder="Todas las ciudades"
                  value={cityFilter}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p
                  aria-live="polite"
                  className="text-[12px] font-semibold text-muted"
                >
                  {countLabel}
                </p>
                {filtersActive && (
                  <button
                    className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                    onClick={clearFilters}
                    type="button"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {suppliers.length === 0 ? (
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
            ) : filteredSuppliers.length === 0 ? (
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
                description="Ajusta la búsqueda o los filtros para encontrar el proveedor."
                title="No hay proveedores que coincidan con la búsqueda."
              />
            ) : (
              <RecordsTable
                caption="Proveedores con su identificación, correo, teléfono y ubicación"
                columns={columns}
                getRowKey={(supplier) => String(supplier.id)}
                getRowLabel={(supplier) => supplier.name}
                renderCard={renderCard}
                rowActions={renderActions}
                rows={filteredSuppliers}
              />
            )}
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
          suppliersResource.reload();
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
