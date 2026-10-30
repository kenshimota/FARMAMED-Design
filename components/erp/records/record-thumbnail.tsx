"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

type RecordThumbnailProps = {
  src: string | null;
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  loading?: boolean;
};

const SIZE_STYLES = {
  sm: "h-10 w-10",
  md: "h-12 w-12",
  lg: "h-20 w-20",
} as const;

export function RecordThumbnail({
  src,
  label,
  size = "md",
  className = "",
  loading = false,
}: RecordThumbnailProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const unavailable = !src || failedSource === src;
  const dimensionClass = className || SIZE_STYLES[size];

  if (loading) {
    return (
      <span
        aria-busy="true"
        aria-label={`Cargando imagen de ${label}`}
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-background ${dimensionClass}`}
        role="img"
      >
        <span aria-hidden="true" className="skeleton-block h-full w-full rounded-xl" />
      </span>
    );
  }

  if (unavailable) {
    return (
      <span
        aria-label={`Sin imagen para ${label}`}
        className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-background text-muted ${dimensionClass}`}
        role="img"
      >
        <Icon name="image" size={size === "lg" ? 26 : 18} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-background ${dimensionClass}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={`Imagen de ${label}`}
        className="h-full w-full object-contain"
        loading="lazy"
        onError={() => setFailedSource(src)}
        referrerPolicy="no-referrer"
        src={src}
      />
    </span>
  );
}
