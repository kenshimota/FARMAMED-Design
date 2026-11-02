"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { Skeleton } from "@/components/erp/ui/skeleton";
import {
  getImageDisplayName,
  getImageSource,
  type ImageRecord,
} from "@/components/erp/records/records-api";
import type { AsyncResourceStatus } from "@/components/erp/ui/use-async-resource";

export type ProductImageMode = "upload" | "existing";

export type ProductImageValidation = {
  checking: boolean;
  error: string | null;
};

type ProductImageFieldProps = {
  id: string;
  mode: ProductImageMode;
  onModeChange: (mode: ProductImageMode) => void;
  images: ImageRecord[];
  imagesStatus: AsyncResourceStatus;
  imagesError: string | null;
  onRetryImages: () => void;
  selectedImageId: string;
  onSelectedImageIdChange: (id: string) => void;
  file: File | null;
  previewUrl: string | null;
  onFileSelected: (file: File | null) => void;
  fileChecking: boolean;
  onFileValidationChange: (validation: ProductImageValidation) => void;
  fieldError?: string;
  disabled?: boolean;
  editing?: boolean;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_DIMENSION = 6000;
const MAX_PIXELS = 25 * 1000 * 1000;
const FILE_ACCEPT = "image/jpeg,image/png,image/webp";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const FILE_COPY = {
  invalidType: "Usa una imagen JPEG, PNG o WebP.",
  tooLarge: "La imagen supera los 5 MB.",
  invalidDimensions: "La imagen supera el tamaño permitido.",
  unreadable:
    "No pudimos leer la imagen. Usa un archivo JPEG, PNG o WebP.",
  oneFile: "Selecciona un solo archivo.",
} as const;

const sizeFormatter = new Intl.NumberFormat("es-VE", {
  maximumFractionDigits: 1,
});

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${sizeFormatter.format(bytes / (1024 * 1024))} MB`;
  }
  if (bytes >= 1024) {
    return `${sizeFormatter.format(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function fileExtension(name: string) {
  const extension = name.split(".").pop();
  return extension ? extension.toLowerCase() : "";
}

function isClearlyInvalidMimeType(type: string) {
  if (!type || type === "application/octet-stream") return false;
  if (ALLOWED_MIME_TYPES.has(type)) return false;

  return (
    type.startsWith("image/") ||
    type.startsWith("video/") ||
    type.startsWith("audio/") ||
    type.startsWith("text/") ||
    type === "application/pdf"
  );
}

function validateFileBasics(file: File) {
  const hasAllowedType = ALLOWED_MIME_TYPES.has(file.type);
  const hasAllowedExtension = ALLOWED_EXTENSIONS.has(fileExtension(file.name));

  if (!hasAllowedType) {
    if (isClearlyInvalidMimeType(file.type)) return FILE_COPY.invalidType;
    if (!hasAllowedExtension) return FILE_COPY.invalidType;
  }

  if (file.size > MAX_FILE_BYTES) return FILE_COPY.tooLarge;

  return null;
}

type ImageDimensions = {
  width: number;
  height: number;
};

async function readImageDimensions(file: File): Promise<ImageDimensions | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      return readDimensionsWithImage(file);
    }
  }

  return readDimensionsWithImage(file);
}

function readDimensionsWithImage(file: File): Promise<ImageDimensions | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function dimensionsError(dimensions: ImageDimensions | null) {
  if (!dimensions) return FILE_COPY.unreadable;

  const { width, height } = dimensions;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  ) {
    return FILE_COPY.unreadable;
  }

  if (
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION ||
    width * height > MAX_PIXELS
  ) {
    return FILE_COPY.invalidDimensions;
  }

  return null;
}

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

function GalleryThumbnail({ image }: { image: ImageRecord }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = getImageSource(image);
  const unavailable = !source || failedSource === source;

  return (
    <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-xl border border-line bg-background">
      {unavailable ? (
        <Icon aria-hidden="true" className="text-muted" name="image" size={24} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full object-contain p-2"
          loading="lazy"
          onError={() => setFailedSource(source)}
          referrerPolicy="no-referrer"
          src={source}
        />
      )}
    </span>
  );
}

export function ProductImageField({
  id,
  mode,
  onModeChange,
  images,
  imagesStatus,
  imagesError,
  onRetryImages,
  selectedImageId,
  onSelectedImageIdChange,
  file,
  previewUrl,
  onFileSelected,
  fileChecking,
  onFileValidationChange,
  fieldError,
  disabled = false,
  editing = false,
}: ProductImageFieldProps) {
  const helpId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const searchId = `${id}-buscar`;
  const inputId = `${id}-archivo`;
  const describedBy = [helpId, fieldError ? errorId : null]
    .filter(Boolean)
    .join(" ");
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState(false);
  const [failedPreview, setFailedPreview] = useState<string | null>(null);
  const validationRun = useRef(0);

  useEffect(() => {
    return () => {
      validationRun.current += 1;
    };
  }, []);

  function clearFile() {
    validationRun.current += 1;
    onFileSelected(null);
    onFileValidationChange({ checking: false, error: null });
  }

  const orderedImages = useMemo(
    () => [...images].sort(compareImageIds),
    [images],
  );

  const imageIndexes = useMemo(
    () =>
      new Map(
        orderedImages.map((image, index) => [String(image.id), index] as const),
      ),
    [orderedImages],
  );

  const selectedImage = useMemo(
    () =>
      orderedImages.find((image) => String(image.id) === selectedImageId) ??
      null,
    [orderedImages, selectedImageId],
  );

  const selectedImageName = getImageDisplayName(
    selectedImage,
    selectedImage ? imageIndexes.get(String(selectedImage.id)) : undefined,
  );
  const previewSource =
    mode === "upload" ? previewUrl : getImageSource(selectedImage);
  const previewUnavailable =
    !previewSource || failedPreview === previewSource;

  const filteredImages = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    if (!normalizedQuery) return orderedImages;
    return orderedImages.filter((image) => {
      const imageName = getImageDisplayName(
        image,
        imageIndexes.get(String(image.id)),
      );
      return (
        normalizeSearch(image.reference).includes(normalizedQuery) ||
        normalizeSearch(imageName).includes(normalizedQuery)
      );
    });
  }, [imageIndexes, orderedImages, query]);

  function selectMode(nextMode: ProductImageMode) {
    if (disabled || nextMode === mode) return;
    setDragging(false);
    setQuery("");
    clearFile();
    onModeChange(nextMode);
  }

  function handleFile(fileToValidate: File | null) {
    if (!fileToValidate) {
      clearFile();
      return;
    }

    const run = validationRun.current + 1;
    validationRun.current = run;
    onFileSelected(fileToValidate);

    const basicError = validateFileBasics(fileToValidate);
    if (basicError) {
      onFileValidationChange({ checking: false, error: basicError });
      return;
    }

    onFileValidationChange({ checking: true, error: null });
    void readImageDimensions(fileToValidate).then((dimensions) => {
      if (validationRun.current !== run) return;
      onFileValidationChange({
        checking: false,
        error: dimensionsError(dimensions),
      });
    });
  }

  function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (list.length > 1) {
      clearFile();
      onFileValidationChange({ checking: false, error: FILE_COPY.oneFile });
      return;
    }
    handleFile(list[0]);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length === 0) return;
    if (files.length > 1) {
      handleFiles(files);
      return;
    }
    handleFile(files[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  }

  const tabClass = (active: boolean) =>
    `flex min-h-11 items-center justify-center rounded-xl border px-3 text-[12px] font-semibold transition-colors focus-within:ring-[3px] focus-within:ring-cyan/60 motion-reduce:transition-none ${
      active
        ? "border-brand bg-soft-blue text-brand"
        : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink"
    }`;

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="eyebrow">Imagen del producto</span>
          <h2
            className="mt-3 text-lg font-semibold tracking-[-0.02em] text-ink"
            id={`${id}-titulo`}
          >
            Elige la imagen
          </h2>
        </div>
        <span className="rounded-full bg-soft-lime px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
          Obligatoria
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-5 text-muted" id={helpId}>
        Obligatoria. Formatos JPEG, PNG o WebP. Máximo 5 MB. Hasta 6000 × 6000
        px y 25 MP. La miniatura se genera automáticamente.
      </p>

      {editing && mode === "upload" && (
        <p className="mt-2 rounded-xl border border-brand/15 bg-soft-blue px-3 py-2 text-[11px] leading-5 text-ink">
          Al subir una imagen nueva, la imagen anterior seguirá disponible en el
          catálogo y no se eliminará.
        </p>
      )}

      <div
        aria-describedby={describedBy}
        aria-label="Origen de la imagen"
        className="mt-4 grid grid-cols-2 gap-2"
        id={id}
        role="group"
        tabIndex={-1}
      >
        <label className={tabClass(mode === "upload")}>
          <input
            checked={mode === "upload"}
            className="sr-only"
            disabled={disabled}
            name={`${id}-origen`}
            onChange={() => selectMode("upload")}
            type="radio"
            value="upload"
          />
          Subir archivo
        </label>
        <label className={tabClass(mode === "existing")}>
          <input
            checked={mode === "existing"}
            className="sr-only"
            disabled={disabled}
            name={`${id}-origen`}
            onChange={() => selectMode("existing")}
            type="radio"
            value="existing"
          />
          Imagen existente
        </label>
      </div>

      {mode === "upload" ? (
        <div className="mt-4">
          <input
            accept={FILE_ACCEPT}
            aria-describedby={describedBy}
            aria-invalid={fieldError ? true : undefined}
            aria-required="true"
            className="peer sr-only"
            disabled={disabled}
            id={inputId}
            name="image"
            onChange={handleInputChange}
            type="file"
          />
          <label
            className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors motion-reduce:transition-none peer-focus-visible:ring-[3px] peer-focus-visible:ring-cyan/60 ${
              fieldError ? "border-alert/50 bg-alert/[0.04]" : "border-line bg-background"
            } ${
              dragging ? "border-brand bg-soft-blue" : "hover:border-brand/50"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            htmlFor={inputId}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!disabled) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface text-brand">
              <Icon name="image" size={22} />
            </span>
            <span className="text-[13px] font-semibold text-ink">
              {file ? "Cambiar imagen" : "Subir imagen"}
            </span>
            <span className="text-[12px] leading-5 text-muted">
              Arrastra una imagen aquí o selecciona un archivo.
            </span>
          </label>

          {file && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-background px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold text-ink">
                  {file.name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                className="min-h-11 rounded-full border border-ink/15 px-3 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
                disabled={disabled}
                onClick={() => handleFile(null)}
                type="button"
              >
                Quitar
              </button>
            </div>
          )}

          <p aria-live="polite" className="mt-2 text-[11px] leading-5 text-muted">
            {fileChecking
              ? "Revisando la imagen…"
              : file
                ? "Vista previa temporal. La imagen definitiva se muestra al guardar."
                : "Aún no has seleccionado un archivo."}
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label
              className="mb-2 block text-[12px] font-semibold text-ink"
              htmlFor={searchId}
            >
              Buscar imagen existente
            </label>
            <div className="relative">
              <Icon
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                name="search"
                size={16}
              />
              <input
                className="h-11 w-full rounded-xl border border-ink/15 bg-surface pl-9 pr-3 text-[13px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                id={searchId}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre o referencia"
                type="search"
                value={query}
              />
            </div>
          </div>

          <div
            aria-describedby={describedBy}
            aria-invalid={fieldError ? true : undefined}
            tabIndex={-1}
          >
            {imagesStatus === "loading" ? (
            <div aria-busy="true" role="status">
              <span className="sr-only">Cargando imágenes…</span>
              <div aria-hidden="true" className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    className="rounded-2xl border border-line p-2"
                    key={index}
                  >
                    <Skeleton className="aspect-[4/3] w-full" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                  </div>
                ))}
              </div>
            </div>
          ) : imagesStatus === "error" ? (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                  onClick={onRetryImages}
                  type="button"
                >
                  Reintentar
                </button>
              }
              tone="warning"
            >
              {imagesError ?? "No pudimos cargar las imágenes."}
            </NoticeBanner>
          ) : images.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-background px-4 py-5 text-center">
              <p className="text-[12px] font-semibold text-ink">
                No hay imágenes registradas.
              </p>
              <p className="mt-1 text-[11px] leading-5 text-muted">
                Puedes subir un archivo o registrar imágenes desde el módulo de
                imágenes.
              </p>
              <Link
                className="mt-2 inline-flex min-h-11 items-center text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href="/app/imagenes"
              >
                Ir a imágenes
              </Link>
            </div>
          ) : filteredImages.length === 0 ? (
            <p className="rounded-2xl border border-line bg-background px-4 py-4 text-center text-[12px] text-muted">
              No hay imágenes que coincidan con la búsqueda.
            </p>
          ) : (
            <div
              aria-describedby={describedBy}
              aria-label="Imágenes disponibles"
              aria-required="true"
              className="grid grid-cols-2 gap-3"
              role="radiogroup"
            >
              {filteredImages.map((image) => {
                const imageName = getImageDisplayName(
                  image,
                  imageIndexes.get(String(image.id)),
                );
                const checked = selectedImageId === String(image.id);

                return (
                  <label
                    className={`relative cursor-pointer rounded-2xl border p-2 transition-colors focus-within:ring-[3px] focus-within:ring-cyan/60 motion-reduce:transition-none ${
                      checked
                        ? "border-brand bg-soft-blue shadow-[0_0_0_1px_var(--brand)]"
                        : "border-line bg-surface hover:border-brand/40"
                    } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                    key={String(image.id)}
                  >
                    <input
                      aria-describedby={describedBy}
                      checked={checked}
                      className="sr-only"
                      disabled={disabled}
                      name={`${id}-imagen`}
                      onChange={() => {
                        clearFile();
                        onSelectedImageIdChange(String(image.id));
                      }}
                      type="radio"
                      value={String(image.id)}
                    />
                    <GalleryThumbnail image={image} />
                    <span className="mt-2 block truncate text-[11px] font-semibold text-ink">
                      {imageName}
                    </span>
                    {checked && (
                      <span
                        aria-hidden="true"
                        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"
                      >
                        <Icon name="check" size={14} />
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Vista previa
        </span>
        <div className="relative mt-2 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-line bg-background">
          {previewSource && !previewUnavailable ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={
                mode === "upload"
                  ? "Vista previa temporal de la imagen seleccionada"
                  : `Miniatura de ${selectedImageName}`
              }
              className="h-full w-full object-contain p-3"
              decoding="async"
              onError={() => setFailedPreview(previewSource)}
              referrerPolicy="no-referrer"
              src={previewSource}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <Icon className="text-muted" name="image" size={26} />
              <span className="text-[11px] font-semibold text-muted">
                {mode === "upload"
                  ? "Aún no hay una vista previa."
                  : "Selecciona una imagen para verla aquí."}
              </span>
            </div>
          )}

          {previewSource && !previewUnavailable && (
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                mode === "upload"
                  ? "bg-soft-lime text-ink"
                  : "bg-soft-blue text-brand"
              }`}
            >
              {mode === "upload" ? "Imagen temporal" : "Miniatura"}
            </span>
          )}
        </div>
      </div>

      {fieldError && (
        <p
          className="mt-3 text-[12px] font-semibold leading-5 text-alert-ink"
          id={errorId}
          role="alert"
        >
          {fieldError}
        </p>
      )}
    </section>
  );
}
