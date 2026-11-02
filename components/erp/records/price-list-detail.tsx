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
import {
  deletePriceList,
  fetchPriceList,
} from "@/components/erp/records/price-lists-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { formatPercent } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type PriceListDetailPageProps = {
  priceListId: string;
};

export function PriceListDetailPage({ priceListId }: PriceListDetailPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canRead = canReadModule(user.role, "listas_precios");
  const canWrite = canWriteModule(user.role, "listas_precios");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validId = isPositiveRecordId(priceListId);
  const loader = useCallback(
    () => fetchPriceList(priceListId),
    [priceListId],
  );
  const resource = useAsyncResource(loader, {
    enabled: canRead && validId,
  });

  if (!canRead) {
    return <AccessState description="No tienes permiso para administrar listas." />;
  }

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/listas-de-precios"
        backLabel="Volver a listas de precios"
        description="Puede que el enlace no sea válido o que la lista ya no exista."
        headingLevel="h1"
        title="No encontramos esa lista"
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
              href="/app/listas-de-precios"
            >
              Volver a listas
            </Link>
          }
          description="Consulta el margen configurado para esta lista de precios."
          eyebrow="Catálogo"
          title="Detalle de la lista"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (resource.status === "error" || !resource.data) {
    const notFound = resource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/listas-de-precios"
        backLabel="Volver a listas de precios"
        description={
          notFound
            ? "Puede que haya sido eliminada o que el enlace no sea válido."
            : resource.error?.message ?? "No pudimos cargar la lista de precios."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={
          notFound ? "No encontramos esa lista" : "No pudimos cargar la lista"
        }
      />
    );
  }

  const priceList = resource.data;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <>
              <Link
                aria-label={`Editar la lista ${priceList.name}`}
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={`/app/listas-de-precios/${priceList.id}/editar`}
              >
                Editar lista
                <Icon name="arrow-right" size={16} />
              </Link>
              <RecordActionButton
                aria-label={`Eliminar la lista ${priceList.name}`}
                danger
                onClick={() => setDeleteOpen(true)}
              >
                Eliminar lista
              </RecordActionButton>
            </>
          ) : undefined
        }
        description="Revisa el margen que se aplicará a los clientes asignados a esta lista."
        eyebrow="Catálogo"
        title={priceList.name}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/listas-de-precios"
        >
          Volver a listas de precios
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      <section
        aria-labelledby="ficha-lista-precios"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Lista de precios</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ficha-lista-precios"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Nombre
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">{priceList.name}</dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Descripción
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
              {priceList.description || "Sin descripción"}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Porcentaje de margen
            </dt>
            <dd className="mt-1.5 text-[14px] font-semibold text-ink">
              {formatPercent(priceList.percentage)}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">
              #{priceList.id}
            </dd>
          </div>
        </dl>

        <div className="mt-6 space-y-3 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          <p>
            El precio de venta se calcula dinámicamente con el costo vigente y
            este porcentaje de margen. Aquí no se muestran costos ni precios
            calculados.
          </p>
          <p>
            El porcentaje es un margen sobre el costo. El cliente solo ve el
            precio final.
          </p>
        </div>

        <p className="mt-4 text-[12px] leading-5 text-muted">
          Para asignar esta lista, abre el formulario de un cliente y usa el
          campo «Lista de precios». La asignación se guarda en el cliente.
        </p>
      </section>

      <ConfirmDialog
        confirmLabel="Eliminar lista"
        description={
          <div className="space-y-2">
            <p>
              Lista:{" "}
              <span className="font-semibold text-ink">{priceList.name}</span>
            </p>
            <p>
              Esta acción es permanente. Si la lista está asignada a clientes,
              no se podrá eliminar.
            </p>
          </div>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deletePriceList(String(priceList.id));
          toast.success("Lista eliminada.");
          router.push("/app/listas-de-precios");
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteOpen}
        title={`¿Eliminar la lista ${priceList.name}?`}
      />
    </div>
  );
}
