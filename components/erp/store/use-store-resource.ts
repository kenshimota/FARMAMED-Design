"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type StoreResourceStatus =
  | "loading"
  | "refreshing"
  | "ready"
  | "error";

export type StoreResource<T> = {
  status: StoreResourceStatus;
  data: T | null;
  error: unknown | null;
  reload: () => void;
};

export function useStoreResource<T>(
  loader: () => Promise<T>,
  key: string,
): StoreResource<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const keyRef = useRef(key);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    status: StoreResourceStatus;
    data: T | null;
    error: unknown | null;
  }>({ status: "loading", data: null, error: null });

  const reload = useCallback(() => {
    setState((current) =>
      current.data !== null
        ? { status: "refreshing", data: current.data, error: null }
        : { status: "loading", data: null, error: null },
    );
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    const keyChanged = keyRef.current !== key;
    keyRef.current = key;

    setState((current) => {
      if (!keyChanged && current.data !== null) {
        return { status: "refreshing", data: current.data, error: null };
      }
      return { status: "loading", data: null, error: null };
    });

    let active = true;

    async function load() {
      try {
        const data = await loaderRef.current();
        if (active) setState({ status: "ready", data, error: null });
      } catch (error) {
        if (!active) return;
        setState((current) => ({
          status: "error",
          data: current.data,
          error,
        }));
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [attempt, key]);

  return {
    status: state.status,
    data: state.data,
    error: state.error,
    reload,
  };
}
