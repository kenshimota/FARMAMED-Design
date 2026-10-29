"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icons";
import { SUCCESS_TOAST_DURATION_MS } from "@/lib/feedback";

export type ToastTone = "success" | "error";

export type ToastAction = () => void | Promise<void>;

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
  retry?: ToastAction;
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string, options?: { retry?: ToastAction }) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let nextToastId = 1;

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const isError = item.tone === "error";

  useEffect(() => {
    if (isError) return;
    const timer = window.setTimeout(() => onDismiss(item.id), SUCCESS_TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isError, item.id, onDismiss]);

  return (
    <div
      className={`toast-enter flex w-full items-start gap-3 rounded-2xl border bg-surface px-4 py-3.5 shadow-[0_16px_44px_rgba(27,12,104,0.12)] ${
        isError ? "border-alert/30" : "border-olive/30"
      }`}
      role={isError ? "alert" : "status"}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          isError ? "bg-alert/[0.1] text-alert-ink" : "bg-soft-lime text-olive"
        }`}
      >
        <Icon name={isError ? "alert" : "check"} size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] leading-6 ${isError ? "text-alert-ink" : "text-ink"}`}>
          {item.message}
        </p>
        {isError && item.retry && (
          <button
            className="mt-2 min-h-11 rounded-full border border-ink/15 px-4 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand"
            onClick={() => {
              onDismiss(item.id);
              void item.retry?.();
            }}
            type="button"
          >
            Reintentar
          </button>
        )}
      </div>
      <button
        aria-label="Cerrar aviso"
        className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-background hover:text-ink"
        onClick={() => onDismiss(item.id)}
        type="button"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success(message) {
        const id = nextToastId++;
        setItems((current) => [
          ...current.filter((item) => item.tone !== "success"),
          { id, tone: "success", message },
        ]);
      },
      error(message, options) {
        const id = nextToastId++;
        setItems((current) => [
          ...current,
          { id, tone: "error", message, retry: options?.retry },
        ]);
      },
      dismiss,
    }),
    [dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex flex-col items-stretch gap-2.5 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]">
        {items.map((item) => (
          <div className="pointer-events-auto" key={item.id}>
            <ToastCard item={item} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("Los avisos solo están disponibles dentro del proveedor de avisos.");
  }
  return context;
}
