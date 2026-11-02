export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

export type SortOrder = "asc" | "desc";

export type PaginationMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

export type ListQuery = {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
  q?: string;
  filters?: Record<string, string | number | boolean | null | undefined>;
};

export type ListRequest = {
  page: number;
  pageSize: number;
  sort: string;
  order: SortOrder;
  q: string;
  filters: Record<string, string>;
};

export class ListPayloadError extends Error {
  constructor() {
    super("Invalid list payload");
    this.name = "ListPayloadError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readWholeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

export function normalizePage(value: unknown): number {
  const parsed = readWholeNumber(value);
  return parsed !== null && parsed >= 1 ? parsed : 1;
}

export function normalizePageSize(
  value: unknown,
  fallback = DEFAULT_PAGE_SIZE,
): number {
  const parsed = readWholeNumber(value);
  if (parsed === null || parsed < 1 || parsed > MAX_PAGE_SIZE) return fallback;
  return parsed;
}

export function normalizeSortOrder(value: unknown): SortOrder {
  return value === "desc" ? "desc" : "asc";
}

export function normalizeSortField(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed) ? trimmed : "";
}

export function pickListFilters(
  filters: ListQuery["filters"],
  keys: readonly string[],
): Record<string, string> {
  if (!filters) return {};
  const picked: Record<string, string> = {};
  for (const key of keys) {
    const value = filters[key];
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) picked[key] = normalized;
  }
  return picked;
}

export function buildListQuery(query: ListQuery = {}): string {
  const params = new URLSearchParams();
  params.set("page", String(normalizePage(query.page)));
  params.set(
    "page_size",
    String(normalizePageSize(query.pageSize)),
  );

  const sort = normalizeSortField(query.sort);
  if (sort) {
    params.set("sort", sort);
    params.set("order", normalizeSortOrder(query.order));
  }

  const search = query.q?.trim();
  if (search) params.set("q", search);

  for (const [key, raw] of Object.entries(query.filters ?? {})) {
    if (raw === null || raw === undefined) continue;
    const value = String(raw).trim();
    if (value) params.set(key, value);
  }

  return `?${params.toString()}`;
}

export function readPaginationMeta(payload: unknown): PaginationMeta | null {
  if (!isRecord(payload) || !isRecord(payload.meta)) return null;
  const meta = payload.meta;

  const page = readWholeNumber(meta.page);
  const pageSize = readWholeNumber(meta.page_size);
  const total = readWholeNumber(meta.total);
  if (page === null || pageSize === null || total === null) return null;

  const totalPages =
    readWholeNumber(meta.total_pages) ??
    (pageSize > 0 ? Math.ceil(total / pageSize) : 0);
  const hasNext =
    typeof meta.has_next === "boolean" ? meta.has_next : page < totalPages;
  const hasPrev =
    typeof meta.has_prev === "boolean" ? meta.has_prev : page > 1;

  return {
    page: Math.max(1, page),
    page_size: Math.max(1, pageSize),
    total: Math.max(0, total),
    total_pages: Math.max(0, totalPages),
    has_next: hasNext,
    has_prev: hasPrev,
  };
}

function readPayloadList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new ListPayloadError();
}

export function parsePaginated<T>(
  payload: unknown,
  parseItem: (source: unknown) => T | null,
  options: { page?: number; pageSize?: number } = {},
): Paginated<T> {
  const list = readPayloadList(payload);
  const data = list
    .map(parseItem)
    .filter((item): item is T => item !== null);

  if (list.length > 0 && data.length === 0) throw new ListPayloadError();

  const meta = readPaginationMeta(payload);
  if (meta) return { data, meta };

  const requestedPageSize = normalizePageSize(options.pageSize);
  const pageSize = Math.max(data.length, requestedPageSize);
  return {
    data,
    meta: {
      page: 1,
      page_size: pageSize,
      total: data.length,
      total_pages: data.length > 0 ? 1 : 0,
      has_next: false,
      has_prev: false,
    },
  };
}

export function pageRange(meta: PaginationMeta) {
  if (meta.total === 0 || meta.total_pages === 0 || meta.page > meta.total_pages) {
    return { from: 0, to: 0 };
  }
  const from = (meta.page - 1) * meta.page_size + 1;
  const to = Math.min(meta.page * meta.page_size, meta.total);
  return from > to ? { from: 0, to: 0 } : { from, to };
}

export function isPageOutOfRange(meta: PaginationMeta) {
  return meta.total > 0 && meta.page > meta.total_pages;
}

export function readListQuery(
  searchParams: { get(name: string): string | null },
  options: {
    filterKeys?: readonly string[];
    defaultPageSize?: number;
    defaultSort?: string;
    defaultOrder?: SortOrder;
    fallback?: {
      page?: number;
      pageSize?: number;
      sort?: string;
      order?: SortOrder;
      q?: string;
      filters?: Record<string, string>;
    };
  } = {},
): ListRequest {
  const fallback = options.fallback;
  const filterKeys = options.filterKeys ?? [];
  const filters: Record<string, string> = {};

  for (const key of filterKeys) {
    const value = searchParams.get(key) ?? fallback?.filters?.[key] ?? "";
    filters[key] = value.trim();
  }

  return {
    page: normalizePage(searchParams.get("page") ?? fallback?.page),
    pageSize: normalizePageSize(
      searchParams.get("page_size") ?? fallback?.pageSize,
      options.defaultPageSize ?? DEFAULT_PAGE_SIZE,
    ),
    sort: normalizeSortField(
      searchParams.get("sort") ?? fallback?.sort ?? options.defaultSort,
    ),
    order: normalizeSortOrder(
      searchParams.get("order") ?? fallback?.order ?? options.defaultOrder,
    ),
    q: (searchParams.get("q") ?? fallback?.q ?? "").trim(),
    filters,
  };
}
