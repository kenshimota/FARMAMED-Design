"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { AutocompleteField } from "@/components/erp/ui/autocomplete-field";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { useServerList } from "@/components/erp/ui/use-server-list";
import { LotDeleteDialog } from "@/components/erp/records/lot-delete-dialog";
import {
  addDaysIso,
  getLotExpiryStatus,
  LotExpiryBadge,
  lotItemStateLabel,
  lotLocationLabel,
  lotProductName,
  lotProductReference,
  lotSectionLabel,
  lotShelfLabel,
  LotSyncNotice,
} from "@/components/erp/records/lot-shared";
import {
  fetchLotPage,
  type LotRecord,
} from "@/components/erp/records/lots-api";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import {
  RecordsLoadError,
  RecordsTableSkeleton,
} from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  fetchProduct,
  fetchProductPage,
  findById,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import {
  fetchItemStates,
  type ItemStateRecord,
} from "@/components/erp/records/item-states-api";
import {
  fetchWarehouses,
  type WarehouseRecord,
} from "@/components/erp/records/warehouses-api";
import {
  fetchShelves,
  type ShelfRecord,
} from "@/components/erp/records/shelves-api";
import { formatDateOnly, formatInteger } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import type { UiError } from "@/lib/api-errors";
import { useRecordsById } from "@/components/erp/records/use-records-by-id";

export type LotExpirySelection =
  | ""
  | "vencidos"
  | "no-vencidos"
  | "proximos-30"
  | "proximos-60"
  | "proximos-90"
  | "personalizado";

export type LotListFilters = {
  productId: string;
  itemStateId: string;
  warehouseId: string;
  shelfId: string;
  sectionId: string;
  number: string;
  expired: "" | "true" | "false";
  expiringBefore: string;
};

const NO_ITEM_STATES: ItemStateRecord[] = [];
const NO_WAREHOUSES: WarehouseRecord[] = [];
const NO_SHELVES: ShelfRecord[] = [];
const NO_SECTIONS: ShelfRecord["sections"] = [];

const EXPIRY_OPTIONS = [
  { value: "vencidos", label: "Vencidos" },
  { value: "no-vencidos", label: "No vencidos" },
  { value: "proximos-30", label: "Próximos 30 días" },
  { value: "proximos-60", label: "Próximos 60 días" },
  { value: "proximos-90", label: "Próximos 90 días" },
  { value: "personalizado", label: "Personalizado" },
];

function currentExpiryWindows() {
  return {
    d30: addDaysIso(30),
    d60: addDaysIso(60),
    d90: addDaysIso(90),
  };
}

function lotErrorMessage(error: UiError | null, fallback: string) {
  if (!error) return fallback;
  if (error.kind === "validation") {
    return "Los filtros ingresados no son válidos. Ajusta la selección e intenta de nuevo.";
  }
  return error.message;
}

function productOptionLabel(product: ProductRecord) {
  return `${product.name} (${product.reference})`;
}

type LotListPageProps = {
  initialFilters: LotListFilters;
};

export function LotListPage({ initialFilters }: LotListPageProps) {
  const { user } = useSession();
  if (!canReadModule(user.role, "lotes")) {
    return (
      <AccessState description="Tu rol no tiene acceso al módulo de lotes. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }
  return <LotListContent initialFilters={initialFilters} />;
}

function LotListContent({ initialFilters }: LotListPageProps) {
  const { user } = useSession();
  const canWrite = canWriteModule(user.role, "lotes");
  const canReadExistencias = canReadModule(user.role, "existencias");

  const list = useServerList<LotRecord>({
    loader: (request) => fetchLotPage(request),
    filterKeys: [
      "product_id",
      "item_state_id",
      "warehouse_id",
      "shelf_id",
      "section_id",
      "number",
      "expired",
      "expiring_before",
    ],
    defaultSort: "expiration_date",
    defaultOrder: "asc",
    initial: {
      filters: {
        product_id: initialFilters.productId,
        item_state_id: initialFilters.itemStateId,
        warehouse_id: initialFilters.warehouseId,
        shelf_id: initialFilters.shelfId,
        section_id: initialFilters.sectionId,
        number: initialFilters.number,
        expired: initialFilters.expired,
        expiring_before: initialFilters.expiringBefore,
      },
    },
  });
  const [dateWindows, setDateWindows] = useState<ReturnType<
    typeof currentExpiryWindows
  > | null>(null);
  const [numberDraft, setNumberDraft] = useState(initialFilters.number);
  const [deleteTarget, setDeleteTarget] = useState<LotRecord | null>(null);
  const [deleteConflict, setDeleteConflict] = useState(false);
  const [productDraft, setProductDraft] = useState("");
  const numberTimer = useRef<number | null>(null);

  const productId = list.filters.product_id ?? "";
  const itemStateId = list.filters.item_state_id ?? "";
  const warehouseId = list.filters.warehouse_id ?? "";
  const shelfId = list.filters.shelf_id ?? "";
  const sectionId = list.filters.section_id ?? "";
  const number = list.filters.number ?? "";
  const expired: "" | "true" | "false" =
    list.filters.expired === "true"
      ? "true"
      : list.filters.expired === "false"
        ? "false"
        : "";
  const expiringBefore = list.filters.expiring_before ?? "";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDateWindows(currentExpiryWindows());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const [appliedNumber, setAppliedNumber] = useState(number);
  if (number !== appliedNumber) {
    setAppliedNumber(number);
    setNumberDraft(number);
  }

  const itemStatesResource = useAsyncResource(fetchItemStates);
  const warehousesResource = useAsyncResource(fetchWarehouses);

  const shelvesLoader = useCallback(
    () => fetchShelves(warehouseId),
    [warehouseId],
  );
  const shelvesResource = useAsyncResource(shelvesLoader, {
    enabled: Boolean(warehouseId),
  });
  const previousWarehouseId = useRef(warehouseId);
  const reloadShelves = shelvesResource.reload;

  useEffect(() => {
    const previous = previousWarehouseId.current;
    previousWarehouseId.current = warehouseId;
    if (previous === warehouseId) return;
    reloadShelves();
  }, [reloadShelves, warehouseId]);

  const itemStates = itemStatesResource.data ?? NO_ITEM_STATES;
  const warehouses = warehousesResource.data ?? NO_WAREHOUSES;
  const shelves = shelvesResource.data ?? NO_SHELVES;

  const selectedShelf = useMemo(
    () => findById(shelves, shelfId),
    [shelfId, shelves],
  );
  const sections = selectedShelf?.sections ?? NO_SECTIONS;

  const lots = list.items;
  const productIds = useMemo(
    () => [
      ...(productId ? [productId] : []),
      ...lots.map((lot) => String(lot.product_id)),
    ],
    [lots, productId],
  );
  const productsById = useRecordsById<ProductRecord>({
    ids: productIds,
    load: fetchProduct,
    getId: (product) => product.id,
  }).records;

  const productLabel = productId
    ? productsById[productId]
      ? productOptionLabel(productsById[productId])
      : `Producto #${productId}`
    : "";
  const [appliedProductLabel, setAppliedProductLabel] = useState(productLabel);
  if (productLabel !== appliedProductLabel) {
    setAppliedProductLabel(productLabel);
    setProductDraft(productLabel);
  }

  useEffect(() => {
    return () => {
      if (numberTimer.current !== null) {
        window.clearTimeout(numberTimer.current);
      }
    };
  }, []);

  const filtersActive = Boolean(
    productId ||
      itemStateId ||
      warehouseId ||
      shelfId ||
      sectionId ||
      number ||
      expired ||
      expiringBefore,
  );

  const expirySelection = useMemo<LotExpirySelection>(() => {
    if (expired === "true") {
      return expiringBefore ? "personalizado" : "vencidos";
    }
    if (expired === "false") {
      if (!expiringBefore) return "no-vencidos";
      if (dateWindows) {
        if (expiringBefore === dateWindows.d30) return "proximos-30";
        if (expiringBefore === dateWindows.d60) return "proximos-60";
        if (expiringBefore === dateWindows.d90) return "proximos-90";
      }
      return "personalizado";
    }
    return expiringBefore ? "personalizado" : "";
  }, [dateWindows, expired, expiringBefore]);

  const expiryOptions = useMemo(
    () =>
      expirySelection === "personalizado"
        ? EXPIRY_OPTIONS
        : EXPIRY_OPTIONS.filter((option) => option.value !== "personalizado"),
    [expirySelection],
  );

  const customExpiryDescription = (() => {
    if (expirySelection !== "personalizado") return null;
    const formatted = expiringBefore ? formatDateOnly(expiringBefore) : "";
    if (!formatted) return "Filtro personalizado de vencimiento.";
    if (expired === "true") return `Vencidos hasta el ${formatted}.`;
    if (expired === "false") {
      return `Hasta el ${formatted}, sin vencidos.`;
    }
    return `Vence antes del ${formatted}.`;
  })();

  const itemStateOptions = useMemo(
    () =>
      itemStates.map((itemState) => ({
        value: String(itemState.id),
        label: itemState.label,
      })),
    [itemStates],
  );

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((warehouse) => ({
        value: String(warehouse.id),
        label: warehouse.name,
      })),
    [warehouses],
  );

  const shelfOptions = useMemo(
    () =>
      shelves
        .filter(
          (shelf) => String(shelf.warehouse_id) === warehouseId,
        )
        .map((shelf) => ({
          value: String(shelf.id),
          label: lotShelfLabel(shelf),
        })),
    [warehouseId, shelves],
  );

  const sectionOptions = useMemo(
    () =>
      sections.map((section) => ({
        value: String(section.id),
        label: lotSectionLabel(section),
      })),
    [sections],
  );

  const chips: FilterChip[] = [];
  if (productId) {
    chips.push({
      id: "product_id",
      label: `Producto: ${productDraft || `#${productId}`}`,
      onRemove: () => list.setFilter("product_id", ""),
    });
  }
  if (itemStateId) {
    chips.push({
      id: "item_state_id",
      label: `Estado: ${
        itemStateOptions.find((option) => option.value === itemStateId)?.label ??
        `#${itemStateId}`
      }`,
      onRemove: () => list.setFilter("item_state_id", ""),
    });
  }
  if (warehouseId) {
    chips.push({
      id: "warehouse_id",
      label: `Bodega: ${
        warehouseOptions.find((option) => option.value === warehouseId)?.label ??
        `#${warehouseId}`
      }`,
      onRemove: () => list.setFilter("warehouse_id", ""),
    });
  }
  if (shelfId) {
    chips.push({
      id: "shelf_id",
      label: `Estante: ${
        shelfOptions.find((option) => option.value === shelfId)?.label ??
        `#${shelfId}`
      }`,
      onRemove: () => list.setFilter("shelf_id", ""),
    });
  }
  if (sectionId) {
    chips.push({
      id: "section_id",
      label: `Sección: ${
        sectionOptions.find((option) => option.value === sectionId)?.label ??
        `#${sectionId}`
      }`,
      onRemove: () => list.setFilter("section_id", ""),
    });
  }
  if (expirySelection) {
    chips.push({
      id: "expiry",
      label:
        expirySelection === "personalizado"
          ? customExpiryDescription ?? "Vencimiento personalizado"
          : `Vencimiento: ${
              EXPIRY_OPTIONS.find((option) => option.value === expirySelection)
                ?.label ?? expirySelection
            }`,
      onRemove: () =>
        list.setFilters({ expired: "", expiring_before: "" }),
    });
  }
  if (number) {
    chips.push({
      id: "number",
      label: `Número: ${number}`,
      onRemove: () => {
        setNumberDraft("");
        list.setFilter("number", "");
      },
    });
  }

  function updateWarehouse(value: string) {
    list.setFilters({
      warehouse_id: value,
      shelf_id: "",
      section_id: "",
    });
  }

  function updateShelf(value: string) {
    list.setFilters({ shelf_id: value, section_id: "" });
  }

  function updateExpiry(value: string) {
    if (value === "personalizado") return;
    if (value === "") {
      list.setFilters({ expired: "", expiring_before: "" });
      return;
    }
    if (value === "vencidos") {
      list.setFilters({ expired: "true", expiring_before: "" });
      return;
    }
    if (value === "no-vencidos") {
      list.setFilters({ expired: "false", expiring_before: "" });
      return;
    }

    const windows = currentExpiryWindows();
    setDateWindows(windows);
    const before =
      value === "proximos-30"
        ? windows.d30
        : value === "proximos-60"
          ? windows.d60
          : windows.d90;
    list.setFilters({ expired: "false", expiring_before: before });
  }

  function handleNumberChange(value: string) {
    setNumberDraft(value);
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    numberTimer.current = window.setTimeout(() => {
      list.setFilter("number", value.trim());
    }, 300);
  }

  function clearFilters() {
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    setNumberDraft("");
    list.clearFilters();
  }

  function productFor(lot: LotRecord) {
    return lot.product ?? productsById[String(lot.product_id)] ?? null;
  }

  const columns: RecordsTableColumn<LotRecord>[] = [
    {
      key: "numero",
      header: "Número de lote",
      className: "whitespace-nowrap",
      render: (lot) => (
        <Link
          className="font-mono text-[13px] font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
          href={`/app/lotes/${lot.id}`}
        >
          {lot.number}
        </Link>
      ),
    },
    {
      key: "producto",
      header: "Producto",
      render: (lot) => {
        const product = productFor(lot);
        const reference = lotProductReference(product);
        return (
          <div>
            <span className="font-semibold text-ink">
              {lotProductName(product, lot.product_id)}
            </span>
            {reference && (
              <span className="mt-1 block font-mono text-[11px] text-muted">
                Ref. {reference}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "vencimiento",
      header: "Vencimiento",
      className: "whitespace-nowrap",
      render: (lot) => (
        <div>
          <span className="font-semibold tabular-nums text-ink">
            {formatDateOnly(lot.expiration_date)}
          </span>
          <div className="mt-1">
            <LotExpiryBadge expirationDate={lot.expiration_date} />
          </div>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (lot) => (
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {lotItemStateLabel(lot, itemStates)}
        </span>
      ),
    },
    {
      key: "existencia",
      header: "Existencia",
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
      render: (lot) => (
        <span className="font-semibold tabular-nums text-ink">
          {formatInteger(lot.stock)}
        </span>
      ),
    },
    {
      key: "reservado",
      header: "Reservado",
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
      render: (lot) => (
        <span className="tabular-nums text-ink">
          {formatInteger(lot.reserved)}
        </span>
      ),
    },
    {
      key: "disponible",
      header: "Disponible",
      className: "whitespace-nowrap text-right",
      headerClassName: "text-right",
      render: (lot) => (
        <span className="font-semibold tabular-nums text-brand">
          {formatInteger(lot.stock - lot.reserved)}
        </span>
      ),
    },
    {
      key: "ubicacion",
      header: "Ubicación",
      render: (lot) => (
        <span className="text-[12px] leading-5 text-muted">
          {lotLocationLabel(lot)}
        </span>
      ),
    },
  ];

  function renderActions(lot: LotRecord) {
    const product = productFor(lot);
    const productName = lotProductName(product, lot.product_id);
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Ver el detalle del lote ${lot.number} de ${productName}`}
          href={`/app/lotes/${lot.id}`}
          icon="eye"
        >
          Ver detalle
        </RecordActionLink>
        {canWrite && (
          <RecordActionLink
            ariaLabel={`Editar el lote ${lot.number} de ${productName}`}
            href={`/app/lotes/${lot.id}/editar`}
            icon="arrow-right"
          >
            Editar
          </RecordActionLink>
        )}
        {canWrite && (
          <RecordActionButton
            aria-label={`Eliminar el lote ${lot.number} de ${productName}`}
            danger
            icon="close"
            onClick={() => {
              setDeleteConflict(false);
              setDeleteTarget(lot);
            }}
          >
            Eliminar
          </RecordActionButton>
        )}
      </RecordActions>
    );
  }

  function renderCard(lot: LotRecord) {
    const product = productFor(lot);
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Lote
            </p>
            <p className="mt-0.5 text-[16px] font-semibold text-ink">
              {lot.number}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-ink">
              {lotProductName(product, lot.product_id)}
            </p>
            {lotProductReference(product) && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                Ref. {lotProductReference(product)}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
              {lotItemStateLabel(lot, itemStates)}
            </span>
            <LotExpiryBadge expirationDate={lot.expiration_date} />
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Existencia
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {formatInteger(lot.stock)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Reservado
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {formatInteger(lot.reserved)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Disponible
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-brand">
              {formatInteger(lot.stock - lot.reserved)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[12px] leading-5 text-muted">
          <span className="font-semibold text-ink">Vence el</span>{" "}
          {formatDateOnly(lot.expiration_date)}
        </p>
        <p className="mt-1 text-[12px] leading-5 text-muted">
          <span className="font-semibold text-ink">Ubicación</span>{" "}
          {lotLocationLabel(lot)}
        </p>
      </div>
    );
  }

  const deleteProduct = deleteTarget ? productFor(deleteTarget) : null;

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          canWrite ? (
            <Link
              className="button-base button-primary min-h-11 px-5 text-[13px]"
              href="/app/lotes/nuevo"
            >
              Nuevo lote
              <Icon name="arrow-right" size={17} />
            </Link>
          ) : undefined
        }
        description="Consulta los lotes de Farmamed con su vencimiento, cantidades y ubicación física. Los lotes y las existencias son fuentes independientes."
        eyebrow="Inventario"
        title="Lotes"
      />

      <LotSyncNotice
        action={
          canReadExistencias ? (
            <Link
              className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href="/app/existencias"
            >
              Ver existencias
            </Link>
          ) : undefined
        }
      />

      {deleteConflict && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-4 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={() => setDeleteConflict(false)}
              type="button"
            >
              Cerrar aviso
            </button>
          }
          tone="warning"
        >
          Solo puedes eliminar lotes con existencia y reservado en cero.
        </NoticeBanner>
      )}

      <FilterBar
        activeCount={chips.length}
        chips={chips}
        extra={
          customExpiryDescription ? (
            <p className="mt-3 text-[12px] leading-5 text-muted">
              {customExpiryDescription}
            </p>
          ) : undefined
        }
        id="lotes-filtros"
        loading={list.status === "loading"}
        onClear={clearFilters}
        results={
          list.status === "loading"
            ? "Cargando lotes…"
            : list.status === "error" && lots.length === 0
              ? "No se pudieron cargar los lotes"
              : list.meta.total === 0
                ? "Sin lotes"
                : `Mostrando ${formatInteger(list.range.from)}–${formatInteger(
                    list.range.to,
                  )} de ${formatInteger(list.meta.total)}`
        }
        search={
          <AutocompleteField
            help="Busca el producto por nombre o referencia. El filtro se aplica en el servidor."
            id="filtro-lotes-producto"
            label="Producto"
            loadOptions={async (query) => {
              const page = await fetchProductPage({ q: query, pageSize: 10 });
              return page.data.map((product) => ({
                value: String(product.id),
                label: productOptionLabel(product),
              }));
            }}
            onSelect={(option) => {
              setProductDraft(option.label);
              list.setFilter("product_id", option.value);
            }}
            onValueChange={(value) => {
              setProductDraft(value);
              if (!value) list.setFilter("product_id", "");
            }}
            placeholder="Buscar producto"
            value={productDraft}
          />
        }
      >
        <SelectField
          emptyLabel="No hay estados de ítem registrados."
          id="filtro-lotes-estado"
          label="Estado del ítem"
          loading={itemStatesResource.status === "loading"}
          loadingLabel="Cargando estados…"
          loadError={
            itemStatesResource.status === "error"
              ? itemStatesResource.error?.message ??
                "No pudimos cargar los estados de ítem."
              : null
          }
          onChange={(value) => list.setFilter("item_state_id", value)}
          onRetry={itemStatesResource.reload}
          options={itemStateOptions}
          placeholder="Todos los estados"
          value={itemStateId}
        />
        <SelectField
          emptyLabel="No hay bodegas registradas."
          id="filtro-lotes-bodega"
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
          placeholder="Todas las bodegas"
          value={warehouseId}
        />
        <SelectField
          disabled={!warehouseId}
          emptyLabel={
            warehouseId
              ? "La bodega no tiene estantes registrados."
              : "Elige una bodega para ver sus estantes."
          }
          id="filtro-lotes-estante"
          label="Estante"
          loading={
            Boolean(warehouseId) &&
            (shelvesResource.status === "loading" ||
              shelvesResource.status === "refreshing")
          }
          loadingLabel="Cargando estantes…"
          loadError={
            warehouseId && shelvesResource.status === "error"
              ? shelvesResource.error?.message ??
                "No pudimos cargar los estantes."
              : null
          }
          onChange={updateShelf}
          onRetry={reloadShelves}
          options={shelfOptions}
          placeholder="Todos los estantes"
          value={shelfId}
        />
        <SelectField
          disabled={!shelfId}
          emptyLabel={
            shelfId
              ? "El estante no tiene secciones registradas."
              : "Elige un estante para ver sus secciones."
          }
          id="filtro-lotes-seccion"
          label="Sección"
          onChange={(value) => list.setFilter("section_id", value)}
          options={sectionOptions}
          placeholder="Todas las secciones"
          value={sectionId}
        />
        <SelectField
          help={
            expirySelection === "personalizado"
              ? "Este filtro conserva la fecha exacta recibida."
              : undefined
          }
          id="filtro-lotes-vencimiento"
          label="Vencimiento"
          onChange={updateExpiry}
          options={expiryOptions}
          placeholder="Todos los vencimientos"
          value={expirySelection}
        />
        <TextField
          help="Filtra por número de lote. Se aplica automáticamente al escribir."
          id="filtro-lotes-numero"
          inputType="search"
          label="Número de lote"
          onChange={handleNumberChange}
          placeholder="Ej. 12"
          value={numberDraft}
        />
      </FilterBar>

      {list.status === "loading" && (
        <RecordsTableSkeleton columns={9} label="Cargando lotes…" rows={6} />
      )}

      {list.status === "error" && lots.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={lotErrorMessage(
            list.error,
            "No pudimos cargar los lotes.",
          )}
          onRetry={list.error?.canRetry ? list.reload : undefined}
          title="No pudimos cargar los lotes"
        />
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && lots.length === 0) && (
          <section
            aria-busy={list.status === "refreshing" || undefined}
            aria-label="Listado de lotes"
            className="space-y-4"
          >
            {list.status === "refreshing" && (
              <>
                <div aria-hidden="true" className="reload-bar" />
                <p aria-live="polite" className="sr-only">
                  Actualizando lotes…
                </p>
              </>
            )}

            {list.status === "error" && lots.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={list.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {lotErrorMessage(
                  list.error,
                  "No pudimos actualizar los lotes. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {lots.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={
                    canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href="/app/lotes/nuevo"
                      >
                        Nuevo lote
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description="Registra el primero para controlar vencimientos y ubicación."
                  title="Todavía no hay lotes registrados."
                />
              ) : (
                <EmptyState
                  action={
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={
                        list.isPageOutOfRange
                          ? list.goToFirstPage
                          : clearFilters
                      }
                      type="button"
                    >
                      {list.isPageOutOfRange
                        ? "Ir a la primera página"
                        : "Limpiar filtros"}
                    </button>
                  }
                  description={
                    list.isPageOutOfRange
                      ? `Hay ${formatInteger(
                          list.meta.total,
                        )} lotes en total, pero esta página no tiene filas.`
                      : "No hay resultados con estos filtros. Ajusta los criterios."
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : "Sin resultados con estos filtros."
                  }
                />
              )
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  busy={list.status === "refreshing"}
                  caption="Lotes con número, producto, vencimiento, estado, existencia, reservado, disponible, ubicación y acciones"
                  columns={columns}
                  getRowAttributes={(lot) => {
                    const status = getLotExpiryStatus(lot.expiration_date);
                    return {
                      className:
                        status === "vencido"
                          ? "bg-alert/[0.03]"
                          : status === "proximo"
                            ? "bg-soft-lime"
                            : undefined,
                    };
                  }}
                  getRowKey={(lot) => String(lot.id)}
                  getRowLabel={(lot) =>
                    `lote ${lot.number} de ${lotProductName(productFor(lot), lot.product_id)}`
                  }
                  renderCard={renderCard}
                  rowActions={renderActions}
                  rows={lots}
                />
              </div>
            )}

            <PaginationControls
              meta={list.meta}
              onFirstPage={list.goToFirstPage}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
          </section>
        )}

      <LotDeleteDialog
        lot={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConflict={() => setDeleteConflict(true)}
        onDeleted={() => {
          setDeleteTarget(null);
          setDeleteConflict(false);
          list.reload();
        }}
        productName={
          deleteTarget
            ? lotProductName(deleteProduct, deleteTarget.product_id)
            : ""
        }
      />
    </div>
  );
}
