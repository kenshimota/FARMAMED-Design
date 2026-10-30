"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
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
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  EditSectionDialog,
  EditShelfDialog,
} from "@/components/erp/records/shelf-dialogs";
import {
  IMMUTABLE_PARENT_NOTICE,
  SECTION_LOTS_CONFLICT,
  SHELF_LOTS_CONFLICT,
  ShelfBreadcrumbs,
  ShelfCard,
  ShelfHierarchySkeleton,
  newShelfHref,
  shelfCountLabel,
} from "@/components/erp/records/shelf-hierarchy";
import {
  deleteSection,
  deleteShelf,
  fetchShelves,
  type ShelfRecord,
  type ShelfSectionRecord,
} from "@/components/erp/records/shelves-api";
import { isLotsConflict } from "@/components/erp/records/shelf-errors";
import { fetchWarehouse } from "@/components/erp/records/warehouses-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { translateApiError } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type DeleteConflict =
  | { kind: "shelf"; code: string }
  | { kind: "section"; code: string };

type SectionTarget = {
  shelf: ShelfRecord;
  section: ShelfSectionRecord;
};

type ShelfHierarchyPageProps = {
  warehouseId: string;
};

export function ShelfHierarchyPage({ warehouseId }: ShelfHierarchyPageProps) {
  const { user } = useSession();

  if (!canReadModule(user.role, "estantes")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de estantes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  if (!isPositiveRecordId(warehouseId)) {
    return (
      <RecordsLoadError
        backHref="/app/bodegas"
        backLabel="Volver a bodegas"
        description="Puede que el enlace no sea válido o que la bodega ya no exista."
        headingLevel="h1"
        title="No encontramos esta bodega"
      />
    );
  }

  return <ShelfHierarchyContent warehouseId={warehouseId} />;
}

function ShelfHierarchyContent({ warehouseId }: { warehouseId: string }) {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "estantes");

  const warehouseLoader = useCallback(
    () => fetchWarehouse(warehouseId),
    [warehouseId],
  );
  const shelvesLoader = useCallback(
    () => fetchShelves(warehouseId),
    [warehouseId],
  );
  const warehouseResource = useAsyncResource(warehouseLoader);
  const shelvesResource = useAsyncResource(shelvesLoader);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editShelfTarget, setEditShelfTarget] = useState<ShelfRecord | null>(null);
  const [deleteShelfTarget, setDeleteShelfTarget] = useState<ShelfRecord | null>(null);
  const [editSectionTarget, setEditSectionTarget] = useState<SectionTarget | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<SectionTarget | null>(null);
  const [deleteConflict, setDeleteConflict] = useState<DeleteConflict | null>(null);

  const warehouse = warehouseResource.data;
  const warehouseForbidden =
    warehouseResource.status === "error" &&
    warehouseResource.error?.kind === "forbidden";

  if (warehouseResource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/bodegas"
            >
              Volver a bodegas
            </Link>
          }
          description="Jerarquía de estantes y secciones de la bodega."
          eyebrow="Operación"
          title="Estantes"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (!warehouseForbidden && (warehouseResource.status === "error" || !warehouse)) {
    const notFound = warehouseResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/bodegas"
        backLabel="Volver a bodegas"
        description={
          notFound
            ? "Puede que haya sido eliminada o que el enlace no sea válido."
            : warehouseResource.error?.message ?? "No pudimos cargar la bodega."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : warehouseResource.reload}
        title={notFound ? "No encontramos esta bodega" : "No pudimos cargar la bodega"}
      />
    );
  }

  const warehouseInfo = warehouse ?? {
    id: warehouseId,
    name: `Bodega #${warehouseId}`,
  };
  const shelves = (shelvesResource.data ?? []).filter(
    (shelf) => String(shelf.warehouse_id) === String(warehouseInfo.id),
  );
  const initialShelvesError =
    shelvesResource.data === null && shelvesResource.status === "error";
  const loadingShelves =
    shelvesResource.data === null && !initialShelvesError;

  function isShelfExpanded(shelf: ShelfRecord) {
    return expanded[String(shelf.id)] ?? true;
  }

  function toggleShelf(shelf: ShelfRecord) {
    const key = String(shelf.id);
    setExpanded((current) => ({
      ...current,
      [key]: !(current[key] ?? true),
    }));
  }

  function handleDeleteError(caught: unknown, conflict: DeleteConflict) {
    if (isLotsConflict(caught)) {
      setDeleteConflict(conflict);
      return;
    }
    toast.error(translateApiError(caught).message);
  }

  async function confirmDeleteShelf() {
    if (!deleteShelfTarget) return;
    try {
      await deleteShelf(deleteShelfTarget.id);
      setDeleteConflict(null);
      toast.success("Estante eliminado.");
      shelvesResource.reload();
    } catch (caught) {
      handleDeleteError(caught, { kind: "shelf", code: deleteShelfTarget.code });
    }
  }

  async function confirmDeleteSection() {
    if (!deleteSectionTarget) return;
    const { shelf, section } = deleteSectionTarget;
    try {
      await deleteSection(shelf.id, section.id);
      setDeleteConflict(null);
      toast.success("Sección eliminada.");
      shelvesResource.reload();
    } catch (caught) {
      handleDeleteError(caught, { kind: "section", code: section.code });
    }
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            {!warehouseForbidden && (
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={`/app/bodegas/${warehouseInfo.id}`}
              >
                Volver a bodega
              </Link>
            )}
            {canWrite && (
              <Link
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href={newShelfHref(warehouseInfo.id)}
              >
                Nuevo estante
                <Icon name="arrow-right" size={17} />
              </Link>
            )}
          </>
        }
        description={`Jerarquía de estantes y secciones de ${warehouseInfo.name}.`}
        eyebrow="Operación"
        title={`Estantes de ${warehouseInfo.name}`}
      >
        <ShelfBreadcrumbs warehouse={warehouseInfo} />
        {warehouse && (
          <div className="mt-3 flex max-w-3xl flex-wrap gap-x-6 gap-y-1 text-[12px] leading-5 text-muted">
            <p>
              <span className="font-semibold text-ink">Dirección:</span>{" "}
              {warehouse.address}
            </p>
            {warehouse.observations && (
              <p>
                <span className="font-semibold text-ink">Observaciones:</span>{" "}
                {warehouse.observations}
              </p>
            )}
          </div>
        )}
      </RecordsPageHeader>

      {warehouseForbidden && (
        <NoticeBanner tone="warning">
          No pudimos cargar los datos de la bodega, pero la jerarquía de estantes y
          secciones sigue disponible.
        </NoticeBanner>
      )}

      <NoticeBanner tone="info">{IMMUTABLE_PARENT_NOTICE}</NoticeBanner>

      {deleteConflict && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-4 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={() => setDeleteConflict(null)}
              type="button"
            >
              Cerrar aviso
            </button>
          }
          role="alert"
          tone="warning"
        >
          <p>
            {deleteConflict.kind === "shelf"
              ? SHELF_LOTS_CONFLICT
              : SECTION_LOTS_CONFLICT}
          </p>
          <p className="mt-1 font-mono text-[12px] font-semibold">
            {deleteConflict.code}
          </p>
        </NoticeBanner>
      )}

      <section aria-labelledby="lista-estantes" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              className="text-xl font-semibold tracking-[-0.03em] text-ink"
              id="lista-estantes"
            >
              Estantes
            </h2>
            <p aria-live="polite" className="mt-1 text-[12px] text-muted">
              {initialShelvesError
                ? "No disponible"
                : loadingShelves
                  ? "Cargando estantes…"
                  : shelfCountLabel(shelves.length)}
            </p>
          </div>
          {canWrite && shelves.length > 0 && (
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href={newShelfHref(warehouseInfo.id)}
            >
              Nuevo estante
              <Icon name="layers" size={16} />
            </Link>
          )}
        </div>

        {shelvesResource.status === "refreshing" && (
          <div aria-hidden="true" className="reload-bar" />
        )}

        {initialShelvesError && (
          <RecordsLoadError
            description={
              shelvesResource.error?.message ??
              "Revisa tu conexión e intenta de nuevo."
            }
            onRetry={shelvesResource.reload}
            title="No pudimos cargar los estantes."
          />
        )}

        {shelvesResource.status === "error" && shelves.length > 0 && (
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

        {loadingShelves && <ShelfHierarchySkeleton />}

        {!loadingShelves && !initialShelvesError && shelves.length === 0 && (
          <EmptyState
            action={
              canWrite ? (
                <Link
                  className="button-base button-primary min-h-11 px-5"
                  href={newShelfHref(warehouseInfo.id)}
                >
                  Nuevo estante
                  <Icon name="arrow-right" size={17} />
                </Link>
              ) : undefined
            }
            description={
              canWrite
                ? "Crea el primer estante para organizar la ubicación física del inventario."
                : "Aún no hay estantes registrados para consultar."
            }
            title="Esta bodega todavía no tiene estantes."
          />
        )}

        {shelves.length > 0 && (
          <ul aria-label="Estantes de la bodega" className="space-y-4">
            {shelves.map((shelf) => (
              <ShelfCard
                canWrite={canWrite}
                expanded={isShelfExpanded(shelf)}
                key={String(shelf.id)}
                onDeleteSection={(targetShelf, section) => {
                  setDeleteConflict(null);
                  setDeleteSectionTarget({ shelf: targetShelf, section });
                }}
                onDeleteShelf={(targetShelf) => {
                  setDeleteConflict(null);
                  setDeleteShelfTarget(targetShelf);
                }}
                onEditSection={(targetShelf, section) =>
                  setEditSectionTarget({ shelf: targetShelf, section })
                }
                onEditShelf={setEditShelfTarget}
                onToggle={() => toggleShelf(shelf)}
                shelf={shelf}
                warehouseId={warehouseInfo.id}
              />
            ))}
          </ul>
        )}
      </section>

      {editShelfTarget && (
        <EditShelfDialog
          onClose={() => setEditShelfTarget(null)}
          onSaved={shelvesResource.reload}
          shelf={editShelfTarget}
        />
      )}

      {editSectionTarget && (
        <EditSectionDialog
          onClose={() => setEditSectionTarget(null)}
          onSaved={shelvesResource.reload}
          section={editSectionTarget.section}
          shelf={editSectionTarget.shelf}
        />
      )}

      <ConfirmDialog
        confirmBusyLabel="Eliminando…"
        confirmLabel="Eliminar estante"
        description={
          deleteShelfTarget ? (
            <div className="space-y-2">
              <p>Si el estante tiene lotes asociados, no se podrá eliminar.</p>
              <p>Esta acción no se puede deshacer.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteShelfTarget(null)}
        onConfirm={confirmDeleteShelf}
        onError={(error) => toast.error(error.message)}
        open={deleteShelfTarget !== null}
        title={
          deleteShelfTarget
            ? `¿Eliminar el estante ${deleteShelfTarget.code}?`
            : "Eliminar estante"
        }
      />

      <ConfirmDialog
        confirmBusyLabel="Eliminando…"
        confirmLabel="Eliminar sección"
        description={
          deleteSectionTarget ? (
            <div className="space-y-2">
              <p>
                Si la sección tiene lotes asociados, no se podrá eliminar.
              </p>
              <p>Esta acción no se puede deshacer.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteSectionTarget(null)}
        onConfirm={confirmDeleteSection}
        onError={(error) => toast.error(error.message)}
        open={deleteSectionTarget !== null}
        title={
          deleteSectionTarget
            ? `¿Eliminar la sección ${deleteSectionTarget.section.code}?`
            : "Eliminar sección"
        }
      />
    </div>
  );
}
