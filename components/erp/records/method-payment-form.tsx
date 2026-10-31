"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { BusyButton } from "@/components/erp/ui/action-button";
import {
  focusFirstInvalidField,
  FormErrorSummary,
  type FormErrorItem,
  useUnsavedChangesWarning,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import {
  buildDetailErrors,
  buildDetailsPayload,
  detailFieldId,
  LABEL_MAX_LENGTH,
  mapMethodPaymentFieldErrors,
  METHOD_PAYMENT_COPY,
  METHOD_PAYMENT_FIELD_IDS,
  methodPaymentErrorMessage,
  summaryItemsFor,
  validateLabel,
  type DetailValues,
} from "@/components/erp/records/method-payment-errors";
import {
  createMethodPayment,
  fetchMethodPayment,
  updateMethodPayment,
  type MethodPayment,
  type MethodPaymentDetails,
} from "@/components/erp/records/method-payments-api";
import {
  fetchMethodPaymentTypes,
  findMethodPaymentType,
  type MethodPaymentType,
} from "@/components/erp/records/method-payment-types-api";
import {
  MethodActiveSwitch,
  MethodPaymentDetailFields,
} from "@/components/erp/records/method-payment-fields";
import { fetchCurrencies, type Currency } from "@/lib/finance/currencies-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { canWriteModule } from "@/lib/permissions";

const NO_TYPES: MethodPaymentType[] = [];
const NO_CURRENCIES: Currency[] = [];

type MethodPaymentFormPageProps = {
  mode: "create" | "edit";
  methodId?: string;
};

export function MethodPaymentFormPage({
  mode,
  methodId,
}: MethodPaymentFormPageProps) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  if (!canWriteModule(user.role, "metodos_pago")) {
    return activityVisible ? (
      <AccessState description="Solo la administración puede crear o editar métodos de pago. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }
  if (mode === "edit" && !isPositiveRecordId(methodId)) {
    return activityVisible ? (
      <RecordsLoadError
        backHref="/app/metodos-pago"
        backLabel="Volver a métodos de pago"
        description="Puede que el enlace no sea válido o que el método ya no exista."
        headingLevel="h1"
        title="No encontramos este método de pago"
      />
    ) : null;
  }
  return <MethodPaymentFormContent mode={mode} methodId={methodId} />;
}

function detailsToValues(details: MethodPaymentDetails): DetailValues {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [
      key,
      typeof value === "boolean" ? value : String(value),
    ]),
  );
}

function defaultValuesFor(fields: MethodPaymentType["fields"]): DetailValues {
  const values: DetailValues = {};
  for (const field of fields) {
    values[field.key] = field.type === "boolean" ? false : "";
  }
  return values;
}

function FormHeader({
  editing,
  method,
}: {
  editing: boolean;
  method?: MethodPayment | null;
}) {
  return (
    <RecordsPageHeader
      description={
        editing
          ? "Actualiza la etiqueta, los datos de cobro y el estado del método. El tipo de método no se puede cambiar."
          : "Registra los datos de cobro según el tipo de método elegido. La moneda se hereda del tipo."
      }
      eyebrow="Finanzas"
      title={
        editing
          ? `Editar ${method?.label ?? "método de pago"}`
          : "Nuevo método de pago"
      }
    />
  );
}

function MethodPaymentFormContent({
  mode,
  methodId,
}: MethodPaymentFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const activityVisible = useActivityVisible();

  const methodLoader = useCallback(
    () => fetchMethodPayment(methodId ?? ""),
    [methodId],
  );
  const methodResource = useAsyncResource(methodLoader, { enabled: editing });
  const typesResource = useAsyncResource(fetchMethodPaymentTypes);
  const currenciesResource = useAsyncResource(() => fetchCurrencies(), {
    enabled: !editing,
  });

  const [typeId, setTypeId] = useState("");
  const [label, setLabel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [values, setValues] = useState<DetailValues>({});
  const [initialSnapshot, setInitialSnapshot] = useState("");
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const shouldResetOnHideRef = useRef(false);

  const method = methodResource.data;
  const types = typesResource.data ?? NO_TYPES;
  const currencies = currenciesResource.data ?? NO_CURRENCIES;

  const selectedType = findMethodPaymentType(types, typeId || null);
  const fields = useMemo(
    () => selectedType?.fields ?? [],
    [selectedType],
  );

  const typeOptions = useMemo(() => {
    if (currenciesResource.status !== "ready") return [];
    const activeCurrencyIds = new Set(currencies.map((item) => String(item.id)));
    return types
      .filter(
        (type) =>
          type.is_active &&
          type.currency !== null &&
          type.currency_id !== null &&
          activeCurrencyIds.has(String(type.currency_id)),
      )
      .map((type) => ({
        value: String(type.id),
        label: `${type.code} — ${type.name}`,
      }));
  }, [currencies, currenciesResource.status, types]);

  const initKey = editing
    ? method
      ? `edit:${method.id}`
      : null
    : `create:${typeId}`;

  if (initKey && initializedFor !== initKey) {
    if (editing && method) {
      setTypeId(
        method.method_payment_type_id !== null
          ? String(method.method_payment_type_id)
          : "",
      );
      setLabel(method.label);
      setIsActive(method.is_active);
      setValues(detailsToValues(method.details));
      setInitialSnapshot(
        JSON.stringify({
          typeId:
            method.method_payment_type_id !== null
              ? String(method.method_payment_type_id)
              : "",
          label: method.label,
          isActive: method.is_active,
          values: detailsToValues(method.details),
        }),
      );
    } else if (!editing) {
      const nextValues = selectedType
        ? defaultValuesFor(selectedType.fields)
        : {};
      setValues(nextValues);
      setInitialSnapshot(
        JSON.stringify({
          typeId,
          label: "",
          isActive: true,
          values: nextValues,
        }),
      );
    }
    setInitializedFor(initKey);
  }

  const fieldLabels = useMemo(() => {
    const labels: Record<string, string> = {
      [METHOD_PAYMENT_FIELD_IDS.method_payment_type_id]: "Tipo de método",
      [METHOD_PAYMENT_FIELD_IDS.label]: "Etiqueta",
      [METHOD_PAYMENT_FIELD_IDS.is_active]: "Estado del método",
    };
    for (const field of fields) {
      labels[detailFieldId(field.key)] = field.label;
    }
    return labels;
  }, [fields]);

  const localErrors = useMemo(() => {
    const errors: Record<string, string> = {};
    if (!editing && !selectedType) {
      errors[METHOD_PAYMENT_FIELD_IDS.method_payment_type_id] =
        METHOD_PAYMENT_COPY.typeRequired;
    }
    const labelError = validateLabel(label);
    if (labelError) errors[METHOD_PAYMENT_FIELD_IDS.label] = labelError;
    for (const [key, message] of Object.entries(
      buildDetailErrors(fields, values),
    )) {
      errors[detailFieldId(key)] = message;
    }
    return errors;
  }, [editing, fields, label, selectedType, values]);

  const visibleErrors = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [fieldId, message] of Object.entries(localErrors)) {
      if (touched[fieldId]) result[fieldId] = message;
    }
    for (const [fieldId, message] of Object.entries(serverErrors)) {
      result[fieldId] = message;
    }
    return result;
  }, [localErrors, serverErrors, touched]);

  const summaryErrors: FormErrorItem[] = useMemo(() => {
    const touchedErrors = Object.fromEntries(
      Object.entries(localErrors).filter(([fieldId]) => touched[fieldId]),
    );
    return [
      ...summaryItemsFor(touchedErrors, fieldLabels),
      ...summaryItemsFor(serverErrors, fieldLabels),
    ];
  }, [fieldLabels, localErrors, serverErrors, touched]);

  const snapshot = JSON.stringify({ typeId, label, isActive, values });
  const dirty = initializedFor !== null && snapshot !== initialSnapshot;
  useUnsavedChangesWarning(dirty && !busy);

  useLayoutEffect(() => {
    return () => {
      if (!shouldResetOnHideRef.current) return;
      shouldResetOnHideRef.current = false;
      setTypeId("");
      setLabel("");
      setIsActive(true);
      setValues({});
      setTouched({});
      setSubmitError(null);
      setServerErrors({});
      setInitializedFor(null);
      setInitialSnapshot("");
    };
  }, []);

  if (!activityVisible) return null;

  const currency = selectedType?.currency ?? method?.currency ?? null;

  if (editing && methodResource.status === "loading") {
    return (
      <div className="space-y-5">
        <FormHeader editing={editing} />
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && methodResource.status === "error") {
    return (
      <RecordsLoadError
        backHref="/app/metodos-pago"
        backLabel="Volver a métodos de pago"
        description={
          methodResource.error?.status === 404
            ? METHOD_PAYMENT_COPY.notFound
            : methodResource.error?.message ?? METHOD_PAYMENT_COPY.notFound
        }
        headingLevel="h1"
        title="No pudimos cargar el método de pago"
      />
    );
  }

  if (editing && !method) return null;

  if (typesResource.status === "error") {
    return (
      <RecordsLoadError
        backHref="/app/metodos-pago"
        backLabel="Volver a métodos de pago"
        description="No pudimos cargar los tipos de pago para construir el formulario."
        headingLevel="h1"
        onRetry={typesResource.reload}
        title="No pudimos cargar los tipos de pago"
      />
    );
  }

  function clearServerError(fieldId: string) {
    setServerErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  }

  function updateDetail(key: string, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
    clearServerError(detailFieldId(key));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (typesResource.status !== "ready") return;
    setSubmitError(null);
    setServerErrors({});

    const errorEntries = Object.entries(localErrors);
    if (errorEntries.length > 0) {
      setTouched(Object.fromEntries(errorEntries.map(([fieldId]) => [fieldId, true])));
      setTimeout(() => focusFirstInvalidField(), 0);
      return;
    }

    const payloadDetails = buildDetailsPayload(
      fields,
      values,
      editing && method ? method.details : undefined,
    );
    const reactivating =
      editing && method !== null && !method.is_active && isActive;

    setBusy(true);
    try {
      if (editing && method) {
        await updateMethodPayment(String(method.id), {
          label: label.trim(),
          details: payloadDetails,
          is_active: isActive,
        });
        toast.success(METHOD_PAYMENT_COPY.saved);
        router.push(`/app/metodos-pago/${method.id}`);
      } else if (selectedType) {
        const created = await createMethodPayment({
          method_payment_type_id: selectedType.id,
          label: label.trim(),
          details: payloadDetails,
          is_active: isActive,
        });
        toast.success(METHOD_PAYMENT_COPY.created);
        shouldResetOnHideRef.current = true;
        router.push(`/app/metodos-pago/${created.id}`);
      }
    } catch (caught) {
      setSubmitError(methodPaymentErrorMessage(caught, { reactivating }));
      const mapped = mapMethodPaymentFieldErrors(caught, fields);
      if (Object.keys(mapped).length > 0) setServerErrors(mapped);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <FormHeader editing={editing} method={method} />

      <form
        className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="space-y-6">
          {submitError && (
            <div
              className="rounded-2xl border border-alert/25 bg-alert/[0.06] px-4 py-3.5"
              role="alert"
              tabIndex={-1}
            >
              <p className="text-[13px] font-semibold text-alert-ink">
                {submitError}
              </p>
            </div>
          )}

          <FormErrorSummary errors={summaryErrors} />

          {editing && method ? (
            <div className="rounded-xl border border-line bg-background p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                Tipo de método
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">
                {method.method_payment_type
                  ? `${method.method_payment_type.code} — ${method.method_payment_type.name}`
                  : selectedType
                    ? `${selectedType.code} — ${selectedType.name}`
                    : "—"}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-muted">
                {METHOD_PAYMENT_COPY.typeImmutable}
              </p>
            </div>
          ) : (
            <SelectField
              error={
                visibleErrors[METHOD_PAYMENT_FIELD_IDS.method_payment_type_id]
              }
              help="Obligatorio. Solo se ofrecen tipos activos con moneda activa."
              id={METHOD_PAYMENT_FIELD_IDS.method_payment_type_id}
              label="Tipo de método"
              loading={
                typesResource.status === "loading" ||
                currenciesResource.status === "loading"
              }
              loadingLabel={METHOD_PAYMENT_COPY.loadingTypes}
              loadError={
                currenciesResource.status === "error"
                  ? "No pudimos cargar las monedas."
                  : null
              }
              onChange={(value) => setTypeId(value)}
              onRetry={() => {
                typesResource.reload();
                currenciesResource.reload();
              }}
              options={typeOptions}
              placeholder="Selecciona un tipo de método"
              required
              value={typeId}
            />
          )}

          <TextField
            error={visibleErrors[METHOD_PAYMENT_FIELD_IDS.label]}
            help={METHOD_PAYMENT_COPY.labelHelp}
            id={METHOD_PAYMENT_FIELD_IDS.label}
            label="Etiqueta"
            maxLength={LABEL_MAX_LENGTH}
            onBlur={() =>
              setTouched((current) => ({
                ...current,
                [METHOD_PAYMENT_FIELD_IDS.label]: true,
              }))
            }
            onChange={(value) => {
              setLabel(value);
              clearServerError(METHOD_PAYMENT_FIELD_IDS.label);
            }}
            placeholder="Ej. PayPal Farmamed"
            required
            value={label}
          />

          {(editing || selectedType) && (
            <TextField
              help={METHOD_PAYMENT_COPY.inheritedCurrency}
              id="metodo-moneda"
              label="Moneda"
              mono
              onChange={() => undefined}
              readOnly
              value={
                currency
                  ? `${currency.code} — ${currency.name}${
                      currency.symbol ? ` (${currency.symbol})` : ""
                    }`
                  : "—"
              }
            />
          )}

          {selectedType && (
            <section aria-labelledby="metodo-datos-titulo" className="space-y-5">
              <div>
                <h2
                  className="text-[15px] font-semibold tracking-[-0.01em] text-ink"
                  id="metodo-datos-titulo"
                >
                  Datos del método
                </h2>
                <div className="mt-3">
                  <NoticeBanner tone="warning">
                    {METHOD_PAYMENT_COPY.privacy}
                  </NoticeBanner>
                </div>
              </div>

              {fields.length === 0 ? (
                <p className="text-[13px] leading-6 text-muted">
                  {METHOD_PAYMENT_COPY.typeNoFields}
                </p>
              ) : (
                <MethodPaymentDetailFields
                  disabled={busy}
                  errors={visibleErrors}
                  fields={fields}
                  onBlur={(key) =>
                    setTouched((current) => ({
                      ...current,
                      [detailFieldId(key)]: true,
                    }))
                  }
                  onChange={updateDetail}
                  values={values}
                />
              )}
            </section>
          )}

          {editing && method && !method.is_active && (
            <NoticeBanner tone="warning">
              {METHOD_PAYMENT_COPY.inactiveNotice}
            </NoticeBanner>
          )}

          <MethodActiveSwitch
            checked={isActive}
            disabled={busy}
            error={visibleErrors[METHOD_PAYMENT_FIELD_IDS.is_active]}
            id={METHOD_PAYMENT_FIELD_IDS.is_active}
            onChange={setIsActive}
          />
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            className="button-base button-secondary min-h-11 px-6 text-center"
            href={
              editing && method
                ? `/app/metodos-pago/${method.id}`
                : "/app/metodos-pago"
            }
          >
            Cancelar
          </Link>
          <BusyButton
            busy={busy}
            busyLabel="Guardando…"
            className="min-h-11 px-6"
            disabled={typesResource.status !== "ready"}
            type="submit"
          >
            {editing ? "Guardar cambios" : "Crear método"}
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
