"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  requireText?: { value: string; label: string };
  onConfirm: () => void | Promise<void>;
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
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
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

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
      return;
    }
    if (event.key !== "Tab") return;

    const panel = panelRef.current;
    if (!panel) return;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (element) => element.getClientRects().length > 0,
    );
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

  async function handleConfirm() {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } catch {
      setBusy(false);
      onClose();
      return;
    }
    setBusy(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/35 p-4 backdrop-blur-[2px] sm:items-center"
      onClick={handleClose}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="w-full max-w-lg rounded-[24px] border border-line bg-surface p-6 shadow-[0_24px_80px_rgba(27,12,104,0.24)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
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
    </div>
  );
}
