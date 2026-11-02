"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { useServerList } from "@/components/erp/ui/use-server-list";
import { ORDER_COPY } from "@/components/erp/records/orders-errors";
import {
  fetchOrderPage,
  fetchOrderStatuses,
  type OrderRecord,
} from "@/components/erp/records/orders-api";
import {
  OrderStatusBadge,
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
  fetchCustomer,
  fetchCustomerPage,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatDateTime, formatInteger } from "@/lib/format";
import type { UiError } from "@/lib/api-errors";

export type OrderListFilters = {
  status: string;
  customerId: string;
  number: string;
};

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
  const currencyStatus = useCurrencyStatusContext();
  const canWrite = canWriteModule(user.role, "pedidos");

  const list = useServerList<OrderRecord>({
    loader: (request) => fetchOrderPage(request),
    filterKeys: ["status", "customer_id", "number"],
    defaultSort: "createdAt",
    defaultOrder: "desc",
    initial: {
      filters: {
        status: initialFilters.status,
        customer_id: initialFilters.customerId,
        number: initialFilters.number,
      },
    },
  });
  const [numberDraft, setNumberDraft] = useState(initialFilters.number);
  const [customerDraft, setCustomerDraft] = useState("");
  const numberTimer = useRef<number | null>(null);

  const status = list.filters.status ?? "";
  const customerId = list.filters.customer_id ?? "";
  const number = list.filters.number ?? "";
  const orders = list.items;

  const statusesResource = useAsyncResource(fetchOrderStatuses);
  const statuses = statusesResource.data ?? [];

  const [appliedNumber, setAppliedNumber] = useState(number);
  if (number !== appliedNumber) {
    setAppliedNumber(number);
    setNumberDraft(number);
  }

  const customerIds = useMemo(
    () => (customerId ? [customerId] : []),
    [customerId],
  );
  const customersById = useRecordsById<CustomerRecord>({
    ids: customerIds,
    load: fetchCustomer,
    getId: (customer) => customer.id,
  }).records;
  const customerLabel = customerId
    ? customersById[customerId]
      ? customersById[customerId].fullName
      : `Cliente #${customerId}`
    : "";
  const [appliedCustomerLabel, setAppliedCustomerLabel] =
    useState(customerLabel);
  if (customerLabel !== appliedCustomerLabel) {
    setAppliedCustomerLabel(customerLabel);
    setCustomerDraft(customerLabel);
  }

  useEffect(() => {
    return () => {
      if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    };
  }, []);

  const filtersActive = Boolean(status || customerId || number);
  const chips: FilterChip[] = [];
  if (status) {
    chips.push({
      id: "status",
      label: `Estado: ${
        orderStatusOptions(statuses).find((option) => option.value === status)
          ?.label ?? status
      }`,
      onRemove: () => list.setFilter("status", ""),
    });
  }
  if (customerId) {
    chips.push({
      id: "customer_id",
      label: `Cliente: ${customerLabel || `#${customerId}`}`,
      onRemove: () => list.setFilter("customer_id", ""),
    });
  }
  if (number) {
    chips.push({
      id: "number",
      label: `Número: ${number}`,
      onRemove: () => {
        setNumberDraft("");
        list.setFilter("number", "");
      },
    });
  }

  function handleNumberChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 12);
    setNumberDraft(digits);
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    numberTimer.current = window.setTimeout(() => {
      list.setFilter("number", digits);
    }, 300);
  }

  function clearFilters() {
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    setNumberDraft("");
    list.clearFilters();
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

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        id="pedidos-filtros"
        loading={list.status === "loading"}
        onClear={clearFilters}
        results={
          list.status === "loading"
            ? "Cargando pedidos…"
            : list.status === "error" && orders.length === 0
              ? "No se pudieron cargar los pedidos"
              : list.meta.total === 0
                ? "Sin pedidos"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="Busca el cliente por nombre o correo. El filtro se aplica en el servidor."
            id="filtro-pedido-cliente"
            label="Cliente"
            loadOptions={async (query) => {
              const page = await fetchCustomerPage({ q: query, pageSize: 10 });
              return page.data.map((customer) => ({
                value: String(customer.id),
                label: customer.fullName,
                description: customer.email || undefined,
              }));
            }}
            onSelect={(option) => {
              setCustomerDraft(option.label);
              list.setFilter("customer_id", option.value);
            }}
            onValueChange={(value) => {
              setCustomerDraft(value);
              if (value !== customerLabel) {
                list.setFilter("customer_id", "");
              }
            }}
            placeholder="Buscar cliente"
            value={customerDraft}
          />
        }
      >
        <SelectField
          emptyLabel="No hay estados configurados."
          id="filtro-pedido-estado"
          label="Estado"
          loading={statusesResource.status === "loading"}
          loadingLabel="Cargando estados…"
          onChange={(value) => list.setFilter("status", value)}
          options={orderStatusOptions(statuses)}
          placeholder="Todos los estados"
          value={status}
        />
        <TextField
          help="Número exacto del pedido. Se aplica automáticamente al escribir."
          id="filtro-pedido-numero"
          inputMode="numeric"
          inputType="search"
          label="Número"
          maxLength={12}
          onChange={handleNumberChange}
          placeholder="Ej. 12"
          value={numberDraft}
        />
      </FilterBar>

      {list.status === "loading" && (
        <RecordsTableSkeleton columns={8} label="Cargando pedidos…" rows={6} />
      )}

      {list.status === "error" && orders.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={listErrorMessage(
            list.error,
            "No pudimos cargar los pedidos.",
          )}
          onRetry={list.reload}
          title="No pudimos cargar los pedidos"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && orders.length === 0) && (
          <section aria-label="Listado de pedidos" className="space-y-4">
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && orders.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={list.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {listErrorMessage(
                  list.error,
                  "No pudimos actualizar los pedidos. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {orders.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={
                    canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/pedidos/nuevo"
                      >
                        Nuevo pedido
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description="La venta asistida permite crear el primer pedido para un cliente asignado."
                  title={ORDER_COPY.empty}
                />
              ) : (
                <EmptyState
                  action={
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={
                        list.isPageOutOfRange
                          ? list.goToFirstPage
                          : clearFilters
                      }
                      type="button"
                    >
                      {list.isPageOutOfRange
                        ? "Ir a la primera página"
                        : "Limpiar filtros"}
                    </button>
                  }
                  description={
                    list.isPageOutOfRange
                      ? `Hay ${formatInteger(
                          list.meta.total,
                        )} pedidos en total, pero esta página no tiene filas.`
                      : ORDER_COPY.emptyFilteredHelp
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : ORDER_COPY.emptyFiltered
                  }
                />
              )
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  busy={list.status === "refreshing"}
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

            <PaginationControls
              meta={list.meta}
              onFirstPage={list.goToFirstPage}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
          </section>
        )}

      <p className="text-[12px] leading-5 text-muted">
        Al aprobar un pedido solicitado se reserva existencia. La reserva se
        libera si el pedido se cancela y el stock solo se descuenta al facturar.
      </p>
    </div>
  );
}
