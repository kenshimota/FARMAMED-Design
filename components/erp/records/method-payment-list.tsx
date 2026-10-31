"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { SelectField } from "@/components/erp/records/form-controls";
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
  METHOD_PAYMENT_COPY,
} from "@/components/erp/records/method-payment-errors";
import {
  fetchMethodPayments,
  type MethodPayment,
} from "@/components/erp/records/method-payments-api";
import {
  fetchMethodPaymentTypes,
  findMethodPaymentType,
  type MethodPaymentType,
} from "@/components/erp/records/method-payment-types-api";
import {
  MethodCurrencyBadge,
  MethodPaymentDetailsSummary,
  MethodPaymentStatusBadge,
  MethodTypeBadge,
  methodPaymentCountLabel,
} from "@/components/erp/records/method-payment-shared";
import {
  MethodPaymentDeactivateDialog,
  MethodPaymentDeleteDialog,
  MethodPaymentReactivateDialog,
} from "@/components/erp/records/method-payment-dialogs";
import { fetchCurrencies, type Currency } from "@/lib/finance/currencies-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import type { UiError } from "@/lib/api-errors";

export type MethodPaymentListFilters = {
  methodPaymentTypeId: string;
  currencyId: string;
  isActive: string;
};

export const EMPTY_METHOD_PAYMENT_FILTERS: MethodPaymentListFilters = {
  methodPaymentTypeId: "",
  currencyId: "",
  isActive: "",
};

const NO_METHODS: MethodPayment[] = [];
const NO_TYPES: MethodPaymentType[] = [];
const NO_CURRENCIES: Currency[] = [];

type MethodDialogState = {
  mode: "deactivate" | "reactivate" | "delete";
  method: MethodPayment;
};

function filtersKey(filters: MethodPaymentListFilters) {
  return [filters.methodPaymentTypeId, filters.currencyId, filters.isActive].join(
    "|",
  );
}

function hasActiveFilters(filters: MethodPaymentListFilters, query: string) {
  return Boolean(
    filters.methodPaymentTypeId ||
      filters.currencyId ||
      filters.isActive ||
      query.trim(),
  );
}

function listErrorMessage(error: UiError | null) {
  return error?.message ?? "No pudimos cargar los métodos de pago.";
}

export function MethodPaymentListPage({
  initialFilters,
}: {
  initialFilters: MethodPaymentListFilters;
}) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  if (!canReadModule(user.role, "metodos_pago")) {
    return activityVisible ? (
      <AccessState description="Tu rol no tiene acceso al módulo de métodos de pago. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }
  return <MethodPaymentListContent initialFilters={initialFilters} />;
}

function MethodPaymentListContent({
  initialFilters,
}: {
  initialFilters: MethodPaymentListFilters;
}) {
  const { user } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const activityVisible = useActivityVisible();
  const canWrite = canWriteModule(user.role, "metodos_pago");

  const [filters, setFilters] =
    useState<MethodPaymentListFilters>(initialFilters);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<MethodDialogState | null>(null);

  const initialKey = filtersKey(initialFilters);
  const [appliedInitialKey, setAppliedInitialKey] = useState(initialKey);
  if (initialKey !== appliedInitialKey) {
    setAppliedInitialKey(initialKey);
    setFilters(initialFilters);
  }

  const methodsLoader = useCallback(
    () =>
      fetchMethodPayments({
        method_payment_type_id: filters.methodPaymentTypeId || undefined,
        currency_id: filters.currencyId || undefined,
        is_active:
          filters.isActive === "true"
            ? true
            : filters.isActive === "false"
              ? false
              : undefined,
      }),
    [filters.currencyId, filters.isActive, filters.methodPaymentTypeId],
  );
  const methodsResource = useAsyncResource(methodsLoader);
  const reloadMethods = methodsResource.reload;

  const typesResource = useAsyncResource(fetchMethodPaymentTypes);
  const currenciesResource = useAsyncResource(() => fetchCurrencies(canWrite));

  const types = typesResource.data ?? NO_TYPES;
  const currencies = currenciesResource.data ?? NO_CURRENCIES;

  const activeKey = filtersKey(filters);
  const appliedKey = useRef(activeKey);
  useEffect(() => {
    if (appliedKey.current === activeKey) return;
    appliedKey.current = activeKey;
    reloadMethods();
  }, [activeKey, reloadMethods]);

  const methods = methodsResource.data ?? NO_METHODS;
  const filteredMethods = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return methods;
    return methods.filter((method) =>
      method.label.toLowerCase().includes(normalized),
    );
  }, [methods, query]);

  const typeOptions = useMemo(
    () =>
      types.map((type) => ({
        value: String(type.id),
        label: `${type.code} — ${type.name}`,
      })),
    [types],
  );

  const currencyOptions = useMemo(
    () =>
      currencies.map((currency) => ({
        value: String(currency.id),
        label: `${currency.code} — ${currency.name}`,
      })),
    [currencies],
  );

  const filtersActive = hasActiveFilters(filters, query);

  if (!activityVisible) return null;

  function commitFilters(next: MethodPaymentListFilters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.methodPaymentTypeId) {
      params.set("method_payment_type_id", next.methodPaymentTypeId);
    }
    if (next.currencyId) params.set("currency_id", next.currencyId);
    if (next.isActive) params.set("is_active", next.isActive);
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  function clearFilters() {
    setQuery("");
    commitFilters(EMPTY_METHOD_PAYMENT_FILTERS);
  }

  function typeFor(method: MethodPayment) {
    return (
      method.method_payment_type ??
      findMethodPaymentType(types, method.method_payment_type_id)
    );
  }

  function fieldsFor(method: MethodPayment) {
    const type = findMethodPaymentType(
      types,
      method.method_payment_type_id ?? method.method_payment_type?.id ?? null,
    );
    return type?.fields ?? [];
  }

  function currencyFor(method: MethodPayment) {
    if (method.currency) return method.currency;
    const type = findMethodPaymentType(types, method.method_payment_type_id);
    return type?.currency ?? null;
  }

  function reactivationBlocked(method: MethodPayment): boolean | null {
    const type = findMethodPaymentType(types, method.method_payment_type_id);
    if (!type) return null;
    if (!type.is_active) return true;
    const currency = currencies.find(
      (item) => String(item.id) === String(type.currency_id ?? ""),
    );
    if (!currency) return null;
    return !currency.is_active;
  }

  const columns: RecordsTableColumn<MethodPayment>[] = [
    {
      key: "etiqueta",
      header: "Etiqueta",
      render: (method) => (
        <Link
          className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/metodos-pago/${method.id}`}
        >
          {method.label}
        </Link>
      ),
    },
    {
      key: "tipo",
      header: "Tipo de método",
      render: (method) => <MethodTypeBadge type={typeFor(method)} />,
    },
    {
      key: "moneda",
      header: "Moneda",
      className: "whitespace-nowrap",
      render: (method) => <MethodCurrencyBadge currency={currencyFor(method)} />,
    },
    {
      key: "datos",
      header: "Datos del método",
      render: (method) => (
        <MethodPaymentDetailsSummary
          details={method.details}
          fields={fieldsFor(method)}
        />
      ),
    },
    {
      key: "estado",
      header: "Estado",
      className: "whitespace-nowrap",
      render: (method) => (
        <MethodPaymentStatusBadge isActive={method.is_active} />
      ),
    },
  ];

  function renderActions(method: MethodPayment) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver el detalle del método ${method.label}`}
          href={`/app/metodos-pago/${method.id}`}
          icon="arrow-right"
        >
          Ver detalle
        </RecordActionLink>
        {canWrite && (
          <>
            <RecordActionLink
              ariaLabel={`Editar el método ${method.label}`}
              href={`/app/metodos-pago/${method.id}/editar`}
              icon="arrow-right"
            >
              Editar
            </RecordActionLink>
            {method.is_active ? (
              <RecordActionButton
                aria-label={`Desactivar el método ${method.label}`}
                icon="eye-off"
                onClick={() => setDialog({ mode: "deactivate", method })}
              >
                Desactivar
              </RecordActionButton>
            ) : (
              <RecordActionButton
                aria-label={`Reactivar el método ${method.label}`}
                icon="check"
                onClick={() => setDialog({ mode: "reactivate", method })}
              >
                Reactivar
              </RecordActionButton>
            )}
            <RecordActionButton
              aria-label={`Eliminar el método ${method.label}`}
              danger
              icon="close"
              onClick={() => setDialog({ mode: "delete", method })}
            >
              Eliminar
            </RecordActionButton>
          </>
        )}
      </RecordActions>
    );
  }

  function renderCard(method: MethodPayment) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <Link
            className="min-w-0 text-[15px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            href={`/app/metodos-pago/${method.id}`}
          >
            {method.label}
          </Link>
          <MethodPaymentStatusBadge isActive={method.is_active} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Tipo de método
            </dt>
            <dd className="mt-1">
              <MethodTypeBadge type={typeFor(method)} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1">
              <MethodCurrencyBadge currency={currencyFor(method)} />
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
              href="/app/metodos-pago/nuevo"
            >
              Nuevo método
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Datos concretos de cobro registrados por tipo de método. Cada método hereda la moneda de su tipo."
        eyebrow="Finanzas"
        title="Métodos de pago"
      />

      <NoticeBanner tone="info">{METHOD_PAYMENT_COPY.privacy}</NoticeBanner>

      {!canWrite && (
        <NoticeBanner tone="info">{METHOD_PAYMENT_COPY.writeNotice}</NoticeBanner>
      )}

      {methodsResource.status === "loading" && (
        <RecordsTableSkeleton
          columns={5}
          label="Cargando métodos de pago…"
          rows={6}
        />
      )}

      {methodsResource.status === "error" && (
        <RecordsLoadError
          description={listErrorMessage(methodsResource.error)}
          onRetry={reloadMethods}
          title="No pudimos cargar los métodos de pago"
        />
      )}

      {methodsResource.status !== "loading" &&
        methodsResource.status !== "error" && (
          <section
            aria-label="Listado de métodos de pago"
            className="space-y-4"
          >
            {methodsResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative w-full">
                  <label className="sr-only" htmlFor="buscar-metodos">
                    Buscar métodos de pago
                  </label>
                  <Icon
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    name="search"
                    size={17}
                  />
                  <input
                    className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                    id="buscar-metodos"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por etiqueta"
                    type="search"
                    value={query}
                  />
                </div>

                <SelectField
                  id="filtro-metodo-tipo"
                  label="Tipo de método"
                  loading={typesResource.status === "loading"}
                  loadingLabel={METHOD_PAYMENT_COPY.loadingTypes}
                  loadError={
                    typesResource.status === "error"
                      ? "No pudimos cargar los tipos de pago."
                      : null
                  }
                  onChange={(value) =>
                    commitFilters({ ...filters, methodPaymentTypeId: value })
                  }
                  onRetry={typesResource.reload}
                  options={typeOptions}
                  placeholder="Todos"
                  value={filters.methodPaymentTypeId}
                />

                <SelectField
                  id="filtro-metodo-moneda"
                  label="Moneda"
                  loading={currenciesResource.status === "loading"}
                  loadingLabel="Cargando monedas…"
                  loadError={
                    currenciesResource.status === "error"
                      ? "No pudimos cargar las monedas."
                      : null
                  }
                  onChange={(value) =>
                    commitFilters({ ...filters, currencyId: value })
                  }
                  onRetry={currenciesResource.reload}
                  options={currencyOptions}
                  placeholder="Todas"
                  value={filters.currencyId}
                />

                <SelectField
                  id="filtro-metodo-estado"
                  label="Estado"
                  onChange={(value) =>
                    commitFilters({ ...filters, isActive: value })
                  }
                  options={[
                    { value: "true", label: "Activos" },
                    { value: "false", label: "Inactivos" },
                  ]}
                  placeholder="Todos"
                  value={filters.isActive}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p aria-live="polite" className="text-[12px] font-semibold text-muted">
                  {filtersActive
                    ? `Mostrando ${filteredMethods.length} de ${methodPaymentCountLabel(methods.length)}`
                    : methodPaymentCountLabel(methods.length)}
                </p>
                {filtersActive && (
                  <button
                    className="button-base button-secondary min-h-11 px-5"
                    onClick={clearFilters}
                    type="button"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {methods.length === 0 ? (
              <EmptyState
                action={
                  canWrite ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href="/app/metodos-pago/nuevo"
                    >
                      Nuevo método
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description={METHOD_PAYMENT_COPY.empty}
                title="Todavía no hay métodos de pago"
              />
            ) : filteredMethods.length === 0 ? (
              <EmptyState
                action={
                  <button
                    className="button-base button-secondary min-h-11 px-5"
                    onClick={clearFilters}
                    type="button"
                  >
                    Limpiar filtros
                  </button>
                }
                description={METHOD_PAYMENT_COPY.emptyFiltered}
                title="Sin resultados"
              />
            ) : (
              <RecordsTable
                caption="Métodos de pago con su etiqueta, tipo, moneda, datos registrados y estado"
                columns={columns}
                getRowKey={(method) => String(method.id)}
                getRowLabel={(method) => method.label}
                renderCard={renderCard}
                rowActions={renderActions}
                rows={filteredMethods}
              />
            )}
          </section>
        )}

      <MethodPaymentDeactivateDialog
        method={dialog?.mode === "deactivate" ? dialog.method : null}
        onClose={() => setDialog(null)}
        onDone={reloadMethods}
        onRefresh={reloadMethods}
      />
      <MethodPaymentReactivateDialog
        blocked={
          dialog?.mode === "reactivate"
            ? reactivationBlocked(dialog.method)
            : null
        }
        method={dialog?.mode === "reactivate" ? dialog.method : null}
        onClose={() => setDialog(null)}
        onDone={reloadMethods}
        onRefresh={reloadMethods}
      />
      <MethodPaymentDeleteDialog
        method={dialog?.mode === "delete" ? dialog.method : null}
        onClose={() => setDialog(null)}
        onDone={reloadMethods}
        onRefresh={reloadMethods}
      />
    </div>
  );
}
