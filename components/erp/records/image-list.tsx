"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FilterBar } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { Skeleton } from "@/components/erp/ui/skeleton";
import { TextField } from "@/components/erp/records/form-controls";
import { useServerList } from "@/components/erp/ui/use-server-list";
import { ImageDeleteDialog } from "@/components/erp/records/image-delete-dialog";
import { ImagePreview } from "@/components/erp/records/image-preview";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import {
  fetchImagePage,
  getImageDisplayName,
  getImageSource,
  isOpaqueImageReference,
  type ImageRecord,
} from "@/components/erp/records/records-api";
import { formatInteger } from "@/lib/format";
import { canWriteModule } from "@/lib/permissions";

const CARD_GRID =
  "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

function shortUrl(url: string) {
  return url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function ImageCardsSkeleton() {
  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">Cargando imágenes…</span>
      <div aria-hidden="true" className={CARD_GRID}>
        {Array.from({ length: 6 }, (_, index) => (
          <div
            className="overflow-hidden rounded-[24px] border border-line bg-surface"
            key={index}
          >
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-32 max-w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageCard({
  canWrite,
  displayName,
  image,
  onDelete,
  priority,
}: {
  canWrite: boolean;
  displayName: string;
  image: ImageRecord;
  onDelete: (image: ImageRecord, displayName: string) => void;
  priority: boolean;
}) {
  const local = Boolean(image.pathname);
  const generated = isOpaqueImageReference(image.reference);
  const source = getImageSource(image);
  const usesOriginal = Boolean(image.url) && source === image.url;

  return (
    <li className="flex flex-col overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_12px_36px_rgba(27,12,104,0.04)] transition-colors hover:border-brand/35 motion-reduce:transition-none">
      <div className="aspect-[4/3] border-b border-line">
        <ImagePreview
          original={usesOriginal}
          priority={priority}
          reference={displayName}
          src={source}
        />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-[15px] font-semibold leading-6 text-ink">
            {displayName}
          </h2>
          <span
            className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              generated
                ? "bg-soft-lime text-ink"
                : local
                  ? "bg-soft-blue text-brand"
                  : "bg-soft-lime text-ink"
            }`}
          >
            {generated ? "Generada" : local ? "Archivo local" : "Solo S3"}
          </span>
        </div>

        {generated ? (
          <p className="mt-3 rounded-xl border border-brand/15 bg-soft-blue px-3 py-2 text-[12px] leading-5 text-ink">
            Se generó al subir una imagen de producto. La miniatura se
            administra desde el formulario del producto.
          </p>
        ) : (
          <dl className="mt-3 space-y-2 text-[12px]">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                URL
              </dt>
              <dd
                className="mt-1 truncate font-mono text-[11px] text-muted"
                dir="ltr"
                title={image.url}
              >
                {shortUrl(image.url)}
              </dd>
            </div>
            {image.pathname && (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Ruta del archivo
                </dt>
                <dd
                  className="mt-1 truncate font-mono text-[11px] text-muted"
                  dir="ltr"
                  title={image.pathname}
                >
                  {image.pathname}
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <a
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-brand/25 bg-soft-blue px-3.5 text-[12px] font-semibold text-brand transition-colors hover:border-brand/50 hover:text-ink motion-reduce:transition-none"
              href={image.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Abrir imagen
              <Icon name="arrow-up-right" size={15} />
              <span className="sr-only">
                {" "}
                de {displayName} (se abre en una nueva pestaña)
              </span>
            </a>

            {canWrite && !generated && (
              <RecordActions>
                <RecordActionLink
                  ariaLabel={`Editar la imagen ${displayName}`}
                  href={`/app/imagenes/${image.id}/editar`}
                  icon="arrow-right"
                >
                  Editar
                </RecordActionLink>
                <RecordActionButton
                  aria-label={`Eliminar la imagen ${displayName}`}
                  danger
                  icon="close"
                  onClick={() => onDelete(image, displayName)}
                >
                  Eliminar
                </RecordActionButton>
              </RecordActions>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function ImageListPage() {
  const { user } = useSession();
  const canWrite = canWriteModule(user.role, "catalogo");
  const list = useServerList<ImageRecord>({
    loader: (request) => fetchImagePage(request),
  });
  const [deleteTarget, setDeleteTarget] = useState<{
    displayName: string;
    image: ImageRecord;
  } | null>(null);

  const images = list.items;

  const imageIndexes = useMemo(() => {
    const offset = (list.meta.page - 1) * list.meta.page_size;
    return new Map(
      images.map((image, index) => [String(image.id), offset + index] as const),
    );
  }, [images, list.meta.page, list.meta.page_size]);

  function displayNameFor(image: ImageRecord) {
    return getImageDisplayName(image, imageIndexes.get(String(image.id)));
  }

  const hasQuery = Boolean(list.request.q);

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/imagenes/nueva"
            >
              Registrar imagen
              <Icon name="image" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta las imágenes reutilizables del catálogo. Se registran por URL; esta pantalla no sube archivos."
        eyebrow="Catálogo"
        title="Imágenes"
      />

      <FilterBar
        activeCount={Number(hasQuery)}
        chips={
          hasQuery
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
        id="imagenes-filtros"
        loading={list.status === "loading"}
        onClear={list.clearFilters}
        results={
          list.status === "loading"
            ? "Cargando imágenes…"
            : list.status === "error" && images.length === 0
              ? "No pudieron cargarse las imágenes"
              : list.meta.total === 0
                ? "Sin imágenes"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <TextField
            help="La búsqueda se aplica en el servidor por nombre o referencia."
            id="buscar-imagenes"
            inputType="search"
            label="Buscar por nombre o referencia"
            onChange={list.setSearch}
            placeholder="Buscar por nombre o referencia"
            value={list.searchDraft}
          />
        }
      />

      {list.status === "loading" && <ImageCardsSkeleton />}

      {list.status === "error" && images.length === 0 && (
        <RecordsLoadError
          description={
            list.error?.message ??
            "No pudimos cargar las imágenes. Revisa tu conexión e intenta de nuevo."
          }
          onRetry={list.reload}
          title="No pudimos cargar las imágenes."
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && images.length === 0) && (
          <section
            aria-busy={list.status === "refreshing" || undefined}
            aria-label="Listado de imágenes"
            className="space-y-4"
          >
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && images.length > 0 && (
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
                  "No pudimos actualizar las imágenes. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {images.length === 0 ? (
              list.meta.total === 0 && !hasQuery ? (
                <EmptyState
                  action={
                    canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/imagenes/nueva"
                      >
                        Registrar la primera imagen
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description="Registra la primera para usarla en productos."
                  headingLevel={2}
                  title="Todavía no hay imágenes."
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
                        : "Limpiar búsqueda"}
                    </button>
                  }
                  description={
                    list.isPageOutOfRange
                      ? `Hay ${formatInteger(
                          list.meta.total,
                        )} imágenes en total, pero esta página no tiene filas.`
                      : "Prueba con otro nombre o referencia."
                  }
                  headingLevel={2}
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : "Sin resultados con estos filtros."
                  }
                />
              )
            ) : (
              <>
                <ul className={CARD_GRID}>
                  {images.map((image, index) => (
                    <ImageCard
                      canWrite={canWrite}
                      displayName={displayNameFor(image)}
                      image={image}
                      key={String(image.id)}
                      onDelete={(target, displayName) =>
                        setDeleteTarget({ displayName, image: target })
                      }
                      priority={index < 4}
                    />
                  ))}
                </ul>
                <PaginationControls
                  meta={list.meta}
                  onFirstPage={list.goToFirstPage}
                  onPageChange={list.setPage}
                  onPageSizeChange={list.setPageSize}
                />
              </>
            )}

            {images.length === 0 && list.meta.total > 0 && (
              <PaginationControls
                meta={list.meta}
                onFirstPage={list.goToFirstPage}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
              />
            )}
          </section>
        )}

      <ImageDeleteDialog
        image={deleteTarget?.image ?? null}
        imageName={deleteTarget?.displayName ?? null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={list.reload}
      />
    </div>
  );
}
