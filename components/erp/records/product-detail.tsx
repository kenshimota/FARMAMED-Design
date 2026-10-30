"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordActionButton } from "@/components/erp/records/record-actions";
import { RecordThumbnail } from "@/components/erp/records/record-thumbnail";
import { RecordsDetailSkeleton, RecordsLoadError } from "@/components/erp/records/record-states";
import {
  deleteProduct,
  fetchCategories,
  fetchImages,
  fetchProduct,
  findById,
  getImagePreviewSource,
  isPositiveRecordId,
} from "@/components/erp/records/records-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type ProductDetailPageProps = {
  productId: string;
};

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validId = isPositiveRecordId(productId);
  const productLoader = useCallback(() => fetchProduct(productId), [productId]);
  const productResource = useAsyncResource(productLoader, { enabled: validId });
  const categoriesResource = useAsyncResource(fetchCategories, { enabled: validId });
  const imagesResource = useAsyncResource(fetchImages, { enabled: validId });

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/productos"
        backLabel="Volver a productos"
        description="Puede que el enlace no sea válido o que el producto ya no exista."
        headingLevel="h1"
        title="No encontramos este producto"
      />
    );
  }

  if (productResource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/productos"
            >
              Volver a productos
            </Link>
          }
          description="Consulta los datos registrados del producto."
          eyebrow="Catálogo"
          title="Detalle del producto"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (productResource.status === "error" || !productResource.data) {
    const notFound = productResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/productos"
        backLabel="Volver a productos"
        description={
          notFound
            ? "Puede que haya sido eliminado o que el enlace no sea válido."
            : productResource.error?.message ?? "No pudimos cargar el producto."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : productResource.reload}
        title={notFound ? "No encontramos este producto" : "No pudimos cargar el producto"}
      />
    );
  }

  const product = productResource.data;
  const category = findById(categoriesResource.data ?? [], product.category_id);
  const image = findById(imagesResource.data ?? [], product.image_id);
  const imageSource = getImagePreviewSource(image);
  const relatedError =
    categoriesResource.status === "error" || imagesResource.status === "error";

  type RelatedModule = {
    href: string;
    label: string;
    description: string;
    icon: "calculator" | "box";
  };
  const relatedCandidates = [
    canReadModule(user.role, "costos")
      ? {
          href: "/app/costos",
          label: "Costos",
          description: "Módulo en preparación. El acceso depende de tu rol.",
          icon: "calculator" as const,
        }
      : null,
    canReadModule(user.role, "existencias")
      ? {
          href: "/app/existencias",
          label: "Existencias",
          description: "Módulo en preparación. El acceso depende de tu rol.",
          icon: "box" as const,
        }
      : null,
  ];
  const relatedModules = relatedCandidates.filter(
    (item): item is RelatedModule => item !== null,
  );

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <>
              <Link
                aria-label={`Editar ${product.name}`}
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href={`/app/productos/${product.id}/editar`}
              >
                Editar producto
                <Icon name="arrow-right" size={17} />
              </Link>
              <RecordActionButton
                aria-label={`Eliminar ${product.name}`}
                danger
                onClick={() => setDeleteOpen(true)}
              >
                Eliminar producto
              </RecordActionButton>
            </>
          ) : undefined
        }
        description={`Referencia ${product.reference}`}
        eyebrow="Catálogo"
        title={product.name}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/productos"
        >
          Volver a productos
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      {relatedError && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={() => {
                if (categoriesResource.status === "error") categoriesResource.reload();
                if (imagesResource.status === "error") imagesResource.reload();
              }}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos cargar la categoría o la imagen relacionada. Mostramos la información
          disponible.
        </NoticeBanner>
      )}

      <section
        aria-labelledby="ficha-producto"
        className="grid gap-6 rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7 lg:grid-cols-[300px_minmax(0,1fr)]"
      >
        <div>
          <RecordThumbnail
            className="h-64 w-full"
            label={product.name}
            loading={imagesResource.status === "loading"}
            size="lg"
            src={imageSource}
          />
          <p className="mt-3 text-[11px] leading-5 text-muted">
            {image
              ? `Imagen ${image.reference}`
              : imagesResource.status === "loading"
                ? "Cargando imagen…"
                : imagesResource.status === "error"
                  ? "No pudimos cargar la imagen."
                  : "Este producto no tiene una imagen disponible."}
          </p>
        </div>

        <div className="min-w-0">
          <span className="eyebrow">Ficha del producto</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="ficha-producto"
          >
            Datos registrados
          </h2>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Nombre del producto
              </dt>
              <dd className="mt-1.5 text-[14px] text-ink">{product.name}</dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Referencia
              </dt>
              <dd className="mt-1.5">
                <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[12px] font-semibold text-brand">
                  {product.reference}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Categoría
              </dt>
              <dd className="mt-1.5 text-[14px] text-ink">
                <span>
                  {category
                    ? category.name
                    : categoriesResource.status === "loading"
                      ? "Cargando categoría…"
                      : `Categoría #${product.category_id}`}
                </span>
                <Link
                  aria-label="Ir al módulo de categorías"
                  className="ml-2 inline-flex min-h-11 items-center text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  href="/app/categorias"
                >
                  Ir a categorías
                </Link>
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Imagen
              </dt>
              <dd className="mt-1.5 text-[14px] text-ink">
                <span>
                  {image
                    ? image.reference
                    : imagesResource.status === "loading"
                      ? "Cargando imagen…"
                      : `Imagen #${product.image_id}`}
                </span>
                <Link
                  aria-label="Ir al módulo de imágenes"
                  className="ml-2 inline-flex min-h-11 items-center text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  href="/app/imagenes"
                >
                  Ir a imágenes
                </Link>
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Descripción
              </dt>
              <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
                {product.description || "Sin descripción registrada."}
              </dd>
            </div>
          </dl>

          <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
            El catálogo solo guarda nombre, descripción, referencia, categoría e imagen. No
            incluye precio, impuesto, presentación ni existencias.
          </p>
        </div>
      </section>

      {relatedModules.length > 0 && (
        <section
          aria-labelledby="accesos-relacionados"
          className="rounded-[24px] border border-line bg-surface p-5 sm:p-6"
        >
          <h2
            className="text-[15px] font-semibold tracking-[-0.02em] text-ink"
            id="accesos-relacionados"
          >
            Accesos relacionados
          </h2>
          <p className="mt-1.5 text-[12px] leading-6 text-muted">
            Estos accesos abren el módulo raíz. Los módulos siguen en preparación y esta
            versión no filtra sus registros por producto.
          </p>
          <nav aria-label="Módulos relacionados" className="mt-4 grid gap-3 sm:grid-cols-2">
            {relatedModules.map((module) => (
              <Link
                className="flex items-start gap-3 rounded-2xl border border-line bg-background p-4 transition-colors hover:border-brand/40 hover:bg-soft-blue"
                href={module.href}
                key={module.href}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand">
                  <Icon name={module.icon} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">
                    {module.label}
                  </span>
                  <span className="mt-1 block text-[12px] leading-5 text-muted">
                    {module.description}
                  </span>
                </span>
              </Link>
            ))}
          </nav>
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar producto"
        description={
          <div className="space-y-2">
            <p>
              Referencia: <span className="font-semibold text-ink">{product.reference}</span>
            </p>
            <p>Esta acción no se puede deshacer.</p>
          </div>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteProduct(product.id);
          toast.success("Producto eliminado.");
          router.push("/app/productos");
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteOpen}
        title={`¿Eliminar el producto ${product.name}?`}
      />
    </div>
  );
}
