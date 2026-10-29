"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { translateApiError, type UiError } from "@/lib/api-errors";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  requireText?: { value: string; label: string };
  onConfirm: () => void | Promise<void>;
  onError: (error: UiError) => void;
  onClose: () => void;
};

const FOCUSABLE_SELECTOR =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  requireText,
  onConfirm,
  onError,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [prevOpen, setPrevOpen] = useState(open);

  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) setTyped("");
  }

  const canConfirm = !requireText || typed.trim() === requireText.value;

  const handleClose = useCallback(() => {
    if (busy) return;
    onClose();
  }, [busy, onClose]);

  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        handleCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const currentPanel = panelRef.current;
      if (!currentPanel) return;
      const focusable = Array.from(
        currentPanel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    const overlay = overlayRef.current;
    const muted: { element: HTMLElement; previous: string | null }[] = [];
    for (const child of Array.from(document.body.children)) {
      const element = child as HTMLElement;
      if (element === overlay) continue;
      muted.push({ element, previous: element.getAttribute("inert") });
      element.setAttribute("inert", "");
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const { element, previous } of muted) {
        if (previous === null) element.removeAttribute("inert");
        else element.setAttribute("inert", previous);
      }
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  async function handleConfirm() {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } catch (caught) {
      setBusy(false);
      try {
        onError(translateApiError(caught));
      } finally {
        onClose();
      }
      return;
    }
    setBusy(false);
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/35 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={handleClose}
      ref={overlayRef}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-[24px] border border-line bg-surface p-6 shadow-[0_24px_80px_rgba(27,12,104,0.24)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-alert/[0.08] text-alert-ink">
            <Icon name="alert" size={21} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-ink" id={titleId}>
              {title}
            </h2>
            {description && (
              <div className="mt-2 text-[13px] leading-6 text-muted" id={descriptionId}>
                {description}
              </div>
            )}
          </div>
        </div>

        {requireText && (
          <div className="mt-5">
            <label className="mb-2 block text-[13px] font-semibold text-ink" htmlFor={`${titleId}-confirmacion`}>
              {requireText.label}
            </label>
            <input
              autoComplete="off"
              className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors focus:border-brand"
              id={`${titleId}-confirmacion`}
              onChange={(event) => setTyped(event.target.value)}
              type="text"
              value={typed}
            />
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="button-base button-primary disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-[150px]"
            disabled={busy}
            onClick={handleClose}
            type="button"
          >
            {cancelLabel}
          </button>
          <BusyButton
            busy={busy}
            className="sm:min-w-[150px]"
            disabled={!canConfirm}
            onClick={() => void handleConfirm()}
            type="button"
            variant="danger"
          >
            {confirmLabel}
          </BusyButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
