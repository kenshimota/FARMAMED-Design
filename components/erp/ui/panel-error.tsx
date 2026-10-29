"use client";

import { Icon } from "@/components/icons";

type PanelErrorProps = {
  title?: string;
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function PanelError({
  title,
  description,
  onRetry,
  retryLabel = "Reintentar",
}: PanelErrorProps) {
  return (
    <div className="rounded-2xl border border-alert/30 bg-alert/[0.05] p-5" role="alert">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 shrink-0 text-alert-ink" name="alert" size={20} />
        <div className="min-w-0">
          {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
          <p className={`text-[13px] leading-6 text-muted ${title ? "mt-2" : ""}`}>{description}</p>
          {onRetry && (
            <button
              className="button-base button-secondary mt-4 min-h-11 px-5"
              onClick={onRetry}
              type="button"
            >
              {retryLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
