"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useToast } from "@/components/erp/ui/toast";
import { useServerList } from "@/components/erp/ui/use-server-list";
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
  fetchProductPage,
  findById,
  getImageSource,
  type ImageRecord,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import { fetchImagesByIds } from "@/components/erp/records/images-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

export function ProductListPage() {
  const { user } = useSession();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const categoriesResource = useAsyncResource(fetchCategories);
  const list = useServerList<ProductRecord>({
    loader: (request) => fetchProductPage(request),
    filterKeys: ["category_id"],
    defaultSort: "id",
  });
  const [deleteTarget, setDeleteTarget] = useState<ProductRecord | null>(null);
  const [imagesById, setImagesById] = useState<Record<string, ImageRecord>>({});
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesFailed, setImagesFailed] = useState(false);
  const [imagesRetry, setImagesRetry] = useState(0);

  const products = list.items;
  const categories = categoriesResource.data ?? [];
  const categoryFilter = list.filters.category_id ?? "";
  const hasQuery = Boolean(list.request.q);
  const hasCategory = Boolean(categoryFilter);
  const filtersActive = hasQuery || hasCategory;

  const imageIds = useMemo(
    () => [...new Set(products.map((product) => String(product.image_id)))],
    [products],
  );
  const imageIdsKey = imageIds.join("|");

  useEffect(() => {
    let active = true;
    const ids = imageIdsKey ? imageIdsKey.split("|") : [];
    if (ids.length === 0) return;

    async function loadImages() {
      setImagesLoading(true);
      setImagesFailed(false);
      try {
        const images = await fetchImagesByIds(ids);
        if (!active) return;
        setImagesById(
          Object.fromEntries(images.map((image) => [String(image.id), image])),
        );
      } catch {
        if (active) setImagesFailed(true);
      } finally {
        if (active) setImagesLoading(false);
      }
    }

    void loadImages();
    return () => {
      active = false;
    };
  }, [imageIdsKey, imagesRetry]);

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
  }));

  const chips: FilterChip[] = [];
  if (hasQuery) {
    chips.push({
      id: "q",
      label: `Búsqueda: ${list.request.q}`,
      onRemove: () => {
        list.setSearch("");
        list.commitSearch();
      },
    });
  }
  if (hasCategory) {
    chips.push({
      id: "category_id",
      label: `Categoría: ${
        categoryOptions.find((option) => option.value === categoryFilter)?.label ??
        `#${categoryFilter}`
      }`,
      onRemove: () => list.setFilter("category_id", ""),
    });
  }

  function categoryNameFor(id: ProductRecord["category_id"]) {
    return findById(categories, id)?.name ?? `Categoría #${id}`;
  }

  function imageSourceFor(product: ProductRecord) {
    return getImageSource(imagesById[String(product.image_id)]);
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

      <FilterBar
        activeCount={Number(hasQuery) + Number(hasCategory)}
        chips={chips}
        id="productos-filtros"
        loading={list.status === "loading"}
        onClear={list.clearFilters}
        results={
          list.status === "loading"
            ? "Cargando productos…"
            : list.status === "error" && products.length === 0
              ? "No se pudieron cargar los productos"
              : list.meta.total === 0
                ? "Sin productos"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="La búsqueda y los filtros se aplican en el servidor."
            id="buscar-productos"
            label="Buscar"
            loadOptions={async (query) => {
              const page = await fetchProductPage({ q: query, pageSize: 10 });
              return page.data.map((product) => ({
                value: String(product.id),
                label: product.name,
                description: product.reference,
              }));
            }}
            onSelect={(option) => {
              list.setSearch(option.label);
              list.commitSearch();
            }}
            onValueChange={list.setSearch}
            placeholder="Buscar por nombre, referencia o descripción"
            value={list.searchDraft}
          />
        }
      >
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
          onChange={(value) => list.setFilter("category_id", value)}
          onRetry={categoriesResource.reload}
          options={categoryOptions}
          placeholder="Todas las categorías"
          value={categoryFilter}
        />
        <SelectField
          help="El orden se aplica en el servidor y vuelve a la primera página."
          id="orden-productos"
          label="Ordenar por"
          onChange={(value) => {
            const [field, order] = value.split(":");
            list.setSort(field ?? "id", order === "desc" ? "desc" : "asc");
          }}
          options={[
            { value: "id:asc", label: "Más antiguos primero" },
            { value: "name:asc", label: "Nombre, A–Z" },
            { value: "name:desc", label: "Nombre, Z–A" },
            { value: "reference:asc", label: "Referencia, A–Z" },
            { value: "category_id:asc", label: "Categoría, A–Z" },
            { value: "tax_id:asc", label: "Impuesto" },
          ]}
          placeholder="Orden predeterminado"
          value={`${list.request.sort || "id"}:${list.request.order}`}
        />
      </FilterBar>

      {list.status === "loading" && <RecordsListSkeleton />}

      {list.status === "error" && products.length === 0 && (
        <RecordsLoadError
          description={list.error?.message ?? "No pudimos cargar los productos."}
          onRetry={list.reload}
          title="No pudimos cargar los productos"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && products.length === 0) && (
          <section aria-label="Listado de productos" className="space-y-4">
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && products.length > 0 && (
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
                  "No pudimos actualizar los productos. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {imagesFailed && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={() => setImagesRetry((current) => current + 1)}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                No pudimos cargar las imágenes. Las miniaturas se muestran como
                marcador.
              </NoticeBanner>
            )}

            {products.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={
                    canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/productos/nuevo"
                      >
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
                        : "Limpiar filtros"}
                    </button>
                  }
                  description={
                    list.isPageOutOfRange
                      ? `Hay ${formatInteger(
                          list.meta.total,
                        )} productos en total, pero esta página no tiene filas.`
                      : "No hay resultados con estos filtros. Ajusta la búsqueda o la categoría."
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : "Sin resultados con estos filtros."
                  }
                />
              )
            ) : (
              <RecordsTable
                busy={list.status === "refreshing"}
                caption="Productos del catálogo con su referencia, categoría y descripción"
                columns={columns}
                getRowKey={(product) => String(product.id)}
                getRowLabel={(product) => product.name}
                renderCard={renderCard}
                rowActions={renderActions}
                rows={products}
              />
            )}

            <PaginationControls
              meta={list.meta}
              onFirstPage={list.goToFirstPage}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
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
          list.reload();
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
