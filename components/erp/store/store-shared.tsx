"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { RecordThumbnail } from "@/components/erp/records/record-thumbnail";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { Skeleton } from "@/components/erp/ui/skeleton";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import type { CustomerAccessIssue } from "@/lib/customer";
import { formatInteger, formatMoney, formatUnits } from "@/lib/format";
import type { StoreCurrency } from "@/lib/store";

export const STORE_CART_FULL_MESSAGE =
  "Tu pedido ya tiene 50 líneas. Quita o ajusta una línea antes de agregar otro producto.";

export const STORE_CART_ADD_ERROR =
  "No pudimos agregar este producto a tu pedido. Intenta de nuevo.";

export type StoreFeedback = {
  tone: "success" | "error";
  message: string;
};

export function StoreFeedbackBanner({
  feedback,
}: {
  feedback: StoreFeedback | null;
}) {
  if (!feedback) return null;

  return (
    <NoticeBanner
      role={feedback.tone === "error" ? "alert" : "status"}
      tone={feedback.tone === "error" ? "danger" : "success"}
    >
      {feedback.message}
    </NoticeBanner>
  );
}

export function formatStoreMoney(
  price: number,
  currency: StoreCurrency | null,
) {
  return formatMoney(price, {
    code: currency?.code,
    symbol: currency?.symbol,
  });
}

export function StoreImage({
  src,
  label,
  className,
}: {
  src: string | null;
  label: string;
  className: string;
}) {
  return (
    <RecordThumbnail
      className={className}
      label={label}
      size="lg"
      src={src}
    />
  );
}

export function StoreAvailability({
  available,
  className = "",
}: {
  available: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        available
          ? "border-olive/35 bg-soft-lime text-ink"
          : "border-alert/25 bg-alert/[0.06] text-alert-ink"
      } ${className}`}
    >
      <Icon
        aria-hidden="true"
        className={available ? "text-olive" : "text-alert-ink"}
        name={available ? "check" : "close"}
        size={13}
      />
      {available ? "Disponible" : "Agotado"}
    </span>
  );
}

export function StoreItemStateBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
      <Icon aria-hidden="true" name="tag" size={13} />
      {label}
    </span>
  );
}

const ACCOUNT_ISSUE_COPY: Record<
  CustomerAccessIssue,
  { title: string; description: string }
> = {
  vinculo: {
    title: "Tu cuenta aún no está vinculada a un cliente.",
    description:
      "Un administrador debe completar el vínculo de tu usuario con un cliente para habilitar la tienda.",
  },
  lista: {
    title: "Tu cuenta no tiene una lista de precios asignada.",
    description:
      "Para ver precios y disponibilidad, un administrador debe asignarte una lista de precios.",
  },
};

export function StoreAccountIssue({
  reason,
  onRetry,
}: {
  reason: CustomerAccessIssue;
  onRetry?: () => void;
}) {
  const copy = ACCOUNT_ISSUE_COPY[reason];

  return (
    <section
      aria-labelledby="titulo-tienda-cuenta"
      className="mx-auto w-full max-w-2xl rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9"
    >
      <span className="eyebrow">Tienda</span>
      <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-soft-lime text-olive">
        <Icon name="shield" size={23} />
      </span>
      <h1
        className="mt-5 text-balance text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl"
        id="titulo-tienda-cuenta"
      >
        Cuenta incompleta
      </h1>
      <p className="mt-4 text-[15px] font-semibold leading-7 text-ink" role="status">
        {copy.title}
      </p>
      <p className="mt-2 text-[14px] leading-7 text-muted">{copy.description}</p>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link className="button-base button-primary" href="/app/cuenta">
          Ir a mi cuenta
          <Icon name="arrow-right" size={17} />
        </Link>
        {onRetry && (
          <button
            className="button-base button-secondary"
            onClick={onRetry}
            type="button"
          >
            Reintentar
          </button>
        )}
        <Link className="button-base button-secondary" href="/app">
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}

export type StoreErrorCopy = {
  title: string;
  description: string;
  canRetry: boolean;
  backHref?: string;
  backLabel?: string;
};

export function describeStoreError(
  error: unknown,
  context: "catalog" | "detail",
): StoreErrorCopy {
  if (error instanceof ApiError) {
    if (error.isUserBlocked()) {
      return {
        title: "Tu cuenta está bloqueada.",
        description: "Contacta al administrador para revisar el acceso de tu cuenta.",
        canRetry: false,
        backHref: "/app/login",
        backLabel: "Iniciar sesión",
      };
    }

    switch (error.status) {
      case 401:
        return {
          title: "Tu sesión expiró.",
          description: "Inicia sesión de nuevo para continuar en la tienda.",
          canRetry: false,
          backHref: "/app/login",
          backLabel: "Iniciar sesión",
        };
      case 403:
        return {
          title: "No pudimos habilitar la tienda de tu cuenta.",
          description:
            "Contacta al administrador para revisar el vínculo del cliente y la lista de precios.",
          canRetry: false,
          backHref: "/app/cuenta",
          backLabel: "Ir a mi cuenta",
        };
      case 404:
        return context === "detail"
          ? {
              title: "Este producto ya no está disponible.",
              description:
                "Puede que se haya retirado de tu lista o que el enlace no sea válido.",
              canRetry: false,
              backHref: "/app/tienda",
              backLabel: "Volver a la tienda",
            }
          : {
              title: "No encontramos la tienda.",
              description: "Revisa el enlace o vuelve a iniciar sesión.",
              canRetry: false,
              backHref: "/app",
              backLabel: "Volver al inicio",
            };
      case 422:
        return context === "detail"
          ? {
              title: "No pudimos abrir este producto.",
              description:
                "El identificador o el estado seleccionado no son válidos. Vuelve a la tienda y elige otro producto.",
              canRetry: false,
              backHref: "/app/tienda",
              backLabel: "Volver a la tienda",
            }
          : {
              title: "El filtro seleccionado no es válido.",
              description:
                "Elige otro estado o limpia los filtros para continuar.",
              canRetry: false,
              backHref: "/app/tienda",
              backLabel: "Volver a la tienda",
            };
      case 503:
        return {
          title: "La tienda no está disponible en este momento.",
          description: "Intenta de nuevo más tarde.",
          canRetry: true,
        };
      default:
        break;
    }
  }

  const translated = translateApiError(error);
  return {
    title:
      context === "detail"
        ? "No pudimos cargar este producto."
        : "No pudimos cargar la tienda.",
    description: translated.message,
    canRetry: translated.canRetry,
  };
}

export function StoreErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Reintentar",
  backHref,
  backLabel,
  headingLevel = "h2",
  children,
}: StoreErrorCopy & {
  onRetry?: () => void;
  retryLabel?: string;
  headingLevel?: "h1" | "h2";
  children?: ReactNode;
}) {
  const titleId = useId();
  const Heading = headingLevel;

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
      {children && <div className="mt-5">{children}</div>}
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        {onRetry && (
          <button
            className="button-base button-primary"
            onClick={onRetry}
            type="button"
          >
            {retryLabel}
            <Icon name="arrow-right" size={17} />
          </button>
        )}
        {backHref && backLabel && (
          <Link className="button-base button-secondary" href={backHref}>
            {backLabel}
          </Link>
        )}
      </div>
    </section>
  );
}

export function StoreGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">Cargando productos de la tienda…</span>
      <div
        aria-hidden="true"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: count }, (_, index) => (
          <div
            className="rounded-[24px] border border-line bg-surface p-4"
            key={index}
          >
            <Skeleton className="h-44 w-full" />
            <Skeleton className="mt-4 h-3 w-24" />
            <Skeleton className="mt-3 h-5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <Skeleton className="mt-6 h-8 w-28" />
            <Skeleton className="mt-4 h-11 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StoreDetailSkeleton() {
  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">Cargando el producto…</span>
      <div aria-hidden="true" className="space-y-5">
        <div className="rounded-[28px] border border-line bg-surface p-6 sm:p-8">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-8 w-64 max-w-full" />
          <Skeleton className="mt-3 h-3 w-40" />
        </div>
        <div className="grid gap-6 rounded-[28px] border border-line bg-surface p-5 sm:p-7 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <Skeleton className="h-72 w-full" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-48 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function clampQuantity(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(999, Math.max(1, Math.trunc(value)));
}

export function StoreQuantitySelector({
  id,
  productName,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  productName: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const helpId = `${id}-ayuda`;

  return (
    <div>
      <label
        className="block text-[13px] font-semibold text-ink"
        htmlFor={id}
      >
        Cantidad para {productName}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <button
          aria-label={`Disminuir cantidad para ${productName}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-surface text-lg font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || value <= 1}
          onClick={() => onChange(clampQuantity(value - 1))}
          type="button"
        >
          <span aria-hidden="true">−</span>
        </button>
        <input
          aria-describedby={helpId}
          className="h-11 w-20 rounded-xl border border-ink/15 bg-surface px-3 text-center text-[15px] font-semibold text-ink transition-colors hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          id={id}
          inputMode="numeric"
          max={999}
          min={1}
          name={id}
          onChange={(event) =>
            onChange(clampQuantity(Number(event.target.value)))
          }
          type="number"
          value={value}
        />
        <button
          aria-label={`Aumentar cantidad para ${productName}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 bg-surface text-lg font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || value >= 999}
          onClick={() => onChange(clampQuantity(value + 1))}
          type="button"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-muted" id={helpId}>
        Entre 1 y 999 unidades.
      </p>
    </div>
  );
}

export function storeCountLabel(count: number) {
  return count === 1 ? "1 producto" : `${formatInteger(count)} productos`;
}

export function storeQuantityLabel(count: number) {
  return formatUnits(count);
}
