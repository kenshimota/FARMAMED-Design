import { ApiError } from "@/lib/api";
import { CURRENCY_NOT_CONFIGURED } from "@/lib/feedback";

export type UiErrorKind =
  | "network"
  | "bad-request"
  | "session-expired"
  | "blocked"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "validation"
  | "rate-limit"
  | "mail"
  | "currency"
  | "server";

export type UiError = {
  kind: UiErrorKind;
  message: string;
  fieldErrors: Record<string, string>;
  canRetry: boolean;
  status: number | null;
  retryAfterSeconds: number | null;
};

export const COPY = {
  network: "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
  badRequest: "Faltan datos obligatorios. Revisa el formulario.",
  sessionExpired: "Tu sesión expiró. Inicia sesión de nuevo.",
  blocked: "Tu cuenta está bloqueada. Contacta a un administrador.",
  forbidden: "No tienes permisos para esta acción.",
  notFound: "No encontramos este registro.",
  conflictFallback: "No pudimos completar la acción por un conflicto con la información existente.",
  validation: "Revisa los datos del formulario.",
  invalidField: "Este valor no es válido.",
  rateLimit: "Demasiadas solicitudes. Espera un momento e intenta de nuevo.",
  mail: "No pudimos enviar el correo. Intenta de nuevo en unos minutos.",
  server: "Ocurrió un error inesperado. Intenta de nuevo.",
} as const;

const CONFLICT_MESSAGES: Record<string, string> = {
  "supplier already exists": "Ya existe un proveedor con esa identificación.",
  "supplier is in use":
    "No puedes eliminar este proveedor porque tiene compras asociadas.",
  "category already exists": "Ya existe una categoría con ese nombre.",
  "category is in use": "No puedes eliminarla porque está en uso.",
  "product already exists": "Ya existe un producto con esa referencia.",
  "image already exists": "Ya existe una imagen con esa referencia.",
  "image is in use": "No puedes eliminarla porque un producto la usa.",
  "item state already exists": "Ya existe un estado con ese nombre.",
  "item state is in use": "No puedes eliminarlo porque está en uso.",
  "state already exists": "Ya existe un estado con ese nombre.",
  "state has cities": "No puedes eliminarlo porque tiene ciudades.",
  "city already exists": "Ya existe esa ciudad en el estado.",
  "city is in use": "No puedes eliminarla porque un proveedor la usa.",
  "cost already exists": "Ya existe un costo para ese producto y estado.",
  "purchase is not editable": "Esta compra ya no se puede editar.",
  "purchase already confirmed": "Esta compra ya fue confirmada.",
  "item already exists": "Ese producto y estado ya están en la compra.",
  "currency already exists": "Ya existe una moneda con ese código.",
  "base currency rate cannot be changed": "La tasa del bolívar no se puede modificar.",
  "base currency cannot be deactivated": "El bolívar no se puede desactivar.",
  "default transaction currency cannot be deactivated":
    "La moneda de transacciones no se puede desactivar.",
  "shelf already exists": "Ya existe un estante con ese código en la bodega.",
  "section already exists": "Ya existe una sección con ese código en el estante.",
  "shelf has lots": "No puedes eliminarlo porque tiene lotes asociados.",
  "section has lots": "No puedes eliminarlo porque tiene lotes asociados.",
  "lot already exists": "Ya existe un lote con ese número para el producto.",
  "lot has stock or reservations":
    "Solo puedes eliminar lotes con existencia y reservado en cero.",
  "customer already exists": "Ya existe un cliente con ese correo.",
  "customer already has a seller": "Este cliente ya tiene un vendedor asignado.",
  "you cannot block your own account": "No puedes bloquear tu propia cuenta.",
  "cannot block the last administrator":
    "No puedes bloquear al último administrador activo.",
  "you cannot delete your own account": "No puedes eliminar tu propia cuenta.",
  "cannot delete the last administrator":
    "No puedes eliminar al último administrador activo.",
  "admin already exists": "Ya existe un administrador. Inicia sesión.",
};

const KNOWN_MESSAGES: Record<string, string> = {
  "default transaction currency is not configured": CURRENCY_NOT_CONFIGURED,
};

const FIELD_MESSAGE_FALLBACK = COPY.invalidField;

function translateFieldMessage(message: string) {
  const key = message.trim().toLowerCase();
  return KNOWN_MESSAGES[key] ?? FIELD_MESSAGE_FALLBACK;
}

function readApiMessage(error: ApiError) {
  const payload = error.payload;
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message.trim();
  }
  return error.message.trim();
}

export function translateApiError(error: unknown): UiError {
  if (!(error instanceof ApiError)) {
    return {
      kind: "network",
      message: COPY.network,
      fieldErrors: {},
      canRetry: true,
      status: null,
      retryAfterSeconds: null,
    };
  }

  const fieldErrors: Record<string, string> = {};
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    fieldErrors[field] = translateFieldMessage(message);
  }

  if (error.isUserBlocked()) {
    return {
      kind: "blocked",
      message: COPY.blocked,
      fieldErrors,
      canRetry: false,
      status: error.status,
      retryAfterSeconds: null,
    };
  }

  switch (error.status) {
    case 400:
      return {
        kind: "bad-request",
        message: COPY.badRequest,
        fieldErrors,
        canRetry: false,
        status: 400,
        retryAfterSeconds: null,
      };
    case 401:
      return {
        kind: "session-expired",
        message: COPY.sessionExpired,
        fieldErrors,
        canRetry: false,
        status: 401,
        retryAfterSeconds: null,
      };
    case 403:
      return {
        kind: "forbidden",
        message: COPY.forbidden,
        fieldErrors,
        canRetry: false,
        status: 403,
        retryAfterSeconds: null,
      };
    case 404:
      return {
        kind: "not-found",
        message: COPY.notFound,
        fieldErrors,
        canRetry: false,
        status: 404,
        retryAfterSeconds: null,
      };
    case 409: {
      const message = readApiMessage(error);
      return {
        kind: "conflict",
        message:
          CONFLICT_MESSAGES[message.toLowerCase()] ?? COPY.conflictFallback,
        fieldErrors,
        canRetry: false,
        status: 409,
        retryAfterSeconds: null,
      };
    }
    case 422:
      return {
        kind: "validation",
        message: COPY.validation,
        fieldErrors,
        canRetry: false,
        status: 422,
        retryAfterSeconds: null,
      };
    case 429: {
      const wait = error.retryAfterSeconds;
      return {
        kind: "rate-limit",
        message:
          wait && wait > 0
            ? `Demasiadas solicitudes. Intenta de nuevo en ${wait} segundos.`
            : COPY.rateLimit,
        fieldErrors,
        canRetry: true,
        status: 429,
        retryAfterSeconds: wait,
      };
    }
    case 502:
      return {
        kind: "mail",
        message: COPY.mail,
        fieldErrors,
        canRetry: true,
        status: 502,
        retryAfterSeconds: null,
      };
    case 503:
      return {
        kind: "currency",
        message: CURRENCY_NOT_CONFIGURED,
        fieldErrors,
        canRetry: true,
        status: 503,
        retryAfterSeconds: null,
      };
    default:
      return {
        kind: "server",
        message: COPY.server,
        fieldErrors,
        canRetry: true,
        status: error.status,
        retryAfterSeconds: null,
      };
  }
}
