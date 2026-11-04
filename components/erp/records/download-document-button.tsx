"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { documentErrorCopy } from "@/components/erp/records/document-api";
import { buildLoginUrl, getCurrentReturnPath } from "@/lib/session-store";

type DownloadDocumentButtonProps = {
  label: string;
  accessibleLabel?: string;
  busyLabel?: string;
  successMessage: string;
  onDownload: () => Promise<unknown>;
  onError?: (caught: unknown) => void;
  variant?: "primary" | "secondary";
  className?: string;
  supportingText?: ReactNode;
  disabled?: boolean;
};

export function DownloadDocumentButton({
  label,
  accessibleLabel,
  busyLabel = "Generando PDF…",
  successMessage,
  onDownload,
  onError,
  variant = "primary",
  className = "",
  supportingText,
  disabled = false,
}: DownloadDocumentButtonProps) {
  const messageId = useId();
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setCanRetry(false);
    setErrorStatus(null);
    setAnnouncement("");
    try {
      await onDownload();
      setAnnouncement(successMessage);
    } catch (caught) {
      const info = documentErrorCopy(caught);
      setError(info.message);
      setCanRetry(info.canRetry);
      setErrorStatus(info.status);
      onError?.(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        aria-busy={busy || undefined}
        aria-describedby={error ? messageId : undefined}
        aria-label={busy ? busyLabel : (accessibleLabel ?? label)}
        className={`button-base min-h-11 px-5 text-[13px] ${
          variant === "primary" ? "button-primary" : "button-secondary"
        }`}
        disabled={disabled || busy}
        onClick={() => void handleClick()}
        type="button"
      >
        <Icon aria-hidden="true" name="download" size={16} />
        <span>{busy ? busyLabel : label}</span>
      </button>

      {supportingText && (
        <p className="mt-2 text-[12px] leading-5 text-muted">{supportingText}</p>
      )}

      {error ? (
        <div id={messageId}>
          <p
            aria-live="polite"
            className="mt-2 text-[12px] font-semibold leading-5 text-alert-ink"
            role="alert"
          >
            {error}
          </p>
          {canRetry && (
            <button
              className="mt-2 min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold text-alert-ink transition-colors hover:bg-surface"
              onClick={() => void handleClick()}
              type="button"
            >
              Reintentar
            </button>
          )}
          {errorStatus === 401 && (
            <Link
              className="mt-2 inline-flex min-h-11 items-center text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={buildLoginUrl(getCurrentReturnPath(), "expirada")}
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      ) : (
        <p aria-live="polite" className="sr-only">
          {busy ? busyLabel : announcement}
        </p>
      )}
    </div>
  );
}
