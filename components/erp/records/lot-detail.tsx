"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { LotDeleteDialog } from "@/components/erp/records/lot-delete-dialog";
import {
  getLotExpiryStatus,
  LotExpiryBadge,
  lotItemStateLabel,
  lotLocationLabel,
  lotProductName,
  lotProductReference,
  lotSectionLabel,
  lotShelfLabel,
  lotWarehouseName,
  LotSyncNotice,
} from "@/components/erp/records/lot-shared";
import { fetchLot, lotAvailable } from "@/components/erp/records/lots-api";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordActionButton } from "@/components/erp/records/record-actions";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { formatDateOnly, formatInteger } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

export function LotDetailPage({ lotId }: { lotId: string }) {
  const { user } = useSession();
  const canRead = canReadModule(user.role, "lotes");

  if (!canRead) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de lotes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }

  if (!isPositiveRecordId(lotId)) {
    return (
      <RecordsLoadError
        backHref="/app/lotes"
        backLabel="Volver a lotes"
        description="Puede que el enlace no sea válido o que el lote ya no exista."
        headingLevel="h1"
        title="No encontramos este lote"
      />
    );
  }

  return <LotDetailContent lotId={lotId} />;
}

function LotDetailContent({ lotId }: { lotId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const canWrite = canWriteModule(user.role, "lotes");
  const canReadExistencias = canReadModule(user.role, "existencias");
  const canReadWarehouses = canReadModule(user.role, "bodegas");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConflict, setDeleteConflict] = useState(false);

  const loader = useCallback(() => fetchLot(lotId), [lotId]);
  const resource = useAsyncResource(loader);

  if (resource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/lotes"
            >
              Volver a lotes
            </Link>
          }
          description="Consulta el vencimiento, las cantidades y la ubicación física del lote."
          eyebrow="Inventario"
          title="Detalle del lote"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (resource.status === "error" || !resource.data) {
    const notFound = resource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/lotes"
        backLabel="Volver a lotes"
        description={
          notFound
            ? "Puede que haya sido eliminado o que el enlace no sea válido."
            : resource.error?.message ?? "No pudimos cargar el lote."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={
          notFound ? "No encontramos este lote" : "No pudimos cargar el lote"
        }
      />
    );
  }

  const lot = resource.data;
  const productName = lotProductName(lot.product, lot.product_id);
  const productReference = lotProductReference(lot.product);
  const itemStateLabel = lotItemStateLabel(lot);
  const available = lotAvailable(lot);
  const expiryStatus = getLotExpiryStatus(lot.expiration_date);
  const warehouseHref = `/app/bodegas/${lot.warehouse_id}`;
  const shelfHref = `/app/bodegas/${lot.warehouse_id}/estantes/${lot.shelf_id}`;
  const stocksHref = `/app/existencias/producto/${lot.product_id}`;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/lotes"
            >
              Volver a lotes
            </Link>
            {canReadExistencias && (
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={stocksHref}
              >
                Ver existencias del producto
                <Icon name="box" size={16} />
              </Link>
            )}
            {canWrite && (
              <Link
                aria-label={`Editar el lote ${lot.number} de ${productName}`}
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href={`/app/lotes/${lot.id}/editar`}
              >
                Editar lote
                <Icon name="arrow-right" size={17} />
              </Link>
            )}
            {canWrite && (
              <RecordActionButton
                aria-label={`Eliminar el lote ${lot.number} de ${productName}`}
                danger
                onClick={() => {
                  setDeleteConflict(false);
                  setDeleteOpen(true);
                }}
              >
                Eliminar lote
              </RecordActionButton>
            )}
          </>
        }
        description={`${productName} · Vence el ${formatDateOnly(lot.expiration_date)} · ${lotLocationLabel(lot)}`}
        eyebrow="Inventario"
        title={`Lote ${lot.number}`}
      />

      <LotSyncNotice
        action={
          canReadExistencias ? (
            <Link
              className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={stocksHref}
            >
              Ver existencias del producto
            </Link>
          ) : undefined
        }
        variant="detail"
      />

      {deleteConflict && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-4 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={() => setDeleteConflict(false)}
              type="button"
            >
              Cerrar aviso
            </button>
          }
          tone="warning"
        >
          Solo puedes eliminar lotes con existencia y reservado en cero.
        </NoticeBanner>
      )}

      {expiryStatus === "vencido" && (
        <NoticeBanner tone="danger">
          Este lote está vencido. Revisa el estado del ítem y su disponibilidad
          antes de usarlo.
        </NoticeBanner>
      )}

      {expiryStatus === "proximo" && (
        <NoticeBanner tone="warning">
          Este lote vence dentro de los próximos 30 días.
        </NoticeBanner>
      )}

      <section
        aria-labelledby="datos-lote-detalle"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Ficha del lote</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="datos-lote-detalle"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Producto
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              <Link
                className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
                href={`/app/productos/${lot.product_id}`}
              >
                {productName}
              </Link>
              {productReference && (
                <span className="mt-1 block font-mono text-[11px] text-muted">
                  Ref. {productReference}
                </span>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Número de lote
            </dt>
            <dd className="mt-1.5 font-mono text-[14px] font-semibold text-ink">
              {lot.number}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Estado del ítem
            </dt>
            <dd className="mt-1.5">
              <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
                {itemStateLabel}
              </span>
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Fecha de vencimiento
            </dt>
            <dd className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold tabular-nums text-ink">
                {formatDateOnly(lot.expiration_date)}
              </span>
              <LotExpiryBadge expirationDate={lot.expiration_date} />
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">
              #{lot.id}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="cantidades-lote"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Cantidades</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="cantidades-lote"
        >
          Existencia, reservado y disponible
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-line bg-background p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Existencia
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
              {formatInteger(lot.stock)}
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-background p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Reservado
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-ink">
              {formatInteger(lot.reserved)}
            </p>
          </div>
          <div className="rounded-2xl border border-brand/20 bg-soft-blue p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
              Disponible
            </p>
            <p className="mt-1.5 text-2xl font-semibold tabular-nums text-brand">
              {formatInteger(available)}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[12px] leading-6 text-muted">
          El disponible se calcula como existencia − reservado. No se envía al
          API y no modifica las existencias agregadas.
        </p>
      </section>

      <section
        aria-labelledby="ubicacion-lote"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Ubicación física</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ubicacion-lote"
        >
          {lotLocationLabel(lot)}
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Bodega
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              {canReadWarehouses ? (
                <Link
                  className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
                  href={warehouseHref}
                >
                  {lotWarehouseName(lot)}
                </Link>
              ) : (
                <span className="font-semibold text-ink">
                  {lotWarehouseName(lot)}
                </span>
              )}
              {lot.warehouse?.address && (
                <span className="mt-1 block text-[12px] leading-5 text-muted">
                  {lot.warehouse.address}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Estante
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              <Link
                className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
                href={shelfHref}
              >
                {lotShelfLabel(lot.shelf, lot.shelf_id)}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Sección
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              <Link
                className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
                href={shelfHref}
              >
                {lotSectionLabel(lot.section, lot.section_id)}
              </Link>
            </dd>
          </div>
        </dl>

        <p className="mt-5 text-[12px] leading-6 text-muted">
          La ubicación se valida en el API: el estante debe pertenecer a la
          bodega y la sección al estante.
        </p>
      </section>

      <LotDeleteDialog
        lot={deleteOpen ? lot : null}
        onClose={() => setDeleteOpen(false)}
        onConflict={() => setDeleteConflict(true)}
        onDeleted={() => router.push("/app/lotes")}
        productName={productName}
      />
    </div>
  );
}
