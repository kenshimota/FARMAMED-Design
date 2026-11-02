"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CustomerPageHeader } from "@/components/erp/customer-page-header";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { BusyButton } from "@/components/erp/ui/action-button";
import { Skeleton } from "@/components/erp/ui/skeleton";
import { TextAreaField } from "@/components/erp/records/form-controls";
import { focusFirstInvalidField } from "@/components/erp/ui/form";
import { orderMoney } from "@/components/erp/records/orders-shared";
import {
  cartLineCount,
  cartLineSubtotal,
  cartUnitCount,
  summarizeCart,
} from "@/lib/cart-summary";
import { CART_MAX_LINES, type CartLine } from "@/lib/cart";
import { markCartCheckout } from "@/lib/cart-checkout";
import { useCart } from "@/components/erp/use-cart";
import {
  createCustomerOrder,
  customerOrderErrorMessage,
  mapCustomerOrderFieldErrors,
  resolveAffectedOrderProducts,
  type CustomerOrderAffectedProduct,
} from "@/lib/customer-orders";
import type { OrderRecord } from "@/components/erp/records/orders-api";
import { formatInteger } from "@/lib/format";

const STOCK_NOTICE =
  "El stock se reserva cuando el equipo de Farmamed aprueba tu pedido.";

function customerIdFrom(user: ReturnType<typeof useSession>["user"]) {
  return user.customer_id ?? user.customer?.id ?? null;
}

function CheckoutLoading() {
  return (
    <div aria-busy="true" className="space-y-5" role="status">
      <span className="sr-only">Cargando la finalización del pedido…</span>
      <div className="rounded-[28px] border border-line bg-surface p-6 sm:p-8">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-4 h-9 w-64 max-w-full" />
        <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-96 w-full rounded-3xl" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    </div>
  );
}

function CheckoutSummary({ lines }: { lines: readonly CartLine[] }) {
  const summaries = summarizeCart(lines);
  const totalLines = cartLineCount(lines);
  const totalUnits = cartUnitCount(lines);

  return (
    <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
      <section
        aria-labelledby="resumen-finalizar"
        className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
      >
        <span className="eyebrow">Resumen</span>
        <h2
          className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
          id="resumen-finalizar"
        >
          Tu pedido
        </h2>

        <ul className="mt-4 divide-y divide-line">
          {lines.map((line) => (
            <li
              className="flex items-start justify-between gap-3 py-2.5 text-[12px] leading-5"
              key={`${line.productId}-${line.itemStateId}`}
            >
              <span className="min-w-0 text-ink">
                <span className="font-semibold">{formatInteger(line.quantity)} ×</span>{" "}
                {line.name}
                <span className="mt-0.5 block text-[11px] text-muted">
                  {line.itemStateLabel}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-ink">
                {orderMoney(cartLineSubtotal(line), {
                  code: line.currencyCode,
                  symbol: line.currencySymbol,
                })}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-3 border-t border-line pt-4 text-[13px]">
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
            ? "Tu pedido usa más de una moneda. Los totales no se convierten entre monedas."
            : "El total es referencial y se confirma al crear el borrador."}
        </p>

        <div className="mt-5 rounded-2xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          {STOCK_NOTICE}
        </div>
        <p className="mt-3 text-center text-[11px] leading-5 text-muted">
          Este paso no procesa ninguna transacción en línea.
        </p>
      </section>
    </aside>
  );
}

function CreatedOrderPanel({ order }: { order: OrderRecord }) {
  return (
    <section
      aria-labelledby="pedido-creado"
      className="rounded-[28px] border border-olive/30 bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9"
    >
      <span className="eyebrow">Borrador creado</span>
      <h1
        className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-ink"
        id="pedido-creado"
      >
        Pedido #{order.number}
      </h1>
      <p className="mt-3 text-[14px] leading-7 text-muted">
        Guardamos tu pedido como borrador. Puedes revisarlo y enviarlo cuando
        estés listo. {STOCK_NOTICE}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          className="button-base button-primary"
          href={`/app/mis-pedidos/${order.id}/editar`}
        >
          Revisar el borrador
          <Icon name="arrow-right" size={17} />
        </Link>
        <Link className="button-base button-secondary" href="/app">
          Volver al inicio
        </Link>
      </div>
    </section>
  );
}

export function CustomerCheckout() {
  const { user } = useSession();
  const router = useRouter();
  const customerId = customerIdFrom(user);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const submittingRef = useRef(false);

  const lines = useCart(customerId);
  const loaded = lines !== null;
  const empty = loaded && lines.length === 0;
  const [address, setAddress] = useState(user.customer?.direction ?? "");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    deliveryAddress?: string;
    notes?: string;
    items?: string;
  }>({});
  const [message, setMessage] = useState<string | null>(null);
  const [affectedProducts, setAffectedProducts] = useState<
    CustomerOrderAffectedProduct[]
  >([]);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<OrderRecord | null>(null);

  useEffect(() => {
    if (loaded) headingRef.current?.focus({ preventScroll: true });
  }, [empty, loaded]);

  if (user.role !== "customer") {
    return (
      <AccessState description="La finalización de pedidos pertenece al portal del cliente. Usa la navegación del ERP para continuar." />
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

  if (created) return <CreatedOrderPanel order={created} />;
  if (lines === null) return <CheckoutLoading />;

  if (lines.length === 0) {
    return (
      <div className="space-y-5">
        <CustomerPageHeader
          description="Completa los datos de entrega para crear el borrador de tu pedido."
          eyebrow="Finalizar pedido"
          headingRef={headingRef}
          title="Datos de entrega"
        />
        <EmptyState
          action={
            <Link className="button-base button-primary" href="/app/carrito">
              Volver al carrito
              <Icon name="arrow-right" size={17} />
            </Link>
          }
          description="Agrega productos desde la tienda y vuelve a finalizar el pedido."
          headingLevel={2}
          title="Tu pedido está vacío."
        />
      </div>
    );
  }

  const cartLines = lines;

  function validate() {
    const nextErrors: typeof fieldErrors = {};
    const trimmedAddress = address.trim();
    const trimmedNotes = notes.trim();

    if (trimmedAddress.length > 500) {
      nextErrors.deliveryAddress =
        "La dirección de entrega no puede superar los 500 caracteres.";
    }
    if (trimmedNotes.length > 1000) {
      nextErrors.notes = "Las notas no pueden superar los 1000 caracteres.";
    }
    if (cartLines.length === 0) {
      nextErrors.items = "Agrega al menos una línea para continuar.";
    }

    setFieldErrors(nextErrors);
    setAttempted(true);
    const invalid =
      Object.keys(nextErrors).length > 0 || !confirmed;
    if (invalid) {
      setMessage(
        Object.keys(nextErrors).length > 0
          ? "Revisa los datos marcados antes de finalizar el pedido."
          : "Confirma que revisaste el pedido antes de finalizar.",
      );
      window.requestAnimationFrame(() => focusFirstInvalidField());
    }
    return !invalid;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    setMessage(null);
    setAffectedProducts([]);
    if (!validate()) return;

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const order = await createCustomerOrder({
        items: cartLines.map((line) => ({
          product_id: line.productId,
          item_state_id: line.itemStateId,
          quantity: line.quantity,
        })),
        ...(address.trim() ? { delivery_address: address.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      markCartCheckout(String(customerId), order.id);
      setCreated(order);
      router.push(
        `/app/mis-pedidos/${encodeURIComponent(String(order.id))}/editar`,
      );
    } catch (caught) {
      const mapped = mapCustomerOrderFieldErrors(caught);
      setFieldErrors(mapped);
      setMessage(customerOrderErrorMessage(caught, "cart"));
      setAffectedProducts(
        resolveAffectedOrderProducts(
          caught,
          cartLines.map((line) => ({
            productId: line.productId,
            itemStateId: line.itemStateId,
            name: line.name,
            itemStateLabel: line.itemStateLabel,
          })),
        ),
      );
      if (Object.keys(mapped).length > 0) {
        window.requestAnimationFrame(() => focusFirstInvalidField());
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const confirmationError =
    attempted && !confirmed && !submitting
      ? "Confirma que revisaste el pedido antes de finalizar."
      : undefined;

  return (
    <div className="space-y-5">
      <CustomerPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/carrito"
          >
            Volver al carrito
          </Link>
        }
        description="Revisa tus datos de entrega y confirma el pedido. Al finalizar se crea un borrador; todavía no se reserva stock."
        eyebrow="Finalizar pedido"
        headingRef={headingRef}
        title="Datos de entrega"
      />

      {cartLines.length >= CART_MAX_LINES && (
        <NoticeBanner role="alert" tone="warning">
          Tu pedido alcanzó el máximo de {CART_MAX_LINES} líneas permitidas. Si
          necesitas cambiar las líneas, vuelve al carrito.
        </NoticeBanner>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <form className="min-w-0 space-y-5" noValidate onSubmit={submit}>
          <section
            aria-labelledby="datos-entrega"
            className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <span className="eyebrow">Entrega</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-entrega"
            >
              ¿Dónde entregamos tu pedido?
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-muted">
              La dirección es opcional en el borrador. Si la dejas vacía, se
              usará la dirección registrada en tu cuenta cuando exista.
            </p>

            {message && (
              <NoticeBanner className="mt-4" role="alert" tone="danger">
                <p>{message}</p>
                {affectedProducts.length > 0 && (
                  <>
                    <p className="mt-2 font-semibold">Productos señalados</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {affectedProducts.map((product, index) => (
                        <li key={`${product.productId}-${index}`}>
                          <span className="font-semibold">{product.name}</span>
                          {product.itemStateLabel
                            ? ` · ${product.itemStateLabel}`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </NoticeBanner>
            )}

            <div className="mt-5 space-y-5">
              <TextAreaField
                error={fieldErrors.deliveryAddress}
                help={`Opcional. ${address.length}/500 caracteres.`}
                id="finalizar-direccion"
                label="Dirección de entrega"
                maxLength={500}
                onChange={(value) => {
                  setAddress(value);
                  setFieldErrors((current) => ({
                    ...current,
                    deliveryAddress: undefined,
                  }));
                  setMessage(null);
                }}
                placeholder="Calle, edificio, referencia y ciudad."
                rows={3}
                value={address}
              />

              <TextAreaField
                error={fieldErrors.notes}
                help={`Opcional. ${notes.length}/1000 caracteres.`}
                id="finalizar-notas"
                label="Notas del pedido"
                maxLength={1000}
                onChange={(value) => {
                  setNotes(value);
                  setFieldErrors((current) => ({
                    ...current,
                    notes: undefined,
                  }));
                  setMessage(null);
                }}
                placeholder="Ej. Entregar por la tarde."
                rows={3}
                value={notes}
              />
            </div>
          </section>

          <section
            aria-labelledby="confirmar-finalizar"
            className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <span className="eyebrow">Confirmación</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="confirmar-finalizar"
            >
              Confirma tu pedido
            </h2>

            <div className="mt-4 rounded-2xl border border-line bg-background p-4">
              <label
                className="flex min-h-11 cursor-pointer items-start gap-3 text-[13px] leading-6 text-ink"
                htmlFor="confirmar-pedido"
              >
                <input
                  aria-describedby="confirmar-pedido-ayuda"
                  aria-invalid={confirmationError ? true : undefined}
                  checked={confirmed}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--brand)]"
                  id="confirmar-pedido"
                  onChange={(event) => {
                    setConfirmed(event.target.checked);
                    setMessage(null);
                  }}
                  type="checkbox"
                />
                <span>
                  Confirmo que revisé las líneas y los datos de entrega.
                  Entiendo que este paso crea un borrador y no reserva stock ni
                  procesa ninguna transacción.
                </span>
              </label>
              <p
                className="mt-2 pl-8 text-[12px] leading-5 text-muted"
                id="confirmar-pedido-ayuda"
              >
                {STOCK_NOTICE}
              </p>
              {confirmationError && (
                <p
                  className="mt-2 pl-8 text-[12px] font-semibold leading-5 text-alert-ink"
                  role="alert"
                >
                  {confirmationError}
                </p>
              )}
            </div>

            {fieldErrors.items && (
              <p className="mt-3 text-[12px] font-semibold text-alert-ink" role="alert">
                {fieldErrors.items}
              </p>
            )}

            <BusyButton
              busy={submitting}
              busyLabel="Creando borrador…"
              className="mt-5 w-full"
              disabled={submitting}
              type="submit"
            >
              Finalizar pedido
              <Icon name="arrow-right" size={17} />
            </BusyButton>
            <p className="mt-3 text-center text-[11px] leading-5 text-muted">
              Podrás revisar y enviar el pedido desde Mis pedidos.
            </p>
          </section>
        </form>

        <CheckoutSummary lines={cartLines} />
      </div>
    </div>
  );
}
