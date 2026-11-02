"use client";

import Link from "next/link";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CustomerPageHeader } from "@/components/erp/customer-page-header";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { Skeleton } from "@/components/erp/ui/skeleton";
import { RecordThumbnail } from "@/components/erp/records/record-thumbnail";
import { orderMoney } from "@/components/erp/records/orders-shared";
import {
  cartLineSubtotal,
  cartLineCount,
  cartUnitCount,
  summarizeCart,
} from "@/lib/cart-summary";
import {
  CART_MAX_LINES,
  removeCartLine,
  updateCartQuantity,
  type CartLine,
} from "@/lib/cart";
import { useCart } from "@/components/erp/use-cart";
import { formatInteger } from "@/lib/format";

const STOCK_NOTICE =
  "El stock se reserva cuando el equipo de Farmamed aprueba tu pedido.";

function customerIdFrom(user: ReturnType<typeof useSession>["user"]) {
  return user.customer_id ?? user.customer?.id ?? null;
}

function parseQuantity(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 3);
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function CartLoading() {
  return (
    <div aria-busy="true" className="space-y-5" role="status">
      <span className="sr-only">Cargando tu carrito…</span>
      <div className="rounded-[28px] border border-line bg-surface p-6 sm:p-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-48" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-3xl" />
          <Skeleton className="h-40 w-full rounded-3xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    </div>
  );
}

function QuantityControl({
  line,
  onChange,
}: {
  line: CartLine;
  onChange: (quantity: number) => void;
}) {
  const [value, setValue] = useState(String(line.quantity));
  const [syncedQuantity, setSyncedQuantity] = useState(line.quantity);

  if (line.quantity !== syncedQuantity) {
    setSyncedQuantity(line.quantity);
    setValue(String(line.quantity));
  }

  function commit(next: number) {
    const normalized = Math.min(999, Math.max(1, next));
    setValue(String(normalized));
    if (normalized !== line.quantity) onChange(normalized);
  }

  function restoreOrCommit() {
    const parsed = parseQuantity(value);
    if (parsed === null) {
      setValue(String(line.quantity));
      return;
    }
    setValue(String(parsed));
    if (parsed !== line.quantity) onChange(parsed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.blur();
  }

  const current = parseQuantity(value) ?? line.quantity;

  return (
    <div
      aria-label={`Cantidad de ${line.name}`}
      className="flex items-center gap-1 rounded-full border border-line bg-background p-1"
      role="group"
    >
      <button
        aria-label={`Disminuir la cantidad de ${line.name}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold leading-none text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        disabled={current <= 1}
        onClick={() => commit(current - 1)}
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        <span aria-hidden="true">−</span>
      </button>
      <input
        aria-label={`Cantidad de ${line.name}`}
        autoComplete="off"
        className="h-11 w-14 rounded-full border border-transparent bg-transparent text-center text-[15px] font-semibold tabular-nums text-ink focus:border-brand/40 focus:bg-surface"
        inputMode="numeric"
        maxLength={3}
        name={`cantidad-${line.productId}-${line.itemStateId}`}
        onBlur={restoreOrCommit}
        onChange={(event) =>
          setValue(event.target.value.replace(/\D/g, "").slice(0, 3))
        }
        onKeyDown={handleKeyDown}
        value={value}
      />
      <button
        aria-label={`Aumentar la cantidad de ${line.name}`}
        className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold leading-none text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
        disabled={current >= 999}
        onClick={() => commit(current + 1)}
        onMouseDown={(event) => event.preventDefault()}
        type="button"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

function EmptyCart({
  headingRef,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const hintId = useId();

  return (
    <div className="space-y-5">
      <CustomerPageHeader
        description="Revisa las líneas de tu pedido antes de crear el borrador."
        eyebrow="Tu pedido"
        headingRef={headingRef}
        title="Carrito"
      />
      <EmptyState
        action={
          <div className="flex flex-col items-center gap-2">
            <Link className="button-base button-primary" href="/app">
              Volver al inicio
              <Icon name="arrow-right" size={17} />
            </Link>
            <button
              aria-describedby={hintId}
              className="button-base button-secondary cursor-not-allowed opacity-70"
              disabled
              type="button"
            >
              Ver la tienda
            </button>
            <p
              className="max-w-xs text-[11px] font-medium leading-5 text-muted"
              id={hintId}
            >
              La tienda estará disponible cuando se habilite el catálogo del
              cliente.
            </p>
          </div>
        }
        description="Agrega productos desde la tienda para comenzar un pedido."
        headingLevel={2}
        title="Tu pedido está vacío."
      />
    </div>
  );
}

export function CustomerCart() {
  const { user } = useSession();
  const customerId = customerIdFrom(user);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lines = useCart(customerId);
  const loaded = lines !== null;
  const empty = loaded && lines.length === 0;
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (loaded) headingRef.current?.focus({ preventScroll: true });
  }, [empty, loaded]);

  if (user.role !== "customer") {
    return (
      <AccessState description="El carrito pertenece al portal del cliente. Usa la navegación del ERP para continuar." />
    );
  }

  if (customerId === null) {
    return (
      <EmptyState
        description="Contacta al administrador para vincular tu cuenta a un cliente."
        title="Tu cuenta no está vinculada a un cliente."
      />
    );
  }

  if (lines === null) return <CartLoading />;

  if (lines.length === 0) return <EmptyCart headingRef={headingRef} />;

  const summaries = summarizeCart(lines);
  const totalLines = cartLineCount(lines);
  const totalUnits = cartUnitCount(lines);

  function changeQuantity(line: CartLine, quantity: number) {
    updateCartQuantity(
      String(customerId),
      line.productId,
      line.itemStateId,
      quantity,
    );
    setAnnouncement(
      `${line.name}: cantidad ${formatInteger(quantity)}. Subtotal ${orderMoney(
        cartLineSubtotal({ ...line, quantity }),
        { code: line.currencyCode, symbol: line.currencySymbol },
      )}.`,
    );
  }

  function removeLine(line: CartLine) {
    removeCartLine(String(customerId), line.productId, line.itemStateId);
    setAnnouncement(`${line.name} se quitó del pedido.`);
  }

  return (
    <div className="space-y-5">
      <CustomerPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app"
          >
            Volver al inicio
          </Link>
        }
        description="Ajusta las cantidades antes de finalizar. Los precios provienen de tu lista y el servidor confirma el total al crear el borrador."
        eyebrow="Tu pedido"
        headingRef={headingRef}
        title="Carrito"
      />

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {lines.length >= CART_MAX_LINES && (
        <NoticeBanner role="alert" tone="warning">
          Tu carrito alcanzó el máximo de {CART_MAX_LINES} líneas permitidas.
          Para agregar otra variante, quita una línea.
        </NoticeBanner>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="lineas-carrito" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              className="text-lg font-semibold tracking-[-0.03em] text-ink"
              id="lineas-carrito"
            >
              Líneas del pedido
            </h2>
            <p className="text-[12px] font-medium text-muted">
              {totalLines === 1 ? "1 línea" : `${formatInteger(totalLines)} líneas`}
              {" · "}
              {totalUnits === 1 ? "1 unidad" : `${formatInteger(totalUnits)} unidades`}
            </p>
          </div>

          <ul className="space-y-4">
            {lines.map((line, index) => {
              const lineSubtotal = cartLineSubtotal(line);
              const current = orderMoney(lineSubtotal, {
                code: line.currencyCode,
                symbol: line.currencySymbol,
              });

              return (
                <li
                  className="rounded-3xl border border-line bg-surface p-4 shadow-[0_12px_38px_rgba(27,12,104,0.03)] sm:p-5"
                  key={`${line.productId}-${line.itemStateId}`}
                >
                  <div className="flex flex-wrap items-start gap-3 sm:gap-4">
                    <RecordThumbnail
                      label={line.name}
                      priority={index < 2}
                      size="lg"
                      src={line.imageUrl}
                    />
                    <div className="min-w-0 flex-1 basis-44">
                      <p className="break-words text-[15px] font-semibold text-ink">
                        {line.name}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted">
                        {line.reference ?? "Sin referencia"}
                      </p>
                      <p className="mt-2 inline-flex flex-wrap items-center gap-2 text-[12px] text-muted">
                        <span className="rounded-full border border-line bg-background px-2.5 py-1 font-semibold text-ink">
                          {line.itemStateLabel}
                        </span>
                        <span>{orderMoney(line.unitPrice, { code: line.currencyCode, symbol: line.currencySymbol })} c/u</span>
                      </p>
                    </div>
                    <button
                      aria-label={`Quitar ${line.name} del pedido`}
                      className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-alert/30 bg-surface px-3 text-[12px] font-semibold text-alert-ink transition-colors hover:border-alert hover:bg-alert/[0.06]"
                      onClick={() => removeLine(line)}
                      type="button"
                    >
                      <Icon name="close" size={15} />
                      Quitar
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
                    <div>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Cantidad
                      </p>
                      <QuantityControl
                        line={line}
                        onChange={(quantity) => changeQuantity(line, quantity)}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        Subtotal
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                        {current}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
          <section
            aria-labelledby="resumen-carrito"
            className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
          >
            <span className="eyebrow">Resumen</span>
            <h2
              className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
              id="resumen-carrito"
            >
              Total referencial
            </h2>

            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Líneas</dt>
                <dd className="tabular-nums font-semibold text-ink">
                  {formatInteger(totalLines)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Unidades</dt>
                <dd className="tabular-nums font-semibold text-ink">
                  {formatInteger(totalUnits)}
                </dd>
              </div>
              {summaries.map((summary) => (
                <div className="border-t border-line pt-3" key={summary.currencyId}>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-muted">Subtotal</dt>
                    <dd className="font-semibold tabular-nums text-ink">
                      {orderMoney(summary.subtotal, {
                        code: summary.currencyCode,
                        symbol: summary.currencySymbol,
                      })}
                    </dd>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-3">
                    <dt className="font-semibold text-ink">Total referencial</dt>
                    <dd className="text-lg font-semibold tabular-nums text-ink">
                      {orderMoney(summary.total, {
                        code: summary.currencyCode,
                        symbol: summary.currencySymbol,
                      })}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>

            <p className="mt-3 text-[12px] leading-5 text-muted">
              {summaries.length > 1
                ? "Tu carrito usa más de una moneda. Los totales no se convierten entre monedas."
                : "El total es referencial y no se convierte a otra moneda."}
            </p>

            <div className="mt-5 rounded-2xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
              {STOCK_NOTICE}
            </div>

            <Link
              className="button-base button-primary mt-5 w-full"
              href="/app/finalizar-pedido"
            >
              Finalizar pedido
              <Icon name="arrow-right" size={17} />
            </Link>
            <p className="mt-3 text-center text-[11px] leading-5 text-muted">
              Este paso no procesa ninguna transacción en línea.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
