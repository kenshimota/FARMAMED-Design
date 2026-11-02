import { ApiError, apiFetch } from "@/lib/api";
import { formatInteger } from "@/lib/format";
import { getStoredToken } from "@/lib/session";

const CARACAS_TIME_ZONE = "America/Caracas";

export const EXPIRING_SOON_DAYS = 30;

export type DraftPurchase = {
  id: number;
  number: number;
  supplierId: number | null;
  currencyId: number | null;
  currency: { code: string; symbol: string } | null;
  total: number | null;
};

export type LotRow = {
  id: number;
  number: string;
  expirationDate: string;
  stock: number;
  productName: string | null;
};

export type StockRow = {
  id: number;
  quantity: number;
  itemStateLabel: string;
};

export type SupplierRow = {
  id: number;
  name: string;
};

export type CountedRows<T> = {
  count: number;
  items: T[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readListPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) throw new ApiError(500, null);
  if (Array.isArray(payload.data)) return payload.data;
  if (isRecord(payload.data)) return readListPayload(payload.data);
  const nested = Object.values(payload).find((value) => Array.isArray(value));
  if (nested) return nested;
  throw new ApiError(500, null);
}

function readText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

function readAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readNested(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return isRecord(value) ? value : null;
}

function authFetch<T>(path: string, options: RequestInit = {}) {
  return apiFetch<T>(path, { token: getStoredToken() ?? undefined, ...options });
}

export function expiringBeforeDate(days = EXPIRING_SOON_DAYS) {
  const target = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CARACAS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(target);
}

export function formatCount(value: number) {
  return formatInteger(value);
}

function readTotal(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.meta)) {
    const total = payload.meta.total;
    if (typeof total === "number" && Number.isFinite(total)) return total;
  }
  return readListPayload(payload).length;
}

export async function fetchProductCount() {
  return readTotal(await authFetch<unknown>("/products?page=1&page_size=1"));
}

export async function fetchCustomerCount() {
  return readTotal(await authFetch<unknown>("/customers?page=1&page_size=1"));
}

function parsePurchase(source: unknown): DraftPurchase | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const number = readId(source.number);
  if (id === null || number === null) return null;
  const currency = readNested(source, "currency");
  return {
    id,
    number,
    supplierId: readId(source.supplier_id),
    currencyId: readId(source.currency_id),
    currency: currency
      ? {
          code: readText(currency.code) ?? "",
          symbol: readText(currency.symbol) ?? "",
        }
      : null,
    total: readAmount(source.total),
  };
}

async function fetchCount(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  return readTotal(
    await authFetch<unknown>(`${path}${separator}page=1&page_size=1`),
  );
}

export async function fetchDraftPurchaseCount() {
  return fetchCount("/purchases?status=draft");
}

export async function fetchInStockCount() {
  return fetchCount("/stocks?in_stock=true");
}

export async function fetchDraftPurchases(): Promise<CountedRows<DraftPurchase>> {
  const payload = await authFetch<unknown>("/purchases?status=draft");
  const rows = readListPayload(payload);
  return {
    count: readTotal(payload),
    items: rows
      .map(parsePurchase)
      .filter((purchase): purchase is DraftPurchase => purchase !== null)
      .sort((a, b) => b.number - a.number),
  };
}

function parseLot(source: unknown): LotRow | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const number = readText(source.number);
  if (id === null || number === null) return null;
  const product = readNested(source, "product");
  return {
    id,
    number,
    expirationDate: readText(source.expiration_date) ?? "",
    stock: readAmount(source.stock) ?? 0,
    productName: product ? readText(product.name) : null,
  };
}

export async function fetchExpiredLots(): Promise<CountedRows<LotRow>> {
  const rows = readListPayload(await authFetch<unknown>("/lots?expired=true"));
  return {
    count: rows.length,
    items: rows
      .map(parseLot)
      .filter((lot): lot is LotRow => lot !== null),
  };
}

export async function fetchExpiringLots(): Promise<CountedRows<LotRow>> {
  const rows = readListPayload(
    await authFetch<unknown>(
      `/lots?expired=false&expiring_before=${expiringBeforeDate(EXPIRING_SOON_DAYS)}`,
    ),
  );
  return {
    count: rows.length,
    items: rows
      .map(parseLot)
      .filter((lot): lot is LotRow => lot !== null),
  };
}

function parseStock(source: unknown): StockRow | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  if (id === null) return null;
  const itemState = readNested(source, "item_state");
  return {
    id,
    quantity: readAmount(source.quantity) ?? 0,
    itemStateLabel: (itemState ? readText(itemState.label) : null) ?? "Sin estado",
  };
}

export async function fetchStocksInStock(): Promise<CountedRows<StockRow>> {
  const payload = await authFetch<unknown>("/stocks?in_stock=true");
  const rows = readListPayload(payload);
  return {
    count: readTotal(payload),
    items: rows
      .map(parseStock)
      .filter((stock): stock is StockRow => stock !== null),
  };
}

export async function confirmDraftPurchase(purchaseId: number) {
  await authFetch(`/purchases/${purchaseId}/confirm`, { method: "POST" });
}
