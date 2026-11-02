"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { LoadingRegion, Skeleton } from "@/components/erp/ui/skeleton";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { SelectField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import { findById } from "@/components/erp/records/records-api";
import {
  fetchCustomers,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import { walletCountLabel } from "@/components/erp/records/payment-shared";
import {
  fetchWallets,
  type CustomerWallet,
} from "@/components/erp/records/wallets-api";
import { formatMoney } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const NO_WALLETS: CustomerWallet[] = [];
const NO_CUSTOMERS: CustomerRecord[] = [];

function isCustomerFilter(value: string) {
  return /^[1-9]\d*$/.test(value);
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
  const router = useRouter();
  const pathname = usePathname();
  const activityVisible = useActivityVisible();
  const canRegisterPayments = canWriteModule(user.role, "pagos");

  const [customerId, setCustomerId] = useState(
    isCustomerFilter(initialCustomerId) ? initialCustomerId : "",
  );
  const [appliedInitialId, setAppliedInitialId] = useState(initialCustomerId);
  if (initialCustomerId !== appliedInitialId) {
    setAppliedInitialId(initialCustomerId);
    setCustomerId(isCustomerFilter(initialCustomerId) ? initialCustomerId : "");
  }

  const customersResource = useAsyncResource(fetchCustomers);
  const customers = customersResource.data ?? NO_CUSTOMERS;
  const selectedCustomer = useMemo(
    () => (customerId ? findById(customers, customerId) : null),
    [customerId, customers],
  );

  const validCustomerId = isCustomerFilter(customerId) ? customerId : "";
  const loader = useCallback(
    async () => ({
      customerId: validCustomerId,
      wallets: validCustomerId ? await fetchWallets(validCustomerId) : NO_WALLETS,
    }),
    [validCustomerId],
  );
  const walletsResource = useAsyncResource(loader, {
    enabled: Boolean(validCustomerId),
  });
  const reloadWallets = walletsResource.reload;
  const wallets =
    walletsResource.data?.customerId === validCustomerId
      ? walletsResource.data.wallets
      : NO_WALLETS;
  const walletsReady = walletsResource.data?.customerId === validCustomerId;
  const walletsLoading =
    Boolean(validCustomerId) &&
    !walletsReady &&
    walletsResource.status !== "error";

  const appliedCustomerId = useRef(validCustomerId);
  useEffect(() => {
    if (appliedCustomerId.current === validCustomerId) return;
    appliedCustomerId.current = validCustomerId;
    if (validCustomerId) reloadWallets();
  }, [reloadWallets, validCustomerId]);

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

  if (!activityVisible) return null;

  function commitCustomer(value: string) {
    setCustomerId(value);
    if (!value) {
      router.replace(pathname, { scroll: false });
      return;
    }
    router.replace(`${pathname}?customer_id=${encodeURIComponent(value)}`, {
      scroll: false,
    });
  }

  const selectedName =
    selectedCustomer?.fullName ??
    (validCustomerId ? `Cliente #${validCustomerId}` : "");

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canRegisterPayments ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href={
                validCustomerId
                  ? `/app/pagos/nuevo?customer_id=${validCustomerId}`
                  : "/app/pagos/nuevo"
              }
            >
              Registrar pago
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta el saldo por moneda de cada cliente. Cada pago recibido acredita la billetera de la moneda del método de pago."
        eyebrow="Finanzas"
        title="Billeteras de clientes"
      />

      <section
        aria-label="Selección de cliente"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:max-w-xl">
          <SelectField
            emptyLabel="No hay clientes registrados."
            help="Las billeteras se agrupan por cliente y moneda."
            id="filtro-billetera-cliente"
            label="Cliente"
            loading={customersResource.status === "loading"}
            loadingLabel="Cargando clientes…"
            loadError={
              customersResource.status === "error"
                ? customersResource.error?.message ??
                  "No pudimos cargar los clientes."
                : null
            }
            onChange={commitCustomer}
            onRetry={customersResource.reload}
            options={customerOptions}
            placeholder="Selecciona un cliente"
            required
            value={customerId}
          />
        </div>
        {validCustomerId && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p aria-live="polite" className="text-[12px] font-semibold text-muted">
              {walletsLoading
                ? "Cargando billeteras…"
                : walletsResource.status === "error"
                  ? walletsReady
                    ? `${walletCountLabel(wallets.length)} · datos sin actualizar`
                    : "No se pudieron cargar las billeteras"
                  : `${walletCountLabel(wallets.length)} de ${selectedName}`}
            </p>
            <Link
              className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/pagos?customer_id=${validCustomerId}`}
            >
              Ver pagos del cliente
              <Icon name="arrow-up-right" size={14} />
            </Link>
          </div>
        )}
      </section>

      {!validCustomerId && (
        <EmptyState
          description="Elige un cliente para consultar sus saldos por moneda y el historial de movimientos."
          headingLevel={2}
          title="Selecciona un cliente"
        />
      )}

      {validCustomerId && walletsLoading && (
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
      )}

      {validCustomerId &&
        walletsResource.status === "error" &&
        !walletsReady && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={
            walletsResource.error?.message ??
            "No pudimos cargar las billeteras del cliente."
          }
          onRetry={walletsResource.reload}
          title="No pudimos cargar las billeteras"
        />
      )}

      {validCustomerId && walletsReady && (
          <section
            aria-label={`Billeteras de ${selectedName}`}
            className="space-y-4"
          >
            {walletsResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {walletsResource.status === "error" && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={walletsResource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {walletsResource.error?.message ??
                  "No pudimos actualizar las billeteras. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {wallets.length === 0 ? (
              <EmptyState
                action={
                  canRegisterPayments ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href={`/app/pagos/nuevo?customer_id=${validCustomerId}`}
                    >
                      Registrar pago
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description="Las billeteras se crean al registrar el primer pago del cliente en una moneda."
                title="Este cliente aún no tiene billeteras"
              />
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
          </section>
        )}
    </div>
  );
}
