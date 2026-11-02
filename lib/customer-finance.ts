import type { UiError } from "@/lib/api-errors";
import type { InvoicePaymentStatus } from "@/lib/finance/invoices-api";

export const CUSTOMER_FINANCE_COPY = {
  accessDenied: "No tienes acceso a esta información.",
  invoiceNotFound: "No encontramos esa factura.",
  walletNotFound: "No encontramos esa billetera.",
  invalidInvoice: "El identificador de la factura no es válido.",
  invalidWallet: "El identificador de la billetera no es válido.",
  service: "No podemos cargar la información financiera en este momento.",
  serviceHelp: "Intenta de nuevo en unos minutos.",
  sessionExpired:
    "Tu sesión expiró. Inicia sesión de nuevo para consultar esta información.",
  genericTitle: "No pudimos cargar la información financiera",
  genericHelp: "Revisa tu conexión e intenta de nuevo.",
} as const;

export type CustomerFinanceScope = "invoice" | "wallet";

export type CustomerFinanceErrorCopy = {
  title: string;
  description: string;
  canRetry: boolean;
};

export function customerFinanceErrorCopy(
  error: UiError | null,
  scope: CustomerFinanceScope,
): CustomerFinanceErrorCopy {
  const notFoundTitle =
    scope === "invoice"
      ? CUSTOMER_FINANCE_COPY.invoiceNotFound
      : CUSTOMER_FINANCE_COPY.walletNotFound;
  const notFoundHelp =
    scope === "invoice"
      ? "Puede que no exista o que no pertenezca a tu cuenta. Vuelve a tus pedidos para continuar."
      : "Puede que no exista o que no pertenezca a tu cuenta. Vuelve al inicio para continuar.";
  const invalidId =
    scope === "invoice"
      ? CUSTOMER_FINANCE_COPY.invalidInvoice
      : CUSTOMER_FINANCE_COPY.invalidWallet;

  if (!error) {
    return {
      title: CUSTOMER_FINANCE_COPY.genericTitle,
      description: CUSTOMER_FINANCE_COPY.genericHelp,
      canRetry: true,
    };
  }

  switch (error.status) {
    case 401:
      return {
        title: "Tu sesión expiró",
        description: CUSTOMER_FINANCE_COPY.sessionExpired,
        canRetry: false,
      };
    case 403:
      return {
        title: "Sin acceso",
        description: CUSTOMER_FINANCE_COPY.accessDenied,
        canRetry: false,
      };
    case 404:
      return {
        title: notFoundTitle,
        description: notFoundHelp,
        canRetry: false,
      };
    case 422:
      return {
        title: notFoundTitle,
        description: invalidId,
        canRetry: false,
      };
    case 503:
      return {
        title: CUSTOMER_FINANCE_COPY.service,
        description: CUSTOMER_FINANCE_COPY.serviceHelp,
        canRetry: true,
      };
    default:
      break;
  }

  if (error.kind === "currency") {
    return {
      title: CUSTOMER_FINANCE_COPY.service,
      description: CUSTOMER_FINANCE_COPY.serviceHelp,
      canRetry: true,
    };
  }

  if (error.kind === "network") {
    return {
      title: CUSTOMER_FINANCE_COPY.genericTitle,
      description: CUSTOMER_FINANCE_COPY.genericHelp,
      canRetry: true,
    };
  }

  return {
    title: CUSTOMER_FINANCE_COPY.genericTitle,
    description: error.message,
    canRetry: error.canRetry,
  };
}

export function isOwnCustomerRecord(
  recordCustomerId: number | string | null | undefined,
  customerId: number | string | null | undefined,
) {
  if (recordCustomerId === null || recordCustomerId === undefined) return false;
  if (customerId === null || customerId === undefined) return false;
  return String(recordCustomerId) === String(customerId);
}

const CARACAS_TIME_ZONE = "America/Caracas";

function caracasDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: CARACAS_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function isInvoiceOverdue(
  dueDate: string | null,
  status: InvoicePaymentStatus,
) {
  if (!dueDate || status === "paid") return false;

  const today = caracasDateKey(new Date());
  if (!today) return false;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDate.trim());
  if (dateOnly) {
    return today > `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
  }

  const parsed = Date.parse(dueDate);
  if (!Number.isFinite(parsed)) return false;
  const dueKey = caracasDateKey(new Date(parsed));
  return dueKey !== null && today > dueKey;
}
