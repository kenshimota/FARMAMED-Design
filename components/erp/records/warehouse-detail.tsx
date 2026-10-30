"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
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
  deleteWarehouse,
  fetchWarehouse,
} from "@/components/erp/records/warehouses-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const DELETE_CONFLICT_COPY =
  "No puedes eliminar esta bodega porque tiene estantes asociados.";

type WarehouseDetailPageProps = {
  warehouseId: string;
};

export function WarehouseDetailPage({ warehouseId }: WarehouseDetailPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canRead = canReadModule(user.role, "bodegas");
  const canWrite = canWriteModule(user.role, "bodegas");
  const canSeeShelves = canReadModule(user.role, "estantes");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConflict, setDeleteConflict] = useState(false);

  const validId = isPositiveRecordId(warehouseId);
  const loader = useCallback(() => fetchWarehouse(warehouseId), [warehouseId]);
  const resource = useAsyncResource(loader, { enabled: canRead && validId });

  if (!canRead) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de bodegas. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/bodegas"
        backLabel="Volver a bodegas"
        description="Puede que el enlace no sea válido o que la bodega ya no exista."
        headingLevel="h1"
        title="No encontramos esta bodega"
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
              href="/app/bodegas"
            >
              Volver a bodegas
            </Link>
          }
          description="Consulta los datos registrados de la bodega."
          eyebrow="Operación"
          title="Detalle de la bodega"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (resource.status === "error" || !resource.data) {
    const notFound = resource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/bodegas"
        backLabel="Volver a bodegas"
        description={
          notFound
            ? "Puede que haya sido eliminada o que el enlace no sea válido."
            : resource.error?.message ?? "No pudimos cargar la bodega."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={
          notFound ? "No encontramos esta bodega" : "No pudimos cargar la bodega"
        }
      />
    );
  }

  const warehouse = resource.data;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            {canSeeShelves && (
              <Link
                aria-label={`Ver los estantes de la bodega ${warehouse.name}`}
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={`/app/bodegas/${warehouse.id}/estantes`}
              >
                Ver estantes
                <Icon name="layers" size={16} />
              </Link>
            )}
            {canWrite && (
              <Link
                aria-label={`Editar la bodega ${warehouse.name}`}
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href={`/app/bodegas/${warehouse.id}/editar`}
              >
                Editar bodega
                <Icon name="arrow-right" size={17} />
              </Link>
            )}
            {canWrite && (
              <RecordActionButton
                aria-label={`Eliminar la bodega ${warehouse.name}`}
                danger
                onClick={() => {
                  setDeleteConflict(false);
                  setDeleteOpen(true);
                }}
              >
                Eliminar bodega
              </RecordActionButton>
            )}
          </>
        }
        description="Ficha con los datos de la bodega y el acceso a su jerarquía de estantes."
        eyebrow="Operación"
        title={warehouse.name}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/bodegas"
        >
          Volver a bodegas
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      {deleteConflict && (
        <NoticeBanner
          action={
            <div className="flex flex-wrap items-center gap-2">
              {canSeeShelves && (
                <Link
                  className="button-base button-secondary min-h-11 px-4 text-[12px]"
                  href={`/app/bodegas/${warehouse.id}/estantes`}
                >
                  Ver estantes
                  <Icon name="layers" size={15} />
                </Link>
              )}
              <button
                className="min-h-11 rounded-full border border-olive/35 px-4 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                onClick={() => setDeleteConflict(false)}
                type="button"
              >
                Cerrar aviso
              </button>
            </div>
          }
          tone="warning"
        >
          <p>{DELETE_CONFLICT_COPY}</p>
        </NoticeBanner>
      )}

      {canSeeShelves && (
        <NoticeBanner tone="info">
          Los estantes y secciones de esta bodega se consultan en su propia
          pantalla.{" "}
          <Link
            className="font-semibold text-brand underline underline-offset-4 hover:text-ink"
            href={`/app/bodegas/${warehouse.id}/estantes`}
          >
            Ver estantes
          </Link>
        </NoticeBanner>
      )}

      <section
        aria-labelledby="ficha-bodega"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Ficha de la bodega</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ficha-bodega"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Nombre de la bodega
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">{warehouse.name}</dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">
              #{warehouse.id}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Dirección
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
              {warehouse.address}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Observaciones
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
              {warehouse.observations || "Sin observaciones"}
            </dd>
          </div>
        </dl>

        <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          Las bodegas son la raíz de la ubicación física del inventario. El nombre
          no es único: dos bodegas pueden llamarse igual.
        </p>
      </section>

      <ConfirmDialog
        confirmBusyLabel="Eliminando…"
        confirmLabel="Eliminar bodega"
        description={
          <div className="space-y-2">
            <p>Se eliminarán también sus estantes y secciones si no tienen lotes.</p>
            <p>Esta acción no se puede deshacer.</p>
          </div>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteWarehouse(warehouse.id);
          toast.success("Bodega eliminada.");
          router.push("/app/bodegas");
        }}
        onError={(error) => {
          if (error.kind === "conflict") {
            setDeleteConflict(true);
            return;
          }
          toast.error(error.message);
        }}
        open={deleteOpen}
        title={`¿Eliminar la bodega ${warehouse.name}?`}
      />
    </div>
  );
}
