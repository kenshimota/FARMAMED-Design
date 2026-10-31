"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { Skeleton } from "@/components/erp/ui/skeleton";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
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
  fetchImages,
  type ImageRecord,
} from "@/components/erp/records/records-api";
import { formatInteger } from "@/lib/format";
import { canWriteModule } from "@/lib/permissions";

const NO_IMAGES: ImageRecord[] = [];
const CARD_GRID =
  "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compareImageIds(first: ImageRecord, second: ImageRecord) {
  const firstNumber = Number(first.id);
  const secondNumber = Number(second.id);
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return firstNumber - secondNumber;
  }
  return String(first.id).localeCompare(String(second.id), "es", {
    numeric: true,
  });
}

function imageCountLabel(count: number) {
  return count === 1 ? "1 imagen" : `${formatInteger(count)} imágenes`;
}

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
  image,
  onDelete,
}: {
  canWrite: boolean;
  image: ImageRecord;
  onDelete: (image: ImageRecord) => void;
}) {
  const local = Boolean(image.pathname);

  return (
    <li className="flex flex-col overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_12px_36px_rgba(27,12,104,0.04)] transition-colors hover:border-brand/35 motion-reduce:transition-none">
      <div className="aspect-[4/3] border-b border-line">
        <ImagePreview reference={image.reference} src={image.thumbnail} />
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 break-words text-[15px] font-semibold leading-6 text-ink">
            {image.reference}
          </h2>
          <span
            className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              local ? "bg-soft-blue text-brand" : "bg-soft-lime text-ink"
            }`}
          >
            {local ? "Archivo local" : "Solo S3"}
          </span>
        </div>

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
                de {image.reference} (se abre en una nueva pestaña)
              </span>
            </a>

            {canWrite && (
              <RecordActions>
                <RecordActionLink
                  ariaLabel={`Editar la imagen ${image.reference}`}
                  href={`/app/imagenes/${image.id}/editar`}
                  icon="arrow-right"
                >
                  Editar
                </RecordActionLink>
                <RecordActionButton
                  aria-label={`Eliminar la imagen ${image.reference}`}
                  danger
                  icon="close"
                  onClick={() => onDelete(image)}
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
  const imagesResource = useAsyncResource(fetchImages);
  const [query, setQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ImageRecord | null>(null);

  const images = useMemo(
    () => [...(imagesResource.data ?? NO_IMAGES)].sort(compareImageIds),
    [imagesResource.data],
  );

  const filteredImages = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return images;
    return images.filter((image) =>
      normalizeSearch(image.reference).includes(normalizedQuery),
    );
  }, [images, query]);

  const hasQuery = query.trim().length > 0;
  const countLabel = hasQuery
    ? `Mostrando ${formatInteger(filteredImages.length)} de ${imageCountLabel(images.length)}`
    : imageCountLabel(images.length);

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

      {imagesResource.status === "loading" && <ImageCardsSkeleton />}

      {imagesResource.status === "error" && images.length === 0 && (
        <RecordsLoadError
          description={
            imagesResource.error?.message ??
            "No pudimos cargar las imágenes. Revisa tu conexión e intenta de nuevo."
          }
          onRetry={imagesResource.reload}
          title="No pudimos cargar las imágenes."
        />
      )}

      {imagesResource.status !== "loading" &&
        !(imagesResource.status === "error" && images.length === 0) && (
          <section aria-label="Listado de imágenes" className="space-y-4">
            {imagesResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {imagesResource.status === "error" && images.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={imagesResource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {imagesResource.error?.message ??
                  "No pudimos actualizar las imágenes. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
              <div>
                <label
                  className="mb-2 block text-[12px] font-semibold text-ink"
                  htmlFor="buscar-imagenes"
                >
                  Buscar por referencia
                </label>
                <div className="relative">
                  <Icon
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    name="search"
                    size={17}
                  />
                  <input
                    className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                    id="buscar-imagenes"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por referencia"
                    type="search"
                    value={query}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <p
                  aria-live="polite"
                  className="text-[12px] font-semibold text-muted"
                >
                  {countLabel}
                </p>
                {hasQuery && (
                  <button
                    className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                    onClick={() => setQuery("")}
                    type="button"
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </div>
            </div>

            {images.length === 0 ? (
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
            ) : filteredImages.length === 0 ? (
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
                description="Prueba con otra referencia."
                headingLevel={2}
                title="No hay imágenes que coincidan con la búsqueda."
              />
            ) : (
              <ul className={CARD_GRID}>
                {filteredImages.map((image) => (
                  <ImageCard
                    canWrite={canWrite}
                    image={image}
                    key={String(image.id)}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </ul>
            )}
          </section>
        )}

      <ImageDeleteDialog
        image={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={imagesResource.reload}
      />
    </div>
  );
}
