"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { CurrencyChip, CurrencySelect } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { DateField, SelectField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
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
import { findById } from "@/components/erp/records/records-api";
import {
  fetchCustomers,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  fetchMethodPayments,
  type MethodPayment,
} from "@/components/erp/records/method-payments-api";
import {
  deletePayment,
  fetchPayments,
  type PaymentRecord,
} from "@/components/erp/records/payments-api";
import {
  paymentCountLabel,
  paymentMethodLabel,
  paymentMoney,
  SignedMoney,
} from "@/components/erp/records/payment-shared";
import type { WalletCurrency } from "@/components/erp/records/wallets-api";
import { formatDateOnly } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import type { UiError } from "@/lib/api-errors";

export type PaymentListFilters = {
  customerId: string;
  methodPaymentId: string;
  currencyId: string;
  paidFrom: string;
  paidTo: string;
};

export const EMPTY_PAYMENT_FILTERS: PaymentListFilters = {
  customerId: "",
  methodPaymentId: "",
  currencyId: "",
  paidFrom: "",
  paidTo: "",
};

const NO_PAYMENTS: PaymentRecord[] = [];
const NO_CUSTOMERS: CustomerRecord[] = [];
const NO_METHODS: MethodPayment[] = [];

function filtersKey(filters: PaymentListFilters) {
  return [
    filters.customerId,
    filters.methodPaymentId,
    filters.currencyId,
    filters.paidFrom,
    filters.paidTo,
  ].join("|");
}

function hasActiveFilters(filters: PaymentListFilters) {
  return Boolean(
    filters.customerId ||
      filters.methodPaymentId ||
      filters.currencyId ||
      filters.paidFrom ||
      filters.paidTo,
  );
}

function listErrorMessage(error: UiError | null) {
  if (!error) return "No pudimos cargar los pagos.";
  if (error.kind === "validation") {
    return "Los filtros seleccionados no son válidos. Ajusta la búsqueda e intenta de nuevo.";
  }
  return error.message;
}

export function PaymentListPage({
  initialFilters,
}: {
  initialFilters: PaymentListFilters;
}) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  if (!canReadModule(user.role, "pagos")) {
    return activityVisible ? (
      <AccessState description="Tu rol no tiene acceso al módulo de pagos. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }
  return <PaymentListContent initialFilters={initialFilters} />;
}

function PaymentListContent({
  initialFilters,
}: {
  initialFilters: PaymentListFilters;
}) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const currencyStatus = useCurrencyStatusContext();
  const activityVisible = useActivityVisible();
  const canWrite = canWriteModule(user.role, "pagos");
  const canDelete = user.role === "admin";

  const [filters, setFilters] = useState<PaymentListFilters>(initialFilters);
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord | null>(null);

  const initialKey = filtersKey(initialFilters);
  const [appliedInitialKey, setAppliedInitialKey] = useState(initialKey);
  if (initialKey !== appliedInitialKey) {
    setAppliedInitialKey(initialKey);
    setFilters(initialFilters);
  }

  const customersResource = useAsyncResource(fetchCustomers);
  const methodsResource = useAsyncResource(fetchMethodPayments);
  const customers = customersResource.data ?? NO_CUSTOMERS;
  const methods = methodsResource.data ?? NO_METHODS;

  const loader = useCallback(
    () =>
      fetchPayments({
        customerId: filters.customerId || undefined,
        methodPaymentId: filters.methodPaymentId || undefined,
        currencyId: filters.currencyId || undefined,
        paidFrom: filters.paidFrom || undefined,
        paidTo: filters.paidTo || undefined,
      }),
    [
      filters.customerId,
      filters.currencyId,
      filters.methodPaymentId,
      filters.paidFrom,
      filters.paidTo,
    ],
  );
  const resource = useAsyncResource(loader);
  const reload = resource.reload;
  const payments = resource.data ?? NO_PAYMENTS;

  const activeKey = filtersKey(filters);
  const appliedKey = useRef(activeKey);
  useEffect(() => {
    if (appliedKey.current === activeKey) return;
    appliedKey.current = activeKey;
    reload();
  }, [activeKey, reload]);

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

  const methodOptions = useMemo(
    () =>
      methods.map((method) => ({
        value: String(method.id),
        label: method.currency
          ? `${method.label} · ${method.currency.code}`
          : method.label,
      })),
    [methods],
  );

  const filtersActive = hasActiveFilters(filters);
  const invalidDateRange = Boolean(
    filters.paidFrom && filters.paidTo && filters.paidFrom > filters.paidTo,
  );

  if (!activityVisible) return null;

  function commitFilters(next: PaymentListFilters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.customerId) params.set("customer_id", next.customerId);
    if (next.methodPaymentId) {
      params.set("method_payment_id", next.methodPaymentId);
    }
    if (next.currencyId) params.set("currency_id", next.currencyId);
    if (next.paidFrom) params.set("paid_from", next.paidFrom);
    if (next.paidTo) params.set("paid_to", next.paidTo);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  function updateFilter(key: keyof PaymentListFilters, value: string) {
    commitFilters({ ...filters, [key]: value });
  }

  function clearFilters() {
    commitFilters(EMPTY_PAYMENT_FILTERS);
  }

  function customerFor(payment: PaymentRecord) {
    return findById(customers, payment.customer_id);
  }

  function customerNameFor(payment: PaymentRecord) {
    return customerFor(payment)?.fullName ?? `Cliente #${payment.customer_id}`;
  }

  function currencyFor(payment: PaymentRecord): WalletCurrency | null {
    if (payment.currency) return payment.currency;
    const catalog = currencyStatus?.currencies.find(
      (currency) => String(currency.id) === String(payment.currency_id),
    );
    if (!catalog) return null;
    return {
      id: catalog.id ?? payment.currency_id,
      code: catalog.code,
      name: catalog.name,
      symbol: catalog.symbol,
    };
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deletePayment(String(deleteTarget.id));
    toast.success("Pago eliminado. El saldo de la billetera se actualizó.");
    reload();
  }

  function renderActions(payment: PaymentRecord) {
    const customerName = customerNameFor(payment);
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver el pago de ${customerName}`}
          href={`/app/pagos/${payment.id}`}
          icon="eye"
        >
          Ver
        </RecordActionLink>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar el pago de ${customerName}`}
            href={`/app/pagos/${payment.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canDelete && (
          <RecordActionButton
            aria-label={`Eliminar el pago de ${customerName}`}
            danger
            icon="close"
            onClick={() => setDeleteTarget(payment)}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  const columns: RecordsTableColumn<PaymentRecord>[] = [
    {
      key: "fecha",
      header: "Fecha",
      className: "whitespace-nowrap",
      render: (payment) => (
        <span className="tabular-nums text-ink">
          {payment.paid_at ? formatDateOnly(payment.paid_at) : "—"}
        </span>
      ),
    },
    {
      key: "cliente",
      header: "Cliente",
      render: (payment) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/billeteras?customer_id=${payment.customer_id}`}
        >
          {customerNameFor(payment)}
        </Link>
      ),
    },
    {
      key: "metodo",
      header: "Método",
      render: (payment) => (
        <span className="text-ink">
          {paymentMethodLabel(payment.method_payment, payment.method_payment_id)}
        </span>
      ),
    },
    {
      key: "moneda",
      header: "Moneda",
      className: "whitespace-nowrap",
      render: (payment) => <CurrencyChip currency={currencyFor(payment)} />,
    },
    {
      key: "monto",
      header: "Monto",
      className: "whitespace-nowrap",
      render: (payment) => (
        <SignedMoney currency={currencyFor(payment)} value={payment.amount} />
      ),
    },
    {
      key: "referencia",
      header: "Referencia",
      render: (payment) => (
        <span className="text-muted">{payment.reference || "—"}</span>
      ),
    },
  ];

  function renderCard(payment: PaymentRecord) {
    const currency = currencyFor(payment);
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">
              {customerNameFor(payment)}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {paymentMethodLabel(payment.method_payment, payment.method_payment_id)}
            </p>
          </div>
          <CurrencyChip currency={currency} />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <SignedMoney currency={currency} value={payment.amount} />
          <span className="text-[12px] tabular-nums text-muted">
            {payment.paid_at ? formatDateOnly(payment.paid_at) : "Sin fecha"}
          </span>
        </div>
        <dl className="mt-3 space-y-2 text-[12px]">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Referencia
            </dt>
            <dd className="text-right text-ink">{payment.reference || "—"}</dd>
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
              href="/app/pagos/nuevo"
            >
              Registrar pago
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Registra los pagos recibidos y consulta cómo acreditan la billetera del cliente. La moneda se toma del método de pago seleccionado."
        eyebrow="Finanzas"
        title="Pagos recibidos"
      />

      <CurrencyNoticeBanner />

      <section
        aria-label="Filtros de pagos"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField
            emptyLabel="No hay clientes registrados."
            id="filtro-pago-cliente"
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
          <SelectField
            emptyLabel="No hay métodos registrados."
            id="filtro-pago-metodo"
            label="Método de pago"
            loading={methodsResource.status === "loading"}
            loadingLabel="Cargando métodos…"
            loadError={
              methodsResource.status === "error"
                ? methodsResource.error?.message ??
                  "No pudimos cargar los métodos de pago."
                : null
            }
            onChange={(value) => updateFilter("methodPaymentId", value)}
            onRetry={methodsResource.reload}
            options={methodOptions}
            placeholder="Todos los métodos"
            value={filters.methodPaymentId}
          />
          <CurrencySelect
            allOptionLabel="Todas las monedas"
            filter
            help="Busca por código o nombre."
            id="filtro-pago-moneda"
            label="Moneda"
            onChange={(value) => updateFilter("currencyId", value)}
            value={filters.currencyId}
          />
          <DateField
            id="filtro-pago-desde"
            label="Pagado desde"
            max={filters.paidTo || undefined}
            onChange={(value) => updateFilter("paidFrom", value)}
            value={filters.paidFrom}
          />
          <DateField
            id="filtro-pago-hasta"
            label="Pagado hasta"
            min={filters.paidFrom || undefined}
            onChange={(value) => updateFilter("paidTo", value)}
            value={filters.paidTo}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p aria-live="polite" className="text-[12px] font-semibold text-muted">
            {resource.status === "loading"
              ? "Cargando pagos…"
              : resource.status === "error" && payments.length === 0
                ? "No se pudieron cargar los pagos"
                : paymentCountLabel(payments.length)}
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

      {invalidDateRange && (
        <NoticeBanner tone="warning">
          La fecha “desde” es posterior a la fecha “hasta”. Ajusta el rango para
          ver resultados.
        </NoticeBanner>
      )}

      {resource.status === "loading" && (
        <RecordsTableSkeleton columns={7} label="Cargando pagos…" rows={6} />
      )}

      {resource.status === "error" && payments.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={listErrorMessage(resource.error)}
          onRetry={reload}
          title="No pudimos cargar los pagos"
        />
      )}

      {resource.status !== "loading" &&
        !(resource.status === "error" && payments.length === 0) && (
          <section aria-label="Listado de pagos" className="space-y-4">
            {resource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {resource.status === "error" && payments.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {listErrorMessage(resource.error)} Mostramos los datos
                disponibles.
              </NoticeBanner>
            )}

            {payments.length === 0 ? (
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
                      href="/app/pagos/nuevo"
                    >
                      Registrar pago
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description={
                  filtersActive
                    ? "No hay pagos que coincidan con los filtros seleccionados."
                    : "Registra el primer pago recibido para acreditar la billetera del cliente."
                }
                title={
                  filtersActive ? "Sin resultados" : "Aún no hay pagos registrados."
                }
              />
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  caption="Pagos recibidos con su fecha, cliente, método, moneda, monto y referencia"
                  columns={columns}
                  getRowKey={(payment) => String(payment.id)}
                  getRowLabel={(payment) => `pago de ${customerNameFor(payment)}`}
                  renderCard={renderCard}
                  rowActions={renderActions}
                  rows={payments}
                />
              </div>
            )}
          </section>
        )}

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmBusyLabel="Eliminando…"
        confirmLabel="Eliminar pago"
        description={
          deleteTarget ? (
            <span>
              Se eliminará el pago de{" "}
              <strong className="font-semibold text-ink">
                {paymentMoney(deleteTarget.amount, currencyFor(deleteTarget))}
              </strong>{" "}
              de {customerNameFor(deleteTarget)} y se ajustará el saldo de su
              billetera. Si el pago ya está aplicado a una factura, no se puede
              eliminar.
            </span>
          ) : undefined
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        onError={(error) =>
          toast.error(
            error.status === 404
              ? "No encontramos el pago. Actualiza la lista e intenta de nuevo."
              : error.message,
          )
        }
        open={deleteTarget !== null}
        title="Eliminar pago"
      />
    </div>
  );
}
