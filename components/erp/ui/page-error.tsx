"use client";

import Link from "next/link";
import { useId } from "react";
import { Icon } from "@/components/icons";

type PageErrorProps = {
  title?: string;
  description: string;
  onRetry?: () => void;
  homeHref?: string;
};

export function PageError({
  title = "No pudimos cargar esta sección",
  description,
  onRetry,
  homeHref = "/app",
}: PageErrorProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-[28px] border border-line bg-surface p-8 text-center shadow-[0_18px_60px_rgba(27,12,104,0.06)] sm:p-12"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-blue text-alert">
        <Icon name="alert" size={23} />
      </span>
      <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-ink" id={titleId}>
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-[14px] leading-7 text-muted" role="alert">
        {description}
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {onRetry && (
          <button className="button-base button-primary" onClick={onRetry} type="button">
            Reintentar
            <Icon name="arrow-right" size={17} />
          </button>
        )}
        <Link className="button-base button-secondary" href={homeHref}>
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}
