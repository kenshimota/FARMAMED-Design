"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  FormErrorSummary,
  focusFirstInvalidField,
  useUnsavedChangesWarning,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  PRODUCT_FIELD_IDS,
  mapProductFieldErrors,
  productSummaryItems,
  toApiId,
  type ProductFieldKey,
} from "@/components/erp/records/product-errors";
import { SelectField, TextAreaField, TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordThumbnail } from "@/components/erp/records/record-thumbnail";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  fetchCategories,
  fetchImages,
  fetchProduct,
  findById,
  getImagePreviewSource,
  isPositiveRecordId,
  parseProduct,
} from "@/components/erp/records/records-api";
import { ApiError, apiFetch } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canWriteModule } from "@/lib/permissions";
import { getStoredToken } from "@/lib/session";

type ProductFormValues = {
  name: string;
  description: string;
  reference: string;
  category_id: string;
  image_id: string;
};

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  description: "",
  reference: "",
  category_id: "",
  image_id: "",
};

const NAME_MAX_LENGTH = 150;
const REFERENCE_MAX_LENGTH = 100;

const COPY = {
  nameRequired: "Ingresa el nombre del producto.",
  nameTooLong: `El nombre no puede superar los ${NAME_MAX_LENGTH} caracteres.`,
  descriptionRequired: "Ingresa una descripción.",
  referenceRequired: "Ingresa la referencia.",
  referenceTooLong: `La referencia no puede superar los ${REFERENCE_MAX_LENGTH} caracteres.`,
  categoryRequired: "Selecciona una categoría.",
  imageRequired: "Selecciona una imagen.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe un producto con esa referencia.",
  forbidden: "No tienes permisos para guardar productos.",
  notFound: "No encontramos este producto. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic: "No pudimos guardar el producto. Revisa tu conexión e intenta de nuevo.",
  categoriesError: "No pudimos cargar las categorías.",
  imagesError: "No pudimos cargar las imágenes.",
} as const;

type ProductFormPageProps = {
  mode: "create" | "edit";
  productId?: string;
};

export function ProductFormPage({ mode, productId }: ProductFormPageProps) {
  const { user } = useSession();
  if (!canWriteModule(user.role, "catalogo")) return <AccessState />;
  if (mode === "edit" && !isPositiveRecordId(productId)) {
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
  return <ProductFormContent mode={mode} productId={productId} />;
}

function ProductFormContent({ mode, productId }: ProductFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const productLoader = useCallback(() => fetchProduct(productId ?? ""), [productId]);
  const productResource = useAsyncResource(productLoader, { enabled: editing });
  const categoriesResource = useAsyncResource(fetchCategories);
  const imagesResource = useAsyncResource(fetchImages);

  const [values, setValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const product = productResource.data;
  const categories = categoriesResource.data ?? [];
  const images = imagesResource.data ?? [];
  const categoriesReady = categoriesResource.data !== null && categoriesResource.status !== "error";
  const imagesReady = imagesResource.data !== null && imagesResource.status !== "error";
  const categoriesLoading = categoriesResource.status === "loading";
  const imagesLoading = imagesResource.status === "loading";

  if (product) {
    const key = String(product.id);
    if (initializedFor !== key) {
      const next: ProductFormValues = {
        name: product.name,
        description: product.description,
        reference: product.reference,
        category_id: String(product.category_id),
        image_id: String(product.image_id),
      };
      setValues(next);
      setInitialValues(next);
      setInitializedFor(key);
    }
  }

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  const selectedImage = findById(images, values.image_id);
  const selectedImageSource = getImagePreviewSource(selectedImage);
  const hasSelectedImageId = Boolean(values.image_id);
  const previewLoading = imagesLoading;

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
  }));
  const imageOptions = images.map((image) => ({
    value: String(image.id),
    label: image.reference,
  }));

  function clearFieldError(field: ProductFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: ProductFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    clearFieldError(field);
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = COPY.nameRequired;
    else if (values.name.trim().length > NAME_MAX_LENGTH) next.name = COPY.nameTooLong;

    if (!values.description.trim()) next.description = COPY.descriptionRequired;

    if (!values.reference.trim()) next.reference = COPY.referenceRequired;
    else if (values.reference.trim().length > REFERENCE_MAX_LENGTH) {
      next.reference = COPY.referenceTooLong;
    }

    if (!values.category_id) next.category_id = COPY.categoryRequired;
    if (!values.image_id) next.image_id = COPY.imageRequired;
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!categoriesReady || !imagesReady) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);

    const payload = {
      name: values.name.trim(),
      description: values.description.trim(),
      reference: values.reference.trim(),
      category_id: toApiId(values.category_id),
      image_id: toApiId(values.image_id),
    };

    try {
      const response = await apiFetch<unknown>(
        editing ? `/products/${encodeURIComponent(productId ?? "")}` : "/products",
        {
          method: editing ? "PUT" : "POST",
          token: getStoredToken() ?? undefined,
          body: JSON.stringify(payload),
        },
      );
      const saved = parseProduct(response);
      toast.success(editing ? "Cambios guardados." : "Producto creado.");
      setInitialValues(values);
      const targetId = saved?.id ?? productId;
      router.push(targetId ? `/app/productos/${targetId}` : "/app/productos");
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          setMessage(COPY.missingData);
        } else if (caught.status === 401) {
          setMessage(COPY.session);
        } else if (caught.status === 403) {
          setMessage(COPY.forbidden);
        } else if (caught.status === 404) {
          setMessage(COPY.notFound);
        } else if (caught.status === 409) {
          const duplicate =
            caught.fieldErrors.reference ||
            caught.message.toLowerCase().includes("already exists");
          if (duplicate) {
            setErrors({ reference: COPY.duplicate });
            setShowSummary(true);
            setMessage(COPY.duplicate);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translateApiError(caught).message);
          }
        } else if (caught.status === 422) {
          const mapped = mapProductFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            setMessage(null);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(COPY.validation);
          }
        } else {
          setMessage(translateApiError(caught).message);
        }
      } else {
        setMessage(COPY.generic);
      }
      setSubmitting(false);
    }
  }

  const headerTitle = editing ? "Editar producto" : "Nuevo producto";
  const backHref = editing && productId ? `/app/productos/${productId}` : "/app/productos";
  const backLabel = editing ? "Volver al detalle" : "Volver a productos";

  const header = (
    <RecordsPageHeader
      actions={
        <Link className="button-base button-secondary min-h-11 px-5 text-[13px]" href={backHref}>
          {backLabel}
        </Link>
      }
      description={
        editing
          ? "Actualiza los datos reales del producto. Los cambios reemplazan los cinco campos."
          : "Registra un producto con su categoría y su imagen existentes."
      }
      eyebrow="Catálogo"
      title={headerTitle}
    />
  );

  if (editing && productResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && productResource.status === "error") {
    const notFound = productResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/productos"
          backLabel="Volver a productos"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : productResource.error?.message ?? "No pudimos cargar el producto."
          }
          onRetry={notFound ? undefined : productResource.reload}
          title={notFound ? "No encontramos este producto" : "No pudimos cargar el producto"}
        />
      </div>
    );
  }

  const summaryItems = productSummaryItems(errors);
  const selectorsReady = categoriesReady && imagesReady;

  return (
    <div className="space-y-5">
      {header}

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Datos del producto</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-producto"
            >
              {editing ? "Información registrada" : "Información del nuevo producto"}
            </h2>
          </div>
          <span className="rounded-full bg-soft-blue px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
            Escritura habilitada
          </span>
        </div>

        {message && (
          <NoticeBanner className="mt-5" role="alert" tone="danger">
            {message}
          </NoticeBanner>
        )}

        {showSummary && summaryItems.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        <form
          aria-labelledby="datos-producto"
          className="mt-6 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <TextField
              disabled={submitting}
              error={errors.name}
              help={`Obligatorio. Máximo ${NAME_MAX_LENGTH} caracteres.`}
              id={PRODUCT_FIELD_IDS.name}
              label="Nombre del producto"
              maxLength={NAME_MAX_LENGTH}
              onChange={(value) => updateField("name", value)}
              placeholder="Ej. Ibuprofeno 400 mg"
              required
              value={values.name}
            />

            <TextField
              disabled={submitting}
              error={errors.reference}
              help="Obligatoria y única. Máximo 100 caracteres."
              id={PRODUCT_FIELD_IDS.reference}
              label="Referencia"
              maxLength={REFERENCE_MAX_LENGTH}
              onChange={(value) => updateField("reference", value)}
              placeholder="Ej. IBU-400"
              required
              value={values.reference}
            />

            <div className="lg:col-span-2">
              <TextAreaField
                disabled={submitting}
                error={errors.description}
                help={`Texto libre. ${values.description.length} caracteres.`}
                id={PRODUCT_FIELD_IDS.description}
                label="Descripción"
                onChange={(value) => updateField("description", value)}
                placeholder="Describe el producto sin agregar precio, impuesto ni existencias."
                required
                rows={5}
                value={values.description}
              />
            </div>

            <SelectField
              createHref="/app/categorias"
              createLabel="Crear categoría"
              disabled={submitting}
              error={errors.category_id}
              help="Selecciona una categoría existente del catálogo."
              id={PRODUCT_FIELD_IDS.category_id}
              label="Categoría"
              loadError={
                categoriesResource.status === "error" ? COPY.categoriesError : null
              }
              loading={categoriesLoading}
              loadingLabel="Cargando categorías…"
              onChange={(value) => updateField("category_id", value)}
              onRetry={categoriesResource.reload}
              options={categoryOptions}
              placeholder="Selecciona una categoría"
              required
              value={values.category_id}
            />

            <div>
              <SelectField
                createHref="/app/imagenes"
                createLabel="Registrar imagen"
                disabled={submitting}
                error={errors.image_id}
                help="La imagen se reutiliza desde el catálogo de imágenes."
                id={PRODUCT_FIELD_IDS.image_id}
                label="Imagen"
                loadError={imagesResource.status === "error" ? COPY.imagesError : null}
                loading={imagesLoading}
                loadingLabel="Cargando imágenes…"
                onChange={(value) => updateField("image_id", value)}
                onRetry={imagesResource.reload}
                options={imageOptions}
                placeholder="Selecciona una imagen"
                required
                value={values.image_id}
              />

              <div className="mt-3 rounded-2xl border border-line bg-background p-3">
                <p className="text-[12px] font-semibold text-ink">Vista previa</p>
                <RecordThumbnail
                  className="mt-2 h-40 w-full"
                  label={selectedImage?.reference ?? "vista previa"}
                  loading={previewLoading}
                  size="lg"
                  src={selectedImageSource}
                />
                <p aria-live="polite" className="mt-2 text-[11px] leading-5 text-muted">
                  {previewLoading
                    ? "Cargando vista previa…"
                    : selectedImage
                      ? `Referencia de la imagen: ${selectedImage.reference}`
                      : hasSelectedImageId
                        ? "No pudimos cargar la imagen seleccionada."
                        : "Selecciona una imagen para verla aquí."}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link className="button-base button-secondary min-h-11 px-5" href={backHref}>
              Cancelar
            </Link>
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="sm:min-w-[180px]"
              disabled={!selectorsReady}
              type="submit"
            >
              {editing ? "Guardar cambios" : "Crear producto"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
