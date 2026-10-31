"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
  RecordActionLink,
} from "@/components/erp/records/record-actions";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import {
  METHOD_PAYMENT_COPY,
} from "@/components/erp/records/method-payment-errors";
import {
  fetchMethodPayment,
  type MethodPayment,
} from "@/components/erp/records/method-payments-api";
import {
  fetchMethodPaymentTypes,
  findMethodPaymentType,
} from "@/components/erp/records/method-payment-types-api";
import {
  MethodCurrencyBadge,
  MethodPaymentDetailsList,
  MethodPaymentStatusBadge,
  MethodTypeBadge,
} from "@/components/erp/records/method-payment-shared";
import {
  MethodPaymentDeactivateDialog,
  MethodPaymentDeleteDialog,
  MethodPaymentReactivateDialog,
} from "@/components/erp/records/method-payment-dialogs";
import { fetchCurrencies, type Currency } from "@/lib/finance/currencies-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const NO_CURRENCIES: Currency[] = [];

export function MethodPaymentDetailPage({ methodId }: { methodId: string }) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  if (!canReadModule(user.role, "metodos_pago")) {
    return activityVisible ? (
      <AccessState description="Tu rol no tiene acceso al módulo de métodos de pago. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }
  if (!isPositiveRecordId(methodId)) {
    return activityVisible ? (
      <RecordsLoadError
        backHref="/app/metodos-pago"
        backLabel="Volver a métodos de pago"
        description="Puede que el enlace no sea válido o que el método ya no exista."
        headingLevel="h1"
        title="No encontramos este método de pago"
      />
    ) : null;
  }
  return <MethodPaymentDetailContent methodId={methodId} />;
}

function MethodPaymentDetailContent({ methodId }: { methodId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  const canWrite = canWriteModule(user.role, "metodos_pago");
  const [dialog, setDialog] = useState<
    "deactivate" | "reactivate" | "delete" | null
  >(null);

  const methodLoader = useCallback(() => fetchMethodPayment(methodId), [methodId]);
  const methodResource = useAsyncResource(methodLoader);
  const typesResource = useAsyncResource(fetchMethodPaymentTypes);
  const currenciesResource = useAsyncResource(() => fetchCurrencies(canWrite));

  const method = methodResource.data;
  const types = typesResource.data ?? [];
  const currencies = currenciesResource.data ?? NO_CURRENCIES;

  function reactivationBlocked(target: MethodPayment): boolean | null {
    const type = findMethodPaymentType(types, target.method_payment_type_id);
    if (!type) return null;
    if (!type.is_active) return true;
    const currency = currencies.find(
      (item) => String(item.id) === String(type.currency_id ?? ""),
    );
    if (!currency) return null;
    return !currency.is_active;
  }

  if (!activityVisible) return null;

  if (methodResource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/metodos-pago"
            >
              Volver a métodos de pago
            </Link>
          }
          description="Consulta los datos de cobro registrados de este método."
          eyebrow="Finanzas"
          title="Detalle del método de pago"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (methodResource.status === "error" || !method) {
    return (
      <RecordsLoadError
        backHref="/app/metodos-pago"
        backLabel="Volver a métodos de pago"
        description={
          methodResource.error?.status === 404
            ? METHOD_PAYMENT_COPY.notFound
            : methodResource.error?.message ?? METHOD_PAYMENT_COPY.notFound
        }
        headingLevel="h1"
        onRetry={methodResource.reload}
        title="No pudimos cargar el método de pago"
      />
    );
  }

  const type = method.method_payment_type;
  const fields = findMethodPaymentType(
    types,
    method.method_payment_type_id ?? type?.id ?? null,
  )?.fields ?? [];

  function handleDone() {
    methodResource.reload();
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/metodos-pago"
            >
              Volver a métodos de pago
            </Link>
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
                    onClick={() => setDialog("deactivate")}
                  >
                    Desactivar
                  </RecordActionButton>
                ) : (
                  <RecordActionButton
                    aria-label={`Reactivar el método ${method.label}`}
                    icon="check"
                    onClick={() => setDialog("reactivate")}
                  >
                    Reactivar
                  </RecordActionButton>
                )}
                <RecordActionButton
                  aria-label={`Eliminar el método ${method.label}`}
                  danger
                  icon="close"
                  onClick={() => setDialog("delete")}
                >
                  Eliminar
                </RecordActionButton>
              </>
            )}
          </>
        }
        description="Consulta los datos de cobro registrados de este método."
        eyebrow="Finanzas"
        title="Detalle del método de pago"
      />

      {!canWrite && (
        <NoticeBanner tone="info">{METHOD_PAYMENT_COPY.writeNotice}</NoticeBanner>
      )}

      <section
        aria-label="Datos del método de pago"
        className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-line bg-background px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Etiqueta
            </dt>
            <dd className="mt-1 text-[15px] font-semibold text-ink">
              {method.label}
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-background px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Tipo de método
            </dt>
            <dd className="mt-1">
              <MethodTypeBadge type={type} />
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-background px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1">
              <MethodCurrencyBadge currency={method.currency} />
            </dd>
          </div>
          <div className="rounded-xl border border-line bg-background px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
              Estado
            </dt>
            <dd className="mt-1">
              <MethodPaymentStatusBadge isActive={method.is_active} />
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="metodo-datos-titulo"
        className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
      >
        <h2
          className="text-[15px] font-semibold tracking-[-0.01em] text-ink"
          id="metodo-datos-titulo"
        >
          Datos del método
        </h2>
        <div className="mt-4">
          <MethodPaymentDetailsList details={method.details} fields={fields} />
        </div>
      </section>

      <MethodPaymentDeactivateDialog
        method={dialog === "deactivate" ? method : null}
        onClose={() => setDialog(null)}
        onDone={handleDone}
        onRefresh={handleDone}
      />
      <MethodPaymentReactivateDialog
        blocked={dialog === "reactivate" ? reactivationBlocked(method) : null}
        method={dialog === "reactivate" ? method : null}
        onClose={() => setDialog(null)}
        onDone={handleDone}
        onRefresh={handleDone}
      />
      <MethodPaymentDeleteDialog
        method={dialog === "delete" ? method : null}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          router.push("/app/metodos-pago");
        }}
        onRefresh={handleDone}
      />
    </div>
  );
}
