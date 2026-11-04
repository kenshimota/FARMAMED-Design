"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { EntityAutocompleteField } from "@/components/erp/ui/entity-autocomplete";
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
  fetchMethodPayment,
  fetchMethodPayments,
  type MethodPayment,
} from "@/components/erp/records/method-payments-api";
import {
  deletePayment,
  fetchPaymentPage,
  type PaymentRecord,
  type PaymentStatusResult,
} from "@/components/erp/records/payments-api";
import {
  PaymentAmount,
  paymentMethodLabel,
  paymentMoney,
  paymentReferenceLabel,
  paymentStatusOptions,
} from "@/components/erp/records/payment-shared";
import { PaymentReferenceImage } from "@/components/erp/records/payment-reference-image";
import { PaymentStatusBadge } from "@/components/erp/records/payment-status-badge";
import {
  PaymentStatusDialog,
  type PaymentStatusDialogMode,
} from "@/components/erp/records/payment-status-dialog";
import type { WalletCurrency } from "@/components/erp/records/wallets-api";
import { formatDateOnly, formatInteger, formatMoney } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { ApiError } from "@/lib/api";
import type { UiError } from "@/lib/api-errors";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";

export type PaymentListFilters = {
  customerId: string;
  methodPaymentId: string;
  currencyId: string;
  paidFrom: string;
  paidTo: string;
  status: string;
};

export const EMPTY_PAYMENT_FILTERS: PaymentListFilters = {
  customerId: "",
  methodPaymentId: "",
  currencyId: "",
  paidFrom: "",
  paidTo: "",
  status: "",
};

const NO_METHODS: MethodPayment[] = [];

const PAYMENT_STATUS_FILTER_OPTIONS = paymentStatusOptions();

function methodPaymentOptionLabel(method: MethodPayment) {
  return method.currency
    ? `${method.label} · ${method.currency.code}`
    : method.label;
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
      "status",
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
        status: initialFilters.status,
        paid_from: initialFilters.paidFrom,
        paid_to: initialFilters.paidTo,
      },
    },
  });
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    payment: PaymentRecord;
    mode: PaymentStatusDialogMode;
  } | null>(null);
  const [statusUpdates, setStatusUpdates] = useState<
    Record<string, PaymentStatusResult>
  >({});
  const [customerDraft, setCustomerDraft] = useState("");
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [resolvedMethod, setResolvedMethod] = useState<{
    id: string;
    label: string;
    missing: boolean;
  } | null>(null);

  const customerId = list.filters.customer_id ?? "";
  const methodPaymentId = list.filters.method_payment_id ?? "";
  const currencyId = list.filters.currency_id ?? "";
  const status = list.filters.status ?? "";
  const paidFrom = list.filters.paid_from ?? "";
  const paidTo = list.filters.paid_to ?? "";

  const methodsResource = useAsyncResource(fetchMethodPayments);
  const methods = methodsResource.data ?? NO_METHODS;

  const customerIds = useMemo(
    () => [
      ...(customerId ? [customerId] : []),
      ...list.items.map((payment) => String(payment.customer_id)),
    ],
    [customerId, list.items],
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
        label: methodPaymentOptionLabel(method),
      })),
    [methods],
  );

  const listedMethod = methodPaymentId
    ? methodOptions.find((option) => option.value === methodPaymentId)
    : undefined;

  useEffect(() => {
    if (!methodPaymentId || listedMethod) return;
    if (resolvedMethod?.id === methodPaymentId) return;

    let active = true;
    fetchMethodPayment(methodPaymentId)
      .then((method) => {
        if (active) {
          setResolvedMethod({
            id: methodPaymentId,
            label: methodPaymentOptionLabel(method),
            missing: false,
          });
        }
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setResolvedMethod({
            id: methodPaymentId,
            label: `Método #${methodPaymentId}`,
            missing: true,
          });
          return;
        }
        setResolvedMethod({
          id: methodPaymentId,
          label: `Método #${methodPaymentId}`,
          missing: false,
        });
      });
    return () => {
      active = false;
    };
  }, [listedMethod, methodPaymentId, resolvedMethod]);

  const selectedMethodLabel = listedMethod
    ? listedMethod.label
    : resolvedMethod?.id === methodPaymentId
      ? resolvedMethod.label
      : undefined;
  const methodMissing = Boolean(
    resolvedMethod?.id === methodPaymentId && resolvedMethod.missing,
  );

  const payments = useMemo(
    () =>
      list.items.map((payment) => {
        const update = statusUpdates[String(payment.id)];
        if (!update) return payment;
        return {
          ...payment,
          status: update.status,
          rejection_reason: update.rejection_reason,
          wallet: update.wallet ?? payment.wallet,
        };
      }),
    [list.items, statusUpdates],
  );

  const filtersActive = Boolean(
    customerId ||
      methodPaymentId ||
      currencyId ||
      status ||
      paidFrom ||
      paidTo,
  );
  const invalidDateRange = Boolean(
    paidFrom && paidTo && paidFrom > paidTo,
  );

  function clearFilters() {
    setCustomerDraft("");
    setFilterResetKey((current) => current + 1);
    list.clearFilters();
  }

  const chips: FilterChip[] = [];
  if (customerId) {
    chips.push({
      id: "customer_id",
      label: `Cliente: ${customerLabel || `#${customerId}`}`,
      onRemove: () => list.setFilter("customer_id", ""),
    });
  }
  if (status) {
    chips.push({
      id: "status",
      label: `Estado: ${
        PAYMENT_STATUS_FILTER_OPTIONS.find((option) => option.value === status)
          ?.label ?? status
      }`,
      onRemove: () => list.setFilter("status", ""),
    });
  }
  if (methodPaymentId) {
    chips.push({
      id: "method_payment_id",
      label: `Método: ${selectedMethodLabel ?? `#${methodPaymentId}`}`,
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
    const conciliated = deleteTarget.status === "conciliated";
    await deletePayment(String(deleteTarget.id));
    toast.success(
      conciliated
        ? "Pago eliminado. El saldo de la billetera se actualizó."
        : "Pago eliminado. El saldo de la billetera no cambia.",
    );
    list.reload();
  }

  function handleStatusSuccess(
    result: PaymentStatusResult,
    mode: PaymentStatusDialogMode,
  ) {
    setStatusUpdates((current) => ({
      ...current,
      [String(result.id)]: result,
    }));
    const creditedWallet = mode === "conciliate" ? result.wallet : null;
    toast.success(
      mode === "reject"
        ? "Pago rechazado."
        : creditedWallet
          ? `Pago conciliado. Nuevo saldo: ${formatMoney(
              creditedWallet.balance,
              creditedWallet.currency ?? {},
            )}.`
          : "Pago conciliado. El saldo fue acreditado.",
    );
    setStatusTarget(null);
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
        {canWrite && payment.status === "pending" && (
          <>
            <RecordActionButton
              aria-label={`Conciliar el pago de ${customerName}`}
              icon="check"
              onClick={() =>
                setStatusTarget({ payment, mode: "conciliate" })
              }
            >
              Conciliar
            </RecordActionButton>
            <RecordActionButton
              aria-label={`Rechazar el pago de ${customerName}`}
              danger
              icon="close"
              onClick={() => setStatusTarget({ payment, mode: "reject" })}
            >
              Rechazar
            </RecordActionButton>
          </>
        )}
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
      key: "estado",
      header: "Estado",
      className: "whitespace-nowrap",
      render: (payment) => <PaymentStatusBadge status={payment.status} />,
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
        <PaymentAmount currency={currencyFor(payment)} payment={payment} />
      ),
    },
    {
      key: "comprobante",
      header: "Comprobante",
      className: "whitespace-nowrap",
      render: (payment) => (
        <PaymentReferenceImage
          image={payment.reference_image}
          referenceLabel={paymentReferenceLabel(payment)}
        />
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
          <div className="flex flex-col items-end gap-2">
            <PaymentStatusBadge status={payment.status} />
            <CurrencyChip currency={currency} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <PaymentAmount currency={currency} payment={payment} />
          <span className="text-[12px] tabular-nums text-muted">
            {payment.paid_at ? formatDateOnly(payment.paid_at) : "Sin fecha"}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-background p-2">
          <PaymentReferenceImage
            image={payment.reference_image}
            referenceLabel={paymentReferenceLabel(payment)}
          />
          <div className="min-w-0 text-[12px]">
            <p className="font-semibold text-ink">Comprobante</p>
            <p className="truncate text-muted">
              {payment.reference_image
                ? "Imagen de referencia adjunta"
                : "Sin comprobante"}
            </p>
          </div>
        </div>
        <dl className="mt-3 space-y-2 text-[12px]">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Referencia
            </dt>
            <dd className="text-right text-ink">{payment.reference || "—"}</dd>
          </div>
          {payment.status === "rejected" && payment.rejection_reason && (
            <div className="flex items-start justify-between gap-3">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                Motivo
              </dt>
              <dd className="text-right text-ink">{payment.rejection_reason}</dd>
            </div>
          )}
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
        description="Registra los pagos recibidos, adjunta el comprobante y concilia o rechaza cada pago. El saldo se acredita solo cuando el pago se concilia."
        eyebrow="Finanzas"
        title="Pagos recibidos"
      />

      <CurrencyNoticeBanner />

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        id="pagos-filtros"
        loading={list.status === "loading"}
        onClear={clearFilters}
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
          emptyLabel="No hay estados de pago."
          id="filtro-pago-estado"
          label="Estado"
          onChange={(value) => list.setFilter("status", value)}
          options={PAYMENT_STATUS_FILTER_OPTIONS}
          placeholder="Todos los estados"
          value={status}
        />
        <EntityAutocompleteField
          disabled={
            methodsResource.status === "loading" ||
            methodsResource.status === "error"
          }
          emptyLabel={
            methods.length === 0
              ? "No hay métodos registrados."
              : "No hay métodos de pago que coincidan."
          }
          id="filtro-pago-metodo"
          initialLabel={selectedMethodLabel}
          key={`filtro-pago-metodo-${filterResetKey}`}
          label="Método de pago"
          loadingLabel="Buscando métodos de pago…"
          loadOptions={async (query) => {
            const search = query.trim().toLocaleLowerCase("es");
            if (!search) return methodOptions;
            return methodOptions.filter((option) =>
              option.label.toLocaleLowerCase("es").includes(search),
            );
          }}
          onChange={(value) => list.setFilter("method_payment_id", value)}
          placeholder={
            methodsResource.status === "loading"
              ? "Cargando métodos…"
              : "Busca un método de pago"
          }
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

      {methodMissing && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={clearFilters}
              type="button"
            >
              Limpiar filtros
            </button>
          }
          tone="warning"
        >
          El método de pago seleccionado ya no existe. Limpia el filtro para
          continuar.
        </NoticeBanner>
      )}

      {methodsResource.status === "error" && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={methodsResource.reload}
              type="button"
            >
              Reintentar
            </button>
          }
          role="alert"
          tone="warning"
        >
          {methodsResource.error?.message ??
            "No pudimos cargar los métodos de pago."}
        </NoticeBanner>
      )}

      {list.status === "loading" && (
        <RecordsTableSkeleton columns={8} label="Cargando pagos…" rows={6} />
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
                  description="Registra el primer pago recibido. El saldo se acredita cuando el pago se concilia."
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
                  caption="Pagos recibidos con su fecha, cliente, estado, método, moneda, monto, comprobante y referencia"
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
              de {customerNameFor(deleteTarget)}.{" "}
              {deleteTarget.status === "conciliated"
                ? "Se ajustará el saldo de su billetera."
                : "No se ajusta el saldo porque el pago no está conciliado."}{" "}
              Si el pago ya está aplicado a una factura, no se puede eliminar.
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

      <PaymentStatusDialog
        currency={
          statusTarget ? currencyFor(statusTarget.payment) : null
        }
        customerName={
          statusTarget ? customerNameFor(statusTarget.payment) : ""
        }
        mode={statusTarget?.mode ?? "conciliate"}
        onClose={() => setStatusTarget(null)}
        onSuccess={handleStatusSuccess}
        open={statusTarget !== null}
        payment={statusTarget?.payment ?? null}
      />
    </div>
  );
}
