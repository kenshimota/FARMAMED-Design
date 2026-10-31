"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import {
  CurrencyChip,
  CurrencySelect,
  type CurrencyLike,
} from "@/components/erp/ui/currency-select";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import {
  FormErrorSummary,
  focusFirstInvalidField,
  useUnsavedChangesWarning,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  PURCHASE_COPY,
  PURCHASE_HEADER_FIELD_IDS,
  PURCHASE_HEADER_LABELS,
  headerSummaryItems,
  mapBulkLineErrors,
  mapHeaderFieldErrors,
  purchaseErrorMessage,
  type BulkLineError,
  type PurchaseHeaderFieldKey,
} from "@/components/erp/records/purchase-errors";
import {
  PurchaseLinesEditor,
  validateLineValues,
  type PurchaseLineRow,
  type PurchaseLineValues,
} from "@/components/erp/records/purchase-lines";
import {
  createPurchase,
  createPurchaseItem,
  deletePurchaseItem,
  fetchPurchase,
  updatePurchase,
  updatePurchaseItem,
  type PurchaseCurrency,
  type PurchaseItemInput,
  type PurchaseRecord,
} from "@/components/erp/records/purchases-api";
import {
  computePurchaseTotals,
  purchaseCurrencyLabel,
  PurchaseTotalsSummary,
  resolvePurchaseCurrency,
  type PurchaseDisplayCurrency,
} from "@/components/erp/records/purchase-shared";
import {
  SelectField,
  TextAreaField,
} from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  fetchProducts,
  isPositiveRecordId,
  toApiId,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import {
  fetchItemStates,
  type ItemStateRecord,
} from "@/components/erp/records/item-states-api";
import {
  fetchSuppliers,
  type SupplierRecord,
} from "@/components/erp/records/suppliers-api";
import { ApiError } from "@/lib/api";
import {
  flagCurrencyNotConfigured,
  getCurrencyNoticeSnapshot,
  subscribeCurrencyNotice,
} from "@/lib/currency-notice";
import { CURRENCY_NOT_CONFIGURED_DETAIL } from "@/lib/feedback";
import { canWriteModule } from "@/lib/permissions";

type PurchaseFormValues = {
  supplier_id: string;
  currency_id: string;
  notes: string;
};

const EMPTY_VALUES: PurchaseFormValues = {
  supplier_id: "",
  currency_id: "",
  notes: "",
};

const NO_SUPPLIERS: SupplierRecord[] = [];
const NO_PRODUCTS: ProductRecord[] = [];
const NO_ITEM_STATES: ItemStateRecord[] = [];

type PurchaseFormPageProps = {
  mode: "create" | "edit";
  purchaseId?: string;
};

export function PurchaseFormPage({ mode, purchaseId }: PurchaseFormPageProps) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  if (!canWriteModule(user.role, "compras")) {
    return activityVisible ? (
      <AccessState description="Tu rol no tiene acceso para crear ni editar compras. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }
  if (mode === "edit" && !isPositiveRecordId(purchaseId)) {
    return activityVisible ? (
      <RecordsLoadError
        backHref="/app/compras"
        backLabel="Volver a compras"
        description="Puede que el enlace no sea válido o que la compra ya no exista."
        headingLevel="h1"
        title="No encontramos esta compra"
      />
    ) : null;
  }
  return <PurchaseFormContent mode={mode} purchaseId={purchaseId} />;
}

function PurchaseFormContent({ mode, purchaseId }: PurchaseFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";
  const currencyStatus = useCurrencyStatusContext();
  const activityVisible = useActivityVisible();

  const purchaseLoader = useCallback(
    () => fetchPurchase(purchaseId ?? ""),
    [purchaseId],
  );
  const purchaseResource = useAsyncResource(purchaseLoader, { enabled: editing });
  const suppliersResource = useAsyncResource(fetchSuppliers);
  const productsResource = useAsyncResource(fetchProducts);
  const itemStatesResource = useAsyncResource(fetchItemStates);

  const [values, setValues] = useState<PurchaseFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] =
    useState<PurchaseFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [rows, setRows] = useState<PurchaseLineRow[]>([]);
  const [rowsInitializedFor, setRowsInitializedFor] = useState<string | null>(
    null,
  );
  const [localKey, setLocalKey] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkErrors, setBulkErrors] = useState<BulkLineError[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const currencyUnavailable = useSyncExternalStore(
    subscribeCurrencyNotice,
    getCurrencyNoticeSnapshot,
    getCurrencyNoticeSnapshot,
  );
  const shouldResetOnHideRef = useRef(false);

  const purchase = purchaseResource.data;
  const suppliers = suppliersResource.data ?? NO_SUPPLIERS;
  const products = productsResource.data ?? NO_PRODUCTS;
  const itemStates = itemStatesResource.data ?? NO_ITEM_STATES;
  const currencies = useMemo<PurchaseCurrency[]>(() => {
    return (currencyStatus?.currencies ?? [])
      .filter((currency) => currency.id !== null)
      .map((currency) => ({
        id: currency.id as number,
        code: currency.code,
        name: currency.name,
        symbol: currency.symbol,
      }));
  }, [currencyStatus?.currencies]);
  const defaultCurrency = currencyStatus?.defaultCurrency ?? null;
  const currencyLoading =
    currencyStatus?.status === "loading" || currencyStatus?.status === "idle";
  const currencyError =
    currencyStatus?.status === "error"
      ? currencyStatus.errorMessage ?? "No pudimos cargar las monedas."
      : null;
  const currencyBlockedReason = !values.currency_id
    ? currencyStatus?.status === "error"
      ? currencyError ?? "No pudimos cargar las monedas."
      : currencyLoading
        ? "Estamos consultando las monedas. Espera un momento antes de guardar."
        : currencyUnavailable ||
            (currencyStatus?.status === "ready" && !defaultCurrency)
          ? CURRENCY_NOT_CONFIGURED_DETAIL
          : null
    : null;

  if (purchase) {
    const key = String(purchase.id);
    if (initializedFor !== key) {
      const next: PurchaseFormValues = {
        supplier_id: String(purchase.supplier_id),
        currency_id:
          purchase.currency_id !== null
            ? String(purchase.currency_id)
            : purchase.currency
              ? String(purchase.currency.id)
              : "",
        notes: purchase.notes,
      };
      setValues(next);
      setInitialValues(next);
      setInitializedFor(key);
    }
    if (rowsInitializedFor !== key) {
      setRowsInitializedFor(key);
      setRows(rowsFromItems(purchase));
    }
  }

  const currencyOf = useCallback(
    (currencyId: string): PurchaseCurrency | null => {
      if (!currencyId) return null;
      const activeCurrency =
        currencies.find((currency) => String(currency.id) === currencyId) ??
        null;
      if (activeCurrency) return activeCurrency;
      if (purchase?.currency && String(purchase.currency.id) === currencyId) {
        return purchase.currency;
      }
      return null;
    },
    [currencies, purchase],
  );

  const appliedCurrency = useMemo<PurchaseDisplayCurrency | null>(() => {
    const selectedCurrency = currencyOf(values.currency_id);
    if (selectedCurrency) {
      return {
        code: selectedCurrency.code,
        name: selectedCurrency.name.trim() || selectedCurrency.code,
        symbol: selectedCurrency.symbol,
      };
    }
    if (editing) {
      const fallbackId =
        values.currency_id ||
        (purchase?.currency_id !== null && purchase?.currency_id !== undefined
          ? String(purchase.currency_id)
          : purchase?.currency
            ? String(purchase.currency.id)
            : null);
      return resolvePurchaseCurrency(
        purchase?.currency ?? null,
        currencies,
        fallbackId,
        defaultCurrency,
      );
    }
    if (defaultCurrency) {
      return {
        code: defaultCurrency.code,
        name: defaultCurrency.name.trim() || defaultCurrency.code,
        symbol: defaultCurrency.symbol,
      };
    }
    return null;
  }, [
    currencyOf,
    currencies,
    defaultCurrency,
    editing,
    purchase,
    values.currency_id,
  ]);

  const currentCurrency = useMemo(() => {
    return resolvePurchaseCurrency(
      purchase?.currency ?? null,
      currencies,
      purchase?.currency_id ?? null,
      defaultCurrency,
    );
  }, [currencies, defaultCurrency, purchase]);

  const totals = useMemo(() => computePurchaseTotals(rows), [rows]);

  const dirty = useMemo(() => {
    const headerDirty =
      values.supplier_id !== initialValues.supplier_id ||
      values.currency_id !== initialValues.currency_id ||
      values.notes !== initialValues.notes;
    return editing ? headerDirty : headerDirty || rows.length > 0;
  }, [editing, initialValues, rows.length, values]);
  useUnsavedChangesWarning(dirty && !submitting);

  // Un flujo de "nueva compra" debe empezar limpio al volver: si el borrador se
  // guardó con éxito, se reinicia al ocultar la ruta (sin parpadeos durante la
  // navegación) y el estado de React se conserva solo para borradores sin guardar.
  useLayoutEffect(() => {
    return () => {
      if (!shouldResetOnHideRef.current) return;
      shouldResetOnHideRef.current = false;
      setValues(EMPTY_VALUES);
      setInitialValues(EMPTY_VALUES);
      setRows([]);
      setLocalKey(1);
      setErrors({});
      setShowSummary(false);
      setMessage(null);
      setBulkErrors([]);
    };
  }, []);

  if (!activityVisible) return null;

  function updateField(field: PurchaseHeaderFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    setBulkErrors([]);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validateHeader() {
    const next: Record<string, string> = {};
    if (!values.supplier_id) next.supplier_id = PURCHASE_COPY.supplierRequired;
    if (values.currency_id && !currencyOf(values.currency_id)) {
      next.currency_id = PURCHASE_COPY.currencyInvalid;
    }
    if (values.notes.trim().length > 1000) {
      next.notes = "Revisa las notas de la compra. Máximo 1000 caracteres.";
    }
    return next;
  }

  function rowToInput(row: PurchaseLineRow): PurchaseItemInput {
    return {
      product_id: row.product_id,
      item_state_id: row.item_state_id,
      quantity: row.quantity,
      unit_cost: row.unit_cost,
      tax_amount: row.tax_amount,
    };
  }

  function valuesToInput(line: PurchaseLineValues): PurchaseItemInput {
    return {
      product_id: toApiId(line.product_id),
      item_state_id: toApiId(line.item_state_id),
      quantity: Number(line.quantity.trim()),
      unit_cost: Number(line.unit_cost.trim().replace(",", ".")),
      tax_amount: Number(line.tax_amount.trim().replace(",", ".")),
    };
  }

  function applyServerPurchase(updated: PurchaseRecord) {
    setRows(rowsFromItems(updated));
    setRowsInitializedFor(String(updated.id));
  }

  function handleAddLine(line: PurchaseLineValues) {
    if (!editing) {
      setRows((current) => [
        ...current,
        {
          key: `local-${localKey}`,
          id: null,
          ...valuesToInput(line),
        },
      ]);
      setLocalKey((current) => current + 1);
      return;
    }
    return (async () => {
      try {
        const updated = await createPurchaseItem(
          toApiId(purchaseId ?? ""),
          valuesToInput(line),
        );
        applyServerPurchase(updated);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
          purchaseResource.reload();
        }
        throw caught;
      }
    })();
  }

  function handleUpdateLine(key: string, line: PurchaseLineValues) {
    const currentRow = rows.find((row) => row.key === key);
    if (!currentRow) return;
    const taxTrimmed = line.tax_amount.trim();
    const nextRow: PurchaseLineRow = {
      ...currentRow,
      product_id: toApiId(line.product_id),
      item_state_id: toApiId(line.item_state_id),
      quantity: Number(line.quantity.trim()),
      unit_cost: Number(line.unit_cost.trim().replace(",", ".")),
      tax_amount: taxTrimmed
        ? Number(taxTrimmed.replace(",", "."))
        : currentRow.tax_amount,
    };

    if (!editing) {
      setRows((current) =>
        current.map((row) => (row.key === key ? nextRow : row)),
      );
      return;
    }

    return (async () => {
      if (!currentRow.id) return;
      try {
        const patch: Parameters<typeof updatePurchaseItem>[2] = {
          product_id: nextRow.product_id,
          item_state_id: nextRow.item_state_id,
          quantity: nextRow.quantity,
          unit_cost: nextRow.unit_cost,
        };
        if (taxTrimmed) patch.tax_amount = nextRow.tax_amount;
        const updated = await updatePurchaseItem(
          toApiId(purchaseId ?? ""),
          currentRow.id,
          patch,
        );
        applyServerPurchase(updated);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
          purchaseResource.reload();
        }
        throw caught;
      }
    })();
  }

  function handleDeleteLine(row: PurchaseLineRow) {
    if (!editing) {
      setRows((current) => current.filter((item) => item.key !== row.key));
      return;
    }
    return (async () => {
      if (!row.id) return;
      try {
        const updated = await deletePurchaseItem(
          toApiId(purchaseId ?? ""),
          row.id,
        );
        applyServerPurchase(updated);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status >= 400 && caught.status < 500) {
          purchaseResource.reload();
        }
        throw caught;
      }
    })();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (currencyBlockedReason) {
      setMessage(currencyBlockedReason);
      return;
    }

    const nextErrors = validateHeader();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    if (!editing) {
      for (const row of rows) {
        const invalid = validateLineValues(
          {
            product_id: String(row.product_id),
            item_state_id: String(row.item_state_id),
            quantity: String(row.quantity),
            unit_cost: String(row.unit_cost),
            tax_amount: String(row.tax_amount),
          },
          { requireTax: true },
        );
        if (Object.keys(invalid).length > 0) {
          setMessage(PURCHASE_COPY.lineInvalid);
          return;
        }
      }
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);
    setBulkErrors([]);

    try {
      if (editing && purchaseId) {
        await updatePurchase(toApiId(purchaseId), {
          supplier_id: toApiId(values.supplier_id),
          notes: values.notes.trim(),
          ...(values.currency_id &&
          values.currency_id !== initialValues.currency_id
            ? { currency_id: toApiId(values.currency_id) }
            : {}),
        });
        toast.success(PURCHASE_COPY.saved);
        setInitialValues(values);
        router.push(`/app/compras/${purchaseId}`);
        return;
      }

      const items = rows.map(rowToInput);
      const created = await createPurchase({
        supplier_id: toApiId(values.supplier_id),
        ...(values.currency_id
          ? { currency_id: toApiId(values.currency_id) }
          : {}),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
        ...(items.length > 0 ? { items } : {}),
      });
      toast.success(PURCHASE_COPY.created);
      setInitialValues(values);
      shouldResetOnHideRef.current = true;
      router.push(`/app/compras/${created.id}`);
    } catch (caught) {
      const mapped = mapHeaderFieldErrors(caught);
      const bulk = mapBulkLineErrors(caught);
      if (caught instanceof ApiError && caught.status === 409 && editing) {
        purchaseResource.reload();
      }
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped);
        setShowSummary(true);
        window.requestAnimationFrame(() => focusFirstInvalidField());
      } else if (bulk.length > 0) {
        setBulkErrors(bulk);
      } else if (caught instanceof ApiError && caught.status === 503) {
        flagCurrencyNotConfigured();
        setMessage(CURRENCY_NOT_CONFIGURED_DETAIL);
      } else {
        setMessage(purchaseErrorMessage(caught));
      }
      setSubmitting(false);
    }
  }

  const headerTitle = editing
    ? `Compra #${purchase?.number ?? ""}`
    : "Nueva compra";
  const headerDescription = editing
    ? "Actualiza la cabecera del borrador y administra sus líneas. Los totales se recalculan con cada cambio."
    : "Crea un borrador de compra con proveedor, moneda y líneas. Puedes guardarlo sin líneas y completarlo después.";

  const headerActions = (
    <>
      <Link
        className="button-base button-secondary min-h-11 px-5 text-[13px]"
        href={editing ? `/app/compras/${purchaseId}` : "/app/compras"}
      >
        {editing ? "Ver compra" : "Volver a compras"}
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

  if (editing && purchaseResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && (purchaseResource.status === "error" || !purchase)) {
    const notFound = purchaseResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/compras"
          backLabel="Volver a compras"
          description={
            notFound
              ? PURCHASE_COPY.purchaseNotFound
              : purchaseResource.error?.message ?? "No pudimos cargar la compra."
          }
          onRetry={notFound ? undefined : purchaseResource.reload}
          title={
            notFound ? "No encontramos esta compra" : "No pudimos cargar la compra"
          }
        />
      </div>
    );
  }

  if (editing && purchase && purchase.status !== "draft") {
    return (
      <div className="space-y-5">
        {header}
        <NoticeBanner
          action={
            <Link
              className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/compras/${purchaseId}`}
            >
              Ver el detalle de la compra
            </Link>
          }
          role="status"
          tone="warning"
        >
          {PURCHASE_COPY.notEditable}
        </NoticeBanner>
      </div>
    );
  }

  const supplierOptions = suppliers.map((supplier) => ({
    value: String(supplier.id),
    label: supplier.name,
  }));

  const currentCurrencyRecord = editing
    ? currencyOf(
        String(purchase?.currency_id ?? purchase?.currency?.id ?? ""),
      )
    : null;
  const selectedCatalogCurrency = values.currency_id
    ? ((currencyStatus?.currencies ?? []).find(
        (currency) =>
          currency.id !== null &&
          String(currency.id) === values.currency_id,
      ) ?? null)
    : null;
  const summaryCurrency: CurrencyLike | null = selectedCatalogCurrency
    ? selectedCatalogCurrency
    : editing
      ? (currentCurrencyRecord ?? currentCurrency)
      : defaultCurrency;

  let currencyPreview: string;
  const selectedCurrency = currencyOf(values.currency_id);
  if (selectedCurrency) {
    const label = purchaseCurrencyLabel({
      code: selectedCurrency.code,
      name: selectedCurrency.name,
      symbol: selectedCurrency.symbol,
    });
    currencyPreview = editing
      ? `Los montos registrados se interpretarán en ${label}.`
      : `Los montos se guardarán en ${label}.`;
  } else if (editing) {
    currencyPreview = currentCurrency
      ? `Se conserva la moneda actual: ${purchaseCurrencyLabel(currentCurrency)}.`
      : "Sin moneda: la compra no tiene una moneda registrada ni una predeterminada.";
  } else if (defaultCurrency) {
    currencyPreview = `Se usará ${purchaseCurrencyLabel({
      code: defaultCurrency.code,
      name: defaultCurrency.name,
      symbol: defaultCurrency.symbol,
    })}, la moneda por defecto.`;
  } else if (currencyLoading) {
    currencyPreview = "Consultando la moneda por defecto…";
  } else if (currencyError) {
    currencyPreview =
      "No pudimos cargar las monedas. Reintenta la consulta para conocer la moneda por defecto antes de guardar.";
  } else {
    currencyPreview =
      "No hay una moneda por defecto configurada. Contacta a un administrador antes de guardar la compra.";
  }

  const currencyPlaceholder = editing
    ? currentCurrencyRecord
      ? `Mantener moneda actual (${currentCurrencyRecord.code})`
      : "Mantener la moneda actual"
    : undefined;

  const summaryItems = headerSummaryItems(errors);

  return (
    <div className="space-y-5">
      {header}

      <CurrencyNoticeBanner />

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Cabecera</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-compra"
            >
              Datos de la compra
            </h2>
          </div>
          <span className="rounded-full bg-soft-blue px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand">
            {editing ? "Borrador editable" : "Nuevo borrador"}
          </span>
        </div>

        <p className="mt-3 text-[13px] leading-6 text-muted">
          El número, el estado, los totales y la fecha de confirmación los asigna
          Farmamed; no se editan a mano.
        </p>

        {message && (
          <NoticeBanner className="mt-5" role="alert" tone="danger">
            {message}
          </NoticeBanner>
        )}

        {bulkErrors.length > 0 && (
          <NoticeBanner className="mt-5" role="alert" tone="danger" title="Revisa las líneas de la compra">
            <ul className="space-y-1">
              {bulkErrors.map((error, index) => (
                <li key={`${error.lineLabel}-${error.fieldLabel}-${index}`}>
                  <span className="font-semibold">
                    {error.lineLabel} — {error.fieldLabel}:
                  </span>{" "}
                  {error.message}
                </li>
              ))}
            </ul>
          </NoticeBanner>
        )}

        {showSummary && summaryItems.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        <form
          aria-labelledby="datos-compra"
          className="mt-6 space-y-5"
          id="compra-cabecera-form"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <SelectField
              emptyLabel="No hay proveedores registrados."
              error={errors.supplier_id}
              help="Obligatorio. La compra queda registrada a nombre de este proveedor."
              id={PURCHASE_HEADER_FIELD_IDS.supplier_id}
              label={PURCHASE_HEADER_LABELS.supplier_id}
              loading={suppliersResource.status === "loading"}
              loadingLabel="Cargando proveedores…"
              loadError={
                suppliersResource.status === "error"
                  ? suppliersResource.error?.message ??
                    "No pudimos cargar los proveedores."
                  : null
              }
              onChange={(value) => updateField("supplier_id", value)}
              onRetry={suppliersResource.reload}
              options={supplierOptions}
              placeholder="Selecciona un proveedor"
              required
              value={values.supplier_id}
            />
            <CurrencySelect
              currentCurrency={editing ? currentCurrencyRecord : null}
              error={errors.currency_id}
              help="Opcional. Las líneas heredan esta moneda y no se convierten montos."
              id={PURCHASE_HEADER_FIELD_IDS.currency_id}
              label={PURCHASE_HEADER_LABELS.currency_id}
              nonConversionNote
              onChange={(value) => updateField("currency_id", value)}
              optional={!editing}
              placeholder={currencyPlaceholder}
              value={values.currency_id}
            />
          </div>

          <TextAreaField
            disabled={submitting}
            error={errors.notes}
            help="Opcional. Máximo 1000 caracteres."
            id={PURCHASE_HEADER_FIELD_IDS.notes}
            label={PURCHASE_HEADER_LABELS.notes}
            maxLength={1000}
            onChange={(value) => updateField("notes", value)}
            placeholder="Ej. Reposición del mes para el área de analgésicos."
            rows={4}
            value={values.notes}
          />

          <div
            aria-live="polite"
            className="rounded-2xl border border-brand/15 bg-soft-blue p-4"
            role="status"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-ink">Moneda aplicada</p>
              <CurrencyChip currency={summaryCurrency} />
            </div>
            <p className="mt-1 text-[13px] leading-6 text-muted">{currencyPreview}</p>
          </div>

          {currencyBlockedReason && (
            <p
              className="text-[12px] font-semibold leading-5 text-alert-ink"
              role="status"
            >
              {currencyBlockedReason}
            </p>
          )}
        </form>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="lineas-compra" className="min-w-0">
          <div className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
            <span className="eyebrow">Constructor</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="lineas-compra"
            >
              Líneas de la compra
            </h2>
            <p className="mt-3 text-[13px] leading-6 text-muted">
              Agrega productos con su estado de ítem, cantidad, costo unitario e
              impuesto como monto absoluto.
            </p>
            <div className="mt-5">
              <PurchaseLinesEditor
                currency={appliedCurrency}
                itemStates={itemStates}
                itemStatesError={
                  itemStatesResource.status === "error"
                    ? itemStatesResource.error?.message ??
                      "No pudimos cargar los estados de ítem."
                    : null
                }
                itemStatesLoading={itemStatesResource.status === "loading"}
                onAdd={handleAddLine}
                onDelete={handleDeleteLine}
                onRetryItemStates={itemStatesResource.reload}
                onRetryProducts={productsResource.reload}
                onUpdate={handleUpdateLine}
                products={products}
                productsError={
                  productsResource.status === "error"
                    ? productsResource.error?.message ??
                      "No pudimos cargar los productos."
                    : null
                }
                productsLoading={productsResource.status === "loading"}
                rows={rows}
              />
            </div>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
          <PurchaseTotalsSummary
            currency={appliedCurrency}
            empty={rows.length === 0}
            notice={PURCHASE_COPY.noLines}
            totals={totals}
          />
          <div className="rounded-[24px] border border-line bg-surface p-5">
            <BusyButton
              busy={submitting}
              busyLabel="Guardando…"
              className="w-full"
              disabled={Boolean(currencyBlockedReason)}
              form="compra-cabecera-form"
              type="submit"
            >
              {editing ? "Guardar cambios" : "Crear compra"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
            <Link
              className="button-base button-secondary mt-3 w-full px-5"
              href={editing ? `/app/compras/${purchaseId}` : "/app/compras"}
            >
              {editing ? "Volver a la compra" : "Volver a compras"}
            </Link>
            {rows.length === 0 && (
              <p className="mt-4 text-[12px] leading-5 text-muted">
                {PURCHASE_COPY.noLines}
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function rowsFromItems(purchase: PurchaseRecord): PurchaseLineRow[] {
  return (purchase.items ?? []).map((item) => ({
    key: item.id !== null && item.id !== undefined ? `item-${item.id}` : `item-${item.product_id}-${item.item_state_id}`,
    id: item.id,
    product_id: item.product_id,
    item_state_id: item.item_state_id,
    quantity: item.quantity,
    unit_cost: item.unit_cost,
    tax_amount: item.tax_amount,
  }));
}
