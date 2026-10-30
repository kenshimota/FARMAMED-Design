"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import {
  ShelfHierarchySkeleton,
  sectionCountLabel,
  shelfCountLabel,
  shelfDetailHref,
  shelfListHref,
} from "@/components/erp/records/shelf-hierarchy";
import {
  fetchAllShelves,
  type ShelfRecord,
} from "@/components/erp/records/shelves-api";
import { fetchWarehouses } from "@/components/erp/records/warehouses-api";
import type { RecordId } from "@/components/erp/records/records-api";
import { canReadModule } from "@/lib/permissions";

type WarehouseGroup = {
  warehouseId: RecordId;
  shelves: ShelfRecord[];
};

function groupShelves(shelves: ShelfRecord[]): WarehouseGroup[] {
  const groups = new Map<string, WarehouseGroup>();

  for (const shelf of shelves) {
    const key = String(shelf.warehouse_id);
    const group = groups.get(key);
    if (group) {
      group.shelves.push(shelf);
    } else {
      groups.set(key, { warehouseId: shelf.warehouse_id, shelves: [shelf] });
    }
  }

  return Array.from(groups.values()).sort((first, second) => {
    const firstId = Number(first.warehouseId);
    const secondId = Number(second.warehouseId);
    if (Number.isFinite(firstId) && Number.isFinite(secondId)) {
      return firstId - secondId;
    }
    return String(first.warehouseId).localeCompare(
      String(second.warehouseId),
      "es",
      { numeric: true },
    );
  });
}

function groupSectionTotal(group: WarehouseGroup) {
  return group.shelves.reduce(
    (total, shelf) => total + shelf.sections.length,
    0,
  );
}

function headingIdFor(warehouseId: RecordId) {
  const safeId = String(warehouseId).replace(/[^a-zA-Z0-9_-]/g, "-");
  return `bodega-${safeId}-estantes`;
}

export function ShelfDirectoryPage() {
  const { user } = useSession();

  if (!canReadModule(user.role, "estantes")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de estantes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  return <ShelfDirectoryContent />;
}

function ShelfDirectoryContent() {
  const { user } = useSession();
  const canReadWarehouses = canReadModule(user.role, "bodegas");

  const shelvesLoader = useCallback(() => fetchAllShelves(), []);
  const shelvesResource = useAsyncResource(shelvesLoader);
  const warehousesResource = useAsyncResource(fetchWarehouses, {
    enabled: canReadWarehouses,
  });

  const groups = useMemo(
    () => groupShelves(shelvesResource.data ?? []),
    [shelvesResource.data],
  );
  const warehouseNames = useMemo(
    () =>
      new Map(
        (warehousesResource.data ?? []).map((warehouse) => [
          String(warehouse.id),
          warehouse.name,
        ]),
      ),
    [warehousesResource.data],
  );

  const initialShelvesError =
    shelvesResource.data === null && shelvesResource.status === "error";
  const loading =
    shelvesResource.data === null && shelvesResource.status !== "error";
  const namesError =
    canReadWarehouses &&
    warehousesResource.data === null &&
    warehousesResource.status === "error";

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        description="Consulta la jerarquía de estantes y secciones agrupada por bodega."
        eyebrow="Operación"
        title="Estantes"
      />

      {namesError && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={warehousesResource.reload}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos cargar los nombres de las bodegas. Mostramos su
          identificador.
        </NoticeBanner>
      )}

      {shelvesResource.status === "error" && shelvesResource.data !== null && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={shelvesResource.reload}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos actualizar los estantes. Mostramos la información
          disponible.
        </NoticeBanner>
      )}

      {loading && <ShelfHierarchySkeleton />}

      {initialShelvesError && (
        <RecordsLoadError
          description={
            shelvesResource.error?.message ??
            "Revisa tu conexión e intenta de nuevo."
          }
          onRetry={shelvesResource.reload}
          title="No pudimos cargar los estantes"
        />
      )}

      {!loading && !initialShelvesError && groups.length === 0 && (
        <EmptyState
          description="Cuando se registren estantes, aparecerán aquí agrupados por bodega."
          title="Todavía no hay estantes registrados."
        />
      )}

      {!loading && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((group) => {
            const headingId = headingIdFor(group.warehouseId);
            const warehouseLabel =
              warehouseNames.get(String(group.warehouseId)) ??
              `Bodega #${group.warehouseId}`;

            return (
              <section
                aria-labelledby={headingId}
                className="rounded-[24px] border border-line bg-surface p-5 shadow-[0_14px_44px_rgba(27,12,104,0.04)] sm:p-6"
                key={String(group.warehouseId)}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2
                      className="text-lg font-semibold tracking-[-0.02em] text-ink"
                      id={headingId}
                    >
                      {warehouseLabel}
                    </h2>
                    <p className="mt-1 text-[12px] text-muted">
                      {shelfCountLabel(group.shelves.length)} ·{" "}
                      {sectionCountLabel(groupSectionTotal(group))}
                    </p>
                  </div>
                  <Link
                    aria-label={`Ver estantes de ${warehouseLabel}`}
                    className="button-base button-secondary min-h-11 px-5 text-[13px]"
                    href={shelfListHref(group.warehouseId)}
                  >
                    Ver estantes
                    <Icon name="layers" size={16} />
                  </Link>
                </div>

                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {group.shelves.map((shelf) => (
                    <li key={String(shelf.id)}>
                      <Link
                        className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-background px-3 py-2 transition-colors hover:border-brand/40 hover:bg-soft-blue"
                        href={shelfDetailHref(group.warehouseId, shelf.id)}
                      >
                        <span className="font-mono text-[12px] font-semibold text-brand">
                          {shelf.code}
                        </span>
                        <span className="min-w-0 truncate text-[13px] text-ink">
                          {shelf.name || "Sin nombre"}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] font-semibold text-muted">
                          {sectionCountLabel(shelf.sections.length)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
