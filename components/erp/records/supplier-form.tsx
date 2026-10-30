"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
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
  SUPPLIER_FIELD_IDS,
  SUPPLIER_LOCATION_MESSAGE,
  mapSupplierFieldErrors,
  supplierHasLocationConflict,
  supplierSummaryItems,
  type SupplierFieldKey,
} from "@/components/erp/records/supplier-errors";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  createSupplier,
  fetchSupplier,
  updateSupplier,
  type SupplierInput,
} from "@/components/erp/records/suppliers-api";
import {
  fetchCities,
  fetchStates,
  type CityRecord,
} from "@/components/erp/records/locations-api";
import { isPositiveRecordId, toApiId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { canWriteModule } from "@/lib/permissions";

type SupplierFormValues = {
  name: string;
  identification: string;
  email: string;
  phone: string;
  address: string;
  observations: string;
  state_id: string;
  city_id: string;
};

const EMPTY_VALUES: SupplierFormValues = {
  name: "",
  identification: "",
  email: "",
  phone: "",
  address: "",
  observations: "",
  state_id: "",
  city_id: "",
};

const NAME_MAX_LENGTH = 150;
const IDENTIFICATION_MIN_LENGTH = 5;
const IDENTIFICATION_MAX_LENGTH = 30;
const EMAIL_MAX_LENGTH = 150;
const PHONE_MIN_LENGTH = 7;
const PHONE_MAX_LENGTH = 30;
const ADDRESS_MIN_LENGTH = 5;
const ADDRESS_MAX_LENGTH = 255;
const OBSERVATIONS_MAX_LENGTH = 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IDENTIFICATION_PATTERN = /^[A-Z0-9.-]+$/;
const PHONE_PATTERN = /^[0-9+()\s-]+$/;

const COPY = {
  nameRequired: "Ingresa el nombre del proveedor.",
  nameLength: "El nombre debe tener entre 2 y 150 caracteres.",
  identificationRequired: "Ingresa la identificación del proveedor.",
  identificationLength: "La identificación debe tener entre 5 y 30 caracteres.",
  identificationCharacters:
    "Usa letras de la A a la Z, sin acentos, números, puntos y guiones.",
  emailRequired: "Ingresa el correo del proveedor.",
  emailInvalid: "Ingresa un correo válido.",
  phoneRequired: "Ingresa el teléfono del proveedor.",
  phoneLength: "El teléfono debe tener entre 7 y 30 caracteres.",
  phoneCharacters: "Usa solo números, espacios y los signos + ( ) -.",
  addressRequired: "Ingresa la dirección del proveedor.",
  addressLength: "La dirección debe tener entre 5 y 255 caracteres.",
  observationsLength: "Las observaciones no pueden superar los 1000 caracteres.",
  stateRequired: "Selecciona un estado.",
  cityRequired: "Selecciona una ciudad.",
  cityMismatch: SUPPLIER_LOCATION_MESSAGE,
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  duplicate: "Ya existe un proveedor con esa identificación.",
  forbidden: "No tienes permisos para guardar proveedores.",
  notFound: "No encontramos este proveedor. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic:
    "No pudimos guardar el proveedor. Revisa tu conexión e intenta de nuevo.",
  statesError: "No pudimos cargar los estados.",
  citiesError: "No pudimos cargar las ciudades.",
} as const;

type SupplierFormPageProps = {
  mode: "create" | "edit";
  supplierId?: string;
};

export function SupplierFormPage({ mode, supplierId }: SupplierFormPageProps) {
  const { user } = useSession();
  if (!canWriteModule(user.role, "catalogo")) return <AccessState />;
  if (mode === "edit" && !isPositiveRecordId(supplierId)) {
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
  return <SupplierFormContent mode={mode} supplierId={supplierId} />;
}

function SupplierFormContent({ mode, supplierId }: SupplierFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const supplierLoader = useCallback(
    () => fetchSupplier(supplierId ?? ""),
    [supplierId],
  );
  const supplierResource = useAsyncResource(supplierLoader, {
    enabled: editing,
  });
  const statesResource = useAsyncResource(fetchStates);

  const [values, setValues] = useState<SupplierFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] =
    useState<SupplierFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cities, setCities] = useState<CityRecord[]>([]);
  const [citiesStatus, setCitiesStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [citiesError, setCitiesError] = useState<string | null>(null);
  const [citiesAttempt, setCitiesAttempt] = useState(0);

  const supplier = supplierResource.data;
  const states = statesResource.data ?? [];
  const statesLoading = statesResource.status === "loading";
  const statesReady =
    statesResource.data !== null &&
    statesResource.status !== "error" &&
    states.length > 0;
  const citiesLoading =
    Boolean(values.state_id) &&
    (citiesStatus === "loading" || citiesStatus === "idle");
  const citiesReady = !values.state_id || citiesStatus === "ready";

  if (supplier) {
    const key = String(supplier.id);
    if (initializedFor !== key) {
      const next: SupplierFormValues = {
        name: supplier.name,
        identification: supplier.identification.toUpperCase(),
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        observations: supplier.observations,
        state_id: String(supplier.state_id),
        city_id: String(supplier.city_id),
      };
      setValues(next);
      setInitialValues(next);
      setInitializedFor(key);
    }
  }

  useEffect(() => {
    if (!values.state_id) return;

    let active = true;

    fetchCities(values.state_id)
      .then((data) => {
        if (!active) return;
        setCities(data);
        setCitiesStatus("ready");
      })
      .catch((caught) => {
        if (!active) return;
        setCities([]);
        setCitiesStatus("error");
        setCitiesError(translateApiError(caught).message);
      });

    return () => {
      active = false;
    };
  }, [citiesAttempt, values.state_id]);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  const selectedState = states.find(
    (state) => String(state.id) === values.state_id,
  );
  const selectedStateName =
    selectedState?.name ?? `Estado #${values.state_id}`;
  const stateOptions = states.map((state) => ({
    value: String(state.id),
    label: `${state.name} · ${state.code}`,
  }));
  const cityOptions = cities.map((city) => ({
    value: String(city.id),
    label: city.name,
  }));

  function clearFieldError(field: SupplierFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: SupplierFieldKey, value: string) {
    setValues((current) => ({
      ...current,
      [field]: field === "identification" ? value.toUpperCase() : value,
    }));
    setMessage(null);
    clearFieldError(field);
  }

  function handleStateChange(value: string) {
    setValues((current) => ({
      ...current,
      state_id: value,
      city_id: "",
    }));
    setCities([]);
    setCitiesStatus(value ? "loading" : "idle");
    setCitiesError(null);
    setMessage(null);
    clearFieldError("state_id");
    clearFieldError("city_id");
  }

  function retryCities() {
    setCitiesStatus("loading");
    setCitiesError(null);
    setCitiesAttempt((current) => current + 1);
  }

  function handleCityChange(value: string) {
    setValues((current) => ({ ...current, city_id: value }));
    setMessage(null);
    clearFieldError("city_id");
  }

  function validate() {
    const next: Record<string, string> = {};
    const name = values.name.trim();
    const identification = values.identification.trim();
    const email = values.email.trim();
    const phone = values.phone.trim();
    const address = values.address.trim();

    if (!name) next.name = COPY.nameRequired;
    else if (name.length < 2 || name.length > NAME_MAX_LENGTH) {
      next.name = COPY.nameLength;
    }

    if (!identification) next.identification = COPY.identificationRequired;
    else if (
      identification.length < IDENTIFICATION_MIN_LENGTH ||
      identification.length > IDENTIFICATION_MAX_LENGTH
    ) {
      next.identification = COPY.identificationLength;
    } else if (!IDENTIFICATION_PATTERN.test(identification)) {
      next.identification = COPY.identificationCharacters;
    }

    if (!email) next.email = COPY.emailRequired;
    else if (
      email.length > EMAIL_MAX_LENGTH ||
      !EMAIL_PATTERN.test(email)
    ) {
      next.email = COPY.emailInvalid;
    }

    if (!phone) next.phone = COPY.phoneRequired;
    else if (
      phone.length < PHONE_MIN_LENGTH ||
      phone.length > PHONE_MAX_LENGTH
    ) {
      next.phone = COPY.phoneLength;
    } else if (!PHONE_PATTERN.test(phone)) {
      next.phone = COPY.phoneCharacters;
    }

    if (!address) next.address = COPY.addressRequired;
    else if (
      address.length < ADDRESS_MIN_LENGTH ||
      address.length > ADDRESS_MAX_LENGTH
    ) {
      next.address = COPY.addressLength;
    }

    if (values.observations.trim().length > OBSERVATIONS_MAX_LENGTH) {
      next.observations = COPY.observationsLength;
    }

    if (!values.state_id) next.state_id = COPY.stateRequired;
    if (!values.city_id) next.city_id = COPY.cityRequired;
    else if (values.state_id && citiesStatus === "ready") {
      const city = cities.find(
        (item) => String(item.id) === values.city_id,
      );
      if (!city || String(city.state_id) !== values.state_id) {
        next.city_id = COPY.cityMismatch;
      }
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !selectorsReady) return;

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

    const identification = values.identification.trim().toUpperCase();
    const observations = values.observations.trim();
    const payload: SupplierInput = {
      name: values.name.trim(),
      identification,
      email: values.email.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      observations: observations || null,
      state_id: toApiId(values.state_id),
      city_id: toApiId(values.city_id),
    };

    try {
      const saved = editing
        ? await updateSupplier(supplierId ?? "", payload)
        : await createSupplier(payload);
      toast.success(editing ? "Cambios guardados." : "Proveedor creado.");
      setInitialValues({ ...values, identification });
      const targetId = saved?.id ?? supplierId;
      router.push(
        targetId ? `/app/proveedores/${targetId}` : "/app/proveedores",
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
          setErrors({ identification: COPY.duplicate });
          setShowSummary(true);
          setMessage(COPY.duplicate);
          window.requestAnimationFrame(() => focusFirstInvalidField());
        } else if (caught.status === 422) {
          const mapped = mapSupplierFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            setMessage(
              supplierHasLocationConflict(caught)
                ? SUPPLIER_LOCATION_MESSAGE
                : null,
            );
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

  const headerTitle = editing ? "Editar proveedor" : "Nuevo proveedor";
  const backHref =
    editing && supplierId
      ? `/app/proveedores/${supplierId}`
      : "/app/proveedores";
  const backLabel = editing ? "Volver al detalle" : "Volver a proveedores";

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
          ? "Actualiza los datos de contacto y la ubicación del proveedor."
          : "Registra los datos de contacto y la ubicación del proveedor."
      }
      eyebrow="Catálogo"
      title={headerTitle}
    />
  );

  if (editing && supplierResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && supplierResource.status === "error") {
    const notFound = supplierResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/proveedores"
          backLabel="Volver a proveedores"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : supplierResource.error?.message ??
                "No pudimos cargar el proveedor."
          }
          onRetry={notFound ? undefined : supplierResource.reload}
          title={
            notFound
              ? "No encontramos este proveedor"
              : "No pudimos cargar el proveedor"
          }
        />
      </div>
    );
  }

  const summaryItems = supplierSummaryItems(errors);
  const statesError =
    statesResource.status === "error"
      ? statesResource.error?.message ?? COPY.statesError
      : null;
  const citiesLoadError =
    citiesStatus === "error" ? citiesError ?? COPY.citiesError : null;
  const locationPreserved =
    editing &&
    Boolean(initialValues.state_id) &&
    Boolean(initialValues.city_id) &&
    values.state_id === initialValues.state_id &&
    values.city_id === initialValues.city_id;
  const selectorsReady = (statesReady && citiesReady) || locationPreserved;
  const locationFallbackActive =
    locationPreserved && Boolean(statesError || citiesLoadError);

  return (
    <div className="space-y-5">
      {header}

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Datos del proveedor</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-proveedor"
            >
              {editing ? "Información registrada" : "Información del nuevo proveedor"}
            </h2>
          </div>
          <span className="rounded-full bg-soft-blue px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
            Escritura habilitada
          </span>
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
          aria-labelledby="datos-proveedor"
          className="mt-6 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <TextField
              autoComplete="organization"
              disabled={submitting}
              error={errors.name}
              help={`Obligatorio. Entre 2 y ${NAME_MAX_LENGTH} caracteres.`}
              id={SUPPLIER_FIELD_IDS.name}
              label="Nombre"
              maxLength={NAME_MAX_LENGTH}
              onChange={(value) => updateField("name", value)}
              placeholder="Ej. Distribuidora La Salud C.A."
              required
              value={values.name}
            />

            <TextField
              disabled={submitting}
              error={errors.identification}
              help={`Obligatoria. Entre ${IDENTIFICATION_MIN_LENGTH} y ${IDENTIFICATION_MAX_LENGTH} caracteres. Se guarda en mayúsculas; usa letras de la A a la Z, sin acentos, números, puntos y guiones.`}
              id={SUPPLIER_FIELD_IDS.identification}
              label="Identificación"
              maxLength={IDENTIFICATION_MAX_LENGTH}
              onChange={(value) => updateField("identification", value)}
              placeholder="Ej. J-12345678-9"
              required
              value={values.identification}
            />

            <TextField
              autoComplete="email"
              disabled={submitting}
              error={errors.email}
              help="Obligatorio. Puede repetirse en otros proveedores."
              id={SUPPLIER_FIELD_IDS.email}
              label="Correo"
              maxLength={EMAIL_MAX_LENGTH}
              onChange={(value) => updateField("email", value)}
              placeholder="Ej. ventas@lasalud.com"
              required
              value={values.email}
            />

            <TextField
              autoComplete="tel"
              disabled={submitting}
              error={errors.phone}
              help={`Obligatorio. Entre ${PHONE_MIN_LENGTH} y ${PHONE_MAX_LENGTH} caracteres.`}
              id={SUPPLIER_FIELD_IDS.phone}
              label="Teléfono"
              maxLength={PHONE_MAX_LENGTH}
              onChange={(value) => updateField("phone", value)}
              placeholder="Ej. +58 212 555-1234"
              required
              value={values.phone}
            />

            <div className="lg:col-span-2">
              <TextField
                autoComplete="street-address"
                disabled={submitting}
                error={errors.address}
                help={`Obligatoria. Entre ${ADDRESS_MIN_LENGTH} y ${ADDRESS_MAX_LENGTH} caracteres.`}
                id={SUPPLIER_FIELD_IDS.address}
                label="Dirección"
                maxLength={ADDRESS_MAX_LENGTH}
                onChange={(value) => updateField("address", value)}
                placeholder="Ej. Av. Principal, Galpón 4"
                required
                value={values.address}
              />
            </div>

            <SelectField
              disabled={submitting}
              emptyLabel="No hay estados configurados."
              error={errors.state_id}
              help="El estado geográfico al que pertenece la ciudad."
              id={SUPPLIER_FIELD_IDS.state_id}
              label="Estado"
              loadError={statesError}
              loading={statesLoading}
              loadingLabel="Cargando estados…"
              onChange={handleStateChange}
              onRetry={statesResource.reload}
              options={stateOptions}
              placeholder="Selecciona un estado"
              required
              value={values.state_id}
            />

            <div>
              <SelectField
                disabled={submitting || !values.state_id}
                emptyLabel={
                  values.state_id
                    ? "No hay ciudades para este estado."
                    : "Selecciona primero un estado."
                }
                error={errors.city_id}
                help="La ciudad debe pertenecer al estado seleccionado."
                id={SUPPLIER_FIELD_IDS.city_id}
                label="Ciudad"
                loadError={citiesLoadError}
                loading={citiesLoading}
                loadingLabel="Cargando ciudades…"
                onChange={handleCityChange}
                onRetry={retryCities}
                options={cityOptions}
                placeholder="Selecciona una ciudad"
                required
                value={values.city_id}
              />
              <p aria-live="polite" className="sr-only">
                {!values.state_id
                  ? "Selecciona un estado para cargar las ciudades."
                  : citiesStatus === "loading"
                    ? "Cargando las ciudades del estado seleccionado."
                    : citiesStatus === "error"
                      ? "No pudimos cargar las ciudades del estado seleccionado."
                      : citiesStatus === "ready"
                        ? `Ciudades actualizadas para ${selectedStateName}.`
                        : ""}
              </p>
            </div>

            <div className="lg:col-span-2">
              <TextAreaField
                disabled={submitting}
                error={errors.observations}
                help={`Opcional. ${values.observations.length} de ${OBSERVATIONS_MAX_LENGTH} caracteres.`}
                id={SUPPLIER_FIELD_IDS.observations}
                label="Observaciones"
                maxLength={OBSERVATIONS_MAX_LENGTH}
                onChange={(value) => updateField("observations", value)}
                placeholder="Condiciones de entrega, horarios u otra información útil."
                rows={5}
                value={values.observations}
              />
            </div>
          </div>

          {locationFallbackActive && (
            <NoticeBanner tone="info">
              No pudimos cargar todas las ubicaciones. Puedes guardar los
              cambios de contacto conservando el estado y la ciudad actuales
              del proveedor.
            </NoticeBanner>
          )}

          {!statesLoading && !statesError && states.length === 0 && (
            <NoticeBanner tone="warning">
              No hay estados configurados. Un usuario con permiso de catálogo
              debe cargar las ubicaciones antes de registrar proveedores.{" "}
              <Link
                className="font-semibold text-brand underline underline-offset-4 hover:text-ink"
                href="/app/ubicaciones"
              >
                Ir a ubicaciones
              </Link>
            </NoticeBanner>
          )}

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
              disabled={!selectorsReady}
              type="submit"
            >
              {editing ? "Guardar cambios" : "Crear proveedor"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
