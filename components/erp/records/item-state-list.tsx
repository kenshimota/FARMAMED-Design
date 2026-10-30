"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import {
  Tabs,
  getTabId,
  getTabPanelId,
  type TabItem,
} from "@/components/erp/ui/tabs";
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
  deleteItemState,
  fetchItemStates,
  type ItemStateRecord,
} from "@/components/erp/records/item-states-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

const TABS_ID = "estados-item";
const EMPTY_ITEM_STATES: ItemStateRecord[] = [];

type SegmentId = "todos" | "vendibles" | "no-vendibles";

const SEGMENTS: readonly SegmentId[] = ["todos", "vendibles", "no-vendibles"];

const SEGMENT_EMPTY_COPY: Record<SegmentId, string> = {
  todos: "No hay estados de ítem que coincidan con la búsqueda.",
  vendibles: "No hay estados de ítem vendibles que coincidan con la búsqueda.",
  "no-vendibles":
    "No hay estados de ítem no vendibles que coincidan con la búsqueda.",
};

const SEGMENT_EMPTY_COPY_WITHOUT_QUERY: Record<SegmentId, string> = {
  todos: "No hay estados de ítem configurados.",
  vendibles: "No hay estados de ítem vendibles.",
  "no-vendibles": "No hay estados de ítem no vendibles.",
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function itemStateCountLabel(count: number) {
  return count === 1
    ? "1 estado de ítem"
    : `${formatInteger(count)} estados de ítem`;
}

function SellableStatus({ sellable }: { sellable: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        sellable ? "bg-soft-lime text-ink" : "bg-soft-blue text-ink"
      }`}
    >
      <Icon
        className={sellable ? "text-olive" : "text-muted"}
        name={sellable ? "check" : "close"}
        size={13}
      />
      {sellable ? "Vendible" : "No vendible"}
    </span>
  );
}

export function ItemStateListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const itemStatesResource = useAsyncResource(fetchItemStates);

  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SegmentId>("todos");
  const [deleteTarget, setDeleteTarget] = useState<ItemStateRecord | null>(null);

  const itemStates = itemStatesResource.data ?? EMPTY_ITEM_STATES;

  const searchedItemStates = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return itemStates;
    return itemStates.filter(
      (itemState) =>
        normalizeSearch(itemState.label).includes(normalizedQuery) ||
        normalizeSearch(itemState.name).includes(normalizedQuery),
    );
  }, [itemStates, query]);

  const groupedItemStates = useMemo<Record<SegmentId, ItemStateRecord[]>>(
    () => ({
      todos: searchedItemStates,
      vendibles: searchedItemStates.filter((itemState) => itemState.is_sellable),
      "no-vendibles": searchedItemStates.filter(
        (itemState) => !itemState.is_sellable,
      ),
    }),
    [searchedItemStates],
  );

  const hasQuery = query.trim().length > 0;
  const filtersActive = hasQuery || activeTab !== "todos";
  const totalLabel = itemStateCountLabel(itemStates.length);
  const countLabel = hasQuery
    ? `Mostrando ${formatInteger(searchedItemStates.length)} de ${totalLabel}`
    : totalLabel;

  const tabs: TabItem[] = [
    {
      id: "todos",
      label: "Todos",
      count: itemStatesResource.data ? groupedItemStates.todos.length : undefined,
    },
    {
      id: "vendibles",
      label: "Vendibles",
      count: itemStatesResource.data
        ? groupedItemStates.vendibles.length
        : undefined,
    },
    {
      id: "no-vendibles",
      label: "No vendibles",
      count: itemStatesResource.data
        ? groupedItemStates["no-vendibles"].length
        : undefined,
    },
  ];

  function clearFilters() {
    setQuery("");
    setActiveTab("todos");
  }

  const columns: RecordsTableColumn<ItemStateRecord>[] = [
    {
      key: "etiqueta",
      header: "Etiqueta",
      render: (itemState) => (
        <span className="font-semibold text-ink">{itemState.label}</span>
      ),
    },
    {
      key: "clave",
      header: "Clave técnica",
      render: (itemState) => (
        <div>
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {itemState.name}
          </span>
          <span className="mt-1 block text-[11px] leading-4 text-muted">
            Clave estable usada por el inventario
          </span>
        </div>
      ),
    },
    {
      key: "vendible",
      header: "Vendible",
      render: (itemState) => (
        <SellableStatus sellable={itemState.is_sellable} />
      ),
    },
    {
      key: "descripcion",
      header: "Descripción",
      className: "max-w-[280px]",
      render: (itemState) => (
        <span className="line-clamp-2 text-muted">
          {itemState.description || "Sin descripción"}
        </span>
      ),
    },
  ];

  function renderActions(itemState: ItemStateRecord) {
    return (
      <RecordActions>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar ${itemState.label}`}
            href={`/app/estados-item/${itemState.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar ${itemState.label}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(itemState)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(itemState: ItemStateRecord) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-[15px] font-semibold text-ink">{itemState.label}</p>
          <SellableStatus sellable={itemState.is_sellable} />
        </div>
        <div className="mt-2">
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
            {itemState.name}
          </span>
          <p className="mt-1 text-[11px] leading-4 text-muted">
            Clave estable usada por el inventario
          </p>
        </div>
        <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-muted">
          {itemState.description || "Sin descripción"}
        </p>
      </div>
    );
  }

  function renderSegment(segment: SegmentId) {
    const rows = groupedItemStates[segment];
    if (rows.length === 0) {
      return (
        <EmptyState
          action={
            filtersActive ? (
              <button
                className="button-base button-secondary min-h-11 px-5"
                onClick={clearFilters}
                type="button"
              >
                Limpiar filtros
              </button>
            ) : undefined
          }
          description={
            hasQuery
              ? SEGMENT_EMPTY_COPY[segment]
              : SEGMENT_EMPTY_COPY_WITHOUT_QUERY[segment]
          }
          title={hasQuery ? "Sin resultados" : "Sin estados en este filtro"}
        />
      );
    }
    return (
      <RecordsTable
        caption="Estados de ítem con su etiqueta, clave técnica, condición de venta y descripción"
        columns={columns}
        getRowKey={(itemState) => String(itemState.id)}
        getRowLabel={(itemState) => itemState.label}
        renderCard={renderCard}
        rowActions={canWrite ? renderActions : undefined}
        rows={rows}
      />
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/estados-item/nuevo"
            >
              Nuevo estado
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta la condición de los productos con su clave estable y su etiqueta visible."
        eyebrow="Catálogo"
        title="Estados de ítem"
      />

      <NoticeBanner tone="info">
        Los estados de ítem describen la condición del producto. Los estados
        geográficos están en{" "}
        <Link
          className="font-semibold text-brand underline underline-offset-4 hover:text-ink"
          href="/app/ubicaciones"
        >
          Ubicaciones
        </Link>
        .
      </NoticeBanner>

      {itemStatesResource.status === "loading" && (
        <RecordsTableSkeleton
          columns={5}
          label="Cargando estados de ítem…"
          rows={6}
        />
      )}

      {itemStatesResource.status === "error" && itemStates.length === 0 && (
        <RecordsLoadError
          description={
            itemStatesResource.error?.message ??
            "No pudimos cargar los estados de ítem."
          }
          onRetry={itemStatesResource.reload}
          title="No pudimos cargar los estados de ítem"
        />
      )}

      {itemStatesResource.status !== "loading" &&
        !(itemStatesResource.status === "error" && itemStates.length === 0) && (
          <section aria-label="Listado de estados de ítem" className="space-y-4">
            {itemStatesResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {itemStatesResource.status === "error" && itemStates.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={itemStatesResource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {itemStatesResource.error?.message ??
                  "No pudimos actualizar los estados de ítem. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {itemStates.length === 0 ? (
              <EmptyState
                action={
                  canWrite ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href="/app/estados-item/nuevo"
                    >
                      Crear estado
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description="Revisa la carga inicial de datos."
                title="No hay estados de ítem configurados."
              />
            ) : (
              <>
                <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                  <div>
                    <label
                      className="mb-2 block text-[12px] font-semibold text-ink"
                      htmlFor="buscar-estados-item"
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
                        id="buscar-estados-item"
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Buscar por etiqueta o clave técnica"
                        type="search"
                        value={query}
                      />
                    </div>
                  </div>

                  <div className="mt-4 border-t border-line pt-3">
                    <Tabs
                      idPrefix={TABS_ID}
                      label="Filtrar estados de ítem por condición de venta"
                      onChange={(id) => setActiveTab(id as SegmentId)}
                      tabs={tabs}
                      value={activeTab}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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

                {SEGMENTS.map((segment) => (
                  <section
                    aria-labelledby={getTabId(TABS_ID, segment)}
                    hidden={activeTab !== segment}
                    id={getTabPanelId(TABS_ID, segment)}
                    key={segment}
                    role="tabpanel"
                    tabIndex={0}
                  >
                    {renderSegment(segment)}
                  </section>
                ))}
              </>
            )}
          </section>
        )}

      <ConfirmDialog
        confirmLabel="Eliminar estado"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Clave técnica:{" "}
                <span className="font-mono font-semibold text-ink">
                  {deleteTarget.name}
                </span>
              </p>
              <p>
                Si tiene costos, existencias o compras asociadas, no podrás
                eliminarlo. Esta acción no se puede deshacer.
              </p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteItemState(deleteTarget.id);
          toast.success("Estado eliminado.");
          itemStatesResource.reload();
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={
          deleteTarget
            ? `¿Eliminar el estado ${deleteTarget.label}?`
            : "Eliminar estado"
        }
      />
    </div>
  );
}
