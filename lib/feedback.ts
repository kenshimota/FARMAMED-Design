export const SUCCESS_MESSAGES = {
  created: "Registro creado.",
  saved: "Cambios guardados.",
  deleted: "Registro eliminado.",
  purchaseConfirmed: "Compra confirmada. Se actualizaron costos y existencias.",
} as const;

export function successMessageForStatus(status: number) {
  if (status === 204) return SUCCESS_MESSAGES.deleted;
  if (status === 201) return SUCCESS_MESSAGES.created;
  return SUCCESS_MESSAGES.saved;
}

export const CURRENCY_NOT_CONFIGURED = "La moneda de transacciones no está configurada.";

export const CURRENCY_NOT_CONFIGURED_DETAIL =
  "La moneda de transacciones no está configurada. Contacta a un administrador.";

export const PURCHASE_WITHOUT_ITEMS =
  "Esta compra no tiene productos. Ábrela para agregar líneas antes de confirmar.";

export const LARGE_LIST_THRESHOLD = 200;

export const LARGE_LIST_NOTICE =
  "Este listado supera las 200 filas. Usa la búsqueda o los filtros para encontrar lo que necesitas.";

export const RECOVERY_COOLDOWN_SECONDS = 120;

export const RECOVERY_CODE_TTL_SECONDS = 300;

export const SUCCESS_TOAST_DURATION_MS = 5000;
