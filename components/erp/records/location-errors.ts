import { ApiError } from "@/lib/api";
import type { FormErrorItem } from "@/components/erp/ui/form";

export const STATE_FIELD_IDS = {
  name: "estado-nombre",
  code: "estado-codigo",
} as const;

export const CITY_FIELD_IDS = {
  name: "ciudad-nombre",
  state_id: "ciudad-estado",
} as const;

export type StateFieldKey = keyof typeof STATE_FIELD_IDS;
export type CityFieldKey = keyof typeof CITY_FIELD_IDS;

const STATE_FIELD_LABELS: Record<StateFieldKey, string> = {
  name: "Nombre del estado",
  code: "Código",
};

const CITY_FIELD_LABELS: Record<CityFieldKey, string> = {
  name: "Nombre de la ciudad",
  state_id: "Estado",
};

const STATE_FIELD_MESSAGES: Record<StateFieldKey, string> = {
  name: "Ingresa un nombre de 2 a 100 caracteres.",
  code: "Ingresa un código de 2 a 10 caracteres sin espacios.",
};

const CITY_FIELD_MESSAGES: Record<CityFieldKey, string> = {
  name: "Ingresa un nombre de 2 a 100 caracteres.",
  state_id: "Selecciona un estado válido.",
};

const STATE_FIELD_ALIASES: Record<string, StateFieldKey> = {
  name: "name",
  code: "code",
};

const CITY_FIELD_ALIASES: Record<string, CityFieldKey> = {
  name: "name",
  state_id: "state_id",
  stateid: "state_id",
};

function mapFieldErrors<T extends string>(
  error: unknown,
  aliases: Record<string, T>,
  messages: Record<T, string>,
) {
  const mapped: Record<string, string> = {};
  if (!(error instanceof ApiError)) return mapped;

  for (const field of Object.keys(error.fieldErrors)) {
    const key = aliases[field.toLowerCase()];
    if (!key) continue;
    mapped[key] = messages[key];
  }

  return mapped;
}

export function mapStateFieldErrors(error: unknown) {
  return mapFieldErrors(error, STATE_FIELD_ALIASES, STATE_FIELD_MESSAGES);
}

export function mapCityFieldErrors(error: unknown) {
  return mapFieldErrors(error, CITY_FIELD_ALIASES, CITY_FIELD_MESSAGES);
}

export function stateSummaryItems(errors: Record<string, string>): FormErrorItem[] {
  return (Object.keys(STATE_FIELD_IDS) as StateFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: STATE_FIELD_IDS[key],
      label: STATE_FIELD_LABELS[key],
      message: errors[key],
    }));
}

export function citySummaryItems(errors: Record<string, string>): FormErrorItem[] {
  return (Object.keys(CITY_FIELD_IDS) as CityFieldKey[])
    .filter((key) => errors[key])
    .map((key) => ({
      fieldId: CITY_FIELD_IDS[key],
      label: CITY_FIELD_LABELS[key],
      message: errors[key],
    }));
}
