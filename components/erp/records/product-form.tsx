"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
  type ProductFieldKey,
} from "@/components/erp/records/product-errors";
import {
  ProductImageField,
  type ProductImageMode,
  type ProductImageValidation,
} from "@/components/erp/records/product-image-field";
import { SelectField, TextAreaField, TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  fetchCategories,
  fetchImages,
  fetchProduct,
  isPositiveRecordId,
  parseProduct,
  toApiId,
} from "@/components/erp/records/records-api";
import { ApiError, apiFetch } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import {
  fetchTaxes,
  formatTaxRate,
} from "@/lib/finance/taxes-api";
import { canWriteModule } from "@/lib/permissions";
import { getStoredToken } from "@/lib/session";

type ProductFormValues = {
  name: string;
  description: string;
  reference: string;
  category_id: string;
  tax_id: string;
  image_id: string;
};

const EMPTY_VALUES: ProductFormValues = {
  name: "",
  description: "",
  reference: "",
  category_id: "",
  tax_id: "",
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
  taxRequired: "Selecciona un impuesto.",
  imageRequired: "Selecciona una imagen o elige una existente.",
  imageTooLarge: "La imagen supera los 5 MB.",
  unexpectedFile:
    "No pudimos enviar el archivo. Revisa los datos del formulario e intenta de nuevo.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe un producto con esa referencia.",
  forbidden: "No tienes permiso para editar productos.",
  notFound: "No encontramos este producto. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic: "No pudimos guardar el producto. Revisa tu conexión e intenta de nuevo.",
  categoriesError: "No pudimos cargar las categorías.",
  taxesError: "No pudimos cargar los impuestos.",
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
  const { user } = useSession();
  const canManageTaxes = canWriteModule(user.role, "impuestos");
  const editing = mode === "edit";
  const productLoader = useCallback(() => fetchProduct(productId ?? ""), [productId]);
  const productResource = useAsyncResource(productLoader, { enabled: editing });
  const categoriesResource = useAsyncResource(fetchCategories);
  const taxesResource = useAsyncResource(fetchTaxes);
  const imagesResource = useAsyncResource(fetchImages);

  const [values, setValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] = useState<ProductFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageMode, setImageMode] = useState<ProductImageMode>("upload");
  const [initialImageMode, setInitialImageMode] =
    useState<ProductImageMode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileValidation, setFileValidation] = useState<ProductImageValidation>({
    checking: false,
    error: null,
  });
  const filePreviewUrlRef = useRef<string | null>(null);
  const fileChecking = fileValidation.checking;

  useEffect(() => {
    return () => {
      if (filePreviewUrlRef.current) {
        URL.revokeObjectURL(filePreviewUrlRef.current);
      }
    };
  }, []);

  const product = productResource.data;
  const categories = categoriesResource.data ?? [];
  const taxes = taxesResource.data ?? [];
  const images = imagesResource.data ?? [];
  const categoriesReady = categoriesResource.data !== null && categoriesResource.status !== "error";
  const taxesReady =
    taxesResource.data !== null &&
    taxesResource.data.length > 0 &&
    taxesResource.status !== "error";
  const imagesReady = imagesResource.data !== null && imagesResource.status !== "error";
  const categoriesLoading = categoriesResource.status === "loading";
  const taxesLoading = taxesResource.status === "loading";
  const taxesEmpty =
    taxesResource.data !== null &&
    taxesResource.data.length === 0 &&
    taxesResource.status !== "error";

  if (product) {
    const key = String(product.id);
    if (initializedFor !== key) {
      const next: ProductFormValues = {
        name: product.name,
        description: product.description,
        reference: product.reference,
        category_id: String(product.category_id),
        tax_id: product.tax_id === null ? "" : String(product.tax_id),
        image_id: String(product.image_id),
      };
      const nextImageMode: ProductImageMode = product.image_id
        ? "existing"
        : "upload";
      setValues(next);
      setInitialValues(next);
      setImageMode(nextImageMode);
      setInitialImageMode(nextImageMode);
      setSelectedFile(null);
      setFileValidation({ checking: false, error: null });
      setInitializedFor(key);
    }
  }

  const dirty = useMemo(
    () =>
      JSON.stringify(values) !== JSON.stringify(initialValues) ||
      imageMode !== initialImageMode ||
      selectedFile !== null,
    [imageMode, initialImageMode, initialValues, selectedFile, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  const categoryOptions = categories.map((category) => ({
    value: String(category.id),
    label: category.name,
  }));

  const taxOptions = taxes.map((tax) => ({
    value: String(tax.id),
    label: `${tax.code} — ${tax.name} (${formatTaxRate(tax.rate)})`,
  }));

  const selectedTax = taxes.find(
    (tax) => String(tax.id) === values.tax_id,
  );
  const taxHelp = selectedTax
    ? `Tasa ${formatTaxRate(selectedTax.rate)}. Este impuesto se aplica al producto. No calcula totales en pedidos ni facturas.`
    : "Este impuesto se aplica al producto. No calcula totales en pedidos ni facturas.";

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

  function handleImageModeChange(nextMode: ProductImageMode) {
    setImageMode(nextMode);
    setMessage(null);
  }

  function handleSelectedImageIdChange(imageId: string) {
    setValues((current) => ({ ...current, image_id: imageId }));
    setMessage(null);
    clearFieldError("image");
  }

  function releaseFilePreview() {
    if (filePreviewUrlRef.current) {
      URL.revokeObjectURL(filePreviewUrlRef.current);
      filePreviewUrlRef.current = null;
    }
  }

  function handleFileSelected(file: File | null) {
    setSelectedFile(file);
    setMessage(null);
    releaseFilePreview();
    if (file) {
      const url = URL.createObjectURL(file);
      filePreviewUrlRef.current = url;
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl(null);
    }
    clearFieldError("image");
  }

  function handleFileValidationChange(validation: ProductImageValidation) {
    setFileValidation(validation);
    setErrors((current) => {
      if (!validation.error) {
        if (!current.image) return current;
        const next = { ...current };
        delete next.image;
        return next;
      }
      return { ...current, image: validation.error };
    });
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

    if (!values.tax_id || !selectedTax) next.tax_id = COPY.taxRequired;

    if (imageMode === "upload") {
      if (fileValidation.error) next.image = fileValidation.error;
      else if (!selectedFile) next.image = COPY.imageRequired;
    } else if (!values.image_id) {
      next.image = COPY.imageRequired;
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || fileChecking) return;
    if (!categoriesReady || !taxesReady) return;
    if (imageMode === "existing" && !imagesReady) return;

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

    const name = values.name.trim();
    const description = values.description.trim();
    const reference = values.reference.trim();
    const categoryId = String(toApiId(values.category_id));
    const taxId = String(toApiId(values.tax_id));

    let body: FormData | string;
    if (imageMode === "upload" && selectedFile) {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("description", description);
      formData.set("reference", reference);
      formData.set("category_id", categoryId);
      formData.set("tax_id", taxId);
      formData.set("image", selectedFile);
      body = formData;
    } else {
      body = JSON.stringify({
        name,
        description,
        reference,
        category_id: toApiId(values.category_id),
        tax_id: toApiId(values.tax_id),
        image_id: toApiId(values.image_id),
      });
    }

    try {
      const response = await apiFetch<unknown>(
        editing ? `/products/${encodeURIComponent(productId ?? "")}` : "/products",
        {
          method: editing ? "PUT" : "POST",
          token: getStoredToken() ?? undefined,
          body,
        },
      );
      const saved = parseProduct(response);
      const savedImageId = saved?.image_id
        ? String(saved.image_id)
        : values.image_id;
      const nextValues = { ...values, image_id: savedImageId };
      toast.success("Producto guardado.");
      setValues(nextValues);
      setInitialValues(nextValues);
      setInitialImageMode(imageMode);
      setSelectedFile(null);
      releaseFilePreview();
      setFilePreviewUrl(null);
      setFileValidation({ checking: false, error: null });
      const targetId = saved?.id ?? productId;
      router.push(targetId ? `/app/productos/${targetId}` : "/app/productos");
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          const rawMessage = caught.message.toLowerCase();
          if (caught.fieldErrors.tax_id) {
            setErrors({ tax_id: COPY.taxRequired });
            setShowSummary(true);
            setMessage(null);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else if (rawMessage.includes("image or image_id")) {
            setErrors({ image: COPY.imageRequired });
            setShowSummary(true);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else if (rawMessage.includes("unexpected field")) {
            setMessage(COPY.unexpectedFile);
          } else if (rawMessage.includes("tax_id")) {
            setErrors({ tax_id: COPY.taxRequired });
            setShowSummary(true);
            setMessage(null);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(COPY.missingData);
          }
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
            setShowSummary(false);
            setMessage(null);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translateApiError(caught).message);
          }
        } else if (caught.status === 413) {
          setErrors({ image: COPY.imageTooLarge });
          setShowSummary(false);
          setMessage(null);
          window.requestAnimationFrame(() => focusFirstInvalidField());
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
    } finally {
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
          ? "Actualiza los datos reales del producto, su impuesto y su imagen."
          : "Registra un producto con su impuesto, categoría y una imagen nueva o existente."
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
  const selectorsReady =
    categoriesReady && taxesReady && (imageMode === "upload" || imagesReady);
  const busy = submitting || fileChecking;

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
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] md:items-start">
            <div className="grid gap-5 xl:grid-cols-2">
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

              <div className="xl:col-span-2">
                <TextAreaField
                  disabled={submitting}
                  error={errors.description}
                  help={`Texto libre. ${values.description.length} caracteres.`}
                  id={PRODUCT_FIELD_IDS.description}
                  label="Descripción"
                  onChange={(value) => updateField("description", value)}
                  placeholder="Describe el producto sin agregar precio ni existencias."
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
                  categoriesResource.status === "error"
                    ? COPY.categoriesError
                    : null
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
                  disabled={submitting}
                  emptyLabel="No hay impuestos disponibles."
                  error={errors.tax_id}
                  help={taxHelp}
                  id={PRODUCT_FIELD_IDS.tax_id}
                  label="Impuesto"
                  loadError={
                    taxesResource.status === "error"
                      ? COPY.taxesError
                      : null
                  }
                  loading={taxesLoading}
                  loadingLabel="Cargando impuestos…"
                  onChange={(value) => updateField("tax_id", value)}
                  onRetry={taxesResource.reload}
                  options={taxOptions}
                  placeholder="Selecciona un impuesto"
                  required
                  value={values.tax_id}
                />

                {taxesEmpty && (
                  <div
                    className="mt-2 rounded-xl border border-olive/35 bg-soft-lime px-3 py-3 text-[12px] leading-5 text-ink"
                    role="status"
                  >
                    <p className="font-semibold">El catálogo de impuestos está vacío.</p>
                    <p className="mt-1 text-muted">
                      Un administrador debe crearlos antes de registrar productos.
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                        onClick={taxesResource.reload}
                        type="button"
                      >
                        Reintentar
                      </button>
                      {canManageTaxes && (
                        <Link
                          aria-label="Ir a impuestos para administrar el catálogo fiscal"
                          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                          href="/app/impuestos"
                        >
                          Ir a impuestos
                          <Icon name="arrow-up-right" size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {!taxesEmpty && canManageTaxes && (
                  <Link
                    aria-label="Ir a impuestos para administrar el catálogo fiscal"
                    className="mt-2 inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                    href="/app/impuestos"
                  >
                    Ir a impuestos
                    <Icon name="arrow-up-right" size={14} />
                  </Link>
                )}
              </div>
            </div>

            <ProductImageField
              disabled={submitting}
              editing={editing}
              fieldError={errors.image}
              file={selectedFile}
              fileChecking={fileChecking}
              id={PRODUCT_FIELD_IDS.image}
              images={images}
              imagesError={
                imagesResource.status === "error" ? COPY.imagesError : null
              }
              imagesStatus={imagesResource.status}
              mode={imageMode}
              onFileSelected={handleFileSelected}
              onFileValidationChange={handleFileValidationChange}
              onModeChange={handleImageModeChange}
              onRetryImages={imagesResource.reload}
              onSelectedImageIdChange={handleSelectedImageIdChange}
              previewUrl={filePreviewUrl}
              selectedImageId={values.image_id}
            />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link className="button-base button-secondary min-h-11 px-5" href={backHref}>
              Cancelar
            </Link>
            <BusyButton
              busy={busy}
              busyLabel={fileChecking ? "Revisando imagen…" : "Guardando…"}
              className="sm:min-w-[180px]"
              disabled={!selectorsReady}
              type="submit"
            >
              {editing ? "Guardar cambios" : "Guardar producto"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
