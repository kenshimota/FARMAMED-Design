"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { ORDER_COPY } from "@/components/erp/records/orders-errors";
import {
  fetchOrders,
  fetchOrderStatuses,
  type OrderRecord,
} from "@/components/erp/records/orders-api";
import {
  OrderStatusBadge,
  orderCountLabel,
  orderMoney,
  orderNumberLabel,
  orderStatusOptions,
} from "@/components/erp/records/orders-shared";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import {
  RecordsLoadError,
  RecordsTableSkeleton,
} from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  fetchCustomers,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatDateTime, formatInteger } from "@/lib/format";
import type { UiError } from "@/lib/api-errors";

export type OrderListFilters = {
  status: string;
  customerId: string;
  number: string;
};

const EMPTY_FILTERS: OrderListFilters = {
  status: "",
  customerId: "",
  number: "",
};

const NO_ORDERS: OrderRecord[] = [];
const NO_CUSTOMERS: CustomerRecord[] = [];

function filtersKey(filters: OrderListFilters) {
  return [filters.status, filters.customerId, filters.number].join("|");
}

function hasActiveFilters(filters: OrderListFilters) {
  return Boolean(filters.status || filters.customerId || filters.number.trim());
}

function listErrorMessage(error: UiError | null, fallback: string) {
  if (!error) return fallback;
  if (error.kind === "validation" || error.kind === "bad-request") {
    return "Los filtros ingresados no son válidos. Ajusta la selección e intenta de nuevo.";
  }
  return error.message;
}

export function OrderListPage({
  initialFilters,
}: {
  initialFilters: OrderListFilters;
}) {
  const { user } = useSession();
  if (!canReadModule(user.role, "pedidos")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de pedidos. La gestión interna está disponible para administradores y vendedores." />
    );
  }
  return <OrderListContent initialFilters={initialFilters} />;
}

function OrderListContent({
  initialFilters,
}: {
  initialFilters: OrderListFilters;
}) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const currencyStatus = useCurrencyStatusContext();
  const canWrite = canWriteModule(user.role, "pedidos");

  const [filters, setFilters] = useState<OrderListFilters>(initialFilters);
  const [numberDraft, setNumberDraft] = useState(initialFilters.number);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(filters);
  const numberTimer = useRef<number | null>(null);

  const initialFiltersKey = filtersKey(initialFilters);
  const [appliedInitialFiltersKey, setAppliedInitialFiltersKey] =
    useState(initialFiltersKey);
  if (initialFiltersKey !== appliedInitialFiltersKey) {
    setAppliedInitialFiltersKey(initialFiltersKey);
    setFilters(initialFilters);
    setNumberDraft(initialFilters.number);
  }

  const statusesResource = useAsyncResource(fetchOrderStatuses);
  const statuses = statusesResource.data ?? [];
  const customersResource = useAsyncResource(fetchCustomers);
  const customers = customersResource.data ?? NO_CUSTOMERS;

  const loader = useCallback(
    () =>
      fetchOrders({
        status: filters.status || undefined,
        customer_id: filters.customerId || undefined,
        number: filters.number.trim() || undefined,
      }),
    [filters.customerId, filters.number, filters.status],
  );
  const ordersResource = useAsyncResource(loader);
  const reloadOrders = ordersResource.reload;
  const orders = ordersResource.data ?? NO_ORDERS;

  const activeFilterKey = filtersKey(filters);
  const appliedFilterKey = useRef(activeFilterKey);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (appliedFilterKey.current === activeFilterKey) return;
    appliedFilterKey.current = activeFilterKey;
    reloadOrders();
  }, [activeFilterKey, reloadOrders]);

  useEffect(() => {
    return () => {
      if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    };
  }, []);

  const filtersActive = hasActiveFilters(filters);
  const countLabel = ordersResource.data
    ? orderCountLabel(orders.length)
    : ordersResource.status === "error"
      ? "No se pudieron cargar los pedidos"
      : "Cargando pedidos…";

  const customerOptions = useMemo(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.email
          ? `${customer.fullName} — ${customer.email}`
          : customer.fullName,
      })),
    [customers],
  );

  function commitFilters(next: OrderListFilters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.customerId) params.set("customer_id", next.customerId);
    if (next.number.trim()) params.set("number", next.number.trim());
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateFilter(key: keyof OrderListFilters, value: string) {
    commitFilters({ ...filters, [key]: value });
  }

  function handleNumberChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    setNumberDraft(digits);
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    numberTimer.current = window.setTimeout(() => {
      commitFilters({ ...filtersRef.current, number: digits });
    }, 450);
  }

  function clearFilters() {
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    setNumberDraft("");
    commitFilters(EMPTY_FILTERS);
  }

  function currencyFor(order: OrderRecord) {
    return order.currency ?? currencyStatus?.defaultCurrency ?? null;
  }

  const columns: RecordsTableColumn<OrderRecord>[] = [
    {
      key: "numero",
      header: "Número",
      className: "whitespace-nowrap",
      render: (order) => (
        <Link
          className="font-mono text-[13px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/pedidos/${order.id}`}
        >
          {orderNumberLabel(order.number)}
        </Link>
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      className: "whitespace-nowrap",
      render: (order) => (
        <span className="tabular-nums text-muted">
          {order.createdAt ? formatDateTime(order.createdAt) : "—"}
        </span>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      className: "max-w-[220px]",
      render: (order) => (
        <span className="block truncate font-semibold text-ink" title={order.customer?.fullName}>
          {order.customer?.fullName ?? `Cliente #${order.customerId ?? "—"}`}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      className: "whitespace-nowrap",
      render: (order) => (
        <OrderStatusBadge status={order.status} statuses={statuses} />
      ),
    },
    {
      key: "lineas",
      header: "Líneas",
      className: "whitespace-nowrap tabular-nums",
      render: (order) => formatInteger(order.itemsCount),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      className: "whitespace-nowrap tabular-nums",
      render: (order) => orderMoney(order.subtotal, currencyFor(order)),
    },
    {
      key: "total",
      header: "Total",
      className: "whitespace-nowrap font-semibold tabular-nums",
      render: (order) => orderMoney(order.total, currencyFor(order)),
    },
    {
      key: "moneda",
      header: "Moneda",
      className: "whitespace-nowrap",
      render: (order) => (
        <CurrencyChip currency={currencyFor(order)} />
      ),
    },
  ];

  function renderActions(order: OrderRecord) {
    const label = orderNumberLabel(order.number);
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver el detalle del ${label}`}
          href={`/app/pedidos/${order.id}`}
          icon="arrow-right"
        >
          Ver detalle
        </RecordActionLink>
      </RecordActions>
    );
  }

  function renderCard(order: OrderRecord) {
    const currency = currencyFor(order);
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-semibold text-ink">
              {orderNumberLabel(order.number)}
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {order.customer?.fullName ?? `Cliente #${order.customerId ?? "—"}`}
            </p>
          </div>
          <OrderStatusBadge status={order.status} statuses={statuses} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Fecha
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {order.createdAt ? formatDateTime(order.createdAt) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Líneas
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {formatInteger(order.itemsCount)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Total
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {orderMoney(order.total, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1">
              <CurrencyChip currency={currency} />
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/pedidos/nuevo"
            >
              Nuevo pedido
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Revisa los pedidos de todos los clientes, filtra por estado, cliente o número y avanza cada pedido según su estado."
        eyebrow="Operación"
        title="Pedidos"
      />

      {statusesResource.status === "error" && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={statusesResource.reload}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos cargar el catálogo de estados. Mostramos los estados base
          mientras el servicio se recupera.
        </NoticeBanner>
      )}

      <section
        aria-label="Filtros de pedidos"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <h2 className="text-[13px] font-semibold text-ink">Filtros</h2>
          <button
            aria-controls="filtros-pedidos-campos"
            aria-expanded={filtersOpen}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-4 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand"
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
          >
            {filtersOpen ? "Ocultar filtros" : "Mostrar filtros"}
            <Icon
              className={`transition-transform motion-reduce:transition-none ${filtersOpen ? "rotate-180" : ""}`}
              name="chevron-down"
              size={15}
            />
          </button>
        </div>

        <div
          className={`${filtersOpen ? "grid" : "hidden"} mt-4 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid lg:grid-cols-3`}
          id="filtros-pedidos-campos"
        >
          <SelectField
            emptyLabel="No hay estados configurados."
            id="filtro-pedido-estado"
            label="Estado"
            loading={statusesResource.status === "loading"}
            loadingLabel="Cargando estados…"
            onChange={(value) => updateFilter("status", value)}
            options={orderStatusOptions(statuses)}
            placeholder="Todos los estados"
            value={filters.status}
          />
          <SelectField
            emptyLabel="No hay clientes registrados."
            id="filtro-pedido-cliente"
            label="Cliente"
            loading={customersResource.status === "loading"}
            loadingLabel="Cargando clientes…"
            loadError={
              customersResource.status === "error"
                ? customersResource.error?.message ??
                  "No pudimos cargar los clientes."
                : null
            }
            onChange={(value) => updateFilter("customerId", value)}
            onRetry={customersResource.reload}
            options={customerOptions}
            placeholder="Todos los clientes"
            value={filters.customerId}
          />
          <TextField
            help="Número exacto del pedido. Se aplica automáticamente al escribir."
            id="filtro-pedido-numero"
            inputMode="numeric"
            label="Número"
            maxLength={12}
            onChange={handleNumberChange}
            placeholder="Ej. 12"
            value={numberDraft}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p aria-live="polite" className="text-[12px] font-semibold text-muted">
            {countLabel}
          </p>
          {filtersActive && (
            <button
              className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              onClick={clearFilters}
              type="button"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {ordersResource.status === "loading" && (
        <RecordsTableSkeleton columns={8} label="Cargando pedidos…" rows={6} />
      )}

      {ordersResource.status === "error" && orders.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={listErrorMessage(
            ordersResource.error,
            "No pudimos cargar los pedidos.",
          )}
          onRetry={reloadOrders}
          title="No pudimos cargar los pedidos"
        />
      )}

      {ordersResource.status !== "loading" &&
        !(ordersResource.status === "error" && orders.length === 0) && (
          <section aria-label="Listado de pedidos" className="space-y-4">
            {ordersResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {ordersResource.status === "error" && orders.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={reloadOrders}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {listErrorMessage(
                  ordersResource.error,
                  "No pudimos actualizar los pedidos. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {orders.length === 0 ? (
              <EmptyState
                action={
                  filtersActive ? (
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={clearFilters}
                      type="button"
                    >
                      Limpiar filtros
                    </button>
                  ) : canWrite ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href="/app/pedidos/nuevo"
                    >
                      Nuevo pedido
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description={
                  filtersActive
                    ? ORDER_COPY.emptyFilteredHelp
                    : "La venta asistida permite crear el primer pedido para un cliente asignado."
                }
                title={
                  filtersActive ? ORDER_COPY.emptyFiltered : ORDER_COPY.empty
                }
              />
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  caption="Pedidos con número, fecha, cliente, estado, líneas, subtotal, total y moneda"
                  columns={columns}
                  getRowKey={(order) => String(order.id)}
                  getRowLabel={(order) => orderNumberLabel(order.number)}
                  renderCard={renderCard}
                  rowActions={renderActions}
                  rows={orders}
                />
              </div>
            )}
          </section>
        )}

      <p className="text-[12px] leading-5 text-muted">
        Al aprobar un pedido solicitado se reserva existencia. La reserva se
        libera si el pedido se cancela y el stock solo se descuenta al facturar.
      </p>
    </div>
  );
}
