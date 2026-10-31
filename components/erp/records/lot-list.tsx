"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { LotDeleteDialog } from "@/components/erp/records/lot-delete-dialog";
import {
  addDaysIso,
  getLotExpiryStatus,
  LotExpiryBadge,
  lotCountLabel,
  lotItemStateLabel,
  lotLocationLabel,
  lotProductName,
  lotProductReference,
  lotSectionLabel,
  lotShelfLabel,
  LotSyncNotice,
} from "@/components/erp/records/lot-shared";
import {
  fetchLots,
  type LotFilters,
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
  fetchProducts,
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

const EMPTY_FILTERS: LotListFilters = {
  productId: "",
  itemStateId: "",
  warehouseId: "",
  shelfId: "",
  sectionId: "",
  number: "",
  expired: "",
  expiringBefore: "",
};

const NO_LOTS: LotRecord[] = [];
const NO_PRODUCTS: ProductRecord[] = [];
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

function filtersKey(filters: LotListFilters) {
  return [
    filters.productId,
    filters.itemStateId,
    filters.warehouseId,
    filters.shelfId,
    filters.sectionId,
    filters.number,
    filters.expired,
    filters.expiringBefore,
  ].join("|");
}

function hasActiveFilters(filters: LotListFilters) {
  return Boolean(
    filters.productId ||
      filters.itemStateId ||
      filters.warehouseId ||
      filters.shelfId ||
      filters.sectionId ||
      filters.number.trim() ||
      filters.expired ||
      filters.expiringBefore,
  );
}

function toApiFilters(filters: LotListFilters): LotFilters {
  return {
    product_id: filters.productId || undefined,
    item_state_id: filters.itemStateId || undefined,
    warehouse_id: filters.warehouseId || undefined,
    shelf_id: filters.shelfId || undefined,
    section_id: filters.sectionId || undefined,
    number: filters.number.trim() || undefined,
    expired:
      filters.expired === "true"
        ? true
        : filters.expired === "false"
          ? false
          : undefined,
    expiring_before: filters.expiringBefore || undefined,
  };
}

function buildQuery(filters: LotListFilters) {
  const params = new URLSearchParams();
  if (filters.productId) params.set("product_id", filters.productId);
  if (filters.itemStateId) params.set("item_state_id", filters.itemStateId);
  if (filters.warehouseId) params.set("warehouse_id", filters.warehouseId);
  if (filters.shelfId) params.set("shelf_id", filters.shelfId);
  if (filters.sectionId) params.set("section_id", filters.sectionId);
  if (filters.number.trim()) params.set("number", filters.number.trim());
  if (filters.expired) params.set("expired", filters.expired);
  if (filters.expiringBefore) {
    params.set("expiring_before", filters.expiringBefore);
  }
  return params;
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
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSession();
  const canWrite = canWriteModule(user.role, "lotes");
  const canReadExistencias = canReadModule(user.role, "existencias");

  const [filters, setFilters] = useState<LotListFilters>(initialFilters);
  const [dateWindows, setDateWindows] = useState<ReturnType<
    typeof currentExpiryWindows
  > | null>(null);
  const [numberDraft, setNumberDraft] = useState(initialFilters.number);
  const [deleteTarget, setDeleteTarget] = useState<LotRecord | null>(null);
  const [deleteConflict, setDeleteConflict] = useState(false);
  const filtersRef = useRef(filters);
  const numberTimer = useRef<number | null>(null);

  const initialFiltersKey = filtersKey(initialFilters);
  const [appliedInitialFiltersKey, setAppliedInitialFiltersKey] =
    useState(initialFiltersKey);
  if (initialFiltersKey !== appliedInitialFiltersKey) {
    setAppliedInitialFiltersKey(initialFiltersKey);
    setFilters(initialFilters);
    if (numberDraft === filters.number) {
      setNumberDraft(initialFilters.number);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDateWindows(currentExpiryWindows());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const productsResource = useAsyncResource(fetchProducts);
  const itemStatesResource = useAsyncResource(fetchItemStates);
  const warehousesResource = useAsyncResource(fetchWarehouses);

  const shelvesLoader = useCallback(
    () => fetchShelves(filters.warehouseId),
    [filters.warehouseId],
  );
  const shelvesResource = useAsyncResource(shelvesLoader, {
    enabled: Boolean(filters.warehouseId),
  });

  const reloadShelves = shelvesResource.reload;
  const previousWarehouseId = useRef(filters.warehouseId);

  useEffect(() => {
    const previous = previousWarehouseId.current;
    previousWarehouseId.current = filters.warehouseId;
    if (!filters.warehouseId || !previous) return;
    reloadShelves();
  }, [filters.warehouseId, reloadShelves]);

  const products = productsResource.data ?? NO_PRODUCTS;
  const itemStates = itemStatesResource.data ?? NO_ITEM_STATES;
  const warehouses = warehousesResource.data ?? NO_WAREHOUSES;
  const shelves = shelvesResource.data ?? NO_SHELVES;

  const selectedShelf = useMemo(
    () => findById(shelves, filters.shelfId),
    [filters.shelfId, shelves],
  );
  const sections = selectedShelf?.sections ?? NO_SECTIONS;

  const lotsLoader = useCallback(
    () => fetchLots(toApiFilters(filters)),
    [filters],
  );
  const lotsResource = useAsyncResource(lotsLoader);
  const reloadLots = lotsResource.reload;
  const lots = lotsResource.data ?? NO_LOTS;

  const activeFilterKey = filtersKey(filters);
  const appliedFilterKey = useRef(activeFilterKey);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    if (appliedFilterKey.current === activeFilterKey) return;
    appliedFilterKey.current = activeFilterKey;
    reloadLots();
  }, [activeFilterKey, reloadLots]);

  useEffect(() => {
    return () => {
      if (numberTimer.current !== null) {
        window.clearTimeout(numberTimer.current);
      }
    };
  }, []);

  const filtersActive = hasActiveFilters(filters);
  const countLabel = lotsResource.data
    ? lotCountLabel(lots.length)
    : lotsResource.status === "error"
      ? "No se pudieron cargar los lotes"
      : "Cargando lotes…";

  const expirySelection = useMemo<LotExpirySelection>(() => {
    if (filters.expired === "true") {
      return filters.expiringBefore ? "personalizado" : "vencidos";
    }
    if (filters.expired === "false") {
      if (!filters.expiringBefore) return "no-vencidos";
      if (dateWindows) {
        if (filters.expiringBefore === dateWindows.d30) return "proximos-30";
        if (filters.expiringBefore === dateWindows.d60) return "proximos-60";
        if (filters.expiringBefore === dateWindows.d90) return "proximos-90";
      }
      return "personalizado";
    }
    return filters.expiringBefore ? "personalizado" : "";
  }, [dateWindows, filters.expired, filters.expiringBefore]);

  const expiryOptions = useMemo(
    () =>
      expirySelection === "personalizado"
        ? EXPIRY_OPTIONS
        : EXPIRY_OPTIONS.filter((option) => option.value !== "personalizado"),
    [expirySelection],
  );

  const customExpiryDescription = (() => {
    if (expirySelection !== "personalizado") return null;
    const formatted = filters.expiringBefore
      ? formatDateOnly(filters.expiringBefore)
      : "";
    if (!formatted) return "Filtro personalizado de vencimiento.";
    if (filters.expired === "true") return `Vencidos hasta el ${formatted}.`;
    if (filters.expired === "false") {
      return `Hasta el ${formatted}, sin vencidos.`;
    }
    return `Vence antes del ${formatted}.`;
  })();

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        value: String(product.id),
        label: productOptionLabel(product),
      })),
    [products],
  );

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
          (shelf) => String(shelf.warehouse_id) === filters.warehouseId,
        )
        .map((shelf) => ({
          value: String(shelf.id),
          label: lotShelfLabel(shelf),
        })),
    [filters.warehouseId, shelves],
  );

  const sectionOptions = useMemo(
    () =>
      sections.map((section) => ({
        value: String(section.id),
        label: lotSectionLabel(section),
      })),
    [sections],
  );

  function commitFilters(next: LotListFilters) {
    setFilters(next);
    const query = buildQuery(next).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function updateFilter(
    key: "productId" | "itemStateId" | "sectionId",
    value: string,
  ) {
    commitFilters({ ...filters, [key]: value });
  }

  function updateWarehouse(value: string) {
    commitFilters({
      ...filters,
      warehouseId: value,
      shelfId: "",
      sectionId: "",
    });
  }

  function updateShelf(value: string) {
    commitFilters({ ...filters, shelfId: value, sectionId: "" });
  }

  function updateExpiry(value: string) {
    if (value === "personalizado") return;
    if (value === "") {
      commitFilters({ ...filters, expired: "", expiringBefore: "" });
      return;
    }
    if (value === "vencidos") {
      commitFilters({ ...filters, expired: "true", expiringBefore: "" });
      return;
    }
    if (value === "no-vencidos") {
      commitFilters({ ...filters, expired: "false", expiringBefore: "" });
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
    commitFilters({ ...filters, expired: "false", expiringBefore: before });
  }

  function handleNumberChange(value: string) {
    setNumberDraft(value);
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    numberTimer.current = window.setTimeout(() => {
      commitFilters({ ...filtersRef.current, number: value.trim() });
    }, 450);
  }

  function clearFilters() {
    if (numberTimer.current !== null) window.clearTimeout(numberTimer.current);
    setNumberDraft("");
    commitFilters(EMPTY_FILTERS);
  }

  function productFor(lot: LotRecord) {
    return lot.product ?? findById(products, lot.product_id);
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

      <section
        aria-label="Filtros de lotes"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField
            emptyLabel="No hay productos registrados."
            id="filtro-lotes-producto"
            label="Producto"
            loading={productsResource.status === "loading"}
            loadingLabel="Cargando productos…"
            loadError={
              productsResource.status === "error"
                ? productsResource.error?.message ??
                  "No pudimos cargar los productos."
                : null
            }
            onChange={(value) => updateFilter("productId", value)}
            onRetry={productsResource.reload}
            options={productOptions}
            placeholder="Todos los productos"
            value={filters.productId}
          />
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
            onChange={(value) => updateFilter("itemStateId", value)}
            onRetry={itemStatesResource.reload}
            options={itemStateOptions}
            placeholder="Todos los estados"
            value={filters.itemStateId}
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
            value={filters.warehouseId}
          />
          <SelectField
            disabled={!filters.warehouseId}
            emptyLabel={
              filters.warehouseId
                ? "La bodega no tiene estantes registrados."
                : "Elige una bodega para ver sus estantes."
            }
            id="filtro-lotes-estante"
            label="Estante"
            loading={
              Boolean(filters.warehouseId) &&
              (shelvesResource.status === "loading" ||
                shelvesResource.status === "refreshing")
            }
            loadingLabel="Cargando estantes…"
            loadError={
              filters.warehouseId && shelvesResource.status === "error"
                ? shelvesResource.error?.message ??
                  "No pudimos cargar los estantes."
                : null
            }
            onChange={updateShelf}
            onRetry={reloadShelves}
            options={shelfOptions}
            placeholder="Todos los estantes"
            value={filters.shelfId}
          />
          <SelectField
            disabled={!filters.shelfId}
            emptyLabel={
              filters.shelfId
                ? "El estante no tiene secciones registradas."
                : "Elige un estante para ver sus secciones."
            }
            id="filtro-lotes-seccion"
            label="Sección"
            onChange={(value) => updateFilter("sectionId", value)}
            options={sectionOptions}
            placeholder="Todas las secciones"
            value={filters.sectionId}
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
            label="Número de lote"
            onChange={handleNumberChange}
            placeholder="Ej. 12"
            value={numberDraft}
          />
        </div>

        {customExpiryDescription && (
          <p className="mt-3 text-[12px] leading-5 text-muted">
            {customExpiryDescription}
          </p>
        )}

        <p aria-live="polite" className="sr-only">
          {filters.warehouseId &&
          (shelvesResource.status === "loading" ||
            shelvesResource.status === "refreshing")
            ? "Cargando los estantes de la bodega seleccionada."
            : ""}
          {filters.shelfId &&
          (shelvesResource.status === "loading" ||
            shelvesResource.status === "refreshing")
            ? "Cargando las secciones del estante seleccionado."
            : ""}
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p aria-live="polite" className="text-[12px] font-semibold text-muted">
            {countLabel}
          </p>
          {filtersActive && (
            <button
              className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              onClick={clearFilters}
              type="button"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {lotsResource.status === "loading" && (
        <RecordsTableSkeleton columns={9} label="Cargando lotes…" rows={6} />
      )}

      {lotsResource.status === "error" && lots.length === 0 && (
        <RecordsLoadError
          backHref="/app"
          backLabel="Volver al inicio"
          description={lotErrorMessage(
            lotsResource.error,
            "No pudimos cargar los lotes.",
          )}
          onRetry={lotsResource.error?.canRetry ? reloadLots : undefined}
          title="No pudimos cargar los lotes"
        />
      )}

      {lotsResource.status !== "loading" &&
        !(lotsResource.status === "error" && lots.length === 0) && (
          <section
            aria-busy={lotsResource.status === "refreshing" || undefined}
            aria-label="Listado de lotes"
            className="space-y-4"
          >
            {lotsResource.status === "refreshing" && (
              <>
                <div aria-hidden="true" className="reload-bar" />
                <p aria-live="polite" className="sr-only">
                  Actualizando lotes…
                </p>
              </>
            )}

            {lotsResource.status === "error" && lots.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={reloadLots}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {lotErrorMessage(
                  lotsResource.error,
                  "No pudimos actualizar los lotes. Mostramos los datos disponibles.",
                )}
              </NoticeBanner>
            )}

            {lots.length === 0 ? (
              <EmptyState
                action={
                  filtersActive ? (
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={clearFilters}
                      type="button"
                    >
                      Limpiar filtros
                    </button>
                  ) : canWrite ? (
                    <Link
                      className="button-base button-primary min-h-11 px-5"
                      href="/app/lotes/nuevo"
                    >
                      Nuevo lote
                      <Icon name="arrow-right" size={17} />
                    </Link>
                  ) : undefined
                }
                description={
                  filtersActive
                    ? "Ajusta los filtros para ver otros resultados."
                    : "Registra el primero para controlar vencimientos y ubicación."
                }
                title={
                  filtersActive
                    ? "No hay lotes que coincidan con los filtros."
                    : "Todavía no hay lotes registrados."
                }
              />
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
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
          </section>
        )}

      <LotDeleteDialog
        lot={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConflict={() => setDeleteConflict(true)}
        onDeleted={() => {
          setDeleteTarget(null);
          setDeleteConflict(false);
          reloadLots();
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
