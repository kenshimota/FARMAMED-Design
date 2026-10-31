"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
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
  IMAGE_FIELD_IDS,
  imageSummaryItems,
  mapImageFieldErrors,
  type ImageFieldKey,
} from "@/components/erp/records/image-errors";
import {
  createImage,
  fetchImage,
  updateImage,
  type ImageInput,
} from "@/components/erp/records/images-api";
import { TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canWriteModule } from "@/lib/permissions";

type ImageFormValues = {
  reference: string;
  url: string;
  thumbnail: string;
  pathname: string;
};

const EMPTY_VALUES: ImageFormValues = {
  reference: "",
  url: "",
  thumbnail: "",
  pathname: "",
};

const URL_MAX_LENGTH = 2048;
const REFERENCE_MAX_LENGTH = 100;

const COPY = {
  referenceRequired: "Ingresa la referencia.",
  referenceTooLong: `La referencia no puede superar los ${REFERENCE_MAX_LENGTH} caracteres.`,
  urlRequired: "Ingresa la URL de la imagen.",
  urlInvalid: "Ingresa una URL válida para la imagen.",
  thumbnailRequired: "Ingresa la URL de la miniatura.",
  thumbnailInvalid: "Ingresa una URL válida para la miniatura.",
  pathnameTooLong: `La ruta no puede superar los ${URL_MAX_LENGTH} caracteres.`,
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe una imagen con esa referencia.",
  forbidden: "No tienes permisos para guardar imágenes.",
  notFound: "No encontramos esta imagen. Puede que haya sido eliminada.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic: "No pudimos guardar la imagen. Revisa tu conexión e intenta de nuevo.",
} as const;

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type ImageFormPageProps = {
  mode: "create" | "edit";
  imageId?: string;
};

export function ImageFormPage({ mode, imageId }: ImageFormPageProps) {
  const { user } = useSession();

  if (!canWriteModule(user.role, "catalogo")) {
    return (
      <AccessState description="Tu rol puede consultar imágenes, pero no registrarlas, editarlas ni eliminarlas. Tu sesión sigue activa." />
    );
  }

  if (mode === "edit" && !isPositiveRecordId(imageId)) {
    return (
      <RecordsLoadError
        backHref="/app/imagenes"
        backLabel="Volver a imágenes"
        description="Puede que el enlace no sea válido o que la imagen ya no exista."
        headingLevel="h1"
        title="No encontramos esta imagen"
      />
    );
  }

  return <ImageFormContent imageId={imageId} mode={mode} />;
}

function ImageFormContent({ mode, imageId }: ImageFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const imageLoader = useCallback(() => fetchImage(imageId ?? ""), [imageId]);
  const imageResource = useAsyncResource(imageLoader, { enabled: editing });

  const [values, setValues] = useState<ImageFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] =
    useState<ImageFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const image = imageResource.data;

  if (image) {
    const key = String(image.id);
    if (initializedFor !== key) {
      const next: ImageFormValues = {
        reference: image.reference,
        url: image.url,
        thumbnail: image.thumbnail ?? "",
        pathname: image.pathname ?? "",
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

  function clearFieldError(field: ImageFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: ImageFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    clearFieldError(field);
  }

  function validate() {
    const next: Record<string, string> = {};
    const reference = values.reference.trim();

    if (!reference) {
      next.reference = COPY.referenceRequired;
    } else if (reference.length > REFERENCE_MAX_LENGTH) {
      next.reference = COPY.referenceTooLong;
    }

    const url = values.url.trim();
    if (!url) {
      next.url = COPY.urlRequired;
    } else if (!isValidUrl(url)) {
      next.url = COPY.urlInvalid;
    }

    const thumbnail = values.thumbnail.trim();
    if (!thumbnail) {
      next.thumbnail = COPY.thumbnailRequired;
    } else if (!isValidUrl(thumbnail)) {
      next.thumbnail = COPY.thumbnailInvalid;
    }

    if (values.pathname.trim().length > URL_MAX_LENGTH) {
      next.pathname = COPY.pathnameTooLong;
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

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

    const pathname = values.pathname.trim();
    const payload: ImageInput = {
      reference: values.reference.trim(),
      url: values.url.trim(),
      thumbnail: values.thumbnail.trim(),
      pathname: pathname || null,
    };

    try {
      if (editing && imageId) {
        await updateImage(imageId, payload);
        toast.success("Cambios guardados.");
      } else {
        await createImage(payload);
        toast.success("Imagen registrada.");
      }

      setInitialValues(values);
      router.push("/app/imagenes");
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
          const duplicate = Boolean(
            caught.fieldErrors.reference ||
              caught.message.toLowerCase().includes("already exists"),
          );
          if (duplicate) {
            setErrors({ reference: COPY.duplicate });
            setShowSummary(true);
            setMessage(COPY.duplicate);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translateApiError(caught).message);
          }
        } else if (caught.status === 422) {
          const mapped = mapImageFieldErrors(caught);
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

  const headerTitle = editing ? "Editar imagen" : "Registrar imagen";
  const headerDescription = editing
    ? "Actualiza la referencia, la URL y la miniatura de la imagen. Los cambios reemplazan los datos registrados."
    : "Registra una imagen reutilizable por URL. No se suben archivos; la ruta del archivo es opcional.";

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/imagenes"
        >
          Volver a imágenes
        </Link>
      }
      description={headerDescription}
      eyebrow="Catálogo"
      title={headerTitle}
    />
  );

  if (editing && imageResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && imageResource.status === "error") {
    const notFound = imageResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/imagenes"
          backLabel="Volver a imágenes"
          description={
            notFound
              ? "Puede que haya sido eliminada o que el enlace no sea válido."
              : imageResource.error?.message ?? "No pudimos cargar la imagen."
          }
          onRetry={notFound ? undefined : imageResource.reload}
          title={
            notFound
              ? "No encontramos esta imagen"
              : "No pudimos cargar la imagen"
          }
        />
      </div>
    );
  }

  const summaryItems = imageSummaryItems(errors);

  return (
    <div className="space-y-5">
      {header}

      <NoticeBanner tone="info">
        La interfaz no sube archivos. Registra la URL de la imagen y de su
        miniatura; si el archivo solo está en S3, deja la ruta vacía.
      </NoticeBanner>

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Datos de la imagen</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-imagen"
            >
              {editing ? "Información registrada" : "Información de la nueva imagen"}
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
          aria-labelledby="datos-imagen"
          className="mt-6 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <TextField
              disabled={submitting}
              error={errors.reference}
              help="Obligatoria. Identifica la imagen dentro del catálogo."
              id={IMAGE_FIELD_IDS.reference}
              label="Referencia"
              maxLength={REFERENCE_MAX_LENGTH}
              onChange={(value) => updateField("reference", value)}
              required
              value={values.reference}
            />
            <TextField
              disabled={submitting}
              error={errors.pathname}
              help="Déjala vacía si la imagen solo está en S3."
              id={IMAGE_FIELD_IDS.pathname}
              label="Ruta del archivo (opcional)"
              maxLength={URL_MAX_LENGTH}
              mono
              onChange={(value) => updateField("pathname", value)}
              placeholder="/ruta/del/archivo.png"
              value={values.pathname}
            />
          </div>

          <TextField
            disabled={submitting}
            error={errors.url}
            help="Obligatoria. Debe ser una URL pública de la imagen."
            id={IMAGE_FIELD_IDS.url}
            inputMode="url"
            label="URL de la imagen"
            maxLength={URL_MAX_LENGTH}
            mono
            onChange={(value) => updateField("url", value)}
            placeholder="https://"
            required
            value={values.url}
          />

          <TextField
            disabled={submitting}
            error={errors.thumbnail}
            help="Obligatoria. Debe ser una URL pública de la miniatura."
            id={IMAGE_FIELD_IDS.thumbnail}
            inputMode="url"
            label="URL de la miniatura"
            maxLength={URL_MAX_LENGTH}
            mono
            onChange={(value) => updateField("thumbnail", value)}
            placeholder="https://"
            required
            value={values.thumbnail}
          />

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="button-base button-secondary min-h-11 px-5"
              href="/app/imagenes"
            >
              Cancelar
            </Link>
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="sm:min-w-[180px]"
              type="submit"
            >
              <span className="inline-flex items-center gap-2">
                {editing ? "Guardar cambios" : "Registrar imagen"}
                <Icon name="arrow-right" size={18} />
              </span>
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
