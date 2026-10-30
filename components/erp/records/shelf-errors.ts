import { ApiError } from "@/lib/api";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const SHELF_FIELD_IDS = {
  code: "estante-codigo",
  name: "estante-nombre",
  description: "estante-descripcion",
} as const;

export type ShelfFieldKey = keyof typeof SHELF_FIELD_IDS;

export const SHELF_FIELD_LABELS: Record<ShelfFieldKey, string> = {
  code: "Código",
  name: "Nombre",
  description: "Descripción",
};

const SHELF_FIELD_ALIASES: Record<string, ShelfFieldKey> = {
  code: "code",
  name: "name",
  description: "description",
};

const SHELF_FIELD_MESSAGES: Record<ShelfFieldKey, string> = {
  code: "Ingresa un código válido para el estante.",
  name: "Revisa el nombre del estante.",
  description: "Revisa la descripción del estante.",
};

export function mapShelfFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const field of Object.keys(error.fieldErrors)) {
    const key = SHELF_FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    mapped[key] = SHELF_FIELD_MESSAGES[key];
  }

  return mapped;
}

export function shelfSummaryItems(
  errors: Record<string, string>,
): FormErrorItem[] {
  return (Object.keys(SHELF_FIELD_IDS) as ShelfFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: SHELF_FIELD_IDS[key],
      label: SHELF_FIELD_LABELS[key],
      message: errors[key],
    }));
}

export const SECTION_FIELD_IDS = {
  code: "seccion-codigo",
  name: "seccion-nombre",
  description: "seccion-descripcion",
} as const;

export type SectionFieldKey = keyof typeof SECTION_FIELD_IDS;

export const SECTION_FIELD_LABELS: Record<SectionFieldKey, string> = {
  code: "Código",
  name: "Nombre",
  description: "Descripción",
};

const SECTION_FIELD_ALIASES: Record<string, SectionFieldKey> = {
  code: "code",
  name: "name",
  description: "description",
};

const SECTION_FIELD_MESSAGES: Record<SectionFieldKey, string> = {
  code: "Ingresa un código válido para la sección.",
  name: "Revisa el nombre de la sección.",
  description: "Revisa la descripción de la sección.",
};

export function mapSectionFieldErrors(error: unknown) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const field of Object.keys(error.fieldErrors)) {
    const key = SECTION_FIELD_ALIASES[field.toLowerCase()];
    if (!key) continue;
    mapped[key] = SECTION_FIELD_MESSAGES[key];
  }

  return mapped;
}

export function sectionSummaryItems(
  errors: Record<string, string>,
): FormErrorItem[] {
  return (Object.keys(SECTION_FIELD_IDS) as SectionFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: SECTION_FIELD_IDS[key],
      label: SECTION_FIELD_LABELS[key],
      message: errors[key],
    }));
}

export function hasImmutableParentError(
  error: unknown,
  parentField: "warehouse_id" | "shelf_id",
) {
  if (!(error instanceof ApiError) || error.status !== 422) return false;
  return Object.keys(error.fieldErrors).some(
    (field) => field.toLowerCase() === parentField,
  );
}

const LOTS_CONFLICT_MESSAGES = new Set(["shelf has lots", "section has lots"]);

export function isLotsConflict(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  return [error.message, ...Object.values(error.fieldErrors)].some((message) =>
    LOTS_CONFLICT_MESSAGES.has(message.trim().toLowerCase()),
  );
}
