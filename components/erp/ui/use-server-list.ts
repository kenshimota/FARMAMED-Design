"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { translateApiError, type UiError } from "@/lib/api-errors";
import {
  DEFAULT_PAGE_SIZE,
  normalizePage,
  normalizePageSize,
  normalizeSortField,
  normalizeSortOrder,
  pageRange,
  readListQuery,
  type ListRequest,
  type Paginated,
  type PaginationMeta,
  type SortOrder,
} from "@/lib/pagination";

export type ServerListStatus = "idle" | "loading" | "refreshing" | "ready" | "error";

export type ServerListInitial = {
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: SortOrder;
  q?: string;
  filters?: Record<string, string>;
};

export type UseServerListOptions<T> = {
  loader: (request: ListRequest) => Promise<Paginated<T>>;
  filterKeys?: readonly string[];
  defaultPageSize?: number;
  defaultSort?: string;
  defaultOrder?: SortOrder;
  enabled?: boolean;
  initial?: ServerListInitial;
};

export type ServerListResult<T> = {
  status: ServerListStatus;
  items: T[];
  meta: PaginationMeta;
  error: UiError | null;
  request: ListRequest;
  searchDraft: string;
  filters: Record<string, string>;
  range: { from: number; to: number };
  isPageOutOfRange: boolean;
  setSearch: (value: string) => void;
  commitSearch: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSort: (sort: string, order?: SortOrder) => void;
  setFilter: (key: string, value: string) => void;
  setFilters: (values: Record<string, string>) => void;
  clearFilters: () => void;
  goToFirstPage: () => void;
  reload: () => void;
};

const SEARCH_DEBOUNCE_MS = 300;

function emptyMeta(pageSize: number): PaginationMeta {
  return {
    page: 1,
    page_size: pageSize,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  };
}

export function useServerList<T>({
  loader,
  filterKeys = [],
  defaultPageSize = DEFAULT_PAGE_SIZE,
  defaultSort = "",
  defaultOrder = "asc",
  enabled = true,
  initial,
}: UseServerListOptions<T>): ServerListResult<T> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialJson = useMemo(
    () => JSON.stringify(initial ?? {}),
    [initial],
  );
  const initialFallback = useMemo(
    () => JSON.parse(initialJson) as ServerListInitial,
    [initialJson],
  );
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const filterKeySignature = filterKeys.join("|");
  const filterKeysRef = useRef(filterKeys);
  filterKeysRef.current = filterKeys;
  const searchParamsString = searchParams.toString();

  const request = useMemo(() => {
    const params = new URLSearchParams(searchParamsString);
    return readListQuery(
      { get: (name) => params.get(name) },
      {
        filterKeys: filterKeySignature ? filterKeySignature.split("|") : [],
        defaultPageSize,
        defaultSort,
        defaultOrder,
        fallback: initialFallback,
      },
    );
  }, [
    defaultOrder,
    defaultPageSize,
    defaultSort,
    filterKeySignature,
    initialFallback,
    searchParamsString,
  ]);

  const requestSignature = useMemo(() => {
    const filters = filterKeysRef.current
      .map((key) => `${key}=${request.filters[key] ?? ""}`)
      .join("&");
    return [
      request.page,
      request.pageSize,
      request.sort,
      request.order,
      request.q,
      filters,
    ].join("|");
  }, [request]);

  const requestRef = useRef(request);
  requestRef.current = request;

  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: ServerListStatus;
    items: T[];
    meta: PaginationMeta;
    error: UiError | null;
  }>({
    status: enabled ? "loading" : "idle",
    items: [],
    meta: emptyMeta(defaultPageSize),
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({
        status: "idle",
        items: [],
        meta: emptyMeta(defaultPageSize),
        error: null,
      });
      return;
    }

    let active = true;
    setState((current) => ({
      status: current.items.length > 0 ? "refreshing" : "loading",
      items: current.items,
      meta: current.meta,
      error: null,
    }));

    async function load() {
      try {
        const result = await loaderRef.current(requestRef.current);
        if (!active) return;
        setState({
          status: "ready",
          items: result.data,
          meta: result.meta,
          error: null,
        });
      } catch (caught) {
        if (!active) return;
        setState((current) => ({
          status: "error",
          items: current.items,
          meta: current.meta,
          error: translateApiError(caught),
        }));
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [attempt, defaultPageSize, enabled, requestSignature]);

  const searchDraftRef = useRef(request.q);
  const [searchDraft, setSearchDraft] = useState(request.q);
  const searchTimer = useRef<number | null>(null);
  const lastSearchSignature = useRef(request.q);

  useEffect(() => {
    if (lastSearchSignature.current === request.q) return;
    lastSearchSignature.current = request.q;
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
    searchDraftRef.current = request.q;
    setSearchDraft(request.q);
  }, [request.q]);

  const replaceUrl = useCallback(
    (mutate: (params: URLSearchParams) => void, mode: "push" | "replace") => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      if (query === searchParams.toString()) return;
      const url = query ? `${pathname}?${query}` : pathname;
      if (mode === "push") {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString);
    const rawPage = params.get("page");
    const rawPageSize = params.get("page_size");
    let changed = false;

    if (rawPage !== null && normalizePage(rawPage) !== request.page) {
      params.set("page", String(request.page));
      changed = true;
    }
    if (
      rawPageSize !== null &&
      normalizePageSize(rawPageSize, defaultPageSize) !== request.pageSize
    ) {
      params.set("page_size", String(request.pageSize));
      changed = true;
    }

    if (!changed) return;
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [
    defaultPageSize,
    pathname,
    request.page,
    request.pageSize,
    router,
    searchParamsString,
  ]);

  const cancelSearchTimer = useCallback(() => {
    if (searchTimer.current !== null) {
      window.clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }, []);

  const applySearchDraft = useCallback((params: URLSearchParams) => {
    const value = searchDraftRef.current.trim();
    if (value) params.set("q", value);
    else params.delete("q");
  }, []);

  const commitSearch = useCallback(() => {
    cancelSearchTimer();
    replaceUrl((params) => {
      applySearchDraft(params);
      params.set("page", "1");
      params.set("page_size", String(requestRef.current.pageSize));
    }, "replace");
  }, [applySearchDraft, cancelSearchTimer, replaceUrl]);

  const setSearch = useCallback(
    (value: string) => {
      searchDraftRef.current = value;
      setSearchDraft(value);
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current);
      }
      searchTimer.current = window.setTimeout(() => {
        searchTimer.current = null;
        const trimmed = value.trim();
        replaceUrl((params) => {
          if (trimmed) params.set("q", trimmed);
          else params.delete("q");
          params.set("page", "1");
          params.set("page_size", String(requestRef.current.pageSize));
        }, "replace");
      }, SEARCH_DEBOUNCE_MS);
    },
    [replaceUrl],
  );

  useEffect(() => {
    return () => {
      if (searchTimer.current !== null) {
        window.clearTimeout(searchTimer.current);
      }
    };
  }, []);

  const setPage = useCallback(
    (page: number) => {
      cancelSearchTimer();
      const next = normalizePage(page);
      replaceUrl((params) => {
        applySearchDraft(params);
        params.set("page", String(next));
        params.set("page_size", String(requestRef.current.pageSize));
      }, "push");
    },
    [applySearchDraft, cancelSearchTimer, replaceUrl],
  );

  const setPageSize = useCallback(
    (pageSize: number) => {
      cancelSearchTimer();
      const next = normalizePageSize(pageSize, defaultPageSize);
      replaceUrl((params) => {
        applySearchDraft(params);
        params.set("page", "1");
        params.set("page_size", String(next));
      }, "replace");
    },
    [applySearchDraft, cancelSearchTimer, defaultPageSize, replaceUrl],
  );

  const setSort = useCallback(
    (sort: string, order: SortOrder = "asc") => {
      cancelSearchTimer();
      const field = normalizeSortField(sort);
      replaceUrl((params) => {
        applySearchDraft(params);
        if (field) {
          params.set("sort", field);
          params.set("order", normalizeSortOrder(order));
        } else {
          params.delete("sort");
          params.delete("order");
        }
        params.set("page", "1");
        params.set("page_size", String(requestRef.current.pageSize));
      }, "replace");
    },
    [applySearchDraft, cancelSearchTimer, replaceUrl],
  );

  const applyFilters = useCallback(
    (values: Record<string, string>) => {
      cancelSearchTimer();
      replaceUrl((params) => {
        applySearchDraft(params);
        for (const key of filterKeysRef.current) {
          const value = values[key]?.trim() ?? "";
          if (value) params.set(key, value);
          else params.delete(key);
        }
        params.set("page", "1");
        params.set("page_size", String(requestRef.current.pageSize));
      }, "replace");
    },
    [applySearchDraft, cancelSearchTimer, replaceUrl],
  );

  const setFilter = useCallback(
    (key: string, value: string) => {
      applyFilters({ ...requestRef.current.filters, [key]: value });
    },
    [applyFilters],
  );

  const setFilters = useCallback(
    (values: Record<string, string>) => {
      applyFilters({ ...requestRef.current.filters, ...values });
    },
    [applyFilters],
  );

  const clearFilters = useCallback(() => {
    cancelSearchTimer();
    searchDraftRef.current = "";
    setSearchDraft("");
    replaceUrl((params) => {
      for (const key of filterKeysRef.current) params.delete(key);
      params.delete("q");
      params.set("page", "1");
      params.set("page_size", String(requestRef.current.pageSize));
    }, "replace");
  }, [cancelSearchTimer, replaceUrl]);

  const goToFirstPage = useCallback(() => {
    cancelSearchTimer();
    replaceUrl((params) => {
      applySearchDraft(params);
      params.set("page", "1");
      params.set("page_size", String(requestRef.current.pageSize));
    }, "replace");
  }, [applySearchDraft, cancelSearchTimer, replaceUrl]);

  const reload = useCallback(() => {
    setState((current) => ({
      status: current.items.length > 0 ? "refreshing" : "loading",
      items: current.items,
      meta: current.meta,
      error: null,
    }));
    setAttempt((current) => current + 1);
  }, []);

  return {
    status: state.status,
    items: state.items,
    meta: state.meta,
    error: state.error,
    request,
    searchDraft,
    filters: request.filters,
    range: pageRange(state.meta),
    isPageOutOfRange: state.meta.total > 0 && state.meta.page > state.meta.total_pages,
    setSearch,
    commitSearch,
    setPage,
    setPageSize,
    setSort,
    setFilter,
    setFilters,
    clearFilters,
    goToFirstPage,
    reload,
  };
}
