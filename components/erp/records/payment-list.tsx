"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { CurrencyChip, CurrencySelect } from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { useServerList } from "@/components/erp/ui/use-server-list";
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
import {
  fetchCustomer,
  fetchCustomerPage,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  fetchMethodPayments,
  type MethodPayment,
} from "@/components/erp/records/method-payments-api";
import {
  deletePayment,
  fetchPaymentPage,
  type PaymentRecord,
} from "@/components/erp/records/payments-api";
import {
  paymentMethodLabel,
  paymentMoney,
  SignedMoney,
} from "@/components/erp/records/payment-shared";
import type { WalletCurrency } from "@/components/erp/records/wallets-api";
import { formatDateOnly, formatInteger } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import type { UiError } from "@/lib/api-errors";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";

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

const NO_METHODS: MethodPayment[] = [];

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
  const toast = useToast();
  const currencyStatus = useCurrencyStatusContext();
  const activityVisible = useActivityVisible();
  const canWrite = canWriteModule(user.role, "pagos");
  const canDelete = user.role === "admin";

  const list = useServerList<PaymentRecord>({
    loader: (request) => fetchPaymentPage(request),
    filterKeys: [
      "customer_id",
      "method_payment_id",
      "currency_id",
      "paid_from",
      "paid_to",
    ],
    defaultSort: "paid_at",
    defaultOrder: "desc",
    initial: {
      filters: {
        customer_id: initialFilters.customerId,
        method_payment_id: initialFilters.methodPaymentId,
        currency_id: initialFilters.currencyId,
        paid_from: initialFilters.paidFrom,
        paid_to: initialFilters.paidTo,
      },
    },
  });
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord | null>(null);
  const [customerDraft, setCustomerDraft] = useState("");

  const customerId = list.filters.customer_id ?? "";
  const methodPaymentId = list.filters.method_payment_id ?? "";
  const currencyId = list.filters.currency_id ?? "";
  const paidFrom = list.filters.paid_from ?? "";
  const paidTo = list.filters.paid_to ?? "";
  const payments = list.items;

  const methodsResource = useAsyncResource(fetchMethodPayments);
  const methods = methodsResource.data ?? NO_METHODS;

  const customerIds = useMemo(
    () => [
      ...(customerId ? [customerId] : []),
      ...payments.map((payment) => String(payment.customer_id)),
    ],
    [customerId, payments],
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

  const filtersActive = Boolean(
    customerId || methodPaymentId || currencyId || paidFrom || paidTo,
  );
  const invalidDateRange = Boolean(
    paidFrom && paidTo && paidFrom > paidTo,
  );

  const chips: FilterChip[] = [];
  if (customerId) {
    chips.push({
      id: "customer_id",
      label: `Cliente: ${customerLabel || `#${customerId}`}`,
      onRemove: () => list.setFilter("customer_id", ""),
    });
  }
  if (methodPaymentId) {
    chips.push({
      id: "method_payment_id",
      label: `Método: ${
        methodOptions.find((option) => option.value === methodPaymentId)?.label ??
        `#${methodPaymentId}`
      }`,
      onRemove: () => list.setFilter("method_payment_id", ""),
    });
  }
  if (currencyId) {
    chips.push({
      id: "currency_id",
      label: `Moneda: ${
        (currencyStatus?.currencies ?? []).find(
          (currency) => String(currency.id) === currencyId,
        )?.code ?? `#${currencyId}`
      }`,
      onRemove: () => list.setFilter("currency_id", ""),
    });
  }
  if (paidFrom) {
    chips.push({
      id: "paid_from",
      label: `Desde: ${paidFrom}`,
      onRemove: () => list.setFilter("paid_from", ""),
    });
  }
  if (paidTo) {
    chips.push({
      id: "paid_to",
      label: `Hasta: ${paidTo}`,
      onRemove: () => list.setFilter("paid_to", ""),
    });
  }

  if (!activityVisible) return null;

  function customerFor(payment: PaymentRecord) {
    return customersById[String(payment.customer_id)] ?? null;
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
    list.reload();
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

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        id="pagos-filtros"
        loading={list.status === "loading"}
        onClear={list.clearFilters}
        results={
          list.status === "loading"
            ? "Cargando pagos…"
            : list.status === "error" && payments.length === 0
              ? "No se pudieron cargar los pagos"
              : list.meta.total === 0
                ? "Sin pagos"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="Busca el cliente por nombre o correo. El filtro se aplica en el servidor."
            id="filtro-pago-cliente"
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
          onChange={(value) => list.setFilter("method_payment_id", value)}
          onRetry={methodsResource.reload}
          options={methodOptions}
          placeholder="Todos los métodos"
          value={methodPaymentId}
        />
        <CurrencySelect
          allOptionLabel="Todas las monedas"
          filter
          help="Busca por código o nombre."
          id="filtro-pago-moneda"
          label="Moneda"
          onChange={(value) => list.setFilter("currency_id", value)}
          value={currencyId}
        />
        <DateField
          id="filtro-pago-desde"
          label="Pagado desde"
          max={paidTo || undefined}
          onChange={(value) => list.setFilter("paid_from", value)}
          value={paidFrom}
        />
        <DateField
          id="filtro-pago-hasta"
          label="Pagado hasta"
          min={paidFrom || undefined}
          onChange={(value) => list.setFilter("paid_to", value)}
          value={paidTo}
        />
      </FilterBar>

      {invalidDateRange && (
        <NoticeBanner tone="warning">
          La fecha “desde” es posterior a la fecha “hasta”. Ajusta el rango para
          ver resultados.
        </NoticeBanner>
      )}

      {list.status === "loading" && (
        <RecordsTableSkeleton columns={7} label="Cargando pagos…" rows={6} />
      )}

      {list.status === "error" && payments.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={listErrorMessage(list.error)}
          onRetry={list.reload}
          title="No pudimos cargar los pagos"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && payments.length === 0) && (
          <section aria-label="Listado de pagos" className="space-y-4">
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && payments.length > 0 && (
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
                {listErrorMessage(list.error)} Mostramos los datos
                disponibles.
              </NoticeBanner>
            )}

            {payments.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={
                    canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/pagos/nuevo"
                      >
                        Registrar pago
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description="Registra el primer pago recibido para acreditar la billetera del cliente."
                  title="Aún no hay pagos registrados."
                />
              ) : (
                <EmptyState
                  action={
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={
                        list.isPageOutOfRange
                          ? list.goToFirstPage
                          : list.clearFilters
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
                        )} pagos en total, pero esta página no tiene filas.`
                      : "No hay pagos que coincidan con los filtros seleccionados."
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : "Sin resultados con estos filtros."
                  }
                />
              )
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  busy={list.status === "refreshing"}
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

            <PaginationControls
              meta={list.meta}
              onFirstPage={list.goToFirstPage}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
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
