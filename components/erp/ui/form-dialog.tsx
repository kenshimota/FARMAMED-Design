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

type FormDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
};

const FOCUSABLE_SELECTOR =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function FormDialog({
  open,
  title,
  description,
  onClose,
  closeDisabled = false,
  children,
}: FormDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [wasOpen, setWasOpen] = useState(false);
  const [returnFocus, setReturnFocus] = useState<HTMLElement | null>(null);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReturnFocus(
        typeof document !== "undefined" && document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
      );
    }
  }

  const handleClose = useCallback(() => {
    if (closeDisabled) return;
    onClose();
  }, [closeDisabled, onClose]);

  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  });

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const preferred = panel?.querySelector<HTMLElement>("[data-autofocus]");
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (preferred ?? firstFocusable ?? panel)?.focus();

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
      const returnTarget = returnFocus;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [open, returnFocus]);

  useEffect(() => {
    if (!open || !closeDisabled) return;
    closeRef.current?.focus();
  }, [closeDisabled, open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/35 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={handleClose}
      ref={overlayRef}
    >
      <div
        aria-busy={closeDisabled || undefined}
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[min(88vh,860px)] w-full max-w-2xl overflow-y-auto rounded-[24px] border border-line bg-surface p-6 shadow-[0_24px_80px_rgba(27,12,104,0.24)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-[-0.025em] text-ink" id={titleId}>
              {title}
            </h2>
            {description && (
              <p className="mt-2 text-[13px] leading-6 text-muted" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <button
            aria-disabled={closeDisabled || undefined}
            aria-label="Cerrar"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors ${
              closeDisabled
                ? "cursor-not-allowed opacity-60"
                : "hover:bg-background hover:text-ink"
            }`}
            onClick={handleClose}
            ref={closeRef}
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
