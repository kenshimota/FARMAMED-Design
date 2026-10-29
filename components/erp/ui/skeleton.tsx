import type { CSSProperties, ReactNode } from "react";

type SkeletonProps = {
  className?: string;
  style?: CSSProperties;
};

export function Skeleton({ className = "", style }: SkeletonProps) {
  return <div aria-hidden="true" className={`skeleton-block ${className}`} style={style} />;
}

export function SkeletonText({ lines = 2, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          className={`h-3 ${index === lines - 1 ? "w-2/3" : "w-full"}`}
          key={index}
        />
      ))}
    </div>
  );
}

export function SkeletonPanel({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <SkeletonText lines={lines} />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}

export function SkeletonTable({
  rows = 5,
  columns = 4,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div aria-hidden="true" className="space-y-2">
      <div className="flex gap-3 border-b border-line pb-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton className={`h-3 ${index === 0 ? "w-28" : "w-20"}`} key={index} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className="flex items-center gap-3 py-1" key={rowIndex}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              className={`h-3 ${columnIndex === 0 ? "w-32" : "w-20"}`}
              key={columnIndex}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadingRegion({
  label = "Cargando…",
  children,
  className = "",
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={className} role="status">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
