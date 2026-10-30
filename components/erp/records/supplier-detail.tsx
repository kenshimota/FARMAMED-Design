"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
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
  deleteSupplier,
  fetchSupplier,
} from "@/components/erp/records/suppliers-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type SupplierDetailPageProps = {
  supplierId: string;
};

export function SupplierDetailPage({ supplierId }: SupplierDetailPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const canReadPurchases = canReadModule(user.role, "compras");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validId = isPositiveRecordId(supplierId);
  const supplierLoader = useCallback(
    () => fetchSupplier(supplierId),
    [supplierId],
  );
  const supplierResource = useAsyncResource(supplierLoader, {
    enabled: validId,
  });

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/proveedores"
        backLabel="Volver a proveedores"
        description="Puede que el enlace no sea válido o que el proveedor ya no exista."
        headingLevel="h1"
        title="No encontramos este proveedor"
      />
    );
  }

  if (supplierResource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/proveedores"
            >
              Volver a proveedores
            </Link>
          }
          description="Consulta los datos registrados del proveedor."
          eyebrow="Catálogo"
          title="Detalle del proveedor"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (supplierResource.status === "error" || !supplierResource.data) {
    const notFound = supplierResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/proveedores"
        backLabel="Volver a proveedores"
        description={
          notFound
            ? "Puede que haya sido eliminado o que el enlace no sea válido."
            : supplierResource.error?.message ??
              "No pudimos cargar el proveedor."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : supplierResource.reload}
        title={
          notFound
            ? "No encontramos este proveedor"
            : "No pudimos cargar el proveedor"
        }
      />
    );
  }

  const supplier = supplierResource.data;
  const cityName = supplier.city?.name ?? `Ciudad #${supplier.city_id}`;
  const stateName = supplier.state?.name ?? `Estado #${supplier.state_id}`;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            {canReadPurchases && (
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href="/app/compras"
              >
                Ir a compras
                <Icon name="arrow-up-right" size={16} />
              </Link>
            )}
            {canWrite && (
              <Link
                aria-label={`Editar proveedor ${supplier.name}`}
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href={`/app/proveedores/${supplier.id}/editar`}
              >
                Editar proveedor
                <Icon name="arrow-right" size={17} />
              </Link>
            )}
            {canWrite && (
              <RecordActionButton
                aria-label={`Eliminar proveedor ${supplier.name}`}
                danger
                onClick={() => setDeleteOpen(true)}
              >
                Eliminar proveedor
              </RecordActionButton>
            )}
          </>
        }
        description={`Identificación ${supplier.identification}`}
        eyebrow="Catálogo"
        title={supplier.name}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/proveedores"
        >
          Volver a proveedores
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      {canReadPurchases && (
        <NoticeBanner tone="info">
          Módulo en preparación; todavía no filtra por proveedor.
        </NoticeBanner>
      )}

      <section
        aria-labelledby="ficha-proveedor"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Ficha del proveedor</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ficha-proveedor"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Nombre
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">{supplier.name}</dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificación
            </dt>
            <dd className="mt-1.5">
              <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[12px] font-semibold text-brand">
                {supplier.identification}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Correo
            </dt>
            <dd className="mt-1.5 break-all text-[14px] text-ink">
              {supplier.email || "No registrado"}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Teléfono
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              {supplier.phone || "No registrado"}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Dirección
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
              {supplier.address || "No registrada"}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Ciudad
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              <Link
                className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href={`/app/ubicaciones/ciudades/${supplier.city_id}`}
              >
                {cityName}
              </Link>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Estado
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              <Link
                className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href={`/app/ubicaciones/estados/${supplier.state_id}`}
              >
                {stateName}
              </Link>
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Observaciones
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
              {supplier.observations || "Sin observaciones registradas."}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">
              #{supplier.id}
            </dd>
          </div>
        </dl>

        <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          El correo es un dato de contacto y no es único: puede repetirse en
          otros proveedores.
        </p>
      </section>

      <ConfirmDialog
        confirmLabel="Eliminar proveedor"
        description={
          <div className="space-y-2">
            <p>
              Identificación:{" "}
              <span className="font-semibold text-ink">
                {supplier.identification}
              </span>
            </p>
            <p>
              Si el proveedor tiene compras asociadas, no se puede eliminar.
              Esta acción no se puede deshacer.
            </p>
          </div>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteSupplier(supplier.id);
          toast.success("Proveedor eliminado.");
          router.push("/app/proveedores");
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteOpen}
        title={`¿Eliminar el proveedor ${supplier.name}?`}
      />
    </div>
  );
}
