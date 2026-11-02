"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  fetchCustomers,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  INVOICE_COPY,
  invoiceLoadErrorMessage,
} from "@/components/erp/records/invoices-errors";
import {
  InvoiceStatusBadge,
  invoiceCountLabel,
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
  fetchInvoices,
  type Invoice,
} from "@/lib/finance/invoices-api";
import { canReadModule } from "@/lib/permissions";

export type InvoiceListFilters = {
  orderId: string;
  customerId: string;
  number: string;
  paymentStatus: string;
};

const EMPTY_FILTERS: InvoiceListFilters = {
  orderId: "",
  customerId: "",
  number: "",
  paymentStatus: "",
};

const NO_INVOICES: Invoice[] = [];
const NO_CUSTOMERS: CustomerRecord[] = [];

function filtersKey(filters: InvoiceListFilters) {
  return [
    filters.orderId.trim(),
    filters.customerId,
    filters.number.trim(),
    filters.paymentStatus,
  ].join("|");
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
}

function hasActiveFilters(filters: InvoiceListFilters) {
  return Boolean(
    filters.orderId.trim() ||
      filters.customerId ||
      filters.number.trim() ||
      filters.paymentStatus,
  );
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
  const router = useRouter();
  const pathname = usePathname();
  const customersResource = useAsyncResource(fetchCustomers);
  const customers = customersResource.data ?? NO_CUSTOMERS;

  const [filters, setFilters] = useState<InvoiceListFilters>(initialFilters);
  const [draft, setDraft] = useState<InvoiceListFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const initialFiltersKey = filtersKey(initialFilters);
  const [appliedInitialFiltersKey, setAppliedInitialFiltersKey] =
    useState(initialFiltersKey);
  if (initialFiltersKey !== appliedInitialFiltersKey) {
    setAppliedInitialFiltersKey(initialFiltersKey);
    setFilters(initialFilters);
    setDraft(initialFilters);
  }

  const loader = useCallback(
    () =>
      fetchInvoices({
        orderId: filters.orderId.trim() || undefined,
        customerId: filters.customerId || undefined,
        number: filters.number.trim() || undefined,
        paymentStatus: filters.paymentStatus || undefined,
      }),
    [filters.customerId, filters.number, filters.orderId, filters.paymentStatus],
  );
  const resource = useAsyncResource(loader);
  const reloadInvoices = resource.reload;
  const invoices = resource.data ?? NO_INVOICES;

  const activeFilterKey = filtersKey(filters);
  const appliedFilterKey = useRef(activeFilterKey);

  useEffect(() => {
    if (appliedFilterKey.current === activeFilterKey) return;
    appliedFilterKey.current = activeFilterKey;
    reloadInvoices();
  }, [activeFilterKey, reloadInvoices]);

  const filtersActive = hasActiveFilters(filters);
  const countLabel = resource.data
    ? invoiceCountLabel(invoices.length)
    : resource.status === "error"
      ? "No se pudieron cargar las facturas"
      : "Cargando facturas…";

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

  function commitFilters(next: InvoiceListFilters) {
    const normalized: InvoiceListFilters = {
      orderId: next.orderId.trim(),
      customerId: next.customerId,
      number: next.number.trim(),
      paymentStatus: next.paymentStatus,
    };
    setFilters(normalized);
    setDraft(normalized);
    const params = new URLSearchParams();
    if (normalized.orderId) params.set("order_id", normalized.orderId);
    if (normalized.customerId) params.set("customer_id", normalized.customerId);
    if (normalized.number) params.set("number", normalized.number);
    if (normalized.paymentStatus) {
      params.set("payment_status", normalized.paymentStatus);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitFilters(draft);
  }

  function clearFilters() {
    commitFilters(EMPTY_FILTERS);
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

      <section
        aria-label="Filtros de facturas"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="flex items-center justify-between gap-3 lg:hidden">
          <h2 className="text-[13px] font-semibold text-ink">Filtros</h2>
          <button
            aria-controls="filtros-facturas-campos"
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

        <form
          className={`${filtersOpen ? "grid" : "hidden"} mt-4 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid lg:grid-cols-4`}
          id="filtros-facturas-campos"
          onSubmit={handleSubmit}
        >
          <TextField
            help="Identificador del pedido facturado."
            id="filtro-factura-pedido"
            inputMode="numeric"
            label="Pedido"
            maxLength={12}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                orderId: normalizeDigits(value),
              }))
            }
            placeholder="Ej. 12"
            value={draft.orderId}
          />
          <SelectField
            emptyLabel="No hay clientes registrados."
            id="filtro-factura-cliente"
            label="Cliente"
            loading={customersResource.status === "loading"}
            loadingLabel="Cargando clientes…"
            loadError={
              customersResource.status === "error"
                ? customersResource.error?.message ??
                  "No pudimos cargar los clientes."
                : null
            }
            onChange={(value) =>
              setDraft((current) => ({ ...current, customerId: value }))
            }
            onRetry={customersResource.reload}
            options={customerOptions}
            placeholder="Todos los clientes"
            value={draft.customerId}
          />
          <TextField
            help="Número exacto de la factura."
            id="filtro-factura-numero"
            inputMode="numeric"
            label="Número"
            maxLength={12}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                number: normalizeDigits(value),
              }))
            }
            placeholder="Ej. 7"
            value={draft.number}
          />
          <SelectField
            id="filtro-factura-estado"
            label="Estado de pago"
            onChange={(value) =>
              setDraft((current) => ({ ...current, paymentStatus: value }))
            }
            options={invoiceStatusOptions()}
            placeholder="Todos los estados"
            value={draft.paymentStatus}
          />

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
            <button
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              type="submit"
            >
              Aplicar filtros
              <Icon name="search" size={16} />
            </button>
            {filtersActive && (
              <button
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                onClick={clearFilters}
                type="button"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p aria-live="polite" className="text-[12px] font-semibold text-muted">
            {countLabel}
          </p>
          <p className="text-[12px] text-muted">
            Las facturas no se editan ni se eliminan desde esta pantalla.
          </p>
        </div>
      </section>

      {resource.status === "loading" && (
        <RecordsTableSkeleton columns={10} label="Cargando facturas…" rows={6} />
      )}

      {resource.status === "error" && invoices.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={invoiceLoadErrorMessage(
            resource.error,
            "No pudimos cargar las facturas.",
          )}
          onRetry={reloadInvoices}
          title="No pudimos cargar las facturas"
        />
      )}

      {resource.status !== "loading" &&
        !(resource.status === "error" && invoices.length === 0) && (
          <section aria-label="Listado de facturas" className="space-y-4">
            {resource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {resource.status === "error" && invoices.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={reloadInvoices}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {invoiceLoadErrorMessage(
                  resource.error,
                  "No pudimos actualizar las facturas. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {invoices.length === 0 ? (
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
                  ) : (
                    <Link
                      className="button-base button-secondary min-h-11 px-5"
                      href="/app/pedidos"
                    >
                      Ver pedidos
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  )
                }
                description={
                  filtersActive
                    ? INVOICE_COPY.emptyFilteredHelp
                    : "Las facturas se crean al facturar un pedido. Revisa los pedidos disponibles para facturar."
                }
                title={
                  filtersActive ? INVOICE_COPY.emptyFiltered : INVOICE_COPY.empty
                }
              />
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
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
