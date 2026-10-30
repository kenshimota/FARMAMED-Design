"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
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
  CUSTOMER_FIELD_IDS,
  customerSummaryItems,
  mapCustomerFieldErrors,
  type CustomerFieldKey,
} from "@/components/erp/records/customer-errors";
import { CustomerLocationPicker } from "@/components/erp/records/customer-map";
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
  createCustomer,
  fetchCustomer,
  LONGITUDE_RANGE,
  LATITUDE_RANGE,
  updateCustomer,
  type CustomerInput,
} from "@/components/erp/records/customers-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatCoordinate } from "@/lib/format";

type CustomerFormValues = {
  fullName: string;
  email: string;
  direction: string;
  latitude: string;
  longitude: string;
};

const EMPTY_VALUES: CustomerFormValues = {
  fullName: "",
  email: "",
  direction: "",
  latitude: "",
  longitude: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const COPY = {
  nameRequired: "Ingresa el nombre completo del cliente.",
  emailRequired: "Ingresa el correo del cliente.",
  emailInvalid: "Ingresa un correo válido.",
  directionRequired: "Ingresa la dirección del cliente.",
  latitudeRequired: "Ingresa la latitud del cliente.",
  latitudeInvalid: "Usa un número entre -90 y 90.",
  longitudeRequired: "Ingresa la longitud del cliente.",
  longitudeInvalid: "Usa un número entre -180 y 180.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe un cliente con ese correo.",
  forbidden: "No tienes permisos para guardar clientes.",
  notFound: "No encontramos este cliente. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic:
    "No pudimos guardar el cliente. Revisa tu conexión e intenta de nuevo.",
  geoDenied:
    "No pudimos obtener tu ubicación. Escribe las coordenadas o haz clic en el mapa.",
  geoSuccess: "Ubicación aproximada aplicada. Ajusta el punto si es necesario.",
} as const;

function parseCoordinateText(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function coordinateInputValue(value: number) {
  return String(Number(value.toFixed(7)));
}

function coordinateText(value: number | null) {
  return value === null ? null : formatCoordinate(value);
}

function subscribeToNothing() {
  return () => {};
}

function readGeolocationAvailability() {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

type CustomerFormPageProps = {
  mode: "create" | "edit";
  customerId?: string;
};

export function CustomerFormPage({ mode, customerId }: CustomerFormPageProps) {
  const { user } = useSession();
  if (!canReadModule(user.role, "clientes")) {
    return <AccessState />;
  }
  if (!canWriteModule(user.role, "clientes")) {
    return (
      <AccessState description="Tu rol puede consultar clientes, pero no crearlos ni editarlos. Tu sesión sigue activa." />
    );
  }
  if (mode === "edit" && !isPositiveRecordId(customerId)) {
    return (
      <RecordsLoadError
        backHref="/app/clientes"
        backLabel="Volver a clientes"
        description="Puede que el enlace no sea válido o que el cliente ya no exista."
        headingLevel="h1"
        title="No encontramos este cliente"
      />
    );
  }
  return <CustomerFormContent mode={mode} customerId={customerId} />;
}

function CustomerFormContent({ mode, customerId }: CustomerFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const customerLoader = useCallback(
    () => fetchCustomer(customerId ?? ""),
    [customerId],
  );
  const customerResource = useAsyncResource(customerLoader, {
    enabled: editing,
  });

  const [values, setValues] = useState<CustomerFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] =
    useState<CustomerFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const geoAvailable = useSyncExternalStore(
    subscribeToNothing,
    readGeolocationAvailability,
    () => false,
  );

  const customer = customerResource.data;

  if (customer) {
    const key = String(customer.id);
    if (initializedFor !== key) {
      const next: CustomerFormValues = {
        fullName: customer.fullName,
        email: customer.email,
        direction: customer.direction,
        latitude:
          customer.latitude === null ? "" : coordinateInputValue(customer.latitude),
        longitude:
          customer.longitude === null
            ? ""
            : coordinateInputValue(customer.longitude),
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

  const latitudeValue = parseCoordinateText(values.latitude);
  const longitudeValue = parseCoordinateText(values.longitude);

  function clearFieldError(field: CustomerFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: CustomerFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setGeoMessage(null);
    clearFieldError(field);
  }

  function handleMapPick(latitude: number, longitude: number) {
    setValues((current) => ({
      ...current,
      latitude: coordinateInputValue(latitude),
      longitude: coordinateInputValue(longitude),
    }));
    setMessage(null);
    setGeoMessage(null);
    clearFieldError("latitude");
    clearFieldError("longitude");
  }

  function requestMyLocation() {
    if (!geoAvailable || geoBusy) return;
    setGeoBusy(true);
    setGeoMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoBusy(false);
        handleMapPick(
          Number(position.coords.latitude.toFixed(7)),
          Number(position.coords.longitude.toFixed(7)),
        );
        setGeoMessage(COPY.geoSuccess);
      },
      () => {
        setGeoBusy(false);
        setGeoMessage(COPY.geoDenied);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  function validate() {
    const next: Record<string, string> = {};
    const fullName = values.fullName.trim();
    const email = values.email.trim();
    const direction = values.direction.trim();

    if (!fullName) next.fullName = COPY.nameRequired;

    if (!email) next.email = COPY.emailRequired;
    else if (!EMAIL_PATTERN.test(email)) next.email = COPY.emailInvalid;

    if (!direction) next.direction = COPY.directionRequired;

    if (!values.latitude.trim()) next.latitude = COPY.latitudeRequired;
    else if (
      latitudeValue === null ||
      latitudeValue < LATITUDE_RANGE.min ||
      latitudeValue > LATITUDE_RANGE.max
    ) {
      next.latitude = COPY.latitudeInvalid;
    }

    if (!values.longitude.trim()) next.longitude = COPY.longitudeRequired;
    else if (
      longitudeValue === null ||
      longitudeValue < LONGITUDE_RANGE.min ||
      longitudeValue > LONGITUDE_RANGE.max
    ) {
      next.longitude = COPY.longitudeInvalid;
    }

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

    if (latitudeValue === null || longitudeValue === null) return;

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);

    const payload: CustomerInput = {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      direction: values.direction.trim(),
      latitude: latitudeValue,
      longitude: longitudeValue,
    };

    try {
      const saved = editing
        ? await updateCustomer(customerId ?? "", payload)
        : await createCustomer(payload);
      toast.success(editing ? "Cambios guardados." : "Cliente creado.");
      setInitialValues(values);
      const targetId = saved?.id ?? customerId;
      router.push(
        targetId ? `/app/clientes/${targetId}` : "/app/clientes",
      );
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
        } else if (caught.status === 409) {
          setErrors({ email: COPY.duplicate });
          setShowSummary(true);
          setMessage(null);
          window.requestAnimationFrame(() => focusFirstInvalidField());
        } else if (caught.status === 422) {
          const mapped = mapCustomerFieldErrors(caught);
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

  const headerTitle = editing ? "Editar cliente" : "Nuevo cliente";
  const backHref =
    editing && customerId ? `/app/clientes/${customerId}` : "/app/clientes";
  const backLabel = editing ? "Volver al detalle" : "Volver a clientes";

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
          ? "Actualiza los datos de contacto y la ubicación del cliente."
          : "Registra un cliente con su correo, dirección y ubicación."
      }
      eyebrow="Operación"
      title={headerTitle}
    />
  );

  if (editing && customerResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && customerResource.status === "error") {
    const notFound = customerResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/clientes"
          backLabel="Volver a clientes"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : customerResource.error?.message ??
                "No pudimos cargar el cliente."
          }
          onRetry={notFound ? undefined : customerResource.reload}
          title={
            notFound
              ? "No encontramos este cliente"
              : "No pudimos cargar el cliente"
          }
        />
      </div>
    );
  }

  const summaryItems = customerSummaryItems(errors);
  const latitudeBadge = coordinateText(latitudeValue);
  const longitudeBadge = coordinateText(longitudeValue);

  return (
    <div className="space-y-5">
      {header}

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Datos del cliente</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-cliente"
            >
              {editing
                ? "Información registrada"
                : "Información del nuevo cliente"}
            </h2>
          </div>
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
          aria-labelledby="datos-cliente"
          className="mt-6 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <TextField
              autoComplete="name"
              disabled={submitting}
              error={errors.fullName}
              help="Obligatorio. Nombre o razón social del cliente."
              id={CUSTOMER_FIELD_IDS.fullName}
              label="Nombre completo"
              onChange={(value) => updateField("fullName", value)}
              placeholder="Ej. María Pérez"
              required
              value={values.fullName}
            />

            <TextField
              autoComplete="email"
              disabled={submitting}
              error={errors.email}
              help="Obligatorio. El correo no se puede repetir en otro cliente."
              id={CUSTOMER_FIELD_IDS.email}
              label="Correo"
              onChange={(value) => updateField("email", value)}
              placeholder="Ej. maria@correo.com"
              required
              value={values.email}
            />

            <div className="lg:col-span-2">
              <TextAreaField
                disabled={submitting}
                error={errors.direction}
                help="Obligatoria. Referencia textual de la dirección del cliente."
                id={CUSTOMER_FIELD_IDS.direction}
                label="Dirección"
                onChange={(value) => updateField("direction", value)}
                placeholder="Ej. Av. Principal, edificio 4, oficina 2"
                required
                rows={3}
                value={values.direction}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <TextField
              disabled={submitting}
              error={errors.latitude}
              help="Obligatoria en esta versión. Entre -90 y 90; se completa al hacer clic en el mapa."
              id={CUSTOMER_FIELD_IDS.latitude}
              inputMode="decimal"
              label="Latitud"
              onChange={(value) => updateField("latitude", value)}
              placeholder="Ej. 10.4806"
              required
              value={values.latitude}
            />

            <TextField
              disabled={submitting}
              error={errors.longitude}
              help="Obligatoria en esta versión. Entre -180 y 180; se completa al hacer clic en el mapa."
              id={CUSTOMER_FIELD_IDS.longitude}
              inputMode="decimal"
              label="Longitud"
              onChange={(value) => updateField("longitude", value)}
              placeholder="Ej. -66.9036"
              required
              value={values.longitude}
            />
          </div>

          <div className="rounded-2xl border border-line bg-background/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[13px] font-semibold text-ink">
                  Ubicación en el mapa
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-muted">
                  Haz clic en el mapa para ajustar la ubicación. También puedes
                  escribir la latitud y la longitud manualmente.
                </p>
              </div>
              {geoAvailable && (
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-ink/15 bg-surface px-4 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={submitting || geoBusy}
                  onClick={requestMyLocation}
                  type="button"
                >
                  <Icon name="map-pin" size={16} />
                  {geoBusy ? "Obteniendo ubicación…" : "Usar mi ubicación"}
                </button>
              )}
            </div>

            {geoMessage && (
              <p
                className="mt-3 rounded-xl border border-brand/15 bg-soft-blue px-3 py-2 text-[12px] leading-5 text-ink"
                role="status"
              >
                {geoMessage}
              </p>
            )}

            <div className="mt-4 h-[300px] sm:h-[360px]">
              <CustomerLocationPicker
                latitude={latitudeValue}
                longitude={longitudeValue}
                onPick={handleMapPick}
              />
            </div>

            <p className="mt-3 text-[12px] text-muted">
              {latitudeBadge && longitudeBadge
                ? `Coordenadas actuales: latitud ${latitudeBadge}, longitud ${longitudeBadge}.`
                : "Aún no hay coordenadas. Haz clic en el mapa o escríbelas."}
            </p>
          </div>

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
              {editing ? "Guardar cambios" : "Crear cliente"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
