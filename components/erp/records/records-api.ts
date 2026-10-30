import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type RecordId = number | string;

export type ProductRecord = {
  id: RecordId;
  name: string;
  description: string;
  reference: string;
  category_id: RecordId;
  image_id: RecordId;
};

export type CategoryRecord = {
  id: RecordId;
  name: string;
};

export type ImageRecord = {
  id: RecordId;
  url: string;
  pathname: string | null;
  reference: string;
  thumbnail: string | null;
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

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function readCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new ApiError(500, null);
}

export function parseProduct(source: unknown): ProductRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const categoryId = readId(record.category_id);
  const imageId = readId(record.image_id);
  const name = readText(record.name);
  const reference = readText(record.reference);
  if (id === null || categoryId === null || imageId === null || !name || !reference) {
    return null;
  }

  return {
    id,
    name,
    description: readText(record.description),
    reference,
    category_id: categoryId,
    image_id: imageId,
  };
}

export function parseProductList(payload: unknown): ProductRecord[] {
  const list = readCollection(payload);
  const products = list
    .map(parseProduct)
    .filter((product): product is ProductRecord => product !== null);
  if (list.length > 0 && products.length === 0) throw new ApiError(500, null);
  return products.sort((first, second) => Number(first.id) - Number(second.id));
}

export function parseCategory(source: unknown): CategoryRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;
  const id = readId(record.id);
  const name = readText(record.name);
  if (id === null || !name) return null;
  return { id, name };
}

export function parseCategoryList(payload: unknown): CategoryRecord[] {
  const list = readCollection(payload);
  const categories = list
    .map(parseCategory)
    .filter((category): category is CategoryRecord => category !== null);
  if (list.length > 0 && categories.length === 0) throw new ApiError(500, null);
  return categories;
}

export function parseImage(source: unknown): ImageRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;
  const id = readId(record.id);
  const url = readText(record.url);
  const reference = readText(record.reference);
  if (id === null || !url || !reference) return null;
  return {
    id,
    url,
    pathname: readText(record.pathname) || null,
    reference,
    thumbnail: readText(record.thumbnail) || null,
  };
}

export function parseImageList(payload: unknown): ImageRecord[] {
  const list = readCollection(payload);
  const images = list
    .map(parseImage)
    .filter((image): image is ImageRecord => image !== null);
  if (list.length > 0 && images.length === 0) throw new ApiError(500, null);
  return images;
}

export function getImageSource(image: ImageRecord | null | undefined) {
  return image?.thumbnail || image?.url || null;
}

export function getImagePreviewSource(image: ImageRecord | null | undefined) {
  return image?.url || image?.thumbnail || null;
}

export function findById<T extends { id: RecordId }>(items: T[], id: RecordId) {
  const key = String(id);
  return items.find((item) => String(item.id) === key) ?? null;
}

export function isPositiveRecordId(value: string | null | undefined) {
  return Boolean(value && /^[1-9]\d*$/.test(value));
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchProducts() {
  const payload = await apiFetch<unknown>("/products", authOptions());
  return parseProductList(payload);
}

export async function fetchProduct(id: string) {
  const payload = await apiFetch<unknown>(
    `/products/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const product = parseProduct(payload);
  if (!product) throw new ApiError(500, null);
  return product;
}

export async function fetchCategories() {
  const payload = await apiFetch<unknown>("/categories", authOptions());
  return parseCategoryList(payload);
}

export async function fetchImages() {
  const payload = await apiFetch<unknown>("/images", authOptions());
  return parseImageList(payload);
}

export function deleteProduct(id: RecordId) {
  return apiFetch<void>(`/products/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
