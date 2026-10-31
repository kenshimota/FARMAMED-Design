"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
  DateField,
  SelectField,
  TextField,
} from "@/components/erp/records/form-controls";
import {
  LOT_COPY,
  LOT_FIELD_IDS,
  lotSummaryItems,
  mapLotFieldErrors,
  type LotFieldKey,
} from "@/components/erp/records/lot-errors";
import {
  createLot,
  fetchLot,
  updateLot,
  type LotInput,
} from "@/components/erp/records/lots-api";
import {
  caracasIsoDate,
  isValidIsoDate,
  lotSectionLabel,
  lotShelfLabel,
  LotSyncNotice,
} from "@/components/erp/records/lot-shared";
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
import { fetchWarehouses } from "@/components/erp/records/warehouses-api";
import { fetchShelves } from "@/components/erp/records/shelves-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { formatInteger } from "@/lib/format";
import { canWriteModule } from "@/lib/permissions";

type LotFormValues = {
  number: string;
  product_id: string;
  item_state_id: string;
  expiration_date: string;
  stock: string;
  reserved: string;
  warehouse_id: string;
  shelf_id: string;
  section_id: string;
};

const EMPTY_VALUES: LotFormValues = {
  number: "",
  product_id: "",
  item_state_id: "",
  expiration_date: "",
  stock: "0",
  reserved: "0",
  warehouse_id: "",
  shelf_id: "",
  section_id: "",
};

const NUMBER_MAX_LENGTH = 100;
const INTEGER_PATTERN = /^\d+$/;

function parseQuantity(value: string) {
  const trimmed = value.trim();
  if (!INTEGER_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function normalizeDateInput(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return "";
}

type LotFormPageProps = {
  mode: "create" | "edit";
  lotId?: string;
};

export function LotFormPage({ mode, lotId }: LotFormPageProps) {
  const { user } = useSession();
  if (!canWriteModule(user.role, "lotes")) {
    return (
      <AccessState description="Tu rol puede consultar lotes, pero no crearlos, editarlos ni eliminarlos. Tu sesión sigue activa." />
    );
  }
  if (mode === "edit" && !isPositiveRecordId(lotId)) {
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
  return <LotFormContent lotId={lotId} mode={mode} />;
}

function LotFormContent({ mode, lotId }: LotFormPageProps) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit";

  const lotLoader = useCallback(() => fetchLot(lotId ?? ""), [lotId]);
  const lotResource = useAsyncResource(lotLoader, { enabled: editing });
  const productsResource = useAsyncResource(fetchProducts);
  const itemStatesResource = useAsyncResource(fetchItemStates);
  const warehousesResource = useAsyncResource(fetchWarehouses);

  const [values, setValues] = useState<LotFormValues>(EMPTY_VALUES);
  const [initialValues, setInitialValues] =
    useState<LotFormValues>(EMPTY_VALUES);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lot = lotResource.data;
  const products = productsResource.data ?? [];
  const itemStates = itemStatesResource.data ?? [];
  const warehouses = warehousesResource.data ?? [];

  if (lot) {
    const key = String(lot.id);
    if (initializedFor !== key) {
      const next: LotFormValues = {
        number: lot.number,
        product_id: String(lot.product_id),
        item_state_id: String(lot.item_state_id),
        expiration_date: normalizeDateInput(lot.expiration_date),
        stock: String(lot.stock),
        reserved: String(lot.reserved),
        warehouse_id: String(lot.warehouse_id),
        shelf_id: String(lot.shelf_id),
        section_id: String(lot.section_id),
      };
      setValues(next);
      setInitialValues(next);
      setInitializedFor(key);
    }
  }

  const shelvesLoader = useCallback(
    () => fetchShelves(values.warehouse_id),
    [values.warehouse_id],
  );
  const shelvesResource = useAsyncResource(shelvesLoader, {
    enabled: Boolean(values.warehouse_id),
  });

  const reloadShelves = shelvesResource.reload;
  const previousWarehouseId = useRef(values.warehouse_id);

  useEffect(() => {
    const previous = previousWarehouseId.current;
    previousWarehouseId.current = values.warehouse_id;
    if (!values.warehouse_id || !previous) return;
    reloadShelves();
  }, [reloadShelves, values.warehouse_id]);

  const shelves = shelvesResource.data ?? [];

  const foundShelf = shelves.find(
    (shelf) => String(shelf.id) === values.shelf_id,
  );
  const selectedShelf =
    foundShelf ??
    (lot?.shelf &&
    String(lot.warehouse_id) === values.warehouse_id &&
    String(lot.shelf.id) === values.shelf_id
      ? lot.shelf
      : null);

  const currentSection =
    lot?.section && String(lot.warehouse_id) === values.warehouse_id
      ? lot.section
      : null;
  const baseSections = selectedShelf?.sections ?? [];
  const sections =
    currentSection &&
    String(currentSection.id) === values.section_id &&
    !baseSections.some(
      (section) => String(section.id) === String(currentSection.id),
    )
      ? [...baseSections, currentSection].sort((first, second) =>
          first.code.localeCompare(second.code, "es", {
            numeric: true,
            sensitivity: "base",
          }),
        )
      : baseSections;

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );
  useUnsavedChangesWarning(dirty && !submitting);

  function clearFieldError(field: LotFieldKey) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateField(field: LotFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setMessage(null);
    clearFieldError(field);
  }

  function updateWarehouse(value: string) {
    setValues((current) => ({
      ...current,
      warehouse_id: value,
      shelf_id: "",
      section_id: "",
    }));
    setMessage(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.warehouse_id;
      delete next.shelf_id;
      delete next.section_id;
      return next;
    });
  }

  function updateShelf(value: string) {
    setValues((current) => ({
      ...current,
      shelf_id: value,
      section_id: "",
    }));
    setMessage(null);
    setErrors((current) => {
      const next = { ...current };
      delete next.shelf_id;
      delete next.section_id;
      return next;
    });
  }

  function validate() {
    const next: Record<string, string> = {};
    const number = values.number.trim();

    if (!number) next.number = LOT_COPY.numberRequired;
    else if (number.length > NUMBER_MAX_LENGTH) {
      next.number = LOT_COPY.numberLength;
    }

    if (!values.product_id) next.product_id = LOT_COPY.productRequired;
    if (!values.item_state_id) {
      next.item_state_id = LOT_COPY.itemStateRequired;
    }

    if (!values.expiration_date.trim()) {
      next.expiration_date = LOT_COPY.expirationRequired;
    } else if (!isValidIsoDate(values.expiration_date)) {
      next.expiration_date = LOT_COPY.expirationInvalid;
    }

    const stock = parseQuantity(values.stock);
    const reserved = parseQuantity(values.reserved);

    if (!values.stock.trim()) next.stock = LOT_COPY.stockRequired;
    else if (stock === null) next.stock = LOT_COPY.stockInvalid;

    if (!values.reserved.trim()) next.reserved = LOT_COPY.reservedRequired;
    else if (reserved === null) next.reserved = LOT_COPY.reservedInvalid;

    if (stock !== null && reserved !== null && reserved > stock) {
      next.reserved = LOT_COPY.reservedGreater;
    }

    if (!values.warehouse_id) next.warehouse_id = LOT_COPY.warehouseRequired;
    if (!values.shelf_id) next.shelf_id = LOT_COPY.shelfRequired;
    if (!values.section_id) next.section_id = LOT_COPY.sectionRequired;

    const shelvesLoaded =
      shelvesResource.data !== null && shelvesResource.status !== "error";
    if (
      shelvesLoaded &&
      values.shelf_id &&
      !shelves.some((shelf) => String(shelf.id) === values.shelf_id)
    ) {
      next.shelf_id = LOT_COPY.shelfMismatch;
    }

    if (
      selectedShelf &&
      values.section_id &&
      !sections.some((section) => String(section.id) === values.section_id)
    ) {
      next.section_id = LOT_COPY.sectionMismatch;
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

    const stock = parseQuantity(values.stock);
    const reserved = parseQuantity(values.reserved);
    if (stock === null || reserved === null) {
      setErrors({
        stock: stock === null ? LOT_COPY.stockInvalid : "",
        reserved: reserved === null ? LOT_COPY.reservedInvalid : "",
      });
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);

    const payload: LotInput = {
      number: values.number.trim(),
      product_id: toApiId(values.product_id),
      expiration_date: values.expiration_date,
      item_state_id: toApiId(values.item_state_id),
      stock,
      reserved,
      warehouse_id: toApiId(values.warehouse_id),
      shelf_id: toApiId(values.shelf_id),
      section_id: toApiId(values.section_id),
    };

    try {
      const saved = editing
        ? await updateLot(lotId ?? "", payload)
        : await createLot(payload);
      toast.success(editing ? "Cambios guardados." : "Lote creado.");
      setInitialValues(values);
      const targetId = saved?.id ?? lotId;
      router.push(targetId ? `/app/lotes/${targetId}` : "/app/lotes");
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 400) {
          setMessage(LOT_COPY.missingData);
        } else if (caught.status === 401) {
          setMessage(LOT_COPY.session);
        } else if (caught.status === 403) {
          setMessage(LOT_COPY.forbidden);
        } else if (caught.status === 404) {
          setMessage(LOT_COPY.notFound);
        } else if (caught.status === 409) {
          const normalized = caught.message.trim().toLowerCase();
          if (normalized.includes("already exists")) {
            setErrors({ number: LOT_COPY.duplicate });
            setShowSummary(true);
            setMessage(LOT_COPY.duplicate);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translateApiError(caught).message);
          }
        } else if (caught.status === 422) {
          const mapped = mapLotFieldErrors(caught);
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
        setMessage(LOT_COPY.generic);
      }
      setSubmitting(false);
    }
  }

  const headerTitle = editing ? "Editar lote" : "Nuevo lote";
  const backHref =
    editing && lotId ? `/app/lotes/${lotId}` : "/app/lotes";
  const backLabel = editing ? "Volver al detalle" : "Volver a lotes";

  const header = (
    <RecordsPageHeader
      actions={
        <>
          {editing && lot && (
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href={`/app/existencias/producto/${lot.product_id}`}
            >
              Ver existencias del producto
            </Link>
          )}
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href={backHref}
          >
            {backLabel}
          </Link>
        </>
      }
      description={
        editing
          ? "Actualiza los datos editables de un lote de Farmamed. El formulario reemplaza el número, las cantidades, el vencimiento, el estado y la ubicación."
          : "Registra un lote de Farmamed con su número, vencimiento, cantidades y ubicación física coherente."
      }
      eyebrow="Inventario"
      title={headerTitle}
    />
  );

  if (editing && lotResource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && lotResource.status === "error") {
    const notFound = lotResource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/lotes"
          backLabel="Volver a lotes"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : lotResource.error?.message ?? "No pudimos cargar el lote."
          }
          onRetry={notFound ? undefined : lotResource.reload}
          title={
            notFound ? "No encontramos este lote" : "No pudimos cargar el lote"
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
  const warehouseOptions = warehouses.map((warehouse) => ({
    value: String(warehouse.id),
    label: warehouse.name,
  }));

  const shelfOptions = shelves
    .filter(
      (shelf) => String(shelf.warehouse_id) === values.warehouse_id,
    )
    .map((shelf) => ({
      value: String(shelf.id),
      label: lotShelfLabel(shelf),
    }));
  if (
    lot?.shelf &&
    String(lot.warehouse_id) === values.warehouse_id &&
    !shelfOptions.some((option) => option.value === String(lot.shelf?.id))
  ) {
    shelfOptions.unshift({
      value: String(lot.shelf.id),
      label: `${lotShelfLabel(lot.shelf)} (actual)`,
    });
  }

  const sectionOptions = sections.map((section) => ({
    value: String(section.id),
    label: lotSectionLabel(section),
  }));

  const shelvesLoaded =
    shelvesResource.data !== null && shelvesResource.status !== "error";
  const stockPreview = parseQuantity(values.stock);
  const reservedPreview = parseQuantity(values.reserved);
  const availablePreview =
    stockPreview !== null && reservedPreview !== null
      ? stockPreview - reservedPreview
      : null;
  const pastExpiry =
    isValidIsoDate(values.expiration_date) &&
    values.expiration_date < caracasIsoDate();

  const summaryItems = lotSummaryItems(errors);

  return (
    <div className="space-y-5">
      {header}

      <LotSyncNotice variant={editing ? "detail" : "list"} />

      <section className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
        <div>
          <span className="eyebrow">Datos del lote</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="datos-lote"
          >
            {editing ? "Información registrada" : "Información del nuevo lote"}
          </h2>
        </div>

        {message && (
          <NoticeBanner className="mt-5" role="alert" tone="danger">
            {message}
          </NoticeBanner>
        )}

        {pastExpiry && (
          <NoticeBanner className="mt-4" role="status" tone="warning">
            La fecha de vencimiento ya pasó. Puedes guardar el lote, pero
            quedará marcado como vencido.
          </NoticeBanner>
        )}

        {showSummary && summaryItems.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        <form
          aria-labelledby="datos-lote"
          className="mt-6 space-y-6"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <TextField
              disabled={submitting}
              error={errors.number}
              help="Obligatorio. Debe ser único para el producto y tener máximo 100 caracteres."
              id={LOT_FIELD_IDS.number}
              label="Número de lote"
              maxLength={NUMBER_MAX_LENGTH}
              onChange={(value) => updateField("number", value)}
              placeholder="Ej. L-2026-001"
              required
              value={values.number}
            />
            <SelectField
              emptyLabel="No hay productos registrados."
              error={errors.product_id}
              help="Obligatorio. El número de lote se valida contra este producto."
              id={LOT_FIELD_IDS.product_id}
              label="Producto"
              loading={productsResource.status === "loading"}
              loadingLabel="Cargando productos…"
              loadError={
                productsResource.status === "error"
                  ? productsResource.error?.message ??
                    "No pudimos cargar los productos."
                  : null
              }
              onChange={(value) => updateField("product_id", value)}
              onRetry={productsResource.reload}
              options={productOptions}
              placeholder="Selecciona un producto"
              required
              value={values.product_id}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SelectField
              emptyLabel="No hay estados de ítem registrados."
              error={errors.item_state_id}
              help="Obligatorio. Estado físico o comercial del contenido del lote."
              id={LOT_FIELD_IDS.item_state_id}
              label="Estado del ítem"
              loading={itemStatesResource.status === "loading"}
              loadingLabel="Cargando estados…"
              loadError={
                itemStatesResource.status === "error"
                  ? itemStatesResource.error?.message ??
                    "No pudimos cargar los estados de ítem."
                  : null
              }
              onChange={(value) => updateField("item_state_id", value)}
              onRetry={itemStatesResource.reload}
              options={itemStateOptions}
              placeholder="Selecciona un estado"
              required
              value={values.item_state_id}
            />
            <DateField
              disabled={submitting}
              error={errors.expiration_date}
              help="Obligatoria. Se acepta una fecha pasada; el lote quedará marcado como vencido."
              id={LOT_FIELD_IDS.expiration_date}
              label="Fecha de vencimiento"
              onChange={(value) => updateField("expiration_date", value)}
              required
              value={values.expiration_date}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <TextField
              disabled={submitting}
              error={errors.stock}
              help="Obligatoria. Entero mayor o igual a 0."
              id={LOT_FIELD_IDS.stock}
              inputMode="numeric"
              label="Existencia"
              onChange={(value) => updateField("stock", value)}
              placeholder="0"
              required
              value={values.stock}
            />
            <TextField
              disabled={submitting}
              error={errors.reserved}
              help="Obligatorio. Entero mayor o igual a 0 y menor o igual a la existencia."
              id={LOT_FIELD_IDS.reserved}
              inputMode="numeric"
              label="Reservado"
              onChange={(value) => updateField("reserved", value)}
              placeholder="0"
              required
              value={values.reserved}
            />
          </div>

          <div
            className={`rounded-2xl border px-4 py-3 ${
              availablePreview !== null && availablePreview < 0
                ? "border-alert/25 bg-alert/[0.06]"
                : "border-brand/15 bg-soft-blue"
            }`}
          >
            <p className="text-[12px] font-semibold text-ink">
              Disponible calculado
            </p>
            <p className="mt-1 text-[13px] leading-6 text-muted">
              {availablePreview === null
                ? "Completa la existencia y el reservado para ver el disponible."
                : availablePreview < 0
                  ? "El reservado no puede superar la existencia."
                  : `${formatInteger(availablePreview)} unidades. Se calcula como existencia − reservado y no se envía al API.`}
            </p>
          </div>

          <fieldset className="space-y-5 border-t border-line pt-6">
            <legend className="text-[13px] font-semibold text-ink">
              Ubicación física
            </legend>
            <p className="text-[12px] leading-5 text-muted">
              El estante debe pertenecer a la bodega y la sección al estante.
            </p>

            <div className="grid gap-5 lg:grid-cols-3">
              <SelectField
                emptyLabel="No hay bodegas registradas."
                error={errors.warehouse_id}
                help="Obligatoria. Define los estantes disponibles."
                id={LOT_FIELD_IDS.warehouse_id}
                label="Bodega"
                loading={warehousesResource.status === "loading"}
                loadingLabel="Cargando bodegas…"
                loadError={
                  warehousesResource.status === "error"
                    ? warehousesResource.error?.message ??
                      "No pudimos cargar las bodegas."
                    : null
                }
                onChange={updateWarehouse}
                onRetry={warehousesResource.reload}
                options={warehouseOptions}
                placeholder="Selecciona una bodega"
                required
                value={values.warehouse_id}
              />
              <SelectField
                disabled={!values.warehouse_id}
                emptyLabel={
                  values.warehouse_id
                    ? "La bodega no tiene estantes registrados."
                    : "Elige una bodega para ver sus estantes."
                }
                error={errors.shelf_id}
                help="Obligatorio. Se recarga al cambiar la bodega."
                id={LOT_FIELD_IDS.shelf_id}
                label="Estante"
                loading={
                  Boolean(values.warehouse_id) &&
                  (shelvesResource.status === "loading" ||
                    shelvesResource.status === "refreshing")
                }
                loadingLabel="Cargando estantes…"
                loadError={
                  values.warehouse_id && shelvesResource.status === "error"
                    ? shelvesResource.error?.message ??
                      "No pudimos cargar los estantes."
                    : null
                }
                onChange={updateShelf}
                onRetry={reloadShelves}
                options={shelfOptions}
                placeholder={
                  values.warehouse_id
                    ? "Selecciona un estante"
                    : "Elige una bodega primero"
                }
                required
                value={values.shelf_id}
              />
              <SelectField
                disabled={!values.shelf_id}
                emptyLabel={
                  values.shelf_id
                    ? "El estante no tiene secciones registradas."
                    : "Elige un estante para ver sus secciones."
                }
                error={errors.section_id}
                help="Obligatoria. Se recarga al cambiar el estante."
                id={LOT_FIELD_IDS.section_id}
                label="Sección"
                onChange={(value) => updateField("section_id", value)}
                options={sectionOptions}
                placeholder={
                  values.shelf_id
                    ? "Selecciona una sección"
                    : "Elige un estante primero"
                }
                required
                value={values.section_id}
              />
            </div>

            <p aria-live="polite" className="sr-only">
              {values.warehouse_id &&
              (shelvesResource.status === "loading" ||
                shelvesResource.status === "refreshing")
                ? "Cargando los estantes de la bodega seleccionada."
                : ""}
              {values.shelf_id &&
              shelvesLoaded &&
              !shelves.some(
                (shelf) => String(shelf.id) === values.shelf_id,
              )
                ? "El estante no pertenece a la bodega seleccionada."
                : ""}
            </p>
          </fieldset>

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
              {editing ? "Guardar cambios" : "Crear lote"}
              <Icon name="arrow-right" size={18} />
            </BusyButton>
          </div>
        </form>
      </section>
    </div>
  );
}
