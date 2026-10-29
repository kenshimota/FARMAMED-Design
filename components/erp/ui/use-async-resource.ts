"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { translateApiError, type UiError } from "@/lib/api-errors";

export type AsyncResourceStatus = "idle" | "loading" | "refreshing" | "ready" | "error";

export type AsyncResource<T> = {
  status: AsyncResourceStatus;
  data: T | null;
  error: UiError | null;
  reload: () => void;
};

export function useAsyncResource<T>(
  loader: () => Promise<T>,
  { enabled = true }: { enabled?: boolean } = {},
): AsyncResource<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: AsyncResourceStatus;
    data: T | null;
    error: UiError | null;
  }>({ status: enabled ? "loading" : "idle", data: null, error: null });

  const reload = useCallback(() => {
    setState((current) => ({
      status: current.data !== null ? "refreshing" : "loading",
      data: current.data,
      error: null,
    }));
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({ status: "idle", data: null, error: null });
      return;
    }
    let active = true;

    setState((current) =>
      current.status === "idle"
        ? { status: "loading", data: current.data, error: null }
        : current,
    );

    async function load() {
      try {
        const data = await loaderRef.current();
        if (active) setState({ status: "ready", data, error: null });
      } catch (caught) {
        if (!active) return;
        setState((current) => ({
          status: "error",
          data: current.data,
          error: translateApiError(caught),
        }));
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [attempt, enabled]);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    reload,
  };
}
