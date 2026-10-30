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
import { CityFormDialog } from "@/components/erp/records/city-form-dialog";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordActionButton } from "@/components/erp/records/record-actions";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  deleteCity,
  fetchCity,
  fetchStates,
  type StateRecord,
} from "@/components/erp/records/locations-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { canWriteModule } from "@/lib/permissions";

type CityDetailPageProps = {
  cityId: string;
};

const EMPTY_STATES: StateRecord[] = [];

export function CityDetailPage({ cityId }: CityDetailPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validId = isPositiveRecordId(cityId);
  const cityLoader = useCallback(() => fetchCity(cityId), [cityId]);
  const cityResource = useAsyncResource(cityLoader, { enabled: validId });
  const statesResource = useAsyncResource(fetchStates, { enabled: validId });

  const states = statesResource.data ?? EMPTY_STATES;
  const statesError =
    statesResource.status === "error" && states.length === 0
      ? statesResource.error?.message ?? "No pudimos cargar los estados."
      : null;

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/ubicaciones"
        backLabel="Volver a ubicaciones"
        description="Puede que el enlace no sea válido o que la ciudad ya no exista."
        headingLevel="h1"
        title="No encontramos esta ciudad"
      />
    );
  }

  if (cityResource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/ubicaciones"
            >
              Volver a ubicaciones
            </Link>
          }
          description="Consulta la ciudad geográfica y el estado al que pertenece."
          eyebrow="Catálogo"
          title="Detalle de la ciudad"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (cityResource.status === "error" || !cityResource.data) {
    const notFound = cityResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/ubicaciones"
        backLabel="Volver a ubicaciones"
        description={
          notFound
            ? "Puede que haya sido eliminada o que el enlace no sea válido."
            : cityResource.error?.message ?? "No pudimos cargar la ciudad."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : cityResource.reload}
        title={notFound ? "No encontramos esta ciudad" : "No pudimos cargar la ciudad"}
      />
    );
  }

  const record = cityResource.data;
  // GET /cities/:id no expone el estado anidado; se resuelve con la lista de estados.
  const stateRecord = states.find(
    (state) => String(state.id) === String(record.state_id),
  );
  const stateName = stateRecord?.name ?? `Estado #${record.state_id}`;
  const stateLoading =
    !stateRecord &&
    (statesResource.status === "loading" || statesResource.status === "idle");
  const stateLinkHref = `/app/ubicaciones/estados/${record.state_id}`;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <>
              <button
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                onClick={() => setEditOpen(true)}
                type="button"
              >
                Editar ciudad
                <Icon name="arrow-right" size={17} />
              </button>
              <RecordActionButton danger onClick={() => setDeleteOpen(true)}>
                Eliminar ciudad
              </RecordActionButton>
            </>
          ) : undefined
        }
        description={`Estado: ${stateLoading ? "cargando…" : stateName}`}
        eyebrow="Catálogo"
        title={record.name}
      >
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
          href="/app/ubicaciones"
        >
          Volver a ubicaciones
          <Icon name="arrow-right" size={14} />
        </Link>
      </RecordsPageHeader>

      <NoticeBanner tone="info">
        Los estados geográficos no son los estados de ítem del inventario.{" "}
        <Link
          className="font-semibold text-brand underline underline-offset-4 hover:text-ink"
          href="/app/estados-item"
        >
          Ir a estados de ítem
        </Link>
      </NoticeBanner>

      {statesResource.status === "error" && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={statesResource.reload}
              type="button"
            >
              Reintentar
            </button>
          }
          tone="warning"
        >
          No pudimos cargar los estados. Mostramos la información disponible.
        </NoticeBanner>
      )}

      <section
        aria-labelledby="ficha-ciudad"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Ficha de la ciudad</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ficha-ciudad"
        >
          Datos registrados
        </h2>

        <dl className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Nombre de la ciudad
            </dt>
            <dd className="mt-1.5 flex flex-wrap items-center gap-2 text-[14px] text-ink">
              {record.name}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Estado
            </dt>
            <dd className="mt-1.5 text-[14px] text-ink">
              {stateLoading ? (
                <span>Cargando estado…</span>
              ) : (
                <Link
                  className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  href={stateLinkHref}
                >
                  {stateName}
                </Link>
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Identificador
            </dt>
            <dd className="mt-1.5 font-mono text-[13px] text-ink">#{record.id}</dd>
          </div>
        </dl>

        <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          La ciudad pertenece a un estado geográfico. Proveedores y direcciones pueden usar este
          registro; no representa un estado de ítem del inventario.
        </p>
      </section>

      {canWrite && (
        <CityFormDialog
          cityRecord={record}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            cityResource.reload();
          }}
          open={editOpen}
          onRetryStates={statesResource.reload}
          states={states}
          statesError={statesError}
          statesLoading={statesResource.status === "loading" && states.length === 0}
        />
      )}

      <ConfirmDialog
        confirmLabel="Eliminar ciudad"
        description={
          <div className="space-y-2">
            <p>
              Estado: <span className="font-semibold text-ink">{stateName}</span>
            </p>
            <p>
              Si un proveedor usa esta ciudad, el API no permitirá eliminarla. Esta acción no se
              puede deshacer.
            </p>
          </div>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteCity(record.id);
          toast.success("Ciudad eliminada.");
          router.push("/app/ubicaciones");
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteOpen}
        title={`¿Eliminar la ciudad ${record.name}?`}
      />
    </div>
  );
}
