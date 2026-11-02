"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useServerList } from "@/components/erp/ui/use-server-list";
import {
  fetchCustomer,
  fetchCustomerPage,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";
import {
  INVOICE_COPY,
  invoiceLoadErrorMessage,
} from "@/components/erp/records/invoices-errors";
import {
  InvoiceStatusBadge,
  invoiceDateLabel,
  invoiceMoney,
  invoiceNumberLabel,
  invoiceStatusOptions,
} from "@/components/erp/records/invoice-shared";
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
  fetchInvoicePage,
  type Invoice,
} from "@/lib/finance/invoices-api";
import { canReadModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

export type InvoiceListFilters = {
  orderId: string;
  customerId: string;
  number: string;
  paymentStatus: string;
};

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

export function InvoiceListPage({
  initialFilters,
}: {
  initialFilters: InvoiceListFilters;
}) {
  const { user } = useSession();
  if (!canReadModule(user.role, "facturas")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de facturas. La consulta está disponible para administradores y vendedores." />
    );
  }
  return <InvoiceListContent initialFilters={initialFilters} />;
}

function InvoiceListContent({
  initialFilters,
}: {
  initialFilters: InvoiceListFilters;
}) {
  const list = useServerList<Invoice>({
    loader: (request) => fetchInvoicePage(request),
    filterKeys: ["order_id", "customer_id", "number", "payment_status"],
    defaultSort: "issued_at",
    defaultOrder: "desc",
    initial: {
      filters: {
        order_id: initialFilters.orderId,
        customer_id: initialFilters.customerId,
        number: initialFilters.number,
        payment_status: initialFilters.paymentStatus,
      },
    },
  });
  const [orderDraft, setOrderDraft] = useState(initialFilters.orderId);
  const [numberDraft, setNumberDraft] = useState(initialFilters.number);
  const [customerDraft, setCustomerDraft] = useState("");
  const timers = useRef<Record<string, number>>({});

  const orderId = list.filters.order_id ?? "";
  const customerId = list.filters.customer_id ?? "";
  const number = list.filters.number ?? "";
  const paymentStatus = list.filters.payment_status ?? "";
  const invoices = list.items;

  const [appliedOrderId, setAppliedOrderId] = useState(orderId);
  if (orderId !== appliedOrderId) {
    setAppliedOrderId(orderId);
    setOrderDraft(orderId);
  }

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
      for (const timer of Object.values(timers.current)) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const filtersActive = Boolean(
    orderId || customerId || number || paymentStatus,
  );

  const chips: FilterChip[] = [];
  if (orderId) {
    chips.push({
      id: "order_id",
      label: `Pedido: #${orderId}`,
      onRemove: () => list.setFilter("order_id", ""),
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
      label: `Número: #${number}`,
      onRemove: () => {
        setNumberDraft("");
        list.setFilter("number", "");
      },
    });
  }
  if (paymentStatus) {
    chips.push({
      id: "payment_status",
      label: `Estado de pago: ${
        invoiceStatusOptions().find((option) => option.value === paymentStatus)
          ?.label ?? paymentStatus
      }`,
      onRemove: () => list.setFilter("payment_status", ""),
    });
  }

  function scheduleFilter(key: string, value: string) {
    if (timers.current[key] !== undefined) {
      window.clearTimeout(timers.current[key]);
    }
    timers.current[key] = window.setTimeout(() => {
      delete timers.current[key];
      list.setFilter(key, value.trim());
    }, 300);
  }

  function clearFilters() {
    for (const timer of Object.values(timers.current)) {
      window.clearTimeout(timer);
    }
    timers.current = {};
    setOrderDraft("");
    setNumberDraft("");
    setCustomerDraft("");
    list.clearFilters();
  }

  const columns: RecordsTableColumn<Invoice>[] = [
    {
      key: "numero",
      header: "Número",
      className: "whitespace-nowrap",
      render: (invoice) => (
        <Link
          className="font-mono text-[13px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/facturas/${invoice.id}`}
        >
          {invoiceNumberLabel(invoice.number)}
        </Link>
      ),
    },
    {
      key: "pedido",
      header: "Pedido",
      className: "whitespace-nowrap",
      render: (invoice) =>
        invoice.orderId !== null ? (
          <Link
            className="text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href={`/app/pedidos/${invoice.orderId}`}
          >
            {invoice.orderNumber !== null
              ? `Pedido #${invoice.orderNumber}`
              : `Pedido #${invoice.orderId}`}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "cliente",
      header: "Cliente",
      className: "max-w-[220px]",
      render: (invoice) => (
        <span
          className="block truncate font-semibold text-ink"
          title={invoice.customer?.fullName}
        >
          {invoice.customer?.fullName ?? `Cliente #${invoice.customerId}`}
        </span>
      ),
    },
    {
      key: "emision",
      header: "Emisión",
      className: "whitespace-nowrap",
      render: (invoice) => (
        <span className="tabular-nums text-muted">
          {invoiceDateLabel(invoice.issuedAt)}
        </span>
      ),
    },
    {
      key: "vencimiento",
      header: "Vencimiento",
      className: "whitespace-nowrap",
      render: (invoice) => (
        <span className="tabular-nums text-muted">
          {invoiceDateLabel(invoice.dueDate)}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      className: "whitespace-nowrap tabular-nums",
      render: (invoice) => invoiceMoney(invoice.total, invoice.currency),
    },
    {
      key: "pagado",
      header: "Pagado",
      className: "whitespace-nowrap tabular-nums text-muted",
      render: (invoice) => invoiceMoney(invoice.paidAmount, invoice.currency),
    },
    {
      key: "saldo",
      header: "Saldo",
      className: "whitespace-nowrap font-semibold tabular-nums",
      render: (invoice) => invoiceMoney(invoice.balanceDue, invoice.currency),
    },
    {
      key: "estado",
      header: "Estado de pago",
      className: "whitespace-nowrap",
      render: (invoice) => <InvoiceStatusBadge status={invoice.paymentStatus} />,
    },
  ];

  function renderActions(invoice: Invoice) {
    const label = invoiceNumberLabel(invoice.number);
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver la ${label}`}
          href={`/app/facturas/${invoice.id}`}
          icon="arrow-right"
        >
          Ver factura
        </RecordActionLink>
      </RecordActions>
    );
  }

  function renderCard(invoice: Invoice) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-semibold text-ink">
              {invoiceNumberLabel(invoice.number)}
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {invoice.customer?.fullName ?? `Cliente #${invoice.customerId}`}
            </p>
          </div>
          <InvoiceStatusBadge status={invoice.paymentStatus} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Pedido
            </dt>
            <dd className="mt-1">
              {invoice.orderId !== null ? (
                <Link
                  className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  href={`/app/pedidos/${invoice.orderId}`}
                >
                  {invoice.orderNumber !== null
                    ? `#${invoice.orderNumber}`
                    : `#${invoice.orderId}`}
                </Link>
              ) : (
                <span className="text-muted">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Emisión
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {invoiceDateLabel(invoice.issuedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Total
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {invoiceMoney(invoice.total, invoice.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Pagado
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {invoiceMoney(invoice.paidAmount, invoice.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Saldo pendiente
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {invoiceMoney(invoice.balanceDue, invoice.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Vencimiento
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {invoiceDateLabel(invoice.dueDate)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1">
              <CurrencyChip currency={invoice.currency} />
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        description="Consulta las facturas emitidas al facturar un pedido, revisa su estado de pago y abre el detalle para aplicar pagos recibidos."
        eyebrow="Finanzas"
        title="Facturas"
      />

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        extra={
          <p className="mt-3 text-[12px] leading-5 text-muted">
            Las facturas no se editan ni se eliminan desde esta pantalla.
          </p>
        }
        id="facturas-filtros"
        loading={list.status === "loading"}
        onClear={clearFilters}
        results={
          list.status === "loading"
            ? "Cargando facturas…"
            : list.status === "error" && invoices.length === 0
              ? "No se pudieron cargar las facturas"
              : list.meta.total === 0
                ? "Sin facturas"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="Busca el cliente por nombre o correo. El filtro se aplica en el servidor."
            id="filtro-factura-cliente"
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
        <TextField
          help="Identificador del pedido facturado. Se aplica al escribir."
          id="filtro-factura-pedido"
          inputMode="numeric"
          inputType="search"
          label="Pedido"
          maxLength={12}
          onChange={(value) => {
            const digits = normalizeDigits(value);
            setOrderDraft(digits);
            scheduleFilter("order_id", digits);
          }}
          placeholder="Ej. 12"
          value={orderDraft}
        />
        <TextField
          help="Número exacto de la factura. Se aplica al escribir."
          id="filtro-factura-numero"
          inputMode="numeric"
          inputType="search"
          label="Número"
          maxLength={12}
          onChange={(value) => {
            const digits = normalizeDigits(value);
            setNumberDraft(digits);
            scheduleFilter("number", digits);
          }}
          placeholder="Ej. 7"
          value={numberDraft}
        />
        <SelectField
          id="filtro-factura-estado"
          label="Estado de pago"
          onChange={(value) => list.setFilter("payment_status", value)}
          options={invoiceStatusOptions()}
          placeholder="Todos los estados"
          value={paymentStatus}
        />
      </FilterBar>

      {list.status === "loading" && (
        <RecordsTableSkeleton columns={10} label="Cargando facturas…" rows={6} />
      )}

      {list.status === "error" && invoices.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={invoiceLoadErrorMessage(
            list.error,
            "No pudimos cargar las facturas.",
          )}
          onRetry={list.reload}
          title="No pudimos cargar las facturas"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && invoices.length === 0) && (
          <section aria-label="Listado de facturas" className="space-y-4">
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && invoices.length > 0 && (
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
                {invoiceLoadErrorMessage(
                  list.error,
                  "No pudimos actualizar las facturas. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {invoices.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={
                    <Link
                      className="button-base button-secondary min-h-11 px-5"
                      href="/app/pedidos"
                    >
                      Ver pedidos
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  }
                  description="Las facturas se crean al facturar un pedido. Revisa los pedidos disponibles para facturar."
                  title={INVOICE_COPY.empty}
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
                        )} facturas en total, pero esta página no tiene filas.`
                      : INVOICE_COPY.emptyFilteredHelp
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : INVOICE_COPY.emptyFiltered
                  }
                />
              )
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  busy={list.status === "refreshing"}
                  caption="Facturas con número, pedido, cliente, emisión, vencimiento, total, pagado, saldo y estado de pago"
                  columns={columns}
                  getRowKey={(invoice) => String(invoice.id)}
                  getRowLabel={(invoice) => invoiceNumberLabel(invoice.number)}
                  renderCard={renderCard}
                  rowActions={renderActions}
                  rows={invoices}
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
        Una factura es inmutable: solo cambian el monto pagado y el estado de
        pago cuando se aplican pagos. Los pagos se toman de la billetera del
        cliente en la moneda registrada por el método de pago.
      </p>
    </div>
  );
}
