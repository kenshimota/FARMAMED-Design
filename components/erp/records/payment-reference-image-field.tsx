"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Icon } from "@/components/icons";
import type { ImageRecord } from "@/components/erp/records/records-api";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const FILE_ACCEPT = "image/jpeg,image/png,image/webp";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const FILE_COPY = {
  invalidType: "El comprobante debe ser JPG, PNG o WebP.",
  tooLarge: "El comprobante no puede superar 5 MB.",
  oneFile: "Selecciona un solo comprobante.",
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

function validateFile(file: File) {
  const hasAllowedType = ALLOWED_MIME_TYPES.has(file.type);
  const hasAllowedExtension = ALLOWED_EXTENSIONS.has(fileExtension(file.name));

  if (!hasAllowedType || !hasAllowedExtension) return FILE_COPY.invalidType;
  if (file.size > MAX_FILE_BYTES) return FILE_COPY.tooLarge;
  return null;
}

type PaymentReferenceImageFieldProps = {
  id: string;
  file: File | null;
  currentImage: ImageRecord | null;
  referenceLabel: string;
  editing?: boolean;
  disabled?: boolean;
  error?: string | null;
  onFileSelected: (file: File | null, error: string | null) => void;
};

export function PaymentReferenceImageField({
  id,
  file,
  currentImage,
  referenceLabel,
  editing = false,
  disabled = false,
  error,
  onFileSelected,
}: PaymentReferenceImageFieldProps) {
  const helpId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const inputId = `${id}-archivo`;
  const describedBy = [helpId, error ? errorId : null].filter(Boolean).join(" ");
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const currentSource = currentImage
    ? currentImage.thumbnail || currentImage.url
    : null;
  const previewSource = previewUrl ?? currentSource;
  const previewUnavailable = !previewSource || failedSource === previewSource;

  function updatePreview(selected: File | null) {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    const url = selected ? URL.createObjectURL(selected) : null;
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setFailedSource(null);
  }

  function clearFile() {
    updatePreview(null);
    onFileSelected(null, null);
  }

  function handleFile(selected: File | null) {
    if (!selected) {
      clearFile();
      return;
    }
    const validationError = validateFile(selected);
    if (validationError) {
      updatePreview(null);
      onFileSelected(null, validationError);
      return;
    }
    updatePreview(selected);
    onFileSelected(selected, null);
  }

  function handleFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (list.length > 1) {
      updatePreview(null);
      onFileSelected(null, FILE_COPY.oneFile);
      return;
    }
    handleFile(list[0]);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    handleFiles(files);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    handleFiles(event.dataTransfer.files);
  }

  return (
    <section
      aria-labelledby={`${id}-titulo`}
      className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="eyebrow">Comprobante</span>
          <h2
            className="mt-3 text-lg font-semibold tracking-[-0.02em] text-ink"
            id={`${id}-titulo`}
          >
            {editing && currentImage
              ? "Reemplazar comprobante"
              : "Adjuntar comprobante"}
          </h2>
        </div>
        <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          Opcional
        </span>
      </div>

      <p className="mt-3 text-[12px] leading-5 text-muted" id={helpId}>
        Opcional. Formatos JPG, PNG o WebP. Máximo 5 MB.
        {editing && currentImage
          ? " Si reemplazas el comprobante, la imagen anterior se conserva para auditoría."
          : ""}
      </p>

      <div className="mt-4">
        <input
          accept={FILE_ACCEPT}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          className="peer sr-only"
          disabled={disabled}
          id={inputId}
          name="image"
          onChange={handleInputChange}
          type="file"
        />
        <label
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors motion-reduce:transition-none peer-focus-visible:ring-[3px] peer-focus-visible:ring-cyan/60 ${
            error ? "border-alert/50 bg-alert/[0.04]" : "border-line bg-background"
          } ${dragging ? "border-brand bg-soft-blue" : "hover:border-brand/50"} ${
            disabled ? "cursor-not-allowed opacity-60" : ""
          }`}
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
            {file
              ? "Cambiar comprobante"
              : editing && currentImage
                ? "Reemplazar comprobante"
                : "Adjuntar comprobante"}
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
              onClick={clearFile}
              type="button"
            >
              Quitar
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Vista previa
        </span>
        <div className="relative mt-2 flex min-h-40 items-center justify-center overflow-hidden rounded-2xl border border-line bg-background">
          {previewSource && !previewUnavailable ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`Comprobante del pago ${referenceLabel}`}
              className="max-h-64 w-full object-contain p-3"
              decoding="async"
              onError={() => setFailedSource(previewSource)}
              referrerPolicy="no-referrer"
              src={previewSource}
            />
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <Icon className="text-muted" name="image" size={26} />
              <span className="text-[11px] font-semibold text-muted">
                {previewSource && failedSource === previewSource
                  ? "No se pudo cargar el comprobante"
                  : "Sin comprobante"}
              </span>
            </div>
          )}

          {previewSource && !previewUnavailable && (
            <span
              className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                file ? "bg-soft-lime text-ink" : "bg-soft-blue text-brand"
              }`}
            >
              {file ? "Comprobante nuevo" : "Comprobante actual"}
            </span>
          )}
        </div>
        <p aria-live="polite" className="mt-2 text-[11px] leading-5 text-muted">
          {file
            ? "Vista previa temporal. El comprobante definitivo se muestra al guardar."
            : previewSource && failedSource === previewSource
              ? "No pudimos cargar la vista previa del comprobante actual."
              : editing && currentImage
                ? "Este es el comprobante vigente del pago."
                : "Aún no has adjuntado un comprobante."}
        </p>
      </div>

      {error && (
        <p
          className="mt-3 text-[12px] font-semibold leading-5 text-alert-ink"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}
