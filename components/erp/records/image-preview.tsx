"use client";

import { useState } from "react";

type ImagePreviewProps = {
  src: string | null;
  reference: string;
};

export function ImagePreview({ src, reference }: ImagePreviewProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const unavailable = !src || failedSource === src;
  const initial = reference.trim().charAt(0).toLocaleUpperCase("es") || "?";

  if (unavailable) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-line bg-surface text-xl font-semibold text-brand"
        >
          {initial}
        </span>
        <span className="text-[12px] font-semibold leading-5 text-muted">
          Vista previa no disponible
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={`Miniatura de ${reference}`}
        className="h-full w-full object-contain p-4"
        decoding="async"
        loading="lazy"
        onError={() => setFailedSource(src)}
        referrerPolicy="no-referrer"
        src={src}
      />
    </div>
  );
}
