"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  FormErrorSummary,
  focusFirstInvalidField,
  useUnsavedChangesWarning,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  SectionFormFields,
  ShelfFormFields,
  validateSectionValues,
  validateShelfValues,
  type SectionFormValues,
  type ShelfFormValues,
} from "@/components/erp/records/shelf-form-fields";
import {
  mapSectionFieldErrors,
  mapShelfFieldErrors,
  sectionSummaryItems,
  shelfSummaryItems,
} from "@/components/erp/records/shelf-errors";
import {
  IMMUTABLE_PARENT_NOTICE,
  ShelfBreadcrumbs,
  shelfDetailHref,
  shelfListHref,
} from "@/components/erp/records/shelf-hierarchy";
import {
  createSection,
  createShelf,
  fetchShelf,
  type ShelfRecord,
} from "@/components/erp/records/shelves-api";
import {
  fetchWarehouse,
  type WarehouseRecord,
} from "@/components/erp/records/warehouses-api";
import { isPositiveRecordId, toApiId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const SHELF_COPY = {
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  forbidden: "No tienes permisos para crear estantes.",
  notFound: "No encontramos esta bodega. Puede que haya sido eliminada.",
  generic: "No pudimos guardar el estante. Revisa tu conexión e intenta de nuevo.",
} as const;

const SECTION_COPY = {
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  forbidden: "No tienes permisos para crear secciones.",
  notFound: "No encontramos el estante o la bodega. Puede que hayan sido eliminados.",
  generic: "No pudimos guardar la sección. Revisa tu conexión e intenta de nuevo.",
} as const;

function ParentCard({
  warehouse,
  shelf,
}: {
  warehouse: WarehouseRecord;
  shelf?: ShelfRecord;
}) {
  return (
    <div className="rounded-2xl border border-line bg-background p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        {shelf ? "Bodega y estante" : "Bodega"}
      </p>
      <p className="mt-1 text-[14px] font-semibold text-ink">{warehouse.name}</p>
      <p className="mt-1 text-[12px] leading-5 text-muted">{warehouse.address}</p>
      {shelf && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-muted">
          <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[12px] font-semibold text-brand">
            {shelf.code}
          </span>
          <span>{shelf.name || "Sin nombre"}</span>
        </p>
      )}
    </div>
  );
}

type ShelfFormPageProps = {
  warehouseId: string;
};

export function ShelfFormPage({ warehouseId }: ShelfFormPageProps) {
  const { user } = useSession();

  if (!canReadModule(user.role, "estantes")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de estantes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }
  if (!canWriteModule(user.role, "estantes")) {
    return (
      <AccessState description="Tu rol puede consultar estantes, pero no crear ni editarlos. Tu sesión sigue activa." />
    );
  }
  if (!isPositiveRecordId(warehouseId)) {
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

  return <ShelfFormContent warehouseId={warehouseId} />;
}

function ShelfFormContent({ warehouseId }: { warehouseId: string }) {
  const router = useRouter();
  const toast = useToast();
  const warehouseLoader = useCallback(
    () => fetchWarehouse(warehouseId),
    [warehouseId],
  );
  const warehouseResource = useAsyncResource(warehouseLoader);

  const [values, setValues] = useState<ShelfFormValues>({
    code: "",
    name: "",
    description: "",
  });
  const [initialValues, setInitialValues] = useState<ShelfFormValues>(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  function updateField(field: keyof ShelfFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateShelfValues(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);

    const name = values.name.trim();
    const description = values.description.trim();

    try {
      const saved = await createShelf({
        warehouse_id: toApiId(warehouseId),
        code: values.code.trim().toUpperCase(),
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
      });
      toast.success("Estante creado.");
      setInitialValues(values);
      router.push(
        saved?.id
          ? shelfDetailHref(warehouseId, saved.id)
          : shelfListHref(warehouseId),
      );
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          setMessage(SHELF_COPY.missingData);
        } else if (caught.status === 401) {
          setMessage(SHELF_COPY.session);
        } else if (caught.status === 403) {
          setMessage(SHELF_COPY.forbidden);
        } else if (caught.status === 404) {
          setMessage(SHELF_COPY.notFound);
        } else if (caught.status === 409) {
          setMessage(translateApiError(caught).message);
        } else if (caught.status === 422) {
          const mapped = mapShelfFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translateApiError(caught).message);
          }
        } else {
          setMessage(translateApiError(caught).message);
        }
      } else {
        setMessage(SHELF_COPY.generic);
      }
      setSubmitting(false);
    }
  }

  if (warehouseResource.status === "loading" || !warehouseResource.data) {
    if (warehouseResource.status === "error") {
      const notFound = warehouseResource.error?.kind === "not-found";
      return (
        <RecordsLoadError
          backHref="/app/bodegas"
          backLabel="Volver a bodegas"
          description={
            notFound
              ? "Puede que haya sido eliminada o que el enlace no sea válido."
              : warehouseResource.error?.message ?? "No pudimos cargar la bodega."
          }
          headingLevel="h1"
          onRetry={notFound ? undefined : warehouseResource.reload}
          title={notFound ? "No encontramos esta bodega" : "No pudimos cargar la bodega"}
        />
      );
    }
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href={shelfListHref(warehouseId)}
            >
              Volver a estantes
            </Link>
          }
          description="Registra un estante dentro de la bodega."
          eyebrow="Operación"
          title="Nuevo estante"
        />
        <RecordsFormSkeleton />
      </div>
    );
  }

  const warehouse = warehouseResource.data;
  const summaryItems = shelfSummaryItems(errors);

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href={shelfListHref(warehouse.id)}
          >
            Volver a estantes
          </Link>
        }
        description={`Registra un estante dentro de ${warehouse.name}.`}
        eyebrow="Operación"
        title="Nuevo estante"
      >
        <ShelfBreadcrumbs current="Nuevo estante" warehouse={warehouse} />
      </RecordsPageHeader>

      <NoticeBanner tone="info">{IMMUTABLE_PARENT_NOTICE}</NoticeBanner>

      <section
        aria-labelledby="datos-estante"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <div>
          <span className="eyebrow">Datos del estante</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="datos-estante"
          >
            Información del nuevo estante
          </h2>
        </div>

        <div className="mt-5">
          <ParentCard warehouse={warehouse} />
        </div>

        {message && (
          <NoticeBanner className="mt-5" role="alert" tone="danger">
            {message}
          </NoticeBanner>
        )}

        {showSummary && summaryItems.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        <form
          aria-labelledby="datos-estante"
          className="mt-6"
          noValidate
          onSubmit={handleSubmit}
        >
          <ShelfFormFields
            disabled={submitting}
            errors={errors}
            onChange={updateField}
            values={values}
          />

          <p className="mt-5 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
            El estante quedará en {warehouse.name}. La bodega no se puede cambiar
            después de crearlo.
          </p>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="button-base button-secondary min-h-11 px-5"
              href={shelfListHref(warehouse.id)}
            >
              Cancelar
            </Link>
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="sm:min-w-[180px]"
              type="submit"
            >
              Crear estante
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}

type SectionFormPageProps = {
  warehouseId: string;
  shelfId: string;
};

export function SectionFormPage({ warehouseId, shelfId }: SectionFormPageProps) {
  const { user } = useSession();

  if (!canReadModule(user.role, "estantes")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de estantes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }
  if (!canWriteModule(user.role, "estantes")) {
    return (
      <AccessState description="Tu rol puede consultar estantes y secciones, pero no crear ni editarlos. Tu sesión sigue activa." />
    );
  }
  if (!isPositiveRecordId(warehouseId) || !isPositiveRecordId(shelfId)) {
    return (
      <RecordsLoadError
        backHref="/app/bodegas"
        backLabel="Volver a bodegas"
        description="Puede que el enlace no sea válido o que el estante ya no exista."
        headingLevel="h1"
        title="No encontramos este estante"
      />
    );
  }

  return <SectionFormContent shelfId={shelfId} warehouseId={warehouseId} />;
}

function SectionFormContent({
  warehouseId,
  shelfId,
}: {
  warehouseId: string;
  shelfId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const warehouseLoader = useCallback(
    () => fetchWarehouse(warehouseId),
    [warehouseId],
  );
  const shelfLoader = useCallback(() => fetchShelf(shelfId), [shelfId]);
  const warehouseResource = useAsyncResource(warehouseLoader);
  const shelfResource = useAsyncResource(shelfLoader);

  const [values, setValues] = useState<SectionFormValues>({
    code: "",
    name: "",
    description: "",
  });
  const [initialValues, setInitialValues] = useState<SectionFormValues>(values);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  function updateField(field: keyof SectionFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validateSectionValues(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);

    const name = values.name.trim();
    const description = values.description.trim();

    try {
      await createSection(shelfId, {
        code: values.code.trim().toUpperCase(),
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
      });
      toast.success("Sección creada.");
      setInitialValues(values);
      router.push(shelfDetailHref(warehouseId, shelfId));
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          setMessage(SECTION_COPY.missingData);
        } else if (caught.status === 401) {
          setMessage(SECTION_COPY.session);
        } else if (caught.status === 403) {
          setMessage(SECTION_COPY.forbidden);
        } else if (caught.status === 404) {
          setMessage(SECTION_COPY.notFound);
        } else if (caught.status === 409) {
          setMessage(translateApiError(caught).message);
        } else if (caught.status === 422) {
          const mapped = mapSectionFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translateApiError(caught).message);
          }
        } else {
          setMessage(translateApiError(caught).message);
        }
      } else {
        setMessage(SECTION_COPY.generic);
      }
      setSubmitting(false);
    }
  }

  const loading =
    warehouseResource.status === "loading" || shelfResource.status === "loading";
  const loadError =
    warehouseResource.status === "error" ||
    shelfResource.status === "error" ||
    (!loading && (!warehouseResource.data || !shelfResource.data));

  if (loading || loadError) {
    if (loadError) {
      const warehouseNotFound = warehouseResource.error?.kind === "not-found";
      const shelfNotFound = shelfResource.error?.kind === "not-found";
      const notFound = warehouseNotFound || shelfNotFound;
      return (
        <div className="space-y-5">
          <RecordsPageHeader
            actions={
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={shelfListHref(warehouseId)}
              >
                Volver a estantes
              </Link>
            }
            description="Registra una sección dentro del estante."
            eyebrow="Operación"
            title="Nueva sección"
          />
          <RecordsLoadError
            backHref={shelfListHref(warehouseId)}
            backLabel="Volver a estantes"
            description={
              warehouseNotFound
                ? "Puede que la bodega haya sido eliminada o que el enlace no sea válido."
                : shelfNotFound
                  ? "Puede que el estante haya sido eliminado o que el enlace no sea válido."
                  : warehouseResource.error?.message ??
                    shelfResource.error?.message ??
                    "No pudimos cargar la jerarquía."
            }
            onRetry={
              notFound
                ? undefined
                : () => {
                    if (warehouseResource.status === "error") {
                      warehouseResource.reload();
                    }
                    if (shelfResource.status === "error") {
                      shelfResource.reload();
                    }
                  }
            }
            title={
              warehouseNotFound
                ? "No encontramos esta bodega"
                : shelfNotFound
                  ? "No encontramos este estante"
                  : "No pudimos cargar la jerarquía"
            }
          />
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href={shelfListHref(warehouseId)}
            >
              Volver a estantes
            </Link>
          }
          description="Registra una sección dentro del estante."
          eyebrow="Operación"
          title="Nueva sección"
        />
        <RecordsFormSkeleton />
      </div>
    );
  }

  const warehouse = warehouseResource.data;
  const shelf = shelfResource.data;

  if (!warehouse || !shelf) {
    return (
      <RecordsLoadError
        backHref={shelfListHref(warehouseId)}
        backLabel="Volver a estantes"
        description="No pudimos cargar la jerarquía de la bodega."
        headingLevel="h1"
        title="No pudimos cargar la jerarquía"
      />
    );
  }

  if (String(shelf.warehouse_id) !== String(warehouse.id)) {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          description="Registra una sección dentro del estante."
          eyebrow="Operación"
          title="Nueva sección"
        />
        <RecordsLoadError
          backHref={shelfListHref(warehouse.id)}
          backLabel="Volver a estantes"
          description="Este estante pertenece a otra bodega. Abre la jerarquía correcta para crear la sección."
          headingLevel="h2"
          title="Este estante no pertenece a esta bodega"
        />
      </div>
    );
  }

  const summaryItems = sectionSummaryItems(errors);
  const detailHref = shelfDetailHref(warehouse.id, shelf.id);

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href={detailHref}
          >
            Volver al estante
          </Link>
        }
        description={`Registra una sección dentro del estante ${shelf.code} de ${warehouse.name}.`}
        eyebrow="Operación"
        title="Nueva sección"
      >
        <ShelfBreadcrumbs
          current="Nueva sección"
          shelfCode={shelf.code}
          shelfId={shelf.id}
          warehouse={warehouse}
        />
      </RecordsPageHeader>

      <NoticeBanner tone="info">{IMMUTABLE_PARENT_NOTICE}</NoticeBanner>

      <section
        aria-labelledby="datos-seccion"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <div>
          <span className="eyebrow">Datos de la sección</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="datos-seccion"
          >
            Información de la nueva sección
          </h2>
        </div>

        <div className="mt-5">
          <ParentCard shelf={shelf} warehouse={warehouse} />
        </div>

        {message && (
          <NoticeBanner className="mt-5" role="alert" tone="danger">
            {message}
          </NoticeBanner>
        )}

        {showSummary && summaryItems.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        <form
          aria-labelledby="datos-seccion"
          className="mt-6"
          noValidate
          onSubmit={handleSubmit}
        >
          <SectionFormFields
            disabled={submitting}
            errors={errors}
            onChange={updateField}
            values={values}
          />

          <p className="mt-5 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
            La sección quedará en el estante {shelf.code}. El estante no se puede
            cambiar después de crearla.
          </p>

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="button-base button-secondary min-h-11 px-5"
              href={detailHref}
            >
              Cancelar
            </Link>
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="sm:min-w-[180px]"
              type="submit"
            >
              Crear sección
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
