"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
} from "react";
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
import {
  TextAreaField,
  TextField,
} from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  WAREHOUSE_FIELD_IDS,
  mapWarehouseFieldErrors,
  warehouseSummaryItems,
  type WarehouseFieldKey,
} from "@/components/erp/records/warehouse-errors";
import {
  createWarehouse,
  fetchWarehouse,
  updateWarehouse,
  type WarehouseInput,
} from "@/components/erp/records/warehouses-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type WarehouseFormValues = {
  name: string;
  address: string;
  observations: string;
};

const EMPTY_VALUES: WarehouseFormValues = {
  name: "",
  address: "",
  observations: "",
};

const COPY = {
  nameRequired: "Ingresa el nombre de la bodega.",
  addressRequired: "Ingresa la dirección de la bodega.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  forbidden: "No tienes permisos para guardar bodegas.",
  notFound: "No encontramos esta bodega. Puede que haya sido eliminada.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic:
    "No pudimos guardar la bodega. Revisa tu conexión e intenta de nuevo.",
} as const;

type WarehouseFormPageProps = {
  mode: "create" | "edit";
  warehouseId?: string;
};

export function WarehouseFormPage({ mode, warehouseId }: WarehouseFormPageProps) {
  const { user } = useSession();
  if (!canReadModule(user.role, "bodegas")) {
    return <AccessState />;
  }
  if (!canWriteModule(user.role, "bodegas")) {
    return (
      <AccessState description="Tu rol puede consultar bodegas, pero no crearlas ni editarlas. Tu sesión sigue activa." />
    );
  }
  if (mode === "edit" && !isPositiveRecordId(warehouseId)) {
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
  return <WarehouseFormContent mode={mode} warehouseId={warehouseId} />;
}

function WarehouseFormContent({ mode, warehouseId }: WarehouseFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const loader = useCallback(
    () => fetchWarehouse(warehouseId ?? ""),
    [warehouseId],
  );
  const resource = useAsyncResource(loader, { enabled: editing });

  const [values, setValues] = useState<WarehouseFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] =
    useState<WarehouseFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const warehouse = resource.data;

  if (warehouse) {
    const key = String(warehouse.id);
    if (initializedFor !== key) {
      const next: WarehouseFormValues = {
        name: warehouse.name,
        address: warehouse.address,
        observations: warehouse.observations,
      };
      setValues(next);
      setInitialValues(next);
      setInitializedFor(key);
    }
  }

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  function clearFieldError(field: WarehouseFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: WarehouseFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    clearFieldError(field);
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = COPY.nameRequired;
    if (!values.address.trim()) next.address = COPY.addressRequired;
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate();
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

    const observations = values.observations.trim();
    const payload: WarehouseInput = {
      name: values.name.trim(),
      address: values.address.trim(),
      observations: observations ? observations : null,
    };

    try {
      const saved = editing
        ? await updateWarehouse(warehouseId ?? "", payload)
        : await createWarehouse(payload);
      toast.success(editing ? "Cambios guardados." : "Bodega creada.");
      setInitialValues(values);
      const targetId = saved?.id ?? warehouseId;
      router.push(targetId ? `/app/bodegas/${targetId}` : "/app/bodegas");
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          setMessage(COPY.missingData);
        } else if (caught.status === 401) {
          setMessage(COPY.session);
        } else if (caught.status === 403) {
          setMessage(COPY.forbidden);
        } else if (caught.status === 404) {
          setMessage(COPY.notFound);
        } else if (caught.status === 422) {
          const mapped = mapWarehouseFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(COPY.validation);
          }
        } else {
          setMessage(translateApiError(caught).message);
        }
      } else {
        setMessage(COPY.generic);
      }
      setSubmitting(false);
    }
  }

  const headerTitle = editing ? "Editar bodega" : "Nueva bodega";
  const backHref =
    editing && warehouseId ? `/app/bodegas/${warehouseId}` : "/app/bodegas";
  const backLabel = editing ? "Volver al detalle" : "Volver a bodegas";

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href={backHref}
        >
          {backLabel}
        </Link>
      }
      description={
        editing
          ? "Actualiza el nombre, la dirección y las observaciones de la bodega."
          : "Registra una bodega con su nombre, dirección y observaciones opcionales."
      }
      eyebrow="Operación"
      title={headerTitle}
    />
  );

  if (editing && resource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && resource.status === "error") {
    const notFound = resource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/bodegas"
          backLabel="Volver a bodegas"
          description={
            notFound
              ? "Puede que haya sido eliminada o que el enlace no sea válido."
              : resource.error?.message ?? "No pudimos cargar la bodega."
          }
          onRetry={notFound ? undefined : resource.reload}
          title={
            notFound
              ? "No encontramos esta bodega"
              : "No pudimos cargar la bodega"
          }
        />
      </div>
    );
  }

  const summaryItems = warehouseSummaryItems(errors);

  return (
    <div className="space-y-5">
      {header}

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div>
          <span className="eyebrow">Datos de la bodega</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="datos-bodega"
          >
            {editing
              ? "Información registrada"
              : "Información de la nueva bodega"}
          </h2>
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
          aria-labelledby="datos-bodega"
          className="mt-6 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <TextField
            autoComplete="organization"
            disabled={submitting}
            error={errors.name}
            help="Obligatorio. El nombre no es único: puede repetirse en otra bodega."
            id={WAREHOUSE_FIELD_IDS.name}
            label="Nombre de la bodega"
            onChange={(value) => updateField("name", value)}
            placeholder="Ej. Bodega Central"
            required
            value={values.name}
          />

          <TextAreaField
            disabled={submitting}
            error={errors.address}
            help="Obligatoria. Referencia textual de la ubicación de la bodega."
            id={WAREHOUSE_FIELD_IDS.address}
            label="Dirección"
            onChange={(value) => updateField("address", value)}
            placeholder="Ej. Av. Monseñor Rivero 123"
            required
            rows={3}
            value={values.address}
          />

          <TextAreaField
            disabled={submitting}
            error={errors.observations}
            help={
              editing
                ? "Opcional. Déjala vacía para quitarla de la bodega."
                : "Opcional."
            }
            id={WAREHOUSE_FIELD_IDS.observations}
            label="Observaciones"
            onChange={(value) => updateField("observations", value)}
            placeholder="Ej. Horario de 8 a 18"
            rows={4}
            value={values.observations}
          />

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="button-base button-secondary min-h-11 px-5"
              href={backHref}
            >
              Cancelar
            </Link>
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="sm:min-w-[180px]"
              type="submit"
            >
              {editing ? "Guardar cambios" : "Crear bodega"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
