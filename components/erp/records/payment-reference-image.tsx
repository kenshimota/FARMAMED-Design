"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import type { ImageRecord } from "@/components/erp/records/records-api";

type PaymentReferenceImageProps = {
  image: ImageRecord | null;
  referenceLabel: string;
  variant?: "thumb" | "full";
  className?: string;
};

export function PaymentReferenceImage({
  image,
  referenceLabel,
  variant = "thumb",
  className = "",
}: PaymentReferenceImageProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source =
    variant === "full"
      ? image?.url || image?.thumbnail || null
      : image?.thumbnail || image?.url || null;
  const failed = Boolean(source && failedSource === source);
  const unavailable = !source || failed;
  const alt = `Comprobante del pago ${referenceLabel}`;

  if (variant === "thumb") {
    if (unavailable) {
      return (
        <span
          aria-label={
            failed
              ? `No se pudo cargar el comprobante del pago ${referenceLabel}`
              : `Sin comprobante para el pago ${referenceLabel}`
          }
          className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-line bg-background text-muted ${className}`}
          role="img"
        >
          <Icon aria-hidden="true" name={failed ? "alert" : "image"} size={18} />
        </span>
      );
    }

    return (
      <span
        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-background ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setFailedSource(source)}
          referrerPolicy="no-referrer"
          src={source}
        />
      </span>
    );
  }

  if (unavailable) {
    return (
      <div
        className={`flex min-h-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-background px-4 py-8 text-center ${className}`}
      >
        <Icon
          aria-hidden="true"
          className="text-muted"
          name={failed ? "alert" : "image"}
          size={26}
        />
        <p className="text-[12px] font-semibold text-muted">
          {failed ? "No se pudo cargar el comprobante" : "Sin comprobante"}
        </p>
        <p className="text-[11px] leading-5 text-muted">
          {failed
            ? "La imagen de referencia no está disponible en este momento."
            : "El pago no tiene una imagen de referencia adjunta."}
        </p>
      </div>
    );
  }

  return (
    <figure className={`space-y-3 ${className}`}>
      <div className="flex max-h-[460px] items-center justify-center overflow-hidden rounded-2xl border border-line bg-background">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          className="h-auto max-h-[460px] w-full object-contain p-3"
          loading="lazy"
          onError={() => setFailedSource(source)}
          referrerPolicy="no-referrer"
          src={source}
        />
      </div>
      {image?.url && (
        <figcaption>
          <a
            className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href={image.url}
            rel="noreferrer"
            target="_blank"
          >
            Abrir comprobante original
            <Icon aria-hidden="true" name="arrow-up-right" size={14} />
          </a>
        </figcaption>
      )}
    </figure>
  );
}
