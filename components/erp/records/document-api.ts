import { API_BASE_URL, ApiError } from "@/lib/api";
import { fetchCurrencies } from "@/lib/finance/currencies-api";
import {
  fetchOrderEquivalence,
  type OrderEquivalence,
} from "@/lib/finance/equivalence-api";
import { getStoredToken } from "@/lib/session-store";
import type {
  OrderCurrency,
  OrderRecord,
} from "@/components/erp/records/orders-api";
import type { RecordId } from "@/components/erp/records/records-api";

export type DocumentCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
  isBase: boolean;
  isOrderCurrency: boolean;
};

export type DocumentCatalogNotice = {
  message: string;
  tone: "info" | "warning";
};

export type DocumentCurrencyCatalog = {
  options: DocumentCurrency[];
  notice: DocumentCatalogNotice | null;
};

export type DocumentErrorInfo = {
  message: string;
  canRetry: boolean;
  status: number | null;
};

export type DocumentFile = {
  blob: Blob;
  filename: string;
};

function toOrderCurrency(currency: OrderCurrency | null): DocumentCurrency | null {
  if (!currency) return null;
  return {
    id: currency.id,
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    isBase: false,
    isOrderCurrency: true,
  };
}

function addCurrencyOption(
  options: DocumentCurrency[],
  option: DocumentCurrency,
) {
  const existing = options.find(
    (candidate) =>
      candidate.code.toLowerCase() === option.code.toLowerCase() ||
      String(candidate.id) === String(option.id),
  );
  if (existing) {
    existing.isBase = existing.isBase || option.isBase;
    existing.isOrderCurrency =
      existing.isOrderCurrency || option.isOrderCurrency;
    return;
  }
  options.push(option);
}

function sortCurrencyOptions(options: DocumentCurrency[]) {
  return [...options].sort((first, second) => {
    const firstBase = first.isBase || first.code.toUpperCase() === "VES";
    const secondBase = second.isBase || second.code.toUpperCase() === "VES";
    if (firstBase && !secondBase) return -1;
    if (!firstBase && secondBase) return 1;
    return first.code.localeCompare(second.code, "es");
  });
}

async function fetchBaseCurrencyOption(
  order: OrderRecord,
  orderOption: DocumentCurrency | null,
): Promise<DocumentCurrency | null> {
  if (orderOption && orderOption.code.toUpperCase() === "VES") {
    return { ...orderOption, isBase: true, isOrderCurrency: true };
  }

  try {
    const equivalence = await fetchOrderEquivalence(String(order.id), null);
    const target = equivalence.target.currency;
    if (!target || target.id === null || target.code.toUpperCase() !== "VES") {
      return null;
    }
    return {
      id: target.id,
      code: target.code,
      name: target.name,
      symbol: target.symbol,
      isBase: true,
      isOrderCurrency:
        orderOption !== null &&
        orderOption.code.toLowerCase() === target.code.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export async function fetchQuotationCurrencyCatalog(
  order: OrderRecord,
  options: { includeActiveCurrencies?: boolean } = {},
): Promise<DocumentCurrencyCatalog> {
  const orderOption = toOrderCurrency(order.currency);

  async function fallback(
    notice: DocumentCatalogNotice | null,
  ): Promise<DocumentCurrencyCatalog> {
    const base = await fetchBaseCurrencyOption(order, orderOption);
    const list: DocumentCurrency[] = [];
    if (base) addCurrencyOption(list, base);
    if (orderOption) addCurrencyOption(list, orderOption);

    const resolvedNotice =
      base === null
        ? {
            tone: "info" as const,
            message: orderOption
              ? "No pudimos consultar la tasa del bolívar. Puedes cotizar en la moneda del pedido."
              : "No pudimos consultar las monedas disponibles para cotizar.",
          }
        : notice;

    return {
      options: sortCurrencyOptions(list),
      notice: resolvedNotice,
    };
  }

  if (options.includeActiveCurrencies === false) {
    return fallback(null);
  }

  try {
    const currencies = await fetchCurrencies();
    const active = currencies.filter((currency) => currency.is_active);
    const source = active.length > 0 ? active : currencies;
    const list: DocumentCurrency[] = [];

    for (const currency of source) {
      addCurrencyOption(list, {
        id: currency.id,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
        isBase: currency.is_base,
        isOrderCurrency:
          orderOption !== null &&
          currency.code.toLowerCase() === orderOption.code.toLowerCase(),
      });
    }

    if (orderOption) addCurrencyOption(list, orderOption);

    return {
      options: sortCurrencyOptions(list),
      notice: null,
    };
  } catch (caught) {
    const forbidden = caught instanceof ApiError && caught.status === 403;
    return fallback(
      forbidden
        ? null
        : {
            tone: "warning",
            message:
              "No pudimos cargar el catálogo completo de monedas. Puedes cotizar en bolívar o en la moneda del pedido.",
          },
    );
  }
}

export async function fetchQuotationPreview(
  orderId: RecordId,
  currencyId: RecordId | null,
): Promise<OrderEquivalence> {
  return fetchOrderEquivalence(String(orderId), currencyId);
}

function sanitizeFilenamePart(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim();
}

function stripPdfExtension(value: string) {
  return value.replace(/(?:\.pdf)+$/i, "").trim();
}

function ensurePdfFilename(value: string) {
  const stem = stripPdfExtension(sanitizeFilenamePart(value));
  return `${stem || "documento"}.pdf`;
}

function pdfFilename(prefix: string, ...parts: string[]) {
  const suffix = parts
    .map((part) => stripPdfExtension(sanitizeFilenamePart(part)))
    .filter(Boolean)
    .join("-");
  return suffix ? `${prefix}-${suffix}.pdf` : `${prefix}.pdf`;
}

function filenameFromDisposition(header: string | null) {
  if (!header) return null;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return ensurePdfFilename(
        decodeURIComponent(utf8[1].replace(/^"|"$/g, "").trim()),
      );
    } catch {
      return ensurePdfFilename(utf8[1].replace(/^"|"$/g, "").trim());
    }
  }

  const ascii = /filename="?([^";]+)"?/i.exec(header);
  if (ascii?.[1]) return ensurePdfFilename(ascii[1].trim());
  return null;
}

async function readErrorPayload(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 300) };
    }
  } catch {
    return null;
  }
}

async function requestPdf(path: string, fallbackFilename: string) {
  const token = getStoredToken();
  const headers = new Headers({ Accept: "application/pdf" });
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
    headers,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await readErrorPayload(response));
  }

  const contentType = response.headers.get("Content-Type");
  if (contentType && !contentType.toLowerCase().includes("application/pdf")) {
    throw new ApiError(500, null);
  }

  const blob = await response.blob();
  if (blob.size === 0) throw new ApiError(500, null);

  return {
    blob,
    filename:
      filenameFromDisposition(response.headers.get("Content-Disposition")) ??
      ensurePdfFilename(fallbackFilename),
  } satisfies DocumentFile;
}

function triggerDownload(file: DocumentFile) {
  const objectUrl = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = file.filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadInvoicePdf(
  invoiceId: RecordId,
  invoiceNumber: number | string,
) {
  const file = await requestPdf(
    `/invoices/${encodeURIComponent(String(invoiceId))}/pdf?download=true`,
    pdfFilename("factura", String(invoiceNumber)),
  );
  triggerDownload(file);
  return file;
}

export async function downloadQuotationPdf(
  orderId: RecordId,
  orderNumber: number | string,
  currencyId: RecordId | null,
  currencyCode: string,
) {
  const query = new URLSearchParams({ download: "true" });
  if (currencyId !== null) query.set("currency_id", String(currencyId));

  const file = await requestPdf(
    `/orders/${encodeURIComponent(String(orderId))}/quotation?${query.toString()}`,
    pdfFilename("cotizacion-pedido", String(orderNumber), currencyCode),
  );
  triggerDownload(file);
  return file;
}

export function documentErrorCopy(caught: unknown): DocumentErrorInfo {
  if (!(caught instanceof ApiError)) {
    return {
      message:
        "No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.",
      canRetry: true,
      status: null,
    };
  }

  if (caught.isUserBlocked()) {
    return {
      message: "Tu cuenta está bloqueada. Contacta a un administrador.",
      canRetry: false,
      status: 403,
    };
  }

  switch (caught.status) {
    case 401:
      return {
        message: "Tu sesión venció. Vuelve a iniciar sesión.",
        canRetry: false,
        status: 401,
      };
    case 403:
      return {
        message: "No tienes permiso para descargar este documento.",
        canRetry: false,
        status: 403,
      };
    case 404:
      return {
        message: "No encontramos el pedido, la factura o la moneda.",
        canRetry: false,
        status: 404,
      };
    case 409: {
      const message = caught.message.toLowerCase();
      if (message.includes("already invoiced")) {
        return {
          message: "Este pedido ya fue facturado. Descarga la factura.",
          canRetry: false,
          status: 409,
        };
      }
      if (message.includes("cancelled")) {
        return {
          message: "Este pedido está cancelado y no se puede cotizar.",
          canRetry: false,
          status: 409,
        };
      }
      return {
        message:
          "El pedido cambió de estado. Actualizamos el detalle para que lo revises.",
        canRetry: false,
        status: 409,
      };
    }
    case 422:
      return {
        message: "Revisa la moneda o el pedido antes de generar el documento.",
        canRetry: false,
        status: 422,
      };
    case 503: {
      const message = caught.message.toLowerCase();
      if (message.includes("company profile")) {
        return {
          message: "La empresa no tiene configurados sus datos de emisión.",
          canRetry: true,
          status: 503,
        };
      }
      if (message.includes("currency configuration")) {
        return {
          message:
            "La configuración de monedas está incompleta. Intenta de nuevo más tarde.",
          canRetry: true,
          status: 503,
        };
      }
      return {
        message:
          "La empresa no tiene configurados sus datos de emisión o las monedas.",
        canRetry: true,
        status: 503,
      };
    }
    default:
      return {
        message: "No pudimos generar el documento. Intenta de nuevo.",
        canRetry: true,
        status: caught.status,
      };
  }
}
