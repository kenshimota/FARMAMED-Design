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
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import {
  FormErrorSummary,
  focusFirstInvalidField,
  useUnsavedChangesWarning,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  COST_FIELD_IDS,
  costSummaryItems,
  mapCostFieldErrors,
  type CostFieldKey,
} from "@/components/erp/records/cost-errors";
import {
  createCost,
  fetchCost,
  fetchCostsByProduct,
  updateCost,
  type CostCurrency,
  type CostInput,
  type CostRecord,
} from "@/components/erp/records/costs-api";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  fetchProducts,
  isPositiveRecordId,
  toApiId,
} from "@/components/erp/records/records-api";
import { fetchItemStates } from "@/components/erp/records/item-states-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { CURRENCY_NOT_CONFIGURED_DETAIL } from "@/lib/feedback";
import { canWriteModule } from "@/lib/permissions";

type CostFormValues = {
  product_id: string;
  item_state_id: string;
  cost: string;
  currency_id: string;
};

type DuplicateNotice = {
  cost: CostRecord | null;
  productId: string;
};

const EMPTY_VALUES: CostFormValues = {
  product_id: "",
  item_state_id: "",
  cost: "",
  currency_id: "",
};

const PREFERRED_CURRENCY_KEY = "farmamed.costos.moneda";
const COST_PATTERN = /^\d{1,9}([.,]\d{1,2})?$/;
const MAX_COST = 999999999.99;

const COPY = {
  productRequired: "Selecciona un producto.",
  stateRequired: "Selecciona un estado de ítem.",
  costRequired: "Ingresa el costo.",
  costFormat:
    "Usa un número mayor o igual a 0, con máximo 2 decimales y 9 dígitos enteros.",
  currencyInvalid: "Selecciona una moneda válida.",
  duplicate: "Ya existe un costo para ese producto y estado.",
  duplicateDetail: "Ya existe un costo para ese producto y estado.",
  duplicateHelp:
    "Puedes actualizar el costo existente en lugar de registrar uno nuevo.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  forbidden: "No tienes permisos para guardar costos.",
  notFound: "No encontramos este costo. Puede que haya sido eliminado.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  validation: "Revisa los datos del formulario.",
  generic:
    "No pudimos guardar el costo. Revisa tu conexión e intenta de nuevo.",
  productsError: "No pudimos cargar los productos.",
  statesError: "No pudimos cargar los estados de ítem.",
  currenciesError: "No pudimos cargar las monedas.",
} as const;

function parseCostValue(value: string) {
  const trimmed = value.trim();
  if (!COST_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_COST) return null;
  return parsed;
}

function formatCostInput(value: number | null) {
  if (value === null) return "";
  return new Intl.NumberFormat("es-VE", {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function readPreferredCurrency() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(PREFERRED_CURRENCY_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function subscribePreferredCurrency() {
  return () => {};
}

function rememberPreferredCurrency(value: string) {
  if (!value || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERRED_CURRENCY_KEY, value);
  } catch {
    return;
  }
}

type CostFormPageProps = {
  mode: "create" | "edit";
  costId?: string;
  initialProductId?: string;
};

export function CostFormPage({
  mode,
  costId,
  initialProductId,
}: CostFormPageProps) {
  const { user } = useSession();
  if (!canWriteModule(user.role, "costos")) return <AccessState />;
  if (mode === "edit" && !isPositiveRecordId(costId)) {
    return (
      <RecordsLoadError
        backHref="/app/costos"
        backLabel="Volver a costos"
        description="Puede que el enlace no sea válido o que el costo ya no exista."
        headingLevel="h1"
        title="No encontramos este costo"
      />
    );
  }
  return (
    <CostFormContent
      costId={costId}
      initialProductId={initialProductId}
      mode={mode}
    />
  );
}

function CostFormContent({ mode, costId, initialProductId }: CostFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const currencyStatus = useCurrencyStatusContext();

  const costLoader = useCallback(() => fetchCost(costId ?? ""), [costId]);
  const costResource = useAsyncResource(costLoader, { enabled: editing });
  const productsResource = useAsyncResource(fetchProducts);
  const itemStatesResource = useAsyncResource(fetchItemStates);

  const [values, setValues] = useState<CostFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] =
    useState<CostFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<DuplicateNotice | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [preferredCurrencyApplied, setPreferredCurrencyApplied] = useState(false);
  const [initialProductApplied, setInitialProductApplied] = useState(false);
  const preferredCurrencyId = useSyncExternalStore(
    subscribePreferredCurrency,
    readPreferredCurrency,
    () => "",
  );

  const cost = costResource.data;
  const products = productsResource.data ?? [];
  const itemStates = itemStatesResource.data ?? [];
  const currencies = currencyStatus?.currencies ?? [];
  const defaultCurrency = currencyStatus?.defaultCurrency ?? null;
  const defaultCurrencyCode = defaultCurrency?.code.trim() || "USD_BCV";
  const currencyLoading =
    currencyStatus?.status === "loading" || currencyStatus?.status === "idle";
  const currencyError =
    currencyStatus?.status === "error"
      ? currencyStatus.errorMessage ?? COPY.currenciesError
      : null;

  if (cost) {
    const key = String(cost.id);
    if (initializedFor !== key) {
      const currencyId =
        cost.currency_id !== null
          ? String(cost.currency_id)
          : cost.currency
            ? String(cost.currency.id)
            : "";
      const next: CostFormValues = {
        product_id: String(cost.product_id),
        item_state_id: String(cost.item_state_id),
        cost: formatCostInput(cost.cost),
        currency_id: currencyId,
      };
      setValues(next);
      setInitialValues(next);
      setInitializedFor(key);
    }
  }

  if (
    !editing &&
    !initialProductApplied &&
    productsResource.data !== null
  ) {
    setInitialProductApplied(true);
    const exists = products.some(
      (product) => String(product.id) === initialProductId,
    );
    if (initialProductId && exists) {
      setValues((current) =>
        current.product_id
          ? current
          : { ...current, product_id: initialProductId },
      );
      setInitialValues((current) => ({
        ...current,
        product_id: initialProductId,
      }));
    }
  }

  if (!editing && !preferredCurrencyApplied && !currencyLoading) {
    setPreferredCurrencyApplied(true);
    const exists = currencies.some(
      (currency) => currency.id !== null && String(currency.id) === preferredCurrencyId,
    );
    if (preferredCurrencyId && exists) {
      setValues((current) =>
        current.currency_id
          ? current
          : { ...current, currency_id: preferredCurrencyId },
      );
      setInitialValues((current) => ({
        ...current,
        currency_id: preferredCurrencyId,
      }));
    }
  }

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  function clearFieldError(field: CostFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: CostFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setDuplicateNotice(null);
    clearFieldError(field);
  }

  function findCurrency(currencyId: string): CostCurrency | null {
    if (!currencyId) return null;
    const currency = currencies.find(
      (item) => item.id !== null && String(item.id) === currencyId,
    );
    if (currency && currency.id !== null) {
      return {
        id: currency.id,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      };
    }
    if (cost?.currency && String(cost.currency.id) === currencyId) {
      return cost.currency;
    }
    return null;
  }

  function findDuplicate(currentCosts: CostRecord[]) {
    return (
      currentCosts.find(
        (item) =>
          String(item.item_state_id) === values.item_state_id &&
          (!editing || String(item.id) !== String(costId)),
      ) ?? null
    );
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!values.product_id) next.product_id = COPY.productRequired;
    if (!values.item_state_id) next.item_state_id = COPY.stateRequired;

    if (!values.cost.trim()) {
      next.cost = COPY.costRequired;
    } else if (parseCostValue(values.cost) === null) {
      next.cost = COPY.costFormat;
    }

    if (values.currency_id && !findCurrency(values.currency_id)) {
      next.currency_id = COPY.currencyInvalid;
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

    const parsedCost = parseCostValue(values.cost);
    if (parsedCost === null) {
      setErrors({ cost: COPY.costFormat });
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);
    setDuplicateNotice(null);

    let existing: CostRecord | null = null;
    try {
      const productCosts = await fetchCostsByProduct(toApiId(values.product_id));
      existing = findDuplicate(productCosts);
    } catch {
      existing = null;
    }

    if (existing) {
      setErrors({ item_state_id: COPY.duplicate });
      setShowSummary(true);
      setDuplicateNotice({ cost: existing, productId: values.product_id });
      setMessage(COPY.duplicateDetail);
      setSubmitting(false);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    const currencyChanged = values.currency_id !== initialValues.currency_id;
    const payload: CostInput = {
      product_id: toApiId(values.product_id),
      item_state_id: toApiId(values.item_state_id),
      cost: parsedCost,
      ...(values.currency_id && (!editing || currencyChanged)
        ? { currency_id: toApiId(values.currency_id) }
        : {}),
    };

    try {
      if (editing && costId) {
        await updateCost(costId, payload);
        toast.success("Cambios guardados.");
      } else {
        await createCost(payload);
        toast.success("Costo creado.");
      }

      const remembered =
        values.currency_id ||
        (editing && initialValues.currency_id
          ? initialValues.currency_id
          : defaultCurrency?.id !== null && defaultCurrency?.id !== undefined
            ? String(defaultCurrency.id)
            : "");
      rememberPreferredCurrency(remembered);

      setInitialValues(values);
      router.push("/app/costos");
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
          const normalized = caught.message.trim().toLowerCase();
          if (normalized.includes("already exists")) {
            setErrors({ item_state_id: COPY.duplicate });
            setShowSummary(true);
            setMessage(COPY.duplicateDetail);

            let found: CostRecord | null = null;
            try {
              const productCosts = await fetchCostsByProduct(
                toApiId(values.product_id),
              );
              found = findDuplicate(productCosts);
            } catch {
              found = null;
            }

            setDuplicateNotice({
              cost: found,
              productId: values.product_id,
            });
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translateApiError(caught).message);
          }
        } else if (caught.status === 422) {
          const mapped = mapCostFieldErrors(caught);
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(COPY.validation);
          }
        } else if (caught.status === 503) {
          setMessage(CURRENCY_NOT_CONFIGURED_DETAIL);
        } else {
          setMessage(translateApiError(caught).message);
        }
      } else {
        setMessage(COPY.generic);
      }
      setSubmitting(false);
    }
  }

  const headerTitle = editing ? "Editar costo" : "Nuevo costo";
  const headerDescription = editing
    ? "Actualiza el costo vigente de un producto para un estado de ítem. Cambiar la moneda conserva el monto."
    : "Registra el costo vigente de un producto para un estado de ítem.";

  const headerActions = (
    <>
      {editing && cost && (
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href={`/app/costos/producto/${cost.product_id}`}
        >
          Costos del producto
        </Link>
      )}
      <Link
        className="button-base button-secondary min-h-11 px-5 text-[13px]"
        href="/app/costos"
      >
        Volver a costos
      </Link>
    </>
  );

  const header = (
    <RecordsPageHeader
      actions={headerActions}
      description={headerDescription}
      eyebrow="Inventario"
      title={headerTitle}
    />
  );

  if (editing && costResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && costResource.status === "error") {
    const notFound = costResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/costos"
          backLabel="Volver a costos"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : costResource.error?.message ?? "No pudimos cargar el costo."
          }
          onRetry={notFound ? undefined : costResource.reload}
          title={
            notFound ? "No encontramos este costo" : "No pudimos cargar el costo"
          }
        />
      </div>
    );
  }

  const productOptions = products.map((product) => ({
    value: String(product.id),
    label: `${product.name} (${product.reference})`,
  }));
  const itemStateOptions = itemStates.map((itemState) => ({
    value: String(itemState.id),
    label: itemState.label,
  }));

  const currencyOptions = currencies
    .filter((currency) => currency.id !== null)
    .map((currency) => ({
      value: String(currency.id),
      label: `${currency.code} — ${currency.name}`,
    }));

  if (
    cost?.currency &&
    !currencyOptions.some((option) => option.value === String(cost.currency?.id))
  ) {
    currencyOptions.unshift({
      value: String(cost.currency.id),
      label: `${cost.currency.code} — ${cost.currency.name} (moneda actual)`,
    });
  }

  const selectedCurrency = findCurrency(values.currency_id);
  const currentCurrency = editing
    ? findCurrency(initialValues.currency_id)
    : null;
  let currencyPreview: string;
  if (selectedCurrency) {
    currencyPreview = editing
      ? `Se guardará el mismo monto en ${selectedCurrency.code} — ${selectedCurrency.name}.`
      : `Se guardará en ${selectedCurrency.code} — ${selectedCurrency.name}.`;
  } else if (editing) {
    currencyPreview = currentCurrency
      ? `Se mantendrá la moneda actual: ${currentCurrency.code} — ${currentCurrency.name}.`
      : "No se cambiará la moneda registrada.";
  } else if (defaultCurrency) {
    currencyPreview = `Se guardará en ${defaultCurrency.code} — ${defaultCurrency.name}, la moneda por defecto.`;
  } else if (currencyLoading) {
    currencyPreview = "Consultando la moneda por defecto…";
  } else if (currencyError) {
    currencyPreview =
      "No pudimos cargar las monedas. Reintenta la consulta para conocer la moneda por defecto antes de guardar.";
  } else {
    currencyPreview =
      "No hay una moneda por defecto configurada. Contacta a un administrador antes de guardar el costo.";
  }

  const currencyPlaceholder = editing
    ? currentCurrency
      ? `Mantener moneda actual (${currentCurrency.code})`
      : "Mantener la moneda actual"
    : `Moneda por defecto (${defaultCurrencyCode})`;

  const summaryItems = costSummaryItems(errors);

  return (
    <div className="space-y-5">
      {header}

      <CurrencyNoticeBanner />

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Datos del costo</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-costo"
            >
              {editing ? "Información registrada" : "Información del nuevo costo"}
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

        {duplicateNotice && (
          <NoticeBanner
            action={
              <Link
                className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                href={
                  duplicateNotice.cost
                    ? `/app/costos/${duplicateNotice.cost.id}/editar`
                    : `/app/costos/producto/${duplicateNotice.productId}`
                }
              >
                Editar el costo existente
              </Link>
            }
            className="mt-4"
            tone="warning"
          >
            {COPY.duplicateHelp}
          </NoticeBanner>
        )}

        {showSummary && summaryItems.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        <form
          aria-labelledby="datos-costo"
          className="mt-6 space-y-5"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <SelectField
              emptyLabel="No hay productos registrados."
              error={errors.product_id}
              help="Obligatorio. La combinación de producto y estado debe ser única."
              id={COST_FIELD_IDS.product_id}
              label="Producto"
              loading={productsResource.status === "loading"}
              loadingLabel="Cargando productos…"
              loadError={
                productsResource.status === "error"
                  ? productsResource.error?.message ?? COPY.productsError
                  : null
              }
              onChange={(value) => updateField("product_id", value)}
              onRetry={productsResource.reload}
              options={productOptions}
              placeholder="Selecciona un producto"
              required
              value={values.product_id}
            />
            <SelectField
              emptyLabel="No hay estados de ítem registrados."
              error={errors.item_state_id}
              help="Obligatorio. Un producto tiene un costo por estado de ítem."
              id={COST_FIELD_IDS.item_state_id}
              label="Estado del ítem"
              loading={itemStatesResource.status === "loading"}
              loadingLabel="Cargando estados…"
              loadError={
                itemStatesResource.status === "error"
                  ? itemStatesResource.error?.message ?? COPY.statesError
                  : null
              }
              onChange={(value) => updateField("item_state_id", value)}
              onRetry={itemStatesResource.reload}
              options={itemStateOptions}
              placeholder="Selecciona un estado"
              required
              value={values.item_state_id}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <TextField
              disabled={submitting}
              error={errors.cost}
              help="Obligatorio. Número mayor o igual a 0 con máximo 2 decimales y 9 dígitos enteros."
              id={COST_FIELD_IDS.cost}
              inputMode="decimal"
              label="Costo"
              maxLength={12}
              onChange={(value) => updateField("cost", value)}
              placeholder="0,00"
              required
              value={values.cost}
            />
            <SelectField
              emptyLabel="No hay monedas activas registradas."
              error={errors.currency_id}
              help="Cambiar la moneda no convierte el monto; solo cambia su interpretación."
              id={COST_FIELD_IDS.currency_id}
              label="Moneda"
              loading={currencyLoading}
              loadingLabel="Cargando monedas…"
              loadError={currencyError}
              onChange={(value) => updateField("currency_id", value)}
              onRetry={currencyStatus?.reload}
              options={currencyOptions}
              placeholder={currencyPlaceholder}
              value={values.currency_id}
            />
          </div>

          <div
            aria-live="polite"
            className="rounded-2xl border border-brand/15 bg-soft-blue p-4"
            role="status"
          >
            <p className="text-[12px] font-semibold text-ink">Moneda resultante</p>
            <p className="mt-1 text-[13px] leading-6 text-muted">
              {currencyPreview}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="button-base button-secondary min-h-11 px-5"
              href="/app/costos"
            >
              Cancelar
            </Link>
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="sm:min-w-[180px]"
              type="submit"
            >
              {editing ? "Guardar cambios" : "Crear costo"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
