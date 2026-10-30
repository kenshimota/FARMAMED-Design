"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { RecordActionButton } from "@/components/erp/records/record-actions";
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
  ShelfSectionsList,
  ShelfSectionsSkeleton,
  newSectionHref,
  shelfListHref,
  sectionCountLabel,
} from "@/components/erp/records/shelf-hierarchy";
import {
  deleteSection,
  deleteShelf,
  fetchSections,
  fetchShelf,
  type ShelfSectionRecord,
} from "@/components/erp/records/shelves-api";
import { fetchWarehouse } from "@/components/erp/records/warehouses-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { isLotsConflict } from "@/components/erp/records/shelf-errors";
import { translateApiError } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type ShelfDetailPageProps = {
  warehouseId: string;
  shelfId: string;
};

export function ShelfDetailPage({ warehouseId, shelfId }: ShelfDetailPageProps) {
  const { user } = useSession();

  if (!canReadModule(user.role, "estantes")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de estantes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  if (!isPositiveRecordId(warehouseId) || !isPositiveRecordId(shelfId)) {
    return (
      <RecordsLoadError
        backHref="/app/bodegas"
        backLabel="Volver a bodegas"
        description="Puede que el enlace no sea válido o que el estante ya no exista."
        headingLevel="h1"
        title="No encontramos este estante"
      />
    );
  }

  return <ShelfDetailContent shelfId={shelfId} warehouseId={warehouseId} />;
}

function ShelfDetailContent({
  warehouseId,
  shelfId,
}: {
  warehouseId: string;
  shelfId: string;
}) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "estantes");

  const warehouseLoader = useCallback(
    () => fetchWarehouse(warehouseId),
    [warehouseId],
  );
  const shelfLoader = useCallback(() => fetchShelf(shelfId), [shelfId]);
  const sectionsLoader = useCallback(() => fetchSections(shelfId), [shelfId]);

  const warehouseResource = useAsyncResource(warehouseLoader);
  const shelfResource = useAsyncResource(shelfLoader);
  const sectionsResource = useAsyncResource(sectionsLoader);

  const [editShelfOpen, setEditShelfOpen] = useState(false);
  const [deleteShelfOpen, setDeleteShelfOpen] = useState(false);
  const [editSectionTarget, setEditSectionTarget] =
    useState<ShelfSectionRecord | null>(null);
  const [deleteSectionTarget, setDeleteSectionTarget] =
    useState<ShelfSectionRecord | null>(null);
  const [deleteConflict, setDeleteConflict] = useState<
    "shelf" | "section" | null
  >(null);

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href={shelfListHref(warehouseId)}
        >
          Volver a estantes
        </Link>
      }
      description="Consulta el estante y administra sus secciones."
      eyebrow="Operación"
      title="Detalle del estante"
    />
  );

  if (warehouseResource.status === "loading" || shelfResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsDetailSkeleton />
      </div>
    );
  }

  const warehouseForbidden =
    warehouseResource.status === "error" &&
    warehouseResource.error?.kind === "forbidden";

  if (
    !warehouseForbidden &&
    (warehouseResource.status === "error" || !warehouseResource.data)
  ) {
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

  const shelfRefreshError =
    shelfResource.status === "error" && shelfResource.data !== null;

  if (!shelfResource.data) {
    const notFound = shelfResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref={shelfListHref(warehouseId)}
        backLabel="Volver a estantes"
        description={
          notFound
            ? "Puede que haya sido eliminado o que el enlace no sea válido."
            : shelfResource.error?.message ?? "No pudimos cargar el estante."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : shelfResource.reload}
        title={notFound ? "No encontramos este estante" : "No pudimos cargar el estante"}
      />
    );
  }

  const warehouse = warehouseResource.data ?? {
    id: warehouseId,
    name: `Bodega #${warehouseId}`,
  };
  const shelf = shelfResource.data;

  if (String(shelf.warehouse_id) !== String(warehouse.id)) {
    return (
      <RecordsLoadError
        backHref={shelfListHref(warehouse.id)}
        backLabel="Volver a estantes"
        description="Este estante pertenece a otra bodega. Consulta la jerarquía desde la bodega correcta."
        headingLevel="h1"
        title="Este estante no pertenece a esta bodega"
      />
    );
  }

  const sections =
    sectionsResource.data ??
    (sectionsResource.status === "error" ? shelf.sections : []);
  const sectionsLoading =
    sectionsResource.data === null && sectionsResource.status !== "error";
  const sectionsError = sectionsResource.status === "error";

  async function confirmDeleteShelf() {
    try {
      await deleteShelf(shelf.id);
      toast.success("Estante eliminado.");
      router.push(shelfListHref(warehouse.id));
    } catch (caught) {
      if (isLotsConflict(caught)) {
        setDeleteConflict("shelf");
        return;
      }
      toast.error(translateApiError(caught).message);
    }
  }

  async function confirmDeleteSection() {
    if (!deleteSectionTarget) return;
    try {
      await deleteSection(shelf.id, deleteSectionTarget.id);
      setDeleteConflict(null);
      toast.success("Sección eliminada.");
      sectionsResource.reload();
    } catch (caught) {
      if (isLotsConflict(caught)) {
        setDeleteConflict("section");
        return;
      }
      toast.error(translateApiError(caught).message);
    }
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href={shelfListHref(warehouse.id)}
            >
              Volver a estantes
            </Link>
            {canWrite && (
              <>
                <Link
                  className="button-base button-primary min-h-11 px-5 text-[13px]"
                  href={newSectionHref(warehouse.id, shelf.id)}
                >
                  Nueva sección
                  <Icon name="layers" size={17} />
                </Link>
                <button
                  className="button-base button-secondary min-h-11 px-5 text-[13px]"
                  onClick={() => setEditShelfOpen(true)}
                  type="button"
                >
                  Editar estante
                  <Icon name="arrow-right" size={17} />
                </button>
                <RecordActionButton
                  aria-label={`Eliminar el estante ${shelf.code}`}
                  danger
                  onClick={() => {
                    setDeleteConflict(null);
                    setDeleteShelfOpen(true);
                  }}
                >
                  Eliminar estante
                </RecordActionButton>
              </>
            )}
          </>
        }
        description={shelf.name || `Estante ${shelf.code}`}
        eyebrow="Operación"
        title={`Estante ${shelf.code}`}
      >
        <ShelfBreadcrumbs shelfCode={shelf.code} warehouse={warehouse} />
      </RecordsPageHeader>

      {shelfRefreshError && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-4 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={shelfResource.reload}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos actualizar la ficha del estante. Mostramos los datos
          disponibles.
        </NoticeBanner>
      )}

      {warehouseForbidden && (
        <NoticeBanner tone="warning">
          No pudimos cargar los datos de la bodega, pero el estante y sus
          secciones siguen disponibles.
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
          {deleteConflict === "shelf" ? SHELF_LOTS_CONFLICT : SECTION_LOTS_CONFLICT}
        </NoticeBanner>
      )}

      <section
        aria-labelledby="ficha-estante"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Ficha del estante</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ficha-estante"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Código
            </dt>
            <dd className="mt-1.5">
              <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[12px] font-semibold text-brand">
                {shelf.code}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Nombre
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              {shelf.name || "Sin nombre"}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Descripción
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
              {shelf.description || "Sin descripción registrada."}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Bodega
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              <Link
                className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href={`/app/bodegas/${warehouse.id}`}
              >
                {warehouse.name}
              </Link>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">
              #{shelf.id}
            </dd>
          </div>
        </dl>

        <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          El código es el identificador visible del estante. La bodega del
          estante no se puede cambiar.
        </p>
      </section>

      <section
        aria-labelledby="secciones-estante"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Jerarquía</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="secciones-estante"
            >
              Secciones
            </h2>
            <p aria-live="polite" className="mt-1 text-[12px] text-muted">
              {sectionsLoading
                ? "Cargando secciones…"
                : sectionsError && sections.length === 0
                  ? "No disponible"
                  : sectionCountLabel(sections.length)}
            </p>
          </div>
          {canWrite && sections.length > 0 && (
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href={newSectionHref(warehouse.id, shelf.id)}
            >
              Nueva sección
              <Icon name="layers" size={16} />
            </Link>
          )}
        </div>

        <div className="mt-5">
          {sectionsLoading && <ShelfSectionsSkeleton />}

          {sectionsError && sections.length === 0 && (
            <EmptyState
              action={
                <button
                  className="button-base button-secondary min-h-11 px-5"
                  onClick={sectionsResource.reload}
                  type="button"
                >
                  Reintentar
                </button>
              }
              description="Revisa tu conexión e intenta de nuevo."
              title="No pudimos cargar las secciones."
            />
          )}

          {sectionsError && sections.length > 0 && (
            <div className="mb-4">
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={sectionsResource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                No pudimos actualizar las secciones. Mostramos las secciones
                disponibles.
              </NoticeBanner>
            </div>
          )}

          {!sectionsLoading && (!sectionsError || sections.length > 0) && (
            <ShelfSectionsList
              canWrite={canWrite}
              onDeleteSection={(_, section) => {
                setDeleteConflict(null);
                setDeleteSectionTarget(section);
              }}
              onEditSection={(_, section) => setEditSectionTarget(section)}
              sections={sections}
              shelf={shelf}
              warehouseId={warehouse.id}
            />
          )}
        </div>
      </section>

      {editShelfOpen && (
        <EditShelfDialog
          onClose={() => setEditShelfOpen(false)}
          onSaved={shelfResource.reload}
          shelf={shelf}
        />
      )}

      {editSectionTarget && (
        <EditSectionDialog
          onClose={() => setEditSectionTarget(null)}
          onSaved={sectionsResource.reload}
          section={editSectionTarget}
          shelf={shelf}
        />
      )}

      <ConfirmDialog
        confirmBusyLabel="Eliminando…"
        confirmLabel="Eliminar estante"
        description={
          <div className="space-y-2">
            <p>Si el estante tiene lotes asociados, no se podrá eliminar.</p>
            <p>Esta acción no se puede deshacer.</p>
          </div>
        }
        onClose={() => setDeleteShelfOpen(false)}
        onConfirm={confirmDeleteShelf}
        onError={(error) => toast.error(error.message)}
        open={deleteShelfOpen}
        title={`¿Eliminar el estante ${shelf.code}?`}
      />

      <ConfirmDialog
        confirmBusyLabel="Eliminando…"
        confirmLabel="Eliminar sección"
        description={
          <div className="space-y-2">
            <p>Si la sección tiene lotes asociados, no se podrá eliminar.</p>
            <p>Esta acción no se puede deshacer.</p>
          </div>
        }
        onClose={() => setDeleteSectionTarget(null)}
        onConfirm={confirmDeleteSection}
        onError={(error) => toast.error(error.message)}
        open={deleteSectionTarget !== null}
        title={
          deleteSectionTarget
            ? `¿Eliminar la sección ${deleteSectionTarget.code}?`
            : "Eliminar sección"
        }
      />
    </div>
  );
}
