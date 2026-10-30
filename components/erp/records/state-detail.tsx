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
import { CityResults } from "@/components/erp/records/city-results";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordActionButton } from "@/components/erp/records/record-actions";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
  RecordsTableSkeleton,
} from "@/components/erp/records/record-states";
import { StateFormDialog } from "@/components/erp/records/state-form-dialog";
import {
  deleteState,
  fetchCities,
  fetchState,
  type CityRecord,
} from "@/components/erp/records/locations-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { canWriteModule } from "@/lib/permissions";
import { formatInteger } from "@/lib/format";

type StateDetailPageProps = {
  stateId: string;
};

const EMPTY_CITIES: CityRecord[] = [];

export function StateDetailPage({ stateId }: StateDetailPageProps) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const canWrite = canWriteModule(user.role, "catalogo");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const validId = isPositiveRecordId(stateId);
  const stateLoader = useCallback(() => fetchState(stateId), [stateId]);
  const stateResource = useAsyncResource(stateLoader, { enabled: validId });
  const citiesLoader = useCallback(() => fetchCities(stateId), [stateId]);
  const citiesResource = useAsyncResource(citiesLoader, {
    enabled: validId && Boolean(stateResource.data),
  });

  if (!validId) {
    return (
      <RecordsLoadError
        backHref="/app/ubicaciones"
        backLabel="Volver a ubicaciones"
        description="Puede que el enlace no sea válido o que el estado ya no exista."
        headingLevel="h1"
        title="No encontramos este estado"
      />
    );
  }

  if (stateResource.status === "loading") {
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
          description="Consulta el estado geográfico y sus ciudades."
          eyebrow="Catálogo"
          title="Detalle del estado"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (stateResource.status === "error" || !stateResource.data) {
    const notFound = stateResource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/ubicaciones"
        backLabel="Volver a ubicaciones"
        description={
          notFound
            ? "Puede que haya sido eliminado o que el enlace no sea válido."
            : stateResource.error?.message ?? "No pudimos cargar el estado."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : stateResource.reload}
        title={notFound ? "No encontramos este estado" : "No pudimos cargar el estado"}
      />
    );
  }

  const state = stateResource.data;
  const cities = citiesResource.data ?? EMPTY_CITIES;
  const citiesCountLabel =
    citiesResource.status === "loading" || citiesResource.status === "idle"
      ? "Cargando conteo…"
      : citiesResource.status === "error" && citiesResource.data === null
        ? "No disponible"
        : cities.length === 1
          ? "1 ciudad"
          : `${formatInteger(cities.length)} ciudades`;
  const citiesLoading =
    (citiesResource.status === "loading" || citiesResource.status === "idle") &&
    citiesResource.data === null;
  const citiesFailed = citiesResource.status === "error" && citiesResource.data === null;

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
                Editar estado
                <Icon name="arrow-right" size={17} />
              </button>
              <RecordActionButton danger onClick={() => setDeleteOpen(true)}>
                Eliminar estado
              </RecordActionButton>
            </>
          ) : undefined
        }
        description={`Código ${state.code}`}
        eyebrow="Catálogo"
        title={state.name}
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

      <section
        aria-labelledby="ciudades-del-estado"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Ciudades</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="ciudades-del-estado"
            >
              Ciudades de {state.name}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">
              El conteo proviene de las ciudades registradas para este estado.
            </p>
          </div>
          <span
            aria-live="polite"
            className="rounded-full bg-soft-blue px-3 py-1.5 text-[11px] font-semibold text-brand"
          >
            {citiesCountLabel}
          </span>
        </div>

        <div className="mt-5">
          {citiesLoading && (
            <RecordsTableSkeleton columns={3} label="Cargando ciudades del estado…" />
          )}

          {citiesFailed && (
            <RecordsLoadError
              backHref={null}
              description={citiesResource.error?.message ?? "No pudimos cargar las ciudades."}
              headingLevel="h2"
              onRetry={citiesResource.reload}
              title="No pudimos cargar las ciudades del estado"
            />
          )}

          {!citiesLoading && !citiesFailed && (
            <div className="space-y-3">
              {citiesResource.status === "refreshing" && (
                <div aria-hidden="true" className="reload-bar" />
              )}
              {citiesResource.status === "error" && (
                <NoticeBanner
                  action={
                    <button
                      className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                      onClick={citiesResource.reload}
                      type="button"
                    >
                      Reintentar
                    </button>
                  }
                  tone="warning"
                >
                  {citiesResource.error?.message ??
                    "No pudimos actualizar las ciudades. Mostramos los datos disponibles."}
                </NoticeBanner>
              )}
              <CityResults
                canWrite={false}
                cities={cities}
                emptyDescription="Este estado todavía no tiene ciudades."
                onDelete={() => undefined}
                onEdit={() => undefined}
                stateFilterActive
                states={[state]}
              />
            </div>
          )}
        </div>
      </section>

      <StateFormDialog
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          stateResource.reload();
          citiesResource.reload();
        }}
        open={editOpen}
        stateRecord={state}
      />

      <ConfirmDialog
        confirmLabel="Eliminar estado"
        description={
          <div className="space-y-2">
            <p>
              Código: <span className="font-semibold text-ink">{state.code}</span>
            </p>
            <p>
              Si el estado tiene ciudades, el API no permitirá eliminarlo. Esta acción no se
              puede deshacer.
            </p>
          </div>
        }
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await deleteState(state.id);
          toast.success("Estado eliminado.");
          router.push("/app/ubicaciones");
        }}
        onError={(error) => toast.error(error.message)}
        open={deleteOpen}
        title={`¿Eliminar el estado ${state.name}?`}
      />
    </div>
  );
}
