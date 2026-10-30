"use client";

import Link from "next/link";
import { EmptyState } from "@/components/erp/ui/empty-state";
import {
  RecordActionButton,
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import { RecordsTable, type RecordsTableColumn } from "@/components/erp/records/records-table";
import type {
  CityRecord,
  StateRecord,
} from "@/components/erp/records/locations-api";

type CityResultsProps = {
  cities: CityRecord[];
  states: StateRecord[];
  query?: string;
  stateFilterActive?: boolean;
  canWrite: boolean;
  onEdit?: (city: CityRecord) => void;
  onDelete?: (city: CityRecord) => void;
  emptyTitle?: string;
  emptyDescription?: string;
};

function stateNameFor(city: CityRecord, states: StateRecord[]) {
  if (city.state) return city.state.name;
  const match = states.find((state) => String(state.id) === String(city.state_id));
  return match?.name ?? `Estado #${city.state_id}`;
}

export function CityResults({
  cities,
  states,
  query = "",
  stateFilterActive = false,
  canWrite,
  onEdit,
  onDelete,
  emptyTitle,
  emptyDescription,
}: CityResultsProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCities = normalizedQuery
    ? cities.filter((city) => city.name.toLowerCase().includes(normalizedQuery))
    : cities;

  if (cities.length === 0) {
    return (
      <EmptyState
        description={
          emptyDescription ??
          (stateFilterActive
            ? "Este estado todavía no tiene ciudades."
            : "No hay ciudades configuradas. Revisa la semilla del API.")
        }
        title={emptyTitle ?? (stateFilterActive ? "Estado sin ciudades" : "Sin ciudades")}
      />
    );
  }

  if (filteredCities.length === 0) {
    return (
      <EmptyState
        description="No hay ciudades para este filtro."
        title="Sin resultados"
      />
    );
  }

  function renderActions(city: CityRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver ${city.name}`}
          href={`/app/ubicaciones/ciudades/${city.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canWrite && onEdit && (
          <RecordActionButton
            aria-label={`Editar ${city.name}`}
            icon="arrow-right"
            onClick={() => onEdit(city)}
          >
            Editar
          </RecordActionButton>
        )}
        {canWrite && onDelete && (
          <RecordActionButton
            aria-label={`Eliminar ${city.name}`}
            danger
            icon="close"
            onClick={() => onDelete(city)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  const columns: RecordsTableColumn<CityRecord>[] = [
    {
      key: "nombre",
      header: "Ciudad",
      render: (city) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/ubicaciones/ciudades/${city.id}`}
        >
          {city.name}
        </Link>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (city) => <span>{stateNameFor(city, states)}</span>,
    },
  ];

  function renderCard(city: CityRecord) {
    return (
      <div>
        <Link
          className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/ubicaciones/ciudades/${city.id}`}
        >
          {city.name}
        </Link>
        <p className="mt-2 text-[12px] text-muted">
          Estado: <span className="text-ink">{stateNameFor(city, states)}</span>
        </p>
      </div>
    );
  }

  return (
    <RecordsTable
      caption="Ciudades geográficas con el estado al que pertenecen"
      columns={columns}
      getRowKey={(city) => String(city.id)}
      getRowLabel={(city) => city.name}
      renderCard={renderCard}
      rowActions={renderActions}
      rows={filteredCities}
    />
  );
}
