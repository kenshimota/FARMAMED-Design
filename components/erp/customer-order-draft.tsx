"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CustomerIncompleteContent } from "@/components/erp/customer-incomplete";
import { CustomerPageHeader } from "@/components/erp/customer-page-header";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { BusyButton } from "@/components/erp/ui/action-button";
import { Skeleton } from "@/components/erp/ui/skeleton";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { TextAreaField } from "@/components/erp/records/form-controls";
import { focusFirstInvalidField } from "@/components/erp/ui/form";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import {
  fetchOrder,
  fetchStoreProducts,
  type OrderItem,
  type OrderRecord,
  type StoreProduct,
} from "@/components/erp/records/orders-api";
import {
  OrderStatusBadge,
  orderItemStateLabel,
  orderMoney,
  orderNumberLabel,
  orderProductLabel,
  orderStatusLabel,
  paymentTermDetail,
  paymentTermLabel,
} from "@/components/erp/records/orders-shared";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { clearCart, CART_MAX_LINES } from "@/lib/cart";
import { consumeCartCheckout } from "@/lib/cart-checkout";
import { getCustomerAccessIssue } from "@/lib/customer";
import {
  addCustomerOrderItem,
  customerOrderErrorMessage,
  mapCustomerOrderFieldErrors,
  removeCustomerOrderItem,
  resolveAffectedOrderProducts,
  sendCustomerOrder,
  updateCustomerOrderDetails,
  updateCustomerOrderItemQuantity,
  type CustomerOrderAffectedProduct,
} from "@/lib/customer-orders";
import { formatInteger } from "@/lib/format";

const STOCK_NOTICE =
  "El stock se reserva cuando el equipo de Farmamed aprueba tu pedido.";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; order: OrderRecord }
  | { status: "error"; error: unknown };

type FieldErrors = {
  deliveryAddress?: string;
  notes?: string;
  items?: string;
};

function parseQuantity(value: string | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 999
    ? parsed
    : null;
}

function numericId(value: number | string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function itemKey(productId: number | string, itemStateId: number | string) {
  return `${String(productId)}:${String(itemStateId)}`;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function orderVersion(order: OrderRecord) {
  const items = (order.items ?? [])
    .map((item) => `${item.id}:${item.quantity}`)
    .join(",");
  return `${order.status}|${order.deliveryAddress}|${order.notes}|${items}`;
}

function DraftLoading() {
  return (
    <div aria-busy="true" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]" role="status">
      <span className="sr-only">Cargando el borrador del pedido…</span>
      <div className="space-y-5">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-80 w-full rounded-3xl" />
    </div>
  );
}

function DraftQuantityControl({
  item,
  value,
  disabled,
  error,
  onChange,
}: {
  item: OrderItem;
  value: string;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const productName = orderProductLabel(item.product, item.productId);
  const parsed = parseQuantity(value);
  const current = parsed ?? item.quantity;
  const inputId = `cantidad-borrador-${item.id}`;
  const errorId = `${inputId}-error`;

  function clamp(next: number) {
    onChange(String(Math.min(999, Math.max(1, next))));
  }

  return (
    <div>
      <div
        aria-label={`Cantidad de ${productName}`}
        className="flex items-center gap-1 rounded-full border border-line bg-background p-1"
        role="group"
      >
        <button
          aria-label={`Disminuir la cantidad de ${productName}`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold leading-none text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || current <= 1}
          onClick={() => clamp(current - 1)}
          type="button"
        >
          <span aria-hidden="true">−</span>
        </button>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          aria-label={`Cantidad de ${productName}`}
          autoComplete="off"
          className="h-11 w-14 rounded-full border border-transparent bg-transparent text-center text-[15px] font-semibold tabular-nums text-ink focus:border-brand/40 focus:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
          disabled={disabled}
          id={inputId}
          inputMode="numeric"
          maxLength={3}
          name={inputId}
          onBlur={() => {
            if (parseQuantity(value) === null) onChange(String(item.quantity));
          }}
          onChange={(event) =>
            onChange(event.target.value.replace(/\D/g, "").slice(0, 3))
          }
          value={value}
        />
        <button
          aria-label={`Aumentar la cantidad de ${productName}`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl font-semibold leading-none text-ink transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || current >= 999}
          onClick={() => clamp(current + 1)}
          type="button"
        >
          <span aria-hidden="true">+</span>
        </button>
      </div>
      {error && (
        <p
          className="mt-2 max-w-[15rem] text-[11px] font-semibold leading-4 text-alert-ink"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function ReadOnlyOrder({ order }: { order: OrderRecord }) {
  const sent = order.status === "request";
  const items = order.items ?? [];

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="estado-borrador"
        className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Tu pedido</span>
            <h2
              className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-ink"
              id="estado-borrador"
            >
              {sent ? "Estado del pedido" : "Pedido no editable"}
            </h2>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <p className="mt-3 text-[14px] leading-7 text-muted">
          {sent
            ? "Tu pedido pasó a revisión del equipo de Farmamed. El stock se reserva cuando el equipo aprueba el pedido; todavía no hay una reserva confirmada."
            : `El pedido está en estado ${orderStatusLabel(order.status)}. Solo los borradores permiten editar líneas y datos.`}
        </p>

        {sent && (
          <NoticeBanner className="mt-4" tone="success">
            Pedido enviado. {STOCK_NOTICE}
          </NoticeBanner>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="button-base button-primary min-h-11 px-5 text-[13px]"
            href={`/app/mis-pedidos/${order.id}`}
          >
            Ver el pedido
            <Icon name="arrow-right" size={17} />
          </Link>
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/mis-pedidos"
          >
            Volver a mis pedidos
          </Link>
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app"
          >
            Volver al inicio
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="lineas-solo-lectura"
        className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <h2
          className="text-lg font-semibold tracking-[-0.03em] text-ink"
          id="lineas-solo-lectura"
        >
          Líneas del pedido
        </h2>
        {items.length === 0 ? (
          <p className="mt-3 text-[13px] leading-6 text-muted">
            El pedido no tiene líneas registradas.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {items.map((item) => {
              const name = orderProductLabel(item.product, item.productId);
              return (
                <li
                  className="flex flex-wrap items-start justify-between gap-3 py-3 text-[13px]"
                  key={String(item.id)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{name}</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {orderItemStateLabel(item.itemState, item.itemStateId)}
                      {" · "}
                      {orderMoney(item.unitPrice, order.currency)} c/u
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-ink">
                      {formatInteger(item.quantity)} ×
                    </p>
                    <p className="mt-0.5 font-semibold tabular-nums text-ink">
                      {orderMoney(item.subtotal, order.currency)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-muted">Subtotal</dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {orderMoney(order.subtotal, order.currency)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Total</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {orderMoney(order.total, order.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Término de pago</dt>
            <dd className="mt-1 font-semibold text-ink">
              {paymentTermLabel(order.paymentTerm)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Líneas</dt>
            <dd className="mt-1 tabular-nums text-ink">
              {formatInteger(order.items?.length ?? order.itemsCount)}
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

function DraftProductPicker({
  items,
  customerId,
  busy,
  onAdd,
}: {
  items: OrderItem[];
  customerId: number | string;
  busy: string | null;
  onAdd: (product: StoreProduct) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const catalog = useAsyncResource(
    () => fetchStoreProducts(customerId),
    { enabled: open },
  );
  const products = catalog.data ?? [];
  const existing = new Set(
    items.map((item) => itemKey(item.productId, item.itemStateId)),
  );
  const normalized = normalizeSearch(query);
  const filtered = normalized
    ? products.filter((product) =>
        normalizeSearch(
          `${product.name} ${product.reference} ${product.itemState.label}`,
        ).includes(normalized),
      )
    : products;
  const full = items.length >= CART_MAX_LINES;

  return (
    <section
      aria-labelledby="agregar-linea-borrador"
      className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Catálogo</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="agregar-linea-borrador"
          >
            Agregar producto
          </h2>
          <p className="mt-2 max-w-xl text-[13px] leading-6 text-muted">
            Solo se muestran variantes con precio para tu lista de precios y
            existencia disponible.
          </p>
        </div>
        <button
          aria-expanded={open}
          className="button-base button-secondary min-h-11 px-4 text-[12px]"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? "Cerrar catálogo" : "Ver catálogo"}
        </button>
      </div>

      {full && (
        <p className="mt-4 text-[12px] font-semibold text-alert-ink" role="alert">
          Un pedido admite hasta {CART_MAX_LINES} líneas. Quita una línea para
          agregar otra variante.
        </p>
      )}

      {open && (
        <div className="mt-5">
          <label
            className="mb-2 block text-[12px] font-semibold text-ink"
            htmlFor="buscar-producto-borrador"
          >
            Buscar producto
          </label>
          <input
            className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
            id="buscar-producto-borrador"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, referencia o estado"
            type="search"
            value={query}
          />

          {catalog.status === "loading" && (
            <p className="mt-4 text-[13px] font-semibold text-muted" role="status">
              Cargando el catálogo…
            </p>
          )}

          {catalog.status === "error" && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold text-alert-ink transition-colors hover:bg-surface"
                  onClick={catalog.reload}
                  type="button"
                >
                  Reintentar
                </button>
              }
              className="mt-4"
              role="alert"
              tone="danger"
            >
              {catalog.error?.message ??
                "No pudimos cargar el catálogo de tu cuenta."}
            </NoticeBanner>
          )}

          {catalog.status === "ready" && filtered.length === 0 && (
            <p className="mt-4 rounded-2xl border border-line bg-background px-4 py-3 text-[13px] text-muted">
              {products.length === 0
                ? "No hay productos disponibles para tu cuenta."
                : "No hay productos que coincidan con la búsqueda."}
            </p>
          )}

          {filtered.length > 0 && (
            <ul className="mt-4 space-y-3">
              {filtered.map((product) => {
                const key = itemKey(product.id, product.itemState.id);
                const inOrder = existing.has(key);
                const productId = numericId(product.id);
                const itemStateId = numericId(product.itemState.id);
                const productBusy = busy === `add:${String(product.id)}`;
                const unavailable =
                  inOrder ||
                  full ||
                  busy !== null ||
                  product.available === false ||
                  productId === null ||
                  itemStateId === null;

                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-background p-4"
                    key={key}
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-ink">
                        {product.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted">
                        {product.reference || "Sin referencia"}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">
                        {product.itemState.label} ·{" "}
                        {orderMoney(product.price, product.currency)}
                      </p>
                    </div>
                    <BusyButton
                      aria-label={`Agregar ${product.name} en estado ${product.itemState.label}`}
                      busy={productBusy}
                      busyLabel="Agregando…"
                      className="min-h-11 px-4 text-[12px]"
                      disabled={unavailable}
                      onClick={() => onAdd(product)}
                      type="button"
                      variant="secondary"
                    >
                      {inOrder ? "Ya está en el pedido" : "Agregar"}
                      <Icon name={inOrder ? "check" : "arrow-right"} size={15} />
                    </BusyButton>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function DraftEditor({
  order,
  customerId,
  onChange,
}: {
  order: OrderRecord;
  customerId: number | string;
  onChange: (order: OrderRecord) => void;
}) {
  const items = useMemo(() => order.items ?? [], [order.items]);
  const itemCount = items.length;
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [String(item.id), String(item.quantity)])),
  );
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
  const [address, setAddress] = useState(order.deliveryAddress);
  const [notes, setNotes] = useState(order.notes);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "danger">("danger");
  const [affectedProducts, setAffectedProducts] = useState<
    CustomerOrderAffectedProduct[]
  >([]);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  const busyRef = useRef(false);
  const sentRef = useRef(false);

  const quantityDirty = items.some(
    (item) =>
      parseQuantity(quantities[String(item.id)] ?? String(item.quantity)) !==
      item.quantity,
  );
  const detailsDirty =
    address.trim() !== order.deliveryAddress.trim() ||
    notes.trim() !== order.notes.trim();
  const dirty = quantityDirty || detailsDirty;

  function getQuantity(item: OrderItem) {
    return quantities[String(item.id)] ?? String(item.quantity);
  }

  function updateQuantity(item: OrderItem, value: string) {
    const id = String(item.id);
    setQuantities((current) => ({ ...current, [id]: value }));
    setQuantityErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setMessage(null);
  }

  function validate() {
    const nextQuantityErrors: Record<string, string> = {};
    const parsed: Record<string, number> = {};

    for (const item of items) {
      const value = getQuantity(item);
      const quantity = parseQuantity(value);
      if (quantity === null) {
        nextQuantityErrors[String(item.id)] =
          "La cantidad debe ser un entero entre 1 y 999.";
      } else {
        parsed[String(item.id)] = quantity;
      }
    }

    const nextFieldErrors: FieldErrors = {};
    if (address.trim().length > 500) {
      nextFieldErrors.deliveryAddress =
        "La dirección de entrega no puede superar los 500 caracteres.";
    }
    if (notes.trim().length > 1000) {
      nextFieldErrors.notes = "Las notas no pueden superar los 1000 caracteres.";
    }
    if (items.length === 0) {
      nextFieldErrors.items = "Agrega al menos una línea antes de continuar.";
    }

    setQuantityErrors(nextQuantityErrors);
    setFieldErrors(nextFieldErrors);

    const invalid =
      Object.keys(nextQuantityErrors).length > 0 ||
      Object.keys(nextFieldErrors).length > 0;
    if (invalid) {
      setMessageTone("danger");
      setMessage("Revisa los datos marcados antes de continuar.");
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return null;
    }
    return parsed;
  }

  async function handleApiError(
    caught: unknown,
    fallbackProducts: CustomerOrderAffectedProduct[] = [],
  ) {
    setMessageTone("danger");
    setMessage(customerOrderErrorMessage(caught, "draft"));
    const mapped = mapCustomerOrderFieldErrors(caught);
    setFieldErrors(mapped);
    setQuantityErrors({});
    const affected = resolveAffectedOrderProducts(
      caught,
      items.map((item) => ({
        productId: item.productId,
        itemStateId: item.itemStateId,
        name: orderProductLabel(item.product, item.productId),
        itemStateLabel: orderItemStateLabel(item.itemState, item.itemStateId),
      })),
    );
    setAffectedProducts(
      affected.length > 0 ? affected : fallbackProducts,
    );
    if (Object.keys(mapped).length > 0) {
      window.requestAnimationFrame(() => focusFirstInvalidField());
    }
    if (
      caught instanceof ApiError &&
      caught.status === 404 &&
      !caught.message.toLowerCase().includes("item")
    ) {
      setGone(true);
    }
    if (caught instanceof ApiError && caught.status === 422) {
      try {
        const fresh = await fetchOrder(String(order.id));
        resetFromOrder(fresh);
        onChange(fresh);
      } catch {
        // El mensaje principal ya explica el conflicto.
      }
    }
  }

  async function persistChanges(
    current: OrderRecord,
    parsed: Record<string, number>,
  ) {
    let latest = current;
    for (const item of items) {
      const quantity = parsed[String(item.id)];
      if (quantity === undefined || quantity === item.quantity) continue;
      latest = await updateCustomerOrderItemQuantity(
        current.id,
        item.id,
        quantity,
      );
    }

    if (
      address.trim() !== latest.deliveryAddress.trim() ||
      notes.trim() !== latest.notes.trim()
    ) {
      latest = await updateCustomerOrderDetails(current.id, {
        delivery_address: address.trim(),
        notes: notes.trim(),
      });
    }

    return latest;
  }

  function resetFromOrder(next: OrderRecord) {
    const nextItems = next.items ?? [];
    setQuantities(
      Object.fromEntries(
        nextItems.map((item) => [String(item.id), String(item.quantity)]),
      ),
    );
    setAddress(next.deliveryAddress);
    setNotes(next.notes);
  }

  function mergeFromOrder(next: OrderRecord) {
    const nextItems = next.items ?? [];
    setQuantities((current) => {
      const merged = { ...current };
      for (const item of nextItems) {
        const id = String(item.id);
        if (!(id in merged)) merged[id] = String(item.quantity);
      }
      return merged;
    });
  }

  async function handleSave() {
    if (busyRef.current || order.status !== "draft") return;
    setMessage(null);
    setAffectedProducts([]);
    const parsed = validate();
    if (!parsed) return;

    busyRef.current = true;
    setBusy("save");
    try {
      const latest = await persistChanges(order, parsed);
      resetFromOrder(latest);
      onChange(latest);
      setMessageTone("success");
      setMessage("Cambios guardados.");
      setAnnouncement("Cambios guardados.");
    } catch (caught) {
      await handleApiError(caught);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function handleSend() {
    if (busyRef.current || sentRef.current || order.status !== "draft") return;
    setMessage(null);
    setAffectedProducts([]);
    if (items.length === 0) {
      setAffectedProducts([]);
      setFieldErrors({ items: "Agrega al menos una línea para enviar el pedido." });
      setMessageTone("danger");
      setMessage("Agrega al menos una línea para enviar el pedido.");
      return;
    }

    const parsed = validate();
    if (!parsed) return;

    busyRef.current = true;
    setBusy("send");
    let latest = order;
    try {
      latest = await persistChanges(order, parsed);
      if (latest.status !== "draft") {
        onChange(latest);
        return;
      }
      const sent = await sendCustomerOrder(latest.id);
      sentRef.current = true;
      setAnnouncement("Pedido enviado.");
      onChange(sent);
    } catch (caught) {
      if (latest !== order) {
        resetFromOrder(latest);
        onChange(latest);
      }
      await handleApiError(caught);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function handleAdd(product: StoreProduct) {
    if (busyRef.current || order.status !== "draft") return;
    if (items.length >= CART_MAX_LINES) {
      setAffectedProducts([]);
      setMessageTone("danger");
      setMessage(`Un pedido admite hasta ${CART_MAX_LINES} líneas.`);
      return;
    }
    const productId = numericId(product.id);
    const itemStateId = numericId(product.itemState.id);
    if (productId === null || itemStateId === null) {
      setAffectedProducts([]);
      setMessageTone("danger");
      setMessage("No pudimos agregar ese producto. Intenta con otra variante.");
      return;
    }

    setMessage(null);
    setAffectedProducts([]);
    busyRef.current = true;
    setBusy(`add:${String(product.id)}`);
    try {
      const latest = await addCustomerOrderItem(order.id, {
        product_id: productId,
        item_state_id: itemStateId,
        quantity: 1,
      });
      mergeFromOrder(latest);
      onChange(latest);
      setMessageTone("success");
      setMessage(`${product.name} se agregó al pedido.`);
      setAnnouncement(`${product.name} se agregó al pedido.`);
    } catch (caught) {
      const fallback =
        caught instanceof ApiError && caught.status === 409
          ? [
              {
                productId: String(product.id),
                name: product.name,
                itemStateLabel: product.itemState.label,
              },
            ]
          : [];
      await handleApiError(caught, fallback);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  async function handleRemove(item: OrderItem) {
    if (busyRef.current || order.status !== "draft") return;
    const name = orderProductLabel(item.product, item.productId);
    if (!window.confirm(`¿Quitar ${name} del pedido?`)) return;

    setMessage(null);
    setAffectedProducts([]);
    busyRef.current = true;
    setBusy(`remove:${String(item.id)}`);
    try {
      const latest = await removeCustomerOrderItem(order.id, item.id);
      mergeFromOrder(latest);
      onChange(latest);
      setMessageTone("success");
      setMessage(`${name} se quitó del pedido.`);
      setAnnouncement(`${name} se quitó del pedido.`);
    } catch (caught) {
      await handleApiError(caught);
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  if (gone) {
    return (
      <RecordsLoadError
        backHref="/app/mis-pedidos"
        backLabel="Volver a mis pedidos"
        description="Puede que el pedido haya sido eliminado o que pertenezca a otra cuenta."
        headingLevel="h2"
        title="No encontramos este pedido"
      />
    );
  }

  return (
    <div className="space-y-5">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section
            aria-labelledby="aviso-borrador"
            className="rounded-3xl border border-brand/15 bg-soft-blue p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">
                  Borrador editable
                </p>
                <h2
                  className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink"
                  id="aviso-borrador"
                >
                  {orderNumberLabel(order.number)}
                </h2>
              </div>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="mt-3 text-[13px] leading-6 text-ink">
              Puedes ajustar cantidades, quitar líneas y actualizar los datos de
              entrega mientras el pedido esté en borrador. {STOCK_NOTICE}
            </p>
          </section>

          {message && (
            <NoticeBanner
              role={messageTone === "success" ? "status" : "alert"}
              tone={messageTone}
            >
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

          {fieldErrors.items && (
            <NoticeBanner role="alert" tone="danger">
              {fieldErrors.items}
            </NoticeBanner>
          )}

          <section
            aria-labelledby="lineas-borrador"
            className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                className="text-xl font-semibold tracking-[-0.03em] text-ink"
                id="lineas-borrador"
              >
                Líneas del pedido
              </h2>
              <p className="text-[12px] font-medium text-muted">
                {itemCount === 1 ? "1 línea" : `${formatInteger(itemCount)} líneas`}
              </p>
            </div>

            {items.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  description="Agrega al menos una línea para poder enviar el pedido."
                  headingLevel={3}
                  title="El pedido no tiene líneas."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {items.map((item) => {
                  const name = orderProductLabel(item.product, item.productId);
                  const id = String(item.id);
                  const removeBusy = busy === `remove:${id}`;

                  return (
                    <li
                      className="rounded-2xl border border-line bg-background p-4"
                      key={id}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold text-ink">
                            {name}
                          </p>
                          <p className="mt-0.5 text-[12px] text-muted">
                            {orderItemStateLabel(item.itemState, item.itemStateId)}
                            {" · "}
                            {orderMoney(item.unitPrice, order.currency)} c/u
                          </p>
                        </div>
                        <BusyButton
                          aria-label={`Quitar ${name} del pedido`}
                          busy={removeBusy}
                          busyLabel="Quitando…"
                          className="min-h-11 px-3.5 text-[12px]"
                          disabled={busy !== null}
                          onClick={() => void handleRemove(item)}
                          type="button"
                          variant="danger"
                        >
                          <Icon name="close" size={15} />
                          Quitar
                        </BusyButton>
                      </div>

                      <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
                        <DraftQuantityControl
                          disabled={busy !== null}
                          error={quantityErrors[id]}
                          item={item}
                          onChange={(value) => updateQuantity(item, value)}
                          value={getQuantity(item)}
                        />
                        <p className="text-right text-[13px] font-semibold tabular-nums text-ink">
                          Subtotal guardado:{" "}
                          {orderMoney(item.subtotal, order.currency)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <DraftProductPicker
            busy={busy}
            customerId={customerId}
            items={items}
            onAdd={(product) => void handleAdd(product)}
          />

          <section
            aria-labelledby="datos-borrador"
            className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <span className="eyebrow">Entrega</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-borrador"
            >
              Datos de entrega
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              Puedes actualizar la dirección y las notas mientras el pedido
              siga en borrador.
            </p>

            <div className="mt-5 space-y-5">
              <TextAreaField
                error={fieldErrors.deliveryAddress}
                help={`Opcional. ${address.length}/500 caracteres.`}
                id="borrador-direccion"
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
                id="borrador-notas"
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
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:h-fit">
          <section
            aria-labelledby="resumen-borrador"
            className="rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
          >
            <span className="eyebrow">Resumen</span>
            <h2
              className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
              id="resumen-borrador"
            >
              Totales guardados
            </h2>

            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Líneas</dt>
                <dd className="tabular-nums font-semibold text-ink">
                  {formatInteger(itemCount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-semibold tabular-nums text-ink">
                  {orderMoney(order.subtotal, order.currency)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="text-lg font-semibold tabular-nums text-ink">
                  {orderMoney(order.total, order.currency)}
                </dd>
              </div>
              <div className="border-t border-line pt-3">
                <dt className="text-muted">Término de pago</dt>
                <dd className="mt-1 font-semibold text-ink">
                  {paymentTermLabel(order.paymentTerm)}
                </dd>
                <dd className="mt-0.5 text-[12px] text-muted">
                  {order.paymentTerm
                    ? paymentTermDetail(order.paymentTerm)
                    : "Tu cuenta no tiene un término de pago activo. Contacta al administrador antes de enviar el pedido."}
                </dd>
              </div>
            </dl>

            {dirty && (
              <p className="mt-3 text-[12px] font-semibold leading-5 text-ink">
                Tienes cambios sin guardar. El resumen muestra los importes
                guardados.
              </p>
            )}

            <div className="mt-4 rounded-2xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
              {STOCK_NOTICE}
            </div>

            <div className="mt-5 space-y-3">
              <BusyButton
                busy={busy === "send"}
                busyLabel="Enviando…"
                className="w-full"
                disabled={busy !== null || itemCount === 0}
                onClick={() => void handleSend()}
                type="button"
              >
                Enviar pedido
                <Icon name="arrow-right" size={17} />
              </BusyButton>
              <BusyButton
                busy={busy === "save"}
                busyLabel="Guardando…"
                className="w-full"
                disabled={busy !== null || !dirty}
                onClick={() => void handleSave()}
                type="button"
                variant="secondary"
              >
                Guardar cambios
              </BusyButton>
            </div>

            {itemCount === 0 && (
              <p className="mt-3 text-[12px] leading-5 text-muted">
                Agrega al menos una línea para enviar el pedido.
              </p>
            )}
            <p className="mt-3 text-[12px] leading-5 text-muted">
              Al enviar, el pedido pasa a Solicitado. La reserva de stock ocurre
              solo cuando el equipo de Farmamed lo aprueba.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function CustomerOrderDraft({ orderId }: { orderId: string }) {
  const { user } = useSession();
  const customerId = user.customer_id ?? user.customer?.id ?? null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const lastStatusRef = useRef<string | null>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (
      user.role !== "customer" ||
      customerId === null ||
      !isPositiveRecordId(orderId)
    ) {
      return;
    }
    let active = true;

    async function load() {
      try {
        const order = await fetchOrder(orderId);
        if (active) setState({ status: "ready", order });
      } catch (error) {
        if (active) setState({ status: "error", error });
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [attempt, customerId, orderId, user.role]);

  useEffect(() => {
    if (state.status !== "ready") return;
    const status = state.order.status;
    if (lastStatusRef.current === "draft" && status === "request") {
      headingRef.current?.focus({ preventScroll: true });
    }
    lastStatusRef.current = status;
  }, [state]);

  useEffect(() => {
    if (state.status !== "ready" || customerId === null) return;
    if (consumeCartCheckout(customerId, state.order.id)) {
      clearCart(customerId);
    }
  }, [customerId, state]);

  if (user.role !== "customer") {
    return (
      <AccessState description="La edición de borradores pertenece al portal del cliente. Usa la navegación del ERP para continuar." />
    );
  }

  if (customerId === null) {
    return <CustomerIncompleteContent reason="vinculo" />;
  }

  if (!isPositiveRecordId(orderId)) {
    return (
      <RecordsLoadError
        backHref="/app/mis-pedidos"
        backLabel="Volver a mis pedidos"
        description="Puede que el enlace no sea válido o que el pedido ya no exista."
        headingLevel="h1"
        title="No encontramos este pedido"
      />
    );
  }

  if (state.status === "error") {
    const issue = getCustomerAccessIssue(state.error);
    if (issue) return <CustomerIncompleteContent reason={issue} />;
  }

  const readyOrder = state.status === "ready" ? state.order : null;
  const title =
    readyOrder && readyOrder.status !== "draft"
      ? readyOrder.status === "request"
        ? "Pedido enviado"
        : orderNumberLabel(readyOrder.number)
      : "Editar borrador";
  const description =
    readyOrder && readyOrder.status !== "draft"
      ? "Consulta el estado del pedido y sus líneas. La edición solo está disponible en borrador."
      : "Revisa las líneas, ajusta cantidades y actualiza los datos de entrega antes de enviar el pedido.";

  return (
    <div className="space-y-5">
      <CustomerPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/mis-pedidos"
          >
            Volver a mis pedidos
          </Link>
        }
        description={description}
        eyebrow="Tu pedido"
        headingRef={headingRef}
        title={title}
      />

      {state.status === "loading" && <DraftLoading />}

      {state.status === "error" &&
        (() => {
          if (state.error instanceof ApiError && state.error.status === 503) {
            return (
              <RecordsLoadError
                backHref="/app/mis-pedidos"
                backLabel="Volver a mis pedidos"
                description="No podemos procesar pedidos en este momento."
                onRetry={() => {
                  setState({ status: "loading" });
                  setAttempt((current) => current + 1);
                }}
                title="No pudimos cargar el pedido"
              />
            );
          }
          if (state.error instanceof ApiError && state.error.status === 404) {
            return (
              <RecordsLoadError
                backHref="/app/mis-pedidos"
                backLabel="Volver a mis pedidos"
                description="Puede que el pedido haya sido eliminado o que pertenezca a otra cuenta."
                headingLevel="h2"
                title="No encontramos este pedido"
              />
            );
          }
          return (
            <RecordsLoadError
              backHref="/app/mis-pedidos"
              backLabel="Volver a mis pedidos"
              description="Revisa tu conexión e intenta de nuevo."
              onRetry={() => {
                setState({ status: "loading" });
                setAttempt((current) => current + 1);
              }}
              title="No pudimos cargar el pedido"
            />
          );
        })()}

      {state.status === "ready" &&
        (state.order.status === "draft" ? (
          <DraftEditor
            customerId={customerId ?? ""}
            key={String(state.order.id)}
            onChange={(order) => setState({ status: "ready", order })}
            order={state.order}
          />
        ) : (
          <ReadOnlyOrder key={orderVersion(state.order)} order={state.order} />
        ))}
    </div>
  );
}
