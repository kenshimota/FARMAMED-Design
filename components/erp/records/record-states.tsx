"use client";

import Link from "next/link";
import { useId } from "react";
import { Icon } from "@/components/icons";
import { Skeleton, SkeletonTable, SkeletonText } from "@/components/erp/ui/skeleton";

export function RecordsListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4" role="status">
      <span className="sr-only">Cargando productos…</span>
      <div aria-hidden="true" className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Skeleton className="h-16 w-full sm:max-w-xs" />
        <Skeleton className="h-16 w-full sm:max-w-[220px]" />
      </div>
      <div aria-hidden="true" className="rounded-[24px] border border-line bg-surface p-5">
        <SkeletonTable columns={6} rows={6} />
      </div>
    </div>
  );
}

export function RecordsTableSkeleton({
  columns = 4,
  rows = 6,
  label = "Cargando registros…",
}: {
  columns?: number;
  rows?: number;
  label?: string;
}) {
  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="rounded-[24px] border border-line bg-surface p-5">
        <SkeletonTable columns={columns} rows={rows} />
      </div>
    </div>
  );
}

export function RecordsDetailSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5" role="status">
      <span className="sr-only">Cargando el registro…</span>
      <div aria-hidden="true" className="rounded-[28px] border border-line bg-surface p-6 sm:p-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-3 w-40" />
      </div>
      <div
        aria-hidden="true"
        className="grid gap-5 rounded-[28px] border border-line bg-surface p-6 sm:p-8 lg:grid-cols-[280px_minmax(0,1fr)]"
      >
        <Skeleton className="h-52 w-full" />
        <SkeletonText lines={5} />
      </div>
    </div>
  );
}

export function RecordsFormSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5" role="status">
      <span className="sr-only">Cargando el formulario…</span>
      <div
        aria-hidden="true"
        className="rounded-[28px] border border-line bg-surface p-6 sm:p-8"
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-8 w-56 max-w-full" />
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full lg:col-span-2" />
        </div>
      </div>
    </div>
  );
}

type RecordsLoadErrorProps = {
  title: string;
  description: string;
  onRetry?: () => void;
  backHref?: string | null;
  backLabel?: string;
  headingLevel?: "h1" | "h2";
};

export function RecordsLoadError({
  title,
  description,
  onRetry,
  backHref = "/app",
  backLabel = "Volver al inicio",
  headingLevel = "h2",
}: RecordsLoadErrorProps) {
  const Heading = headingLevel;
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-[28px] border border-line bg-surface p-8 text-center shadow-[0_18px_60px_rgba(27,12,104,0.06)] sm:p-12"
    >
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-blue text-alert">
        <Icon name="alert" size={23} />
      </span>
      <Heading
        className="mt-5 text-2xl font-semibold tracking-[-0.035em] text-ink"
        id={titleId}
      >
        {title}
      </Heading>
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
        {backHref && (
          <Link className="button-base button-secondary" href={backHref}>
            {backLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
