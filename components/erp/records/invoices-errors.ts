import { ApiError } from "@/lib/api";
import { COPY, translateApiError, type UiError } from "@/lib/api-errors";

export const INVOICE_COPY = {
  empty: "Todavía no hay facturas registradas.",
  emptyFiltered: "No hay facturas con esos filtros.",
  emptyFilteredHelp:
    "Ajusta el pedido, el cliente, el número o el estado de pago para ver otros resultados.",
  notFound: "No encontramos esa factura.",
  noPayments: "Esta factura no tiene pagos aplicados.",
  applyHelp: "Solo se pueden aplicar pagos del mismo cliente.",
  noCustomerPayments: "Este cliente no tiene pagos registrados.",
  allPaymentsApplied:
    "Los pagos de este cliente ya fueron aplicados a esta factura.",
  paymentAlreadyApplied: "Este pago ya fue aplicado a esta factura.",
  invoicePaid: "Esta factura ya está pagada.",
  insufficientWallet:
    "La billetera del cliente no tiene saldo suficiente en la moneda del pago.",
  amountExceedsBalance:
    "El monto aplicado no puede superar el saldo pendiente de la factura.",
  customerMismatch:
    "El pago pertenece a otro cliente. Solo se pueden aplicar pagos del mismo cliente.",
  invalidAmount:
    "Ingresa un monto mayor que cero, con máximo dos decimales.",
  invalidPayment: "Selecciona un pago válido.",
  service:
    "No podemos cargar la información de facturación en este momento.",
  forbidden: "No tienes permiso para ver o aplicar pagos.",
} as const;

function readApiMessage(error: ApiError) {
  const payload = error.payload;
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string") return message.trim();
  }
  return error.message.trim();
}

function fieldMessages(error: ApiError) {
  return Object.entries(error.fieldErrors).map(([field, message]) => ({
    field: field.toLowerCase(),
    message: message.toLowerCase(),
  }));
}

function hasField(error: ApiError, name: string) {
  return fieldMessages(error).some((entry) => entry.field === name);
}

export function invoiceLoadErrorMessage(
  error: UiError | null,
  fallback: string,
) {
  if (!error) return fallback;
  if (error.status === 503 || error.kind === "currency") {
    return INVOICE_COPY.service;
  }
  if (error.status === 403) return INVOICE_COPY.forbidden;
  if (error.status === 404) return INVOICE_COPY.notFound;
  if (error.kind === "validation" || error.kind === "bad-request") {
    return "Los filtros ingresados no son válidos. Ajusta la selección e intenta de nuevo.";
  }
  return error.message;
}

export function invoicePaymentErrorMessage(caught: unknown): string {
  if (!(caught instanceof ApiError)) {
    return translateApiError(caught).message;
  }

  const message = readApiMessage(caught).toLowerCase();
  const fields = fieldMessages(caught);

  if (caught.status === 400) {
    return "Faltan el pago o el monto. Revisa el formulario antes de continuar.";
  }

  if (caught.status === 403) {
    return INVOICE_COPY.forbidden;
  }

  if (caught.status === 404) {
    if (message.includes("payment")) return "No encontramos ese pago.";
    return INVOICE_COPY.notFound;
  }

  if (caught.status === 409) {
    if (message.includes("already allocated")) {
      return INVOICE_COPY.paymentAlreadyApplied;
    }
    if (message.includes("already paid")) return INVOICE_COPY.invoicePaid;
    if (message.includes("insufficient wallet balance")) {
      return INVOICE_COPY.insufficientWallet;
    }
    return COPY.conflictFallback;
  }

  if (caught.status === 422) {
    if (
      message.includes("amount exceeds invoice balance") ||
      fields.some((entry) => entry.message.includes("amount exceeds"))
    ) {
      return INVOICE_COPY.amountExceedsBalance;
    }
    if (
      message.includes("does not belong to invoice customer") ||
      fields.some((entry) => entry.message.includes("does not belong"))
    ) {
      return INVOICE_COPY.customerMismatch;
    }
    if (hasField(caught, "amount") || message.includes("amount must")) {
      return INVOICE_COPY.invalidAmount;
    }
    if (hasField(caught, "payment_id") || message.includes("payment_id")) {
      return INVOICE_COPY.invalidPayment;
    }
    if (message.includes("invalid invoice id") || hasField(caught, "id")) {
      return INVOICE_COPY.notFound;
    }
    return "Revisa el pago y el monto antes de continuar.";
  }

  if (caught.status === 503) return INVOICE_COPY.service;

  return translateApiError(caught).message;
}

export function mapInvoicePaymentFieldErrors(caught: unknown) {
  const mapped: { paymentId?: string; amount?: string } = {};
  if (!(caught instanceof ApiError)) return mapped;

  for (const [field, rawMessage] of Object.entries(caught.fieldErrors)) {
    const key = field.toLowerCase();
    const message = rawMessage.toLowerCase();
    if (key === "payment_id") {
      mapped.paymentId =
        message.includes("does not belong")
          ? INVOICE_COPY.customerMismatch
          : INVOICE_COPY.invalidPayment;
    } else if (key === "amount") {
      mapped.amount = message.includes("exceeds")
        ? INVOICE_COPY.amountExceedsBalance
        : INVOICE_COPY.invalidAmount;
    }
  }

  return mapped;
}
