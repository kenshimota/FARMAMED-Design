"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { LoadingRegion, Skeleton } from "@/components/erp/ui/skeleton";
import { useServerList } from "@/components/erp/ui/use-server-list";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import {
  fetchCustomer,
  fetchCustomerPage,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  fetchWalletPage,
  type CustomerWallet,
} from "@/components/erp/records/wallets-api";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";
import { formatInteger, formatMoney } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

function walletCardsSkeleton() {
  return (
    <LoadingRegion label="Cargando billeteras…">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <li
            className="rounded-[24px] border border-line bg-surface p-5"
            key={index}
          >
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-5 h-3 w-28" />
            <Skeleton className="mt-2 h-8 w-40" />
            <Skeleton className="mt-6 h-11 w-full" />
          </li>
        ))}
      </ul>
    </LoadingRegion>
  );
}

export function WalletListPage({
  initialCustomerId,
}: {
  initialCustomerId: string;
}) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  if (!canReadModule(user.role, "billeteras")) {
    return activityVisible ? (
      <AccessState description="Tu rol no tiene acceso a las billeteras de clientes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }
  return <WalletListContent initialCustomerId={initialCustomerId} />;
}

function WalletListContent({
  initialCustomerId,
}: {
  initialCustomerId: string;
}) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  const canRegisterPayments = canWriteModule(user.role, "pagos");

  const list = useServerList<CustomerWallet>({
    loader: (request) => fetchWalletPage(request),
    filterKeys: ["customer_id"],
    initial: { filters: { customer_id: initialCustomerId } },
  });
  const [customerDraft, setCustomerDraft] = useState("");

  const customerId = list.filters.customer_id ?? "";
  const wallets = list.items;

  const customerIds = useMemo(
    () => [
      ...(customerId ? [customerId] : []),
      ...wallets.map((wallet) => String(wallet.customer_id)),
    ],
    [customerId, wallets],
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

  if (!activityVisible) return null;

  function customerFor(wallet: CustomerWallet) {
    return customersById[String(wallet.customer_id)] ?? null;
  }

  function customerNameFor(wallet: CustomerWallet) {
    return customerFor(wallet)?.fullName ?? `Cliente #${wallet.customer_id}`;
  }

  const chips: FilterChip[] = customerId
    ? [
        {
          id: "customer_id",
          label: `Cliente: ${customerDraft || `#${customerId}`}`,
          onRemove: () => list.setFilter("customer_id", ""),
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canRegisterPayments ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href={
                customerId
                  ? `/app/pagos/nuevo?customer_id=${customerId}`
                  : "/app/pagos/nuevo"
              }
            >
              Registrar pago
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta el saldo por moneda de las billeteras de tus clientes. Usa la búsqueda para limitar el listado a un cliente."
        eyebrow="Finanzas"
        title="Billeteras de clientes"
      />

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        id="billeteras-filtros"
        loading={list.status === "loading"}
        onClear={list.clearFilters}
        results={
          list.status === "loading"
            ? "Cargando billeteras…"
            : list.status === "error" && wallets.length === 0
              ? "No se pudieron cargar las billeteras"
              : list.meta.total === 0
                ? "Sin billeteras"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="Busca el cliente por nombre o correo. El filtro se aplica en el servidor."
            id="filtro-billetera-cliente"
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
              if (!value) list.setFilter("customer_id", "");
            }}
            placeholder="Buscar cliente"
            value={customerDraft}
          />
        }
      />

      {list.status === "loading" && walletCardsSkeleton()}

      {list.status === "error" && wallets.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={
            list.error?.message ?? "No pudimos cargar las billeteras."
          }
          onRetry={list.reload}
          title="No pudimos cargar las billeteras"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && wallets.length === 0) && (
          <section
            aria-busy={list.status === "refreshing" || undefined}
            aria-label="Listado de billeteras"
            className="space-y-4"
          >
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && wallets.length > 0 && (
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
                {list.error?.message ??
                  "No pudimos actualizar las billeteras. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {wallets.length === 0 ? (
              list.meta.total === 0 && !customerId ? (
                <EmptyState
                  action={
                    canRegisterPayments ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/pagos/nuevo"
                      >
                        Registrar pago
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description="Las billeteras se crean al registrar el primer pago del cliente en una moneda."
                  title="Todavía no hay billeteras"
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
                        )} billeteras en total, pero esta página no tiene filas.`
                      : "No hay billeteras con este filtro. Prueba con otro cliente."
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : "Sin resultados con estos filtros."
                  }
                />
              )
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {wallets.map((wallet) => (
                  <li
                    className="flex flex-col rounded-[24px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)]"
                    key={String(wallet.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CurrencyChip currency={wallet.currency} />
                      <span className="text-[11px] font-semibold text-muted">
                        Billetera #{wallet.id}
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] font-semibold text-ink">
                      {customerNameFor(wallet)}
                    </p>
                    <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                      Saldo disponible
                    </p>
                    <p className="mt-1.5 break-words text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink">
                      {formatMoney(wallet.balance, wallet.currency ?? {})}
                    </p>
                    <p className="mt-2 text-[12px] text-muted">
                      {wallet.currency
                        ? `${wallet.currency.name} · ${wallet.currency.symbol}`
                        : "Moneda no disponible"}
                    </p>
                    <Link
                      className="button-base button-secondary mt-5 min-h-11 w-full px-4 text-[13px]"
                      href={`/app/billeteras/${wallet.id}`}
                    >
                      Ver movimientos
                      <Icon name="arrow-right" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <PaginationControls
              meta={list.meta}
              onFirstPage={list.goToFirstPage}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
          </section>
        )}
    </div>
  );
}
