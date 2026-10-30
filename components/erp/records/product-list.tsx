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
import { RecordActionButton, RecordActionLink, RecordActions } from "@/components/erp/records/record-actions";
import { RecordThumbnail } from "@/components/erp/records/record-thumbnail";
import { RecordsListSkeleton, RecordsLoadError } from "@/components/erp/records/record-states";
import { RecordsTable, type RecordsTableColumn } from "@/components/erp/records/records-table";
import {
  deleteProduct,
  fetchCategories,
  fetchImages,
  fetchProducts,
  findById,
  getImageSource,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";
import { LARGE_LIST_NOTICE, LARGE_LIST_THRESHOLD } from "@/lib/feedback";

function productCountLabel(count: number) {
  return count === 1 ? "1 producto" : `${formatInteger(count)} productos`;
}

const NO_PRODUCTS: ProductRecord[] = [];

export function ProductListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const productsResource = useAsyncResource(fetchProducts);
  const categoriesResource = useAsyncResource(fetchCategories);
  const imagesResource = useAsyncResource(fetchImages);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);

  const products = productsResource.data ?? NO_PRODUCTS;
  const categories = categoriesResource.data ?? [];
  const images = imagesResource.data ?? [];

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter && String(product.category_id) !== categoryFilter) return false;
      if (!normalizedQuery) return true;
      return [product.name, product.reference, product.description].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [categoryFilter, products, query]);

  const hasQuery = query.trim().length > 0;
  const hasCategory = Boolean(categoryFilter);
  const filtersActive = hasQuery || hasCategory;
  const totalProductsLabel = productCountLabel(products.length);
  const countLabel = filtersActive
    ? `Mostrando ${formatInteger(filteredProducts.length)} de ${totalProductsLabel}`
    : totalProductsLabel;
  const imagesLoading = imagesResource.status === "loading";
  const filteredEmptyDescription =
    hasQuery && hasCategory
      ? "No hay productos que coincidan con la búsqueda y la categoría seleccionada."
      : hasCategory
        ? "No hay productos en la categoría seleccionada."
        : "No hay productos que coincidan con la búsqueda.";

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
  }));

  function categoryNameFor(id: ProductRecord["category_id"]) {
    return findById(categories, id)?.name ?? `Categoría #${id}`;
  }

  function imageSourceFor(product: ProductRecord) {
    const image = findById(images, product.image_id);
    return getImageSource(image);
  }

  const columns: RecordsTableColumn<ProductRecord>[] = [
    {
      key: "imagen",
      header: "Imagen",
      render: (product) => (
        <RecordThumbnail
          label={product.name}
          loading={imagesLoading}
          size="md"
          src={imageSourceFor(product)}
        />
      ),
    },
    {
      key: "nombre",
      header: "Nombre",
      render: (product) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/productos/${product.id}`}
        >
          {product.name}
        </Link>
      ),
    },
    {
      key: "referencia",
      header: "Referencia",
      render: (product) => (
        <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
          {product.reference}
        </span>
      ),
    },
    {
      key: "categoria",
      header: "Categoría",
      render: (product) => <span>{categoryNameFor(product.category_id)}</span>,
    },
    {
      key: "descripcion",
      header: "Descripción",
      className: "max-w-[280px]",
      render: (product) => (
        <span className="line-clamp-2 text-muted">
          {product.description || "Sin descripción"}
        </span>
      ),
    },
  ];

  function renderActions(product: ProductRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver ${product.name}`}
          href={`/app/productos/${product.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar ${product.name}`}
            href={`/app/productos/${product.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar ${product.name}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(product)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(product: ProductRecord) {
    return (
      <div>
        <div className="flex items-start gap-3">
          <RecordThumbnail
            label={product.name}
            loading={imagesLoading}
            size="lg"
            src={imageSourceFor(product)}
          />
          <div className="min-w-0">
            <Link
              className="text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
              href={`/app/productos/${product.id}`}
            >
              {product.name}
            </Link>
            <p className="mt-1.5 inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
              {product.reference}
            </p>
            <p className="mt-2 text-[12px] text-muted">
              {categoryNameFor(product.category_id)}
            </p>
          </div>
        </div>
        <p className="mt-3 line-clamp-3 text-[13px] leading-6 text-muted">
          {product.description || "Sin descripción"}
        </p>
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
              href="/app/productos/nuevo"
            >
              Nuevo producto
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta el catálogo de productos con su categoría e imagen."
        eyebrow="Catálogo"
        title="Productos"
      />

      {productsResource.status === "loading" && <RecordsListSkeleton />}

      {productsResource.status === "error" && (
        <RecordsLoadError
          description={productsResource.error?.message ?? "No pudimos cargar los productos."}
          onRetry={productsResource.reload}
          title="No pudimos cargar los productos"
        />
      )}

      {productsResource.status !== "loading" && productsResource.status !== "error" && (
        <section aria-label="Listado de productos" className="space-y-4">
          {productsResource.status === "refreshing" && (
            <div aria-hidden="true" className="reload-bar" />
          )}
          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(200px,260px)] sm:items-end">
              <div>
                <label
                  className="mb-2 block text-[12px] font-semibold text-ink"
                  htmlFor="buscar-productos"
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
                    id="buscar-productos"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por nombre, referencia o descripción"
                    type="search"
                    value={query}
                  />
                </div>
              </div>

              <SelectField
                id="filtro-categoria"
                label="Categoría"
                loadError={
                  categoriesResource.status === "error"
                    ? "No pudimos cargar las categorías."
                    : null
                }
                loading={categoriesResource.status === "loading"}
                loadingLabel="Cargando categorías…"
                onChange={setCategoryFilter}
                onRetry={categoriesResource.reload}
                options={categoryOptions}
                placeholder="Todas las categorías"
                value={categoryFilter}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <p aria-live="polite" className="text-[12px] font-semibold text-muted">
                {countLabel}
              </p>
              {filtersActive && (
                <button
                  className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  onClick={() => {
                    setQuery("");
                    setCategoryFilter("");
                  }}
                  type="button"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {products.length > LARGE_LIST_THRESHOLD && (
            <NoticeBanner tone="warning">{LARGE_LIST_NOTICE}</NoticeBanner>
          )}

          {imagesResource.status === "error" && (
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
              No pudimos cargar las imágenes. Las miniaturas se muestran como marcador.
            </NoticeBanner>
          )}

          {products.length === 0 ? (
            <EmptyState
              action={
                canWrite ? (
                  <Link className="button-base button-primary min-h-11 px-5" href="/app/productos/nuevo">
                    Nuevo producto
                    <Icon name="arrow-right" size={17} />
                  </Link>
                ) : undefined
              }
              description={
                canWrite
                  ? "Crea el primero para empezar el catálogo."
                  : "Cuando se registren productos aparecerán aquí."
              }
              title="Todavía no hay productos."
            />
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              action={
                <button
                  className="button-base button-secondary min-h-11 px-5"
                  onClick={() => {
                    setQuery("");
                    setCategoryFilter("");
                  }}
                  type="button"
                >
                  Limpiar filtros
                </button>
              }
              description={filteredEmptyDescription}
              title="Sin resultados"
            />
          ) : (
            <RecordsTable
              caption="Productos del catálogo con su referencia, categoría y descripción"
              columns={columns}
              getRowKey={(product) => String(product.id)}
              getRowLabel={(product) => product.name}
              renderCard={renderCard}
              rowActions={renderActions}
              rows={filteredProducts}
            />
          )}
        </section>
      )}

      <ConfirmDialog
        confirmLabel="Eliminar producto"
        description={
          deleteTarget ? (
            <div className="space-y-2">
              <p>
                Referencia: <span className="font-semibold text-ink">{deleteTarget.reference}</span>
              </p>
              <p>Esta acción no se puede deshacer.</p>
            </div>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteProduct(deleteTarget.id);
          toast.success("Producto eliminado.");
          productsResource.reload();
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteTarget !== null}
        title={
          deleteTarget
            ? `¿Eliminar el producto ${deleteTarget.name}?`
            : "Eliminar producto"
        }
      />
    </div>
  );
}
