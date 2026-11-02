import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  buildListQuery,
  parsePaginated,
  pickListFilters,
  type ListQuery,
  type Paginated,
} from "@/lib/pagination";

export type StoreCurrency = {
  id: number;
  code: string;
  name: string;
  symbol: string | null;
};

export type StoreItemState = {
  id: number;
  name: string;
  label: string;
};

export type StoreCategory = {
  id: number;
  name: string;
};

export type StoreVariant = {
  itemState: StoreItemState;
  price: number;
  currencyId: number | null;
  currency: StoreCurrency | null;
  available: boolean;
};

export type StoreProduct = {
  id: number;
  name: string;
  description: string;
  reference: string;
  categoryId: number | null;
  category: StoreCategory | null;
  imageId: number | null;
  imageUrl: string | null;
  imageOriginalUrl: string | null;
  itemState: StoreItemState;
  price: number;
  currencyId: number | null;
  currency: StoreCurrency | null;
  available: boolean;
};

export type StoreProductDetail = Omit<
  StoreProduct,
  "itemState" | "price" | "currencyId" | "currency" | "available"
> & {
  variants: StoreVariant[];
};

export function isPositiveStoreId(value: string | null | undefined) {
  return Boolean(value && /^[1-9]\d*$/.test(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown, fallback = Number.NaN) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readPositiveInteger(value: unknown) {
  const parsed =
    typeof value === "number" ? value : readNumber(value, Number.NaN);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  return fallback;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function readCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new ApiError(500, null);
}

function parseStoreCurrency(
  value: unknown,
  fallbackId: number | null = null,
): StoreCurrency | null {
  if (!isRecord(value)) return null;
  const id = readPositiveInteger(value.id) ?? fallbackId;
  const code = readText(value.code);
  if (id === null || !code) return null;
  return {
    id,
    code,
    name: readText(value.name) || code,
    symbol: readText(value.symbol) || null,
  };
}

function parseStoreItemState(value: unknown): StoreItemState | null {
  if (!isRecord(value)) return null;
  const id = readPositiveInteger(value.id);
  const name = readText(value.name);
  const label = readText(value.label) || name;
  if (id === null || !label) return null;
  return { id, name: name || label, label };
}

function parseStoreCategory(value: unknown): StoreCategory | null {
  if (!isRecord(value)) return null;
  const id = readPositiveInteger(value.id);
  const name = readText(value.name);
  if (id === null || !name) return null;
  return { id, name };
}

function parseStoreImage(value: unknown): {
  id: number | null;
  url: string | null;
  thumbnail: string | null;
} {
  if (typeof value === "string") {
    const url = readText(value) || null;
    return { id: null, url, thumbnail: null };
  }
  if (!isRecord(value)) return { id: null, url: null, thumbnail: null };
  return {
    id: readPositiveInteger(value.id),
    url: readText(value.url) || null,
    thumbnail: readText(value.thumbnail) || null,
  };
}

function parseBaseFields(record: Record<string, unknown>) {
  const id = readPositiveInteger(record.id);
  const name = readText(record.name);
  if (id === null || !name) return null;

  const category = parseStoreCategory(record.category);
  const image = parseStoreImage(record.image);

  return {
    id,
    name,
    description: readText(record.description),
    reference: readText(record.reference),
    categoryId: readPositiveInteger(record.category_id) ?? category?.id ?? null,
    category,
    imageId: readPositiveInteger(record.image_id) ?? image.id,
    imageUrl: image.thumbnail || image.url,
    imageOriginalUrl: image.url || image.thumbnail,
  };
}

function parseVariant(source: unknown): StoreVariant | null {
  if (!isRecord(source)) return null;
  const itemState = parseStoreItemState(source.item_state);
  const price = readNumber(source.price, Number.NaN);
  if (!itemState || !Number.isFinite(price) || price < 0) return null;

  const currencyId = readPositiveInteger(source.currency_id);
  return {
    itemState,
    price,
    currencyId,
    currency: parseStoreCurrency(source.currency, currencyId),
    available: readBoolean(source.available, true),
  };
}

export function parseStoreProduct(source: unknown): StoreProduct | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const base = parseBaseFields(record);
  const itemState = parseStoreItemState(record.item_state);
  const price = readNumber(record.price, Number.NaN);
  if (!base || !itemState || !Number.isFinite(price) || price < 0) return null;

  const currencyId = readPositiveInteger(record.currency_id);
  return {
    ...base,
    itemState,
    price,
    currencyId,
    currency: parseStoreCurrency(record.currency, currencyId),
    available: readBoolean(record.available, true),
  };
}

export function parseStoreProductList(payload: unknown): StoreProduct[] {
  const list = readCollection(payload);
  const products = list
    .map(parseStoreProduct)
    .filter((product): product is StoreProduct => product !== null);
  if (list.length > 0 && products.length === 0) throw new ApiError(500, null);
  return products.filter((product) => product.available);
}

export function parseStoreProductDetail(
  source: unknown,
): StoreProductDetail | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const base = parseBaseFields(record);
  if (!base) return null;

  const variants = Array.isArray(record.variants)
    ? record.variants
        .map(parseVariant)
        .filter((variant): variant is StoreVariant => variant !== null)
    : [];

  if (variants.length === 0) {
    const fallback = parseVariant(record);
    if (fallback) variants.push(fallback);
  }

  return { ...base, variants };
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function buildQuery(itemStateId: string | number | null | undefined) {
  const query = new URLSearchParams();
  if (itemStateId !== undefined && itemStateId !== null) {
    const value = String(itemStateId).trim();
    if (value) query.set("item_state_id", value);
  }
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export async function fetchStoreProducts(
  itemStateId?: string | number | null,
) {
  const payload = await apiFetch<unknown>(
    `/store/products${buildQuery(itemStateId)}`,
    authOptions(),
  );
  return parseStoreProductList(payload);
}

/**
 * Lista paginada del catálogo del cliente. El API de la tienda solo devuelve
 * variantes disponibles, igual que `parseStoreProductList`, por lo que no se
 * filtra de nuevo en cliente ni se altera `meta.total`.
 */
export async function fetchStoreProductPage(
  query: ListQuery = {},
): Promise<Paginated<StoreProduct>> {
  const payload = await apiFetch<unknown>(
    `/store/products${buildListQuery({
      ...query,
      filters: pickListFilters(query.filters, ["item_state_id"]),
    })}`,
    authOptions(),
  );
  return parsePaginated(payload, parseStoreProduct, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

export async function fetchStoreProduct(
  id: string | number,
  itemStateId?: string | number | null,
) {
  const payload = await apiFetch<unknown>(
    `/store/products/${encodeURIComponent(String(id))}${buildQuery(itemStateId)}`,
    authOptions(),
  );
  const product = parseStoreProductDetail(payload);
  if (!product) throw new ApiError(500, null);
  return product;
}
