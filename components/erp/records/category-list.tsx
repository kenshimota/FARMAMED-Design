"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { CategoryFormDialog } from "@/components/erp/records/category-form-dialog";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
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
  deleteCategory,
  fetchCategories,
  type CategoryRecord,
} from "@/components/erp/records/records-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";
import { translateApiError } from "@/lib/api-errors";

const EMPTY_CATEGORIES: CategoryRecord[] = [];

const FOCUSED_NAME_CLASS =
  "rounded-md focus:outline focus:outline-[3px] focus:outline-offset-4 focus:outline-brand";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function categoryCountLabel(count: number) {
  return count === 1 ? "1 categoría" : `${formatInteger(count)} categorías`;
}

export function CategoryListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const categoriesResource = useAsyncResource(fetchCategories);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CategoryRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRecord | null>(null);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);
  const [focusAfterReload, setFocusAfterReload] = useState(false);

  const categories = categoriesResource.data ?? EMPTY_CATEGORIES;

  const filteredCategories = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return categories;
    return categories.filter((category) =>
      normalizeSearch(category.name).includes(normalizedQuery),
    );
  }, [categories, query]);

  const hasQuery = query.trim().length > 0;
  const totalLabel = categoryCountLabel(categories.length);
  const countLabel = hasQuery
    ? `Mostrando ${formatInteger(filteredCategories.length)} de ${totalLabel}`
    : totalLabel;
  const pageDescription = canWrite
    ? "Organiza el catálogo con nombres claros. Las categorías no tienen jerarquías, descripciones ni imágenes en esta versión."
    : "Consulta las categorías que organizan el catálogo. No tienen jerarquías, descripciones ni imágenes en esta versión.";

  useEffect(() => {
    if (!focusTarget) return;
    if (
      categoriesResource.status !== "ready" &&
      categoriesResource.status !== "error"
    ) {
      return;
    }

    const candidates = [
      document.getElementById(`categoria-${focusTarget}-nombre-escritorio`),
      document.getElementById(`categoria-${focusTarget}-nombre-movil`),
    ];
    const target = candidates.find(
      (element) => element && element.getClientRects().length > 0,
    );
    if (!target) {
      const fallbackFrame = window.requestAnimationFrame(() => {
        (searchInputRef.current ?? createButtonRef.current)?.focus();
        setFocusTarget(null);
      });
      return () => window.cancelAnimationFrame(fallbackFrame);
    }

    const frame = window.requestAnimationFrame(() => {
      target.focus();
      setFocusTarget(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [categoriesResource.data, categoriesResource.status, focusTarget]);

  useEffect(() => {
    if (!focusAfterReload) return;
    if (
      categoriesResource.status !== "ready" &&
      categoriesResource.status !== "error"
    ) {
      return;
    }

    const target = searchInputRef.current ?? createButtonRef.current;
    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      target.focus();
      setFocusAfterReload(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [categoriesResource.status, focusAfterReload]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(category: CategoryRecord) {
    setEditTarget(category);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
  }

  function handleSaved(category: CategoryRecord) {
    if (!editTarget) {
      setQuery("");
    }
    setFocusAfterReload(false);
    setFocusTarget(String(category.id));
    categoriesResource.reload();
  }

  function handleMissingCategory() {
    setFocusAfterReload(true);
    categoriesResource.reload();
  }

  const columns: RecordsTableColumn<CategoryRecord>[] = [
    {
      key: "nombre",
      header: "Nombre",
      render: (category) => (
        <span
          className={`inline-block max-w-[64ch] break-words font-semibold text-ink ${FOCUSED_NAME_CLASS}`}
          id={`categoria-${category.id}-nombre-escritorio`}
          tabIndex={-1}
        >
          {category.name}
        </span>
      ),
    },
  ];

  function renderActions(category: CategoryRecord) {
    return (
      <RecordActions>
        <RecordActionButton
          aria-label={`Editar ${category.name}`}
          icon="arrow-right"
          onClick={() => openEdit(category)}
        >
          Editar
        </RecordActionButton>
        <RecordActionButton
          aria-label={`Eliminar ${category.name}`}
          danger
          icon="close"
          onClick={() => setDeleteTarget(category)}
        >
          Eliminar
        </RecordActionButton>
      </RecordActions>
    );
  }

  function renderCard(category: CategoryRecord) {
    return (
      <p
        className={`break-words text-[15px] font-semibold leading-6 text-ink ${FOCUSED_NAME_CLASS}`}
        id={`categoria-${category.id}-nombre-movil`}
        tabIndex={-1}
      >
        {category.name}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <button
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              onClick={openCreate}
              ref={createButtonRef}
              type="button"
            >
              Nueva categoría
              <Icon name="arrow-right" size={17} />
            </button>
          ) : undefined
        }
        description={pageDescription}
        eyebrow="Catálogo"
        title="Categorías"
      />

      {categoriesResource.status === "loading" && (
        <RecordsTableSkeleton
          columns={2}
          label="Cargando categorías…"
          rows={5}
        />
      )}

      {categoriesResource.status === "error" && categories.length === 0 && (
        categoriesResource.error?.kind === "forbidden" ? (
          <AccessState
            description="Tu rol no tiene acceso a las categorías del catálogo. Tu sesión sigue activa; usa la navegación para continuar."
            headingLevel="h2"
          />
        ) : (
          <RecordsLoadError
            description={
              categoriesResource.error?.message ??
              "No pudimos cargar las categorías."
            }
            onRetry={categoriesResource.reload}
            title="No pudimos cargar las categorías"
          />
        )
      )}

      {categoriesResource.status !== "loading" &&
        !(categoriesResource.status === "error" && categories.length === 0) && (
          <section aria-label="Listado de categorías" className="space-y-4">
            {categoriesResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {categoriesResource.status === "error" && categories.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={categoriesResource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {categoriesResource.error?.message ??
                  "No pudimos actualizar las categorías. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {categories.length === 0 ? (
              <EmptyState
                action={
                  canWrite ? (
                    <button
                      className="button-base button-primary min-h-11 px-5"
                      onClick={openCreate}
                      type="button"
                    >
                      Crear la primera categoría
                      <Icon name="arrow-right" size={17} />
                    </button>
                  ) : undefined
                }
                description={
                  canWrite
                    ? "Crea la primera para organizar el catálogo."
                    : "Cuando se registren categorías aparecerán aquí."
                }
                title="Todavía no hay categorías"
              />
            ) : (
              <>
                <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                  <label
                    className="mb-2 block text-[12px] font-semibold text-ink"
                    htmlFor="buscar-categorias"
                  >
                    Buscar categoría
                  </label>
                  <div className="relative">
                    <Icon
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                      name="search"
                      size={17}
                    />
                    <input
                      className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                      id="buscar-categorias"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar por nombre"
                      ref={searchInputRef}
                      type="search"
                      value={query}
                    />
                  </div>
                  <p
                    aria-live="polite"
                    className="mt-4 text-[12px] font-semibold text-muted"
                  >
                    {countLabel}
                  </p>
                </div>

                {filteredCategories.length === 0 ? (
                  <EmptyState
                    action={
                      <button
                        className="button-base button-secondary min-h-11 px-5"
                        onClick={() => setQuery("")}
                        type="button"
                      >
                        Limpiar búsqueda
                      </button>
                    }
                    description="No hay categorías que coincidan con la búsqueda."
                    title="Sin resultados"
                  />
                ) : (
                  <RecordsTable
                    caption={
                      canWrite
                        ? "Categorías del catálogo con su nombre y acciones"
                        : "Categorías del catálogo con su nombre"
                    }
                    columns={columns}
                    getRowKey={(category) => String(category.id)}
                    getRowLabel={(category) => category.name}
                    renderCard={renderCard}
                    rowActions={canWrite ? renderActions : undefined}
                    rows={filteredCategories}
                  />
                )}
              </>
            )}
          </section>
        )}

      {canWrite && (
        <CategoryFormDialog
          category={editTarget}
          onClose={closeForm}
          onMissing={handleMissingCategory}
          onSaved={handleSaved}
          open={formOpen}
        />
      )}

      {canWrite && (
        <ConfirmDialog
          confirmLabel="Eliminar categoría"
          description={
            deleteTarget ? (
              <div className="space-y-2">
                <p>
                  Categoría:{" "}
                  <span className="font-semibold text-ink">
                    {deleteTarget.name}
                  </span>
                </p>
                <p>
                  Esta acción no se puede deshacer. Si la categoría tiene
                  productos asociados, no podrás eliminarla.
                </p>
              </div>
            ) : undefined
          }
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            if (!deleteTarget) return;
            const target = deleteTarget;
            const currentIndex = filteredCategories.findIndex(
              (category) => String(category.id) === String(target.id),
            );
            const neighbor =
              filteredCategories[currentIndex + 1] ??
              filteredCategories[currentIndex - 1] ??
              null;
            try {
              await deleteCategory(target.id);
            } catch (caught) {
              const { kind } = translateApiError(caught);
              if (kind === "not-found" || kind === "network") {
                setFocusAfterReload(true);
                categoriesResource.reload();
              }
              throw caught;
            }
            toast.success("Categoría eliminada.");
            if (neighbor) {
              setFocusAfterReload(false);
              setFocusTarget(String(neighbor.id));
            } else {
              setFocusAfterReload(true);
            }
            categoriesResource.reload();
          }}
          onError={(error) => toast.error(error.message)}
          open={deleteTarget !== null}
          title={
            deleteTarget
              ? `¿Eliminar la categoría ${deleteTarget.name}?`
              : "Eliminar categoría"
          }
        />
      )}
    </div>
  );
}
