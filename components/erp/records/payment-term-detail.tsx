"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordActionButton } from "@/components/erp/records/record-actions";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import {
  deletePaymentTerm,
  fetchPaymentTerm,
  paymentTermConditionLabel,
  paymentTermDayCountLabel,
} from "@/lib/finance/payment-terms-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type PaymentTermDetailPageProps = {
  termId: string;
};

export function PaymentTermDetailPage({ termId }: PaymentTermDetailPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canRead = canReadModule(user.role, "terminos_pago");
  const canWrite = canWriteModule(user.role, "terminos_pago");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validId = isPositiveRecordId(termId);
  const loader = useCallback(() => fetchPaymentTerm(termId), [termId]);
  const resource = useAsyncResource(loader, {
    enabled: canRead && validId,
  });

  if (!canRead) {
    return (
      <AccessState description="No tienes permiso para administrar términos de pago." />
    );
  }

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/terminos-de-pago"
        backLabel="Volver a términos de pago"
        description="Puede que el enlace no sea válido o que el término ya no exista."
        headingLevel="h1"
        title="No encontramos ese término"
      />
    );
  }

  if (resource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/terminos-de-pago"
            >
              Volver a términos
            </Link>
          }
          description="Consulta la condición de pago y los días que definen el vencimiento."
          eyebrow="Finanzas"
          title="Detalle del término de pago"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (resource.status === "error" || !resource.data) {
    const notFound = resource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/terminos-de-pago"
        backLabel="Volver a términos de pago"
        description={
          notFound
            ? "Puede que haya sido eliminado o que el enlace no sea válido."
            : resource.error?.message ??
              "No pudimos cargar el término de pago."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={
          notFound
            ? "No encontramos ese término"
            : "No pudimos cargar el término de pago"
        }
      />
    );
  }

  const term = resource.data;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <>
              <Link
                aria-label={`Editar el término ${term.code}`}
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={`/app/terminos-de-pago/${term.id}/editar`}
              >
                Editar término
                <Icon name="arrow-right" size={16} />
              </Link>
              <RecordActionButton
                aria-label={`Eliminar el término ${term.code}`}
                danger
                onClick={() => setDeleteOpen(true)}
              >
                Eliminar término
              </RecordActionButton>
            </>
          ) : undefined
        }
        description="Revisa la condición de pago y los días que el API usa para calcular el vencimiento de la factura."
        eyebrow="Finanzas"
        title={term.name}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/terminos-de-pago"
        >
          Volver a términos de pago
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      <section
        aria-labelledby="ficha-termino-pago"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Término de pago</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ficha-termino-pago"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Código
            </dt>
            <dd className="mt-1.5">
              <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[12px] font-semibold text-brand">
                {term.code}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">
              #{term.id}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Nombre
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">{term.name}</dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Descripción
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
              {term.description || "Sin descripción"}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Condición
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              {paymentTermConditionLabel(term.days)}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Días
            </dt>
            <dd className="mt-1.5 text-[14px] font-semibold text-ink">
              {paymentTermDayCountLabel(term.days)}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Estado
            </dt>
            <dd className="mt-1.5">
              {term.is_active ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-lime px-2.5 py-1 text-[12px] font-semibold text-ink">
                  <Icon name="check" size={13} />
                  Activo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[12px] font-semibold text-muted">
                  <Icon name="eye-off" size={13} />
                  Inactivo
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6 space-y-3 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          <p>
            Contado usa 0 días: el vencimiento coincide con la fecha de emisión.
            Crédito usa los días indicados para calcular el vencimiento.
          </p>
          <p>
            El cliente tiene un término por defecto y cada pedido conserva el
            suyo. Un término inactivo no se puede asignar a clientes, pedidos ni
            facturas.
          </p>
        </div>

        <p className="mt-4 text-[12px] leading-5 text-muted">
          Para cambiar este término en un cliente, abre el formulario de edición
          del cliente. La eliminación solo se completa si el término no está en
          uso.
        </p>
      </section>

      <ConfirmDialog
        confirmLabel="Eliminar término"
        description={
          <div className="space-y-2">
            <p>
              Código:{" "}
              <span className="font-semibold text-ink">{term.code}</span>
            </p>
            <p>
              Esta acción es permanente. No se puede eliminar un término
              asignado a clientes, pedidos o facturas.
            </p>
          </div>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deletePaymentTerm(String(term.id));
          toast.success("Término eliminado.");
          router.push("/app/terminos-de-pago");
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteOpen}
        title={`¿Eliminar ${term.code}?`}
      />
    </div>
  );
}
