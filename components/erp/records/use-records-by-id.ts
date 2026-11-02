"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseRecordsByIdOptions<T> = {
  ids: Array<string | number>;
  load: (id: string) => Promise<T>;
  getId: (item: T) => string | number;
};

type RecordsByIdState<T> = {
  records: Record<string, T>;
  loading: boolean;
  failed: boolean;
};

export function useRecordsById<T>({
  ids,
  load,
  getId,
}: UseRecordsByIdOptions<T>) {
  const key = [...new Set(ids.map(String))].sort().join("|");
  const loadRef = useRef(load);
  const getIdRef = useRef(getId);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<RecordsByIdState<T>>({
    records: {},
    loading: false,
    failed: false,
  });

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    getIdRef.current = getId;
  }, [getId]);

  useEffect(() => {
    let active = true;
    const uniqueIds = key ? key.split("|") : [];

    if (uniqueIds.length === 0) return;

    async function loadAll() {
      setState((current) => ({
        records: current.records,
        loading: true,
        failed: false,
      }));

      try {
        const results = await Promise.allSettled(
          uniqueIds.map((id) => loadRef.current(id)),
        );
        if (!active) return;
        const records: Record<string, T> = {};
        let failed = false;
        for (const result of results) {
          if (result.status === "fulfilled") {
            records[String(getIdRef.current(result.value))] = result.value;
          } else {
            failed = true;
          }
        }
        setState({ records, loading: false, failed });
      } catch {
        if (active) setState({ records: {}, loading: false, failed: true });
      }
    }

    void loadAll();
    return () => {
      active = false;
    };
  }, [attempt, key]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...state, reload };
}
