import { ApiError } from "@/lib/api";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const IMAGE_FIELD_IDS = {
  reference: "imagen-referencia",
  url: "imagen-url",
  thumbnail: "imagen-miniatura",
  pathname: "imagen-ruta",
} as const;

export type ImageFieldKey = keyof typeof IMAGE_FIELD_IDS;

export const IMAGE_FIELD_LABELS: Record<ImageFieldKey, string> = {
  reference: "Referencia",
  url: "URL de la imagen",
  thumbnail: "URL de la miniatura",
  pathname: "Ruta del archivo",
};

const FIELD_ALIASES: Record<string, ImageFieldKey> = {
  reference: "reference",
  url: "url",
  thumbnail: "thumbnail",
  pathname: "pathname",
};

const FIELD_MESSAGES: Record<ImageFieldKey, string> = {
  reference: "Ingresa una referencia válida.",
  url: "Ingresa una URL válida para la imagen.",
  thumbnail: "Ingresa una URL válida para la miniatura.",
  pathname: "Ingresa una ruta válida o déjala vacía.",
};

export function mapImageFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const [field] of Object.entries(error.fieldErrors)) {
    const key = FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    mapped[key] = FIELD_MESSAGES[key];
  }

  return mapped;
}

export function imageSummaryItems(errors: Record<string, string>): FormErrorItem[] {
  return (Object.keys(IMAGE_FIELD_IDS) as ImageFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: IMAGE_FIELD_IDS[key],
      label: IMAGE_FIELD_LABELS[key],
      message: errors[key],
    }));
}
