import { API_BASE_URL, ApiError, apiFetch } from "@/lib/api";
import { fetchCurrencies } from "@/lib/finance/currencies-api";
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

export type DocumentCurrencyCatalog = {
  options: DocumentCurrency[];
  warning: string | null;
};

export type QuotationPreview = {
  sourceCurrency: DocumentCurrency;
  targetCurrency: DocumentCurrency;
  sourceTotal: number;
  targetTotal: number;
  exchangeRate: number;
  roundingAdjustment: number;
  sourceRateUpdatedAt: string | null;
  targetRateUpdatedAt: string | null;
  calculatedAt: string | null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readId(value: unknown): RecordId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  }
  return null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readTimestamp(value: unknown) {
  const text = readText(value);
  return text || null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function toDocumentCurrency(
  source: unknown,
  isOrderCurrency: boolean,
): DocumentCurrency | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  if (id === null || !code) return null;
  return {
    id,
    code,
    name: readText(source.name) || code,
    symbol: readText(source.symbol) || code,
    isBase: source.is_base === true,
    isOrderCurrency,
  };
}

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

export function parseQuotationPreview(payload: unknown): QuotationPreview {
  const record = unwrapRecord(payload);
  if (!isRecord(record)) throw new ApiError(500, null);

  const source = isRecord(record.source) ? record.source : null;
  const target = isRecord(record.target) ? record.target : null;
  const sourceCurrency = toDocumentCurrency(source?.currency, false);
  const targetCurrency = toDocumentCurrency(target?.currency, false);
  const sourceTotal = readNumber(source?.total);
  const targetTotal = readNumber(target?.total);
  const exchangeRate = readNumber(record.exchange_rate);

  if (
    !sourceCurrency ||
    !targetCurrency ||
    sourceTotal === null ||
    targetTotal === null ||
    exchangeRate === null
  ) {
    throw new ApiError(500, null);
  }

  const ratesUpdatedAt = isRecord(record.rates_updated_at)
    ? record.rates_updated_at
    : null;

  return {
    sourceCurrency,
    targetCurrency,
    sourceTotal,
    targetTotal,
    exchangeRate,
    roundingAdjustment: readNumber(record.rounding_adjustment) ?? 0,
    sourceRateUpdatedAt: readTimestamp(ratesUpdatedAt?.source),
    targetRateUpdatedAt: readTimestamp(ratesUpdatedAt?.target),
    calculatedAt: readTimestamp(record.calculated_at),
  };
}

export async function fetchQuotationPreview(
  orderId: RecordId,
  currencyId: RecordId | null,
) {
  const query =
    currencyId === null
      ? ""
      : `?currency_id=${encodeURIComponent(String(currencyId))}`;
  const payload = await apiFetch<unknown>(
    `/orders/${encodeURIComponent(String(orderId))}/equivalence${query}`,
    { token: getStoredToken() ?? undefined },
  );
  return parseQuotationPreview(payload);
}

export async function fetchQuotationBaseCurrency(orderId: RecordId) {
  const preview = await fetchQuotationPreview(orderId, null);
  return preview.targetCurrency;
}

export async function fetchQuotationCurrencyCatalog(
  order: OrderRecord,
): Promise<DocumentCurrencyCatalog> {
  const orderOption = toOrderCurrency(order.currency);

  try {
    const currencies = await fetchCurrencies();
    const active = currencies.filter((currency) => currency.is_active);
    const source = active.length > 0 ? active : currencies;
    const options: DocumentCurrency[] = [];

    for (const currency of source) {
      addCurrencyOption(options, {
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

    if (orderOption) addCurrencyOption(options, orderOption);

    return {
      options: sortCurrencyOptions(options),
      warning: null,
    };
  } catch {
    let base: DocumentCurrency | null = null;
    try {
      base = await fetchQuotationBaseCurrency(order.id);
    } catch {
      base = null;
    }

    const options: DocumentCurrency[] = [];
    if (base) addCurrencyOption(options, base);
    if (orderOption) addCurrencyOption(options, orderOption);

    return {
      options: sortCurrencyOptions(options),
      warning: base
        ? "No pudimos cargar el catálogo de monedas. Puedes cotizar en bolívares o en la moneda del pedido."
        : "No pudimos cargar el catálogo de monedas. Puedes cotizar en la moneda del pedido.",
    };
  }
}

function sanitizeFilename(value: string) {
  const clean = value.replace(/[\\/:*?"<>|]/g, "_").trim();
  return clean || "documento.pdf";
}

function filenameFromDisposition(header: string | null) {
  if (!header) return null;

  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return sanitizeFilename(
        decodeURIComponent(utf8[1].replace(/^"|"$/g, "").trim()),
      );
    } catch {
      return sanitizeFilename(utf8[1].replace(/^"|"$/g, "").trim());
    }
  }

  const ascii = /filename="?([^";]+)"?/i.exec(header);
  if (ascii?.[1]) return sanitizeFilename(ascii[1].trim());
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
      sanitizeFilename(fallbackFilename),
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
    `factura-${sanitizeFilename(String(invoiceNumber))}.pdf`,
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
    `cotizacion-pedido-${sanitizeFilename(String(orderNumber))}-${sanitizeFilename(
      currencyCode,
    )}.pdf`,
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
