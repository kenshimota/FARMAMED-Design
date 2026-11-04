"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { focusFirstInvalidField } from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  ORDER_COPY,
  isPriceListError,
  isSellerAssignmentError,
  mapCreateOrderFieldErrors,
  orderErrorMessage,
  readStockShortage,
  type OrderStockShortage,
} from "@/components/erp/records/orders-errors";
import {
  createOrder,
  fetchPaymentTerms,
  fetchStoreProducts,
  updateOrderStatus,
  type OrderRecord,
  type StoreProduct,
} from "@/components/erp/records/orders-api";
import {
  fetchCustomer,
  fetchCustomers,
  searchCustomers,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  isCashPaymentTerm,
  orderMoney,
  paymentTermDetail,
} from "@/components/erp/records/orders-shared";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/erp/records/form-controls";
import { EntityAutocompleteField } from "@/components/erp/ui/entity-autocomplete";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { toApiId } from "@/components/erp/records/records-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

const NO_CUSTOMERS: CustomerRecord[] = [];

type CartLine = {
  key: string;
  productId: string | number;
  itemStateId: string | number;
  productName: string;
  reference: string;
  itemStateLabel: string;
  unitPrice: number;
  currency: StoreProduct["currency"];
  quantity: string;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function cartKey(productId: string | number, itemStateId: string | number) {
  return `${String(productId)}:${String(itemStateId)}`;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseCartQuantity(value: string) {
  const parsed = Number(value.trim());
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 999 ? parsed : null;
}

function cartTotal(lines: readonly CartLine[]) {
  return roundMoney(
    lines.reduce((total, line) => {
      const quantity = Number(line.quantity);
      if (!Number.isFinite(quantity) || quantity < 1) return total;
      return total + roundMoney(line.unitPrice * quantity);
    }, 0),
  );
}

function shortageInfo(
  shortage: OrderStockShortage,
  lines: readonly CartLine[],
) {
  return shortage.items.map((item) => {
    const line = lines.find(
      (candidate) =>
        String(candidate.productId) === String(item.productId) &&
        (item.itemStateId === null ||
          String(candidate.itemStateId) === String(item.itemStateId)),
    );
    return {
      productId: item.productId,
      productName: line ? line.productName : `Producto #${item.productId}`,
      stateName: line?.itemStateLabel ?? null,
    };
  });
}

export function OrderCreatePage() {
  const { user } = useSession();
  const canRead = canReadModule(user.role, "pedidos");
  const canWrite = canWriteModule(user.role, "pedidos");

  if (!canRead) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de pedidos. La venta asistida está disponible para administradores y vendedores." />
    );
  }
  if (!canWrite) {
    return (
      <AccessState description="Tu rol puede consultar pedidos, pero no crear pedidos nuevos." />
    );
  }

  return <OrderCreateContent />;
}

function OrderCreateContent() {
  const customersResource = useAsyncResource(fetchCustomers);
  const customers = customersResource.data ?? NO_CUSTOMERS;
  const [customerId, setCustomerId] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerRecord | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const customerRequest = useRef(0);

  async function selectCustomer(value: string) {
    const request = customerRequest.current + 1;
    customerRequest.current = request;
    setCustomerId(value);
    setCustomerError(null);

    if (!value) {
      setSelectedCustomer(null);
      setCustomerLoading(false);
      return;
    }

    setSelectedCustomer(null);
    setCustomerLoading(true);

    try {
      const customer = await fetchCustomer(value);
      if (customerRequest.current !== request) return;
      setSelectedCustomer(customer);
    } catch {
      if (customerRequest.current !== request) return;
      setCustomerError(
        "No pudimos cargar los datos del cliente seleccionado. Vuelve a elegirlo.",
      );
    } finally {
      if (customerRequest.current === request) setCustomerLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/pedidos"
          >
            Volver a pedidos
          </Link>
        }
        description="Venta asistida: elige un cliente, arma las líneas con su catálogo y guarda un borrador o genera el pedido directamente."
        eyebrow="Operación"
        title="Nuevo pedido"
      />

      {customersResource.status === "error" && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={customersResource.reload}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos cargar la lista de clientes. Puedes buscar y seleccionar
          igualmente; reintenta si necesitas actualizarla.
        </NoticeBanner>
      )}

      {customersResource.status === "ready" && customers.length === 0 && (
        <NoticeBanner
          action={
            <Link
              className="button-base button-secondary min-h-11 px-4 text-[12px]"
              href="/app/clientes/nuevo"
            >
              Registrar cliente
              <Icon name="arrow-right" size={15} />
            </Link>
          }
          tone="warning"
        >
          Todavía no hay clientes registrados. La venta asistida necesita un
          cliente con lista de precios asignada.
        </NoticeBanner>
      )}

      <section
        aria-labelledby="cliente-nuevo-pedido"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Cliente</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="cliente-nuevo-pedido"
        >
          Cliente del pedido
        </h2>
        <p className="mt-3 text-[13px] leading-6 text-muted">
          Los vendedores solo operan con clientes asignados; los administradores
          pueden operar con cualquiera.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <EntityAutocompleteField
            emptyLabel="No hay clientes que coincidan."
            help="Busca por nombre o correo. Los vendedores solo operan con clientes asignados."
            id="nuevo-pedido-cliente"
            label="Cliente"
            loadingLabel="Buscando clientes…"
            loadOptions={async (query) => {
              const found = await searchCustomers(query);
              return found.map((customer) => ({
                value: String(customer.id),
                label: customer.fullName,
                description: customer.email || customer.direction || undefined,
              }));
            }}
            onChange={(value) => void selectCustomer(value)}
            placeholder="Busca por nombre o correo"
            required
            value={customerId}
          />
          {customerLoading && (
            <p
              aria-live="polite"
              className="text-[12px] font-semibold text-muted"
            >
              Cargando los datos del cliente…
            </p>
          )}
          {customerError && (
            <NoticeBanner
              action={
                <button
                  className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold text-alert-ink transition-colors hover:bg-surface"
                  onClick={() => void selectCustomer(customerId)}
                  type="button"
                >
                  Reintentar
                </button>
              }
              role="alert"
              tone="danger"
            >
              {customerError}
            </NoticeBanner>
          )}
          {selectedCustomer && (
            <dl className="rounded-2xl border border-line bg-background px-4 py-3 text-[12px] leading-5">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Contacto
                </dt>
                <dd className="mt-1 break-all text-ink">
                  {selectedCustomer.email || "Correo no registrado"}
                </dd>
              </div>
              <div className="mt-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Dirección
                </dt>
                <dd className="mt-1 text-ink">
                  {selectedCustomer.direction || "No registrada"}
                </dd>
              </div>
              <div className="mt-2">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  Lista de precios
                </dt>
                <dd className="mt-1 text-ink">
                  {selectedCustomer.price_list
                    ? selectedCustomer.price_list.name
                    : selectedCustomer.price_list_id !== null
                      ? `Lista #${selectedCustomer.price_list_id}`
                      : "Sin lista asignada"}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {selectedCustomer && (
        <AssistedOrderBuilder
          customer={selectedCustomer}
          key={String(selectedCustomer.id)}
        />
      )}
    </div>
  );
}

function AssistedOrderBuilder({ customer }: { customer: CustomerRecord }) {
  const router = useRouter();
  const toast = useToast();
  const currencyStatus = useCurrencyStatusContext();

  const termsResource = useAsyncResource(fetchPaymentTerms);
  const terms = termsResource.data ?? [];
  const storeResource = useAsyncResource(() => fetchStoreProducts(customer.id));

  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentTermId, setPaymentTermId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState(customer.direction);
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    paymentTermId?: string;
    deliveryAddress?: string;
    notes?: string;
    items?: string;
  }>({});
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
  const [submittingMode, setSubmittingMode] = useState<"draft" | "generate" | null>(
    null,
  );
  const [createdOrder, setCreatedOrder] = useState<OrderRecord | null>(null);
  const [shortage, setShortage] = useState<OrderStockShortage | null>(null);
  const submittingRef = useRef(false);

  const storeProducts = useMemo(
    () => storeResource.data ?? [],
    [storeResource.data],
  );
  const selectedTerm =
    terms.find((term) => String(term.id) === paymentTermId) ?? null;
  const cartCurrency =
    cart[0]?.currency ??
    storeProducts[0]?.currency ??
    currencyStatus?.defaultCurrency ??
    null;
  const total = cartTotal(cart);
  const submitting = submittingMode !== null;

  const filteredProducts = useMemo(() => {
    const normalized = normalizeSearch(query);
    if (!normalized) return storeProducts;
    return storeProducts.filter((product) => {
      const text = `${product.name} ${product.reference} ${product.itemState.label}`;
      return normalizeSearch(text).includes(normalized);
    });
  }, [query, storeProducts]);

  const cartKeys = new Set(
    cart.map((line) => cartKey(line.productId, line.itemStateId)),
  );

  function updateQuantity(key: string, value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    setCart((current) =>
      current.map((line) =>
        line.key === key ? { ...line, quantity: digits } : line,
      ),
    );
    setQuantityErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFieldErrors((current) => ({ ...current, items: undefined }));
    setMessage(null);
  }

  function addProduct(product: StoreProduct) {
    const key = cartKey(product.id, product.itemState.id);
    if (cartKeys.has(key)) {
      setMessage(ORDER_COPY.duplicateItem);
      return;
    }
    if (cart.length >= 50) {
      setMessage("Un pedido admite hasta 50 líneas.");
      return;
    }
    setCart((current) => {
      if (
        current.length >= 50 ||
        current.some((line) => line.key === key)
      ) {
        return current;
      }
      return [
        ...current,
        {
          key,
          productId: product.id,
          itemStateId: product.itemState.id,
          productName: product.name,
          reference: product.reference,
          itemStateLabel: product.itemState.label,
          unitPrice: product.price,
          currency: product.currency,
          quantity: "1",
        },
      ];
    });
    setFieldErrors((current) => ({ ...current, items: undefined }));
    setMessage(null);
  }

  function removeLine(key: string) {
    setCart((current) => current.filter((line) => line.key !== key));
    setQuantityErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFieldErrors((current) => ({ ...current, items: undefined }));
    setMessage(null);
  }

  function validate(cartRequired: boolean) {
    const nextFieldErrors: typeof fieldErrors = {};
    const nextQuantityErrors: Record<string, string> = {};

    if (deliveryAddress.trim().length > 500) {
      nextFieldErrors.deliveryAddress =
        "La dirección de entrega no puede superar los 500 caracteres.";
    }
    if (notes.trim().length > 1000) {
      nextFieldErrors.notes =
        "Las notas no pueden superar los 1000 caracteres.";
    }
    if (paymentTermId && !selectedTerm) {
      nextFieldErrors.paymentTermId = "Selecciona un término de pago válido.";
    }
    if (cartRequired && cart.length === 0) {
      nextFieldErrors.items = ORDER_COPY.noItemsToGenerate;
    }
    if (cart.length > 50) {
      nextFieldErrors.items = "Un pedido admite hasta 50 líneas.";
    }
    for (const line of cart) {
      if (parseCartQuantity(line.quantity) === null) {
        nextQuantityErrors[line.key] =
          "La cantidad debe ser un entero entre 1 y 999.";
      }
    }
    if (Object.keys(nextQuantityErrors).length > 0) {
      nextFieldErrors.items = "Revisa las cantidades del pedido.";
    }

    setFieldErrors(nextFieldErrors);
    setQuantityErrors(nextQuantityErrors);
    const invalid =
      Object.keys(nextFieldErrors).length > 0 ||
      Object.keys(nextQuantityErrors).length > 0;
    if (invalid) {
      window.requestAnimationFrame(() => focusFirstInvalidField());
    }
    return !invalid;
  }

  async function submitOrder(mode: "draft" | "generate") {
    if (submittingRef.current) return;
    setMessage(null);
    setShortage(null);
    if (!validate(mode === "generate")) return;
    submittingRef.current = true;

    const items = cart.map((line) => ({
      product_id: toApiId(String(line.productId)),
      item_state_id: toApiId(String(line.itemStateId)),
      quantity: Number(line.quantity),
    }));

    setSubmittingMode(mode);
    try {
      const input = {
        customer_id: toApiId(String(customer.id)),
        ...(paymentTermId
          ? { payment_term_id: toApiId(paymentTermId) }
          : {}),
        ...(deliveryAddress.trim()
          ? { delivery_address: deliveryAddress.trim() }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(items.length > 0 ? { items } : {}),
      };
      const created = await createOrder(input);

      if (mode === "draft") {
        toast.success(ORDER_COPY.created);
        router.push(`/app/pedidos/${created.id}`);
        return;
      }

      try {
        await updateOrderStatus(created.id, "generate");
        toast.success(ORDER_COPY.generated);
        router.push(`/app/pedidos/${created.id}`);
      } catch (caught) {
        setCreatedOrder(created);
        setShortage(readStockShortage(caught));
        setMessage(orderErrorMessage(caught));
      }
    } catch (caught) {
      const mapped = mapCreateOrderFieldErrors(caught);
      if (Object.keys(mapped).length > 0) {
        setFieldErrors((current) => ({ ...current, ...mapped }));
      }
      const fieldMessage =
        mapped.items ?? mapped.paymentTermId ?? mapped.customerId;
      if (isPriceListError(caught)) {
        setMessage(ORDER_COPY.priceListMissing);
      } else if (isSellerAssignmentError(caught)) {
        setMessage(ORDER_COPY.sellerNotAssigned);
      } else {
        setMessage(fieldMessage ?? orderErrorMessage(caught));
      }
    } finally {
      submittingRef.current = false;
      setSubmittingMode(null);
    }
  }

  if (createdOrder) {
    const shortageItems = shortage ? shortageInfo(shortage, cart) : [];
    return (
      <section
        aria-labelledby="borrador-creado"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Borrador creado</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="borrador-creado"
        >
          El pedido #{createdOrder.number} quedó en borrador
        </h2>
        <p className="mt-3 text-[13px] leading-6 text-muted">
          El borrador se guardó, pero no se pudo generar directamente. Abre el
          pedido para revisar su estado, ajustar líneas o cambiar el término de
          pago antes de reintentar.
        </p>
        {message && (
          <NoticeBanner className="mt-4" role="alert" tone="danger">
            <p>{message}</p>
            {message === ORDER_COPY.walletBalance && (
              <p className="mt-2 text-[12px] leading-5">
                No disponible en esta versión.
              </p>
            )}
            {shortageItems.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {shortageItems.map((item, index) => (
                  <li key={`${item.productId}-${index}`}>
                    <Link
                      className="font-semibold underline underline-offset-4 hover:text-ink"
                      href={`/app/productos/${item.productId}`}
                    >
                      {item.productName}
                    </Link>
                    {item.stateName ? ` · ${item.stateName}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </NoticeBanner>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="button-base button-primary min-h-11 px-5 text-[13px]"
            href={`/app/pedidos/${createdOrder.id}`}
          >
            Abrir borrador
            <Icon name="arrow-right" size={17} />
          </Link>
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/pedidos"
          >
            Volver a pedidos
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section
            aria-labelledby="catalogo-cliente"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h2
                  className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
                  id="catalogo-cliente"
                >
                  Productos disponibles
                </h2>
              </div>
              <span className="rounded-full bg-soft-blue px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
                Precio del cliente
              </span>
            </div>
            <p className="mt-3 text-[13px] leading-6 text-muted">
              Solo se muestran variantes con precio para la lista del cliente y
              existencia disponible. No se exponen cantidades, lotes ni costos.
            </p>

            {storeResource.status === "loading" && (
              <p className="mt-5 text-[13px] font-semibold text-muted" role="status">
                Cargando el catálogo del cliente…
              </p>
            )}

            {storeResource.status === "error" && (
              <div className="mt-5">
                <NoticeBanner
                  action={
                    <button
                      className="min-h-11 rounded-full border border-alert/30 px-3 text-[12px] font-semibold text-alert-ink transition-colors hover:bg-surface"
                      onClick={storeResource.reload}
                      type="button"
                    >
                      Reintentar
                    </button>
                  }
                  role="alert"
                  tone="danger"
                >
                  {storeResource.error?.kind === "forbidden"
                    ? "No pudimos consultar el catálogo del cliente. Verifica que tenga una lista de precios asignada y que esté asignado a tu usuario."
                    : storeResource.error?.message ??
                      "No pudimos cargar el catálogo del cliente."}
                </NoticeBanner>
              </div>
            )}

            {storeResource.status !== "loading" &&
              storeResource.status !== "error" &&
              storeProducts.length === 0 && (
                <div className="mt-5">
                  <EmptyState
                    description={ORDER_COPY.noStoreProducts}
                    title="Sin productos disponibles"
                  />
                </div>
              )}

            {storeProducts.length > 0 && (
              <>
                <div className="mt-5">
                  <label
                    className="mb-2 block text-[12px] font-semibold text-ink"
                    htmlFor="buscar-producto-pedido"
                  >
                    Buscar en el catálogo del cliente
                  </label>
                  <input
                    className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                    id="buscar-producto-pedido"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nombre, referencia o estado"
                    type="search"
                    value={query}
                  />
                  <p aria-live="polite" className="mt-2 text-[12px] text-muted">
                    {filteredProducts.length === 1
                      ? "1 variante disponible"
                      : `${formatInteger(filteredProducts.length)} variantes disponibles`}
                  </p>
                </div>

                {filteredProducts.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-line bg-background px-4 py-3 text-[13px] text-muted">
                    No hay variantes que coincidan con la búsqueda.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {filteredProducts.map((product) => {
                      const key = cartKey(product.id, product.itemState.id);
                      const inCart = cartKeys.has(key);
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
                          <button
                            aria-label={`Agregar ${product.name} en estado ${product.itemState.label}`}
                            className="button-base button-secondary min-h-11 px-4 text-[12px]"
                            disabled={inCart}
                            onClick={() => addProduct(product)}
                            type="button"
                          >
                            {inCart ? "En el pedido" : "Agregar"}
                            <Icon name={inCart ? "check" : "arrow-right"} size={15} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>

          <section
            aria-labelledby="carrito-pedido"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
          >
            <span className="eyebrow">Carrito</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="carrito-pedido"
            >
              Líneas del pedido
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-muted">
              Ajusta las cantidades antes de guardar. El pedido se crea en
              borrador; puedes generarlo directamente desde aquí o abrirlo para
              completarlo después.
            </p>

            {message && (
              <NoticeBanner className="mt-4" role="alert" tone="danger">
                {message}
              </NoticeBanner>
            )}

            {fieldErrors.items && (
              <p className="mt-4 text-[12px] font-semibold text-alert-ink" role="alert">
                {fieldErrors.items}
              </p>
            )}

            {cart.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-line bg-background px-6 py-8 text-center">
                <p className="text-[13px] font-semibold text-ink">
                  El carrito está vacío.
                </p>
                <p className="mx-auto mt-2 max-w-md text-[12px] leading-6 text-muted">
                  Agrega productos del catálogo del cliente. Para generar el
                  pedido necesitas al menos una línea.
                </p>
              </div>
            ) : (
              <ul className="mt-5 space-y-4">
                {cart.map((line) => (
                  <li
                    className="rounded-2xl border border-line bg-background p-4"
                    key={line.key}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-ink">
                          {line.productName}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted">
                          {line.reference || "Sin referencia"}
                        </p>
                        <p className="mt-1 text-[12px] text-muted">
                          {line.itemStateLabel} ·{" "}
                          {orderMoney(line.unitPrice, line.currency)}
                        </p>
                      </div>
                      <button
                        aria-label={`Quitar ${line.productName} del pedido`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-alert/30 bg-surface px-3.5 text-[12px] font-semibold text-alert-ink transition-colors hover:border-alert hover:bg-alert/[0.06]"
                        onClick={() => removeLine(line.key)}
                        type="button"
                      >
                        <Icon name="close" size={15} />
                        Quitar
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-end">
                      <TextField
                        error={quantityErrors[line.key]}
                        id={`carrito-cantidad-${line.key}`}
                        inputMode="numeric"
                        label={`Cantidad de ${line.productName}`}
                        maxLength={3}
                        onChange={(value) => updateQuantity(line.key, value)}
                        value={line.quantity}
                      />
                      <p className="text-right text-[13px] font-semibold tabular-nums text-ink">
                        Subtotal:{" "}
                        {orderMoney(
                          roundMoney(
                            line.unitPrice * (Number(line.quantity) || 0),
                          ),
                          line.currency,
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:h-fit">
          <section
            aria-labelledby="datos-pedido"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
          >
            <span className="eyebrow">Entrega y pago</span>
            <h2
              className="mt-3 text-lg font-semibold tracking-[-0.03em] text-ink"
              id="datos-pedido"
            >
              Datos del pedido
            </h2>

            <div className="mt-4 space-y-5">
              <SelectField
                emptyLabel="No hay términos de pago activos."
                error={fieldErrors.paymentTermId}
                help="Opcional en el borrador. El API exige un término activo antes de generar."
                id="nuevo-pedido-termino"
                label="Término de pago"
                loading={termsResource.status === "loading"}
                loadingLabel="Cargando términos…"
                loadError={
                  termsResource.status === "error"
                    ? termsResource.error?.message ??
                      "No pudimos cargar los términos de pago."
                    : null
                }
                onChange={(value) => {
                  setPaymentTermId(value);
                  setFieldErrors((current) => ({
                    ...current,
                    paymentTermId: undefined,
                  }));
                }}
                onRetry={termsResource.reload}
                options={terms.map((term) => ({
                  value: String(term.id),
                  label: `${term.name} · ${paymentTermDetail(term)}`,
                }))}
                placeholder="Usar el término del cliente"
                value={paymentTermId}
              />

              {isCashPaymentTerm(selectedTerm) && (
                <NoticeBanner tone="info">
                  Para un pedido de contado, la billetera del cliente debe cubrir
                  el total antes de generarlo.
                </NoticeBanner>
              )}

              <TextAreaField
                error={fieldErrors.deliveryAddress}
                help="Opcional. Si lo dejas vacío se usa la dirección del cliente. Máximo 500 caracteres."
                id="nuevo-pedido-direccion"
                label="Dirección de entrega"
                maxLength={500}
                onChange={(value) => {
                  setDeliveryAddress(value);
                  setFieldErrors((current) => ({
                    ...current,
                    deliveryAddress: undefined,
                  }));
                }}
                rows={3}
                value={deliveryAddress}
              />

              <TextAreaField
                error={fieldErrors.notes}
                help="Opcional. Máximo 1000 caracteres."
                id="nuevo-pedido-notas"
                label="Notas del pedido"
                maxLength={1000}
                onChange={(value) => {
                  setNotes(value);
                  setFieldErrors((current) => ({
                    ...current,
                    notes: undefined,
                  }));
                }}
                placeholder="Ej. Entregar por la tarde."
                rows={3}
                value={notes}
              />
            </div>
          </section>

          <section
            aria-labelledby="resumen-nuevo-pedido"
            className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-6"
          >
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
              id="resumen-nuevo-pedido"
            >
              Resumen
            </h2>
            <dl className="mt-4 space-y-3 text-[13px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Cliente</dt>
                <dd className="text-right font-semibold text-ink">
                  {customer.fullName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Líneas</dt>
                <dd className="tabular-nums text-ink">
                  {formatInteger(cart.length)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Moneda</dt>
                <dd>
                  <CurrencyChip currency={cartCurrency} />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="text-lg font-semibold tabular-nums text-ink">
                  {orderMoney(total, cartCurrency)}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[12px] leading-5 text-muted">
              Los precios provienen de la lista del cliente y no se convierten
              entre monedas. El total definitivo lo calcula el API al guardar.
            </p>

            <div className="mt-5 space-y-3">
              <BusyButton
                busy={submittingMode === "generate"}
                busyLabel="Generando…"
                className="w-full"
                disabled={submitting}
                onClick={() => void submitOrder("generate")}
                type="button"
              >
                Generar pedido
                <Icon name="arrow-right" size={17} />
              </BusyButton>
              <BusyButton
                busy={submittingMode === "draft"}
                busyLabel="Guardando…"
                className="w-full"
                disabled={submitting}
                onClick={() => void submitOrder("draft")}
                type="button"
                variant="secondary"
              >
                Guardar borrador
              </BusyButton>
            </div>
            <p className="mt-3 text-[12px] leading-5 text-muted">
              Al generar se reserva existencia. Si falta stock o el cliente de
              contado no tiene saldo, el pedido permanece en borrador.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
