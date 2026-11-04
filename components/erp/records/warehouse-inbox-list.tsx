"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { useToast } from "@/components/erp/ui/toast";
import {
  DateField,
  SelectField,
  TextField,
} from "@/components/erp/records/form-controls";
import { EntityAutocompleteField } from "@/components/erp/ui/entity-autocomplete";
import {
  LotExpiryBadge,
  lotLocationStatusLabel,
  LotLocationStatusBadge,
  lotProductName,
  lotProductReference,
} from "@/components/erp/records/lot-shared";
import { LotLocationDialog } from "@/components/erp/records/lot-location-dialog";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
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
  searchProducts,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import {
  fetchPurchase,
  searchPurchases,
  type PurchaseRecord,
} from "@/components/erp/records/purchases-api";
import { PURCHASE_STATUS_LABELS } from "@/components/erp/records/purchase-shared";
import { WarehouseInboxActions } from "@/components/erp/records/warehouse-inbox-actions";
import {
  fetchWarehouseInboxLots,
  startWarehouseInboxLot,
  type WarehouseInboxFilters,
  type WarehouseInboxLot,
  type WarehouseInboxStatusFilter,
} from "@/components/erp/records/warehouse-inbox-api";
import { ApiError } from "@/lib/api";
import { formatDateOnly, formatInteger } from "@/lib/format";
import { translateApiError, type UiError } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";

export type WarehouseInboxListFilters = {
  productId: string;
  purchaseId: string;
  lotNumber: string;
  status: "" | WarehouseInboxStatusFilter;
  expiringBefore: string;
};

const EMPTY_FILTERS: WarehouseInboxListFilters = {
  productId: "",
  purchaseId: "",
  lotNumber: "",
  status: "",
  expiringBefore: "",
};

const NO_LOTS: WarehouseInboxLot[] = [];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente de ubicar" },
  { value: "in_progress", label: "Ubicando" },
  { value: "located", label: "Ubicado" },
  { value: "all", label: "Todos los estados" },
];

function filtersKey(filters: WarehouseInboxListFilters) {
  return [
    filters.productId,
    filters.purchaseId,
    filters.lotNumber,
    filters.status,
    filters.expiringBefore,
  ].join("|");
}

function hasActiveFilters(filters: WarehouseInboxListFilters) {
  return Boolean(
    filters.productId ||
      filters.purchaseId ||
      filters.lotNumber.trim() ||
      filters.status ||
      filters.expiringBefore,
  );
}

function toApiFilters(
  filters: WarehouseInboxListFilters,
): WarehouseInboxFilters {
  return {
    product_id: filters.productId || undefined,
    purchase_id: filters.purchaseId || undefined,
    lot_number: filters.lotNumber.trim() || undefined,
    status: filters.status || undefined,
    expiring_before: filters.expiringBefore || undefined,
  };
}

function buildQuery(filters: WarehouseInboxListFilters) {
  const params = new URLSearchParams();
  if (filters.productId) params.set("product_id", filters.productId);
  if (filters.purchaseId) params.set("purchase_id", filters.purchaseId);
  if (filters.lotNumber.trim()) {
    params.set("lot_number", filters.lotNumber.trim());
  }
  if (filters.status) params.set("status", filters.status);
  if (filters.expiringBefore) {
    params.set("expiring_before", filters.expiringBefore);
  }
  return params;
}

function readStatus(value: string): WarehouseInboxListFilters["status"] {
  return value === "pending" ||
    value === "in_progress" ||
    value === "located" ||
    value === "all"
    ? value
    : "";
}

function productOptionLabel(product: ProductRecord) {
  return `${product.name} (${product.reference})`;
}

function purchaseOptionLabel(purchase: PurchaseRecord) {
  return purchase.supplier?.name
    ? `Compra #${purchase.number} · ${purchase.supplier.name}`
    : `Compra #${purchase.number}`;
}

function inboxErrorMessage(error: UiError | null, fallback: string) {
  if (!error) return fallback;
  if (error.kind === "network") {
    return "No pudimos cargar la bandeja. Revisa tu conexión e intenta de nuevo.";
  }
  return error.message;
}

function inboxCountLabel(count: number) {
  return count === 1
    ? "1 lote en la bandeja"
    : `${formatInteger(count)} lotes en la bandeja`;
}

function startedByLabel(lot: WarehouseInboxLot) {
  return lot.started_by ?? lot.location_started_by;
}

type WarehouseInboxPageProps = {
  initialFilters: WarehouseInboxListFilters;
};

export function WarehouseInboxPage({
  initialFilters,
}: WarehouseInboxPageProps) {
  const { user } = useSession();
  if (!canReadModule(user.role, "bandeja_almacen")) {
    return (
      <AccessState description="Tu rol no tiene acceso a la bandeja de almacén. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    );
  }
  return <WarehouseInboxContent initialFilters={initialFilters} />;
}

function WarehouseInboxContent({
  initialFilters,
}: WarehouseInboxPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { user } = useSession();
  const canWrite = canWriteModule(user.role, "bandeja_almacen");
  const currentUserId = user.id !== null ? String(user.id) : null;

  const [filters, setFilters] = useState<WarehouseInboxListFilters>(
    initialFilters,
  );
  const [lotNumberDraft, setLotNumberDraft] = useState(
    initialFilters.lotNumber,
  );
  const [startingId, setStartingId] = useState<string | null>(null);
  const [locationLot, setLocationLot] = useState<WarehouseInboxLot | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    tone: "warning" | "danger" | "success";
    message: string;
  } | null>(null);
  const filtersRef = useRef(filters);
  const numberTimer = useRef<number | null>(null);
  const [filterResetKey, setFilterResetKey] = useState(0);
  const [resolvedProduct, setResolvedProduct] = useState<{
    id: string;
    label: string;
    missing: boolean;
  } | null>(null);
  const [resolvedPurchase, setResolvedPurchase] = useState<{
    id: string;
    label: string;
    missing: boolean;
  } | null>(null);

  const initialFiltersKey = filtersKey(initialFilters);
  const [appliedInitialFiltersKey, setAppliedInitialFiltersKey] =
    useState(initialFiltersKey);
  if (initialFiltersKey !== appliedInitialFiltersKey) {
    setAppliedInitialFiltersKey(initialFiltersKey);
    setFilters(initialFilters);
    if (lotNumberDraft === filters.lotNumber) {
      setLotNumberDraft(initialFilters.lotNumber);
    }
  }

  const lotsLoader = useCallback(
    () => fetchWarehouseInboxLots(toApiFilters(filters)),
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

  useEffect(() => {
    const id = filters.productId;
    if (!id) return;

    let active = true;
    fetchProduct(id)
      .then((product) => {
        if (active) {
          setResolvedProduct({
            id,
            label: productOptionLabel(product),
            missing: false,
          });
        }
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setResolvedProduct({
            id,
            label: `Producto #${id}`,
            missing: true,
          });
          return;
        }
        setResolvedProduct({
          id,
          label: `Producto #${id}`,
          missing: false,
        });
      });
    return () => {
      active = false;
    };
  }, [filters.productId]);

  useEffect(() => {
    const id = filters.purchaseId;
    if (!id) return;

    let active = true;
    fetchPurchase(id)
      .then((purchase) => {
        if (active) {
          setResolvedPurchase({
            id,
            label: purchaseOptionLabel(purchase),
            missing: false,
          });
        }
      })
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 404) {
          setResolvedPurchase({
            id,
            label: `Compra #${id}`,
            missing: true,
          });
          return;
        }
        setResolvedPurchase({
          id,
          label: `Compra #${id}`,
          missing: false,
        });
      });
    return () => {
      active = false;
    };
  }, [filters.purchaseId]);

  const selectedProductLabel =
    resolvedProduct?.id === filters.productId
      ? resolvedProduct.label
      : undefined;
  const purchaseLabel =
    resolvedPurchase?.id === filters.purchaseId
      ? resolvedPurchase.label
      : undefined;
  const productMissing = Boolean(
    resolvedProduct?.id === filters.productId && resolvedProduct.missing,
  );
  const purchaseMissing = Boolean(
    resolvedPurchase?.id === filters.purchaseId && resolvedPurchase.missing,
  );

  const countLabel = lotsResource.data
    ? inboxCountLabel(lots.length)
    : lotsResource.status === "error"
      ? "No se pudo cargar la bandeja"
      : "Cargando lotes…";

  const tableCaption =
    filters.status === "located" || filters.status === "all"
      ? "Lotes de la bandeja de almacén con producto, lote, vencimiento, cantidad, estado, compra y acciones"
      : "Lotes pendientes de ubicación con producto, lote, vencimiento, cantidad, estado, compra y acciones";

  function commitFilters(next: WarehouseInboxListFilters) {
    setFilters(next);
    const query = buildQuery(next).toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function updateProduct(value: string) {
    commitFilters({ ...filters, productId: value });
  }

  function updatePurchase(value: string) {
    commitFilters({ ...filters, purchaseId: value });
  }

  function updateStatus(value: string) {
    commitFilters({ ...filters, status: readStatus(value) });
  }

  function updateExpiringBefore(value: string) {
    commitFilters({ ...filters, expiringBefore: value });
  }

  function handleLotNumberChange(value: string) {
    setLotNumberDraft(value);
    if (numberTimer.current !== null) {
      window.clearTimeout(numberTimer.current);
    }
    numberTimer.current = window.setTimeout(() => {
      commitFilters({ ...filtersRef.current, lotNumber: value.trim() });
    }, 450);
  }

  function clearFilters() {
    if (numberTimer.current !== null) {
      window.clearTimeout(numberTimer.current);
    }
    setLotNumberDraft("");
    setFilterResetKey((current) => current + 1);
    commitFilters(EMPTY_FILTERS);
  }

  async function handleStart(lot: WarehouseInboxLot) {
    setStartingId(String(lot.id));
    setFeedback(null);
    try {
      await startWarehouseInboxLot(lot.id);
      toast.success(`Ahora estás ubicando el lote ${lot.number}.`);
      reloadLots();
    } catch (caught) {
      const error = translateApiError(caught);
      if (error.kind === "conflict") {
        setFeedback({ tone: "warning", message: error.message });
        reloadLots();
      } else {
        toast.error(error.message);
      }
    } finally {
      setStartingId(null);
    }
  }

  const columns: RecordsTableColumn<WarehouseInboxLot>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (lot) => (
        <div>
          <span className="font-semibold text-ink">
            {lotProductName(lot.product, lot.product_id)}
          </span>
          {lotProductReference(lot.product) && (
            <span className="mt-1 block font-mono text-[11px] text-muted">
              Ref. {lotProductReference(lot.product)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "lote",
      header: "Lote",
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
      key: "cantidad",
      header: "Cantidad",
      className: "whitespace-nowrap",
      render: (lot) => (
        <div>
          <span className="font-semibold tabular-nums text-ink">
            {formatInteger(lot.stock)}
          </span>
          <span className="mt-1 block text-[11px] leading-5 text-muted">
            Reservado {formatInteger(lot.reserved)} · Disponible{" "}
            {formatInteger(lot.available)}
          </span>
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (lot) => (
        <LotLocationStatusBadge
          label={lotLocationStatusLabel(lot, startedByLabel(lot))}
          lot={lot}
        />
      ),
    },
    {
      key: "compra",
      header: "Compra",
      className: "whitespace-nowrap",
      render: (lot) =>
        lot.purchase ? (
          <Link
            className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            href={`/app/compras/${lot.purchase.id}`}
          >
            Compra #{lot.purchase.number}
          </Link>
        ) : (
          <span className="text-[12px] text-muted">Sin compra</span>
        ),
    },
  ];

  function renderActions(lot: WarehouseInboxLot) {
    return (
      <WarehouseInboxActions
        canWrite={canWrite}
        currentUserId={currentUserId}
        lot={lot}
        onAssign={setLocationLot}
        onStart={handleStart}
        starting={startingId === String(lot.id)}
      />
    );
  }

  function renderCard(lot: WarehouseInboxLot) {
    const productName = lotProductName(lot.product, lot.product_id);
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">{productName}</p>
            {lotProductReference(lot.product) && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                Ref. {lotProductReference(lot.product)}
              </p>
            )}
            <p className="mt-2 font-mono text-[12px] font-semibold text-ink">
              Lote {lot.number}
            </p>
          </div>
          <LotLocationStatusBadge
            label={lotLocationStatusLabel(lot, startedByLabel(lot))}
            lot={lot}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] leading-5 text-muted">
            Vence el {formatDateOnly(lot.expiration_date)}
          </span>
          <LotExpiryBadge expirationDate={lot.expiration_date} />
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Cantidad
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
              {formatInteger(lot.available)}
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-[12px] leading-5 text-muted">
          <span className="font-semibold text-ink">Compra</span>{" "}
          {lot.purchase ? (
            <Link
              className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
              href={`/app/compras/${lot.purchase.id}`}
            >
              #{lot.purchase.number}
            </Link>
          ) : (
            "Sin compra"
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        description="Revisa los lotes pendientes de ubicación, inicia la ubicación y asigna bodega, estante y sección. Un lote pendiente no está disponible para la venta."
        eyebrow="Inventario"
        title="Bandeja de almacén"
      />

      <NoticeBanner role="note" title="Lotes pendientes de ubicación">
        Un lote pendiente no está disponible para la venta. Al asignar la
        ubicación, el lote sale de la bandeja por defecto.
      </NoticeBanner>

      {feedback && (
        <NoticeBanner
          action={
            <button
              className="min-h-11 rounded-full border border-olive/35 px-4 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
              onClick={() => setFeedback(null)}
              type="button"
            >
              Cerrar aviso
            </button>
          }
          role="alert"
          tone={feedback.tone}
        >
          {feedback.message}
        </NoticeBanner>
      )}

      <section
        aria-label="Filtros de la bandeja de almacén"
        className="rounded-[24px] border border-line bg-surface p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <EntityAutocompleteField
            emptyLabel="No hay productos que coincidan."
            help="Busca por nombre o referencia."
            id="filtro-bandeja-producto"
            initialLabel={selectedProductLabel}
            key={`filtro-bandeja-producto-${filterResetKey}`}
            label="Producto"
            loadingLabel="Buscando productos…"
            loadOptions={async (query) => {
              const found = await searchProducts(query);
              return found.map((product) => ({
                value: String(product.id),
                label: productOptionLabel(product),
                description: product.description || undefined,
              }));
            }}
            onChange={updateProduct}
            placeholder="Busca por nombre o referencia"
            value={filters.productId}
          />
          <EntityAutocompleteField
            emptyLabel="No hay compras que coincidan."
            help="Busca por número de compra."
            id="filtro-bandeja-compra"
            initialLabel={purchaseLabel}
            key={`filtro-bandeja-compra-${filterResetKey}`}
            label="Compra"
            loadingLabel="Buscando compras…"
            loadOptions={async (query) => {
              const found = await searchPurchases(query);
              return found.map((purchase) => ({
                value: String(purchase.id),
                label: `Compra #${purchase.number}`,
                description:
                  purchase.supplier?.name ??
                  PURCHASE_STATUS_LABELS[purchase.status],
              }));
            }}
            onChange={updatePurchase}
            placeholder="Busca por número de compra"
            value={filters.purchaseId}
          />
          <SelectField
            id="filtro-bandeja-estado"
            label="Estado"
            onChange={updateStatus}
            options={STATUS_OPTIONS}
            placeholder="Pendientes e iniciados"
            value={filters.status}
          />
          <TextField
            help="Se aplica automáticamente al escribir."
            id="filtro-bandeja-lote"
            label="Número de lote"
            onChange={handleLotNumberChange}
            placeholder="Ej. LOTE-1"
            value={lotNumberDraft}
          />
          <DateField
            help="Muestra los lotes que vencen antes de esta fecha."
            id="filtro-bandeja-vencimiento"
            label="Vence antes de"
            onChange={updateExpiringBefore}
            value={filters.expiringBefore}
          />
        </div>

        {(productMissing || purchaseMissing) && (
          <p
            aria-live="polite"
            className="mt-4 text-[12px] font-semibold text-alert-ink"
          >
            {productMissing && purchaseMissing
              ? "El producto y la compra seleccionados ya no existen. Limpia los filtros para continuar."
              : productMissing
                ? "El producto seleccionado ya no existe. Limpia los filtros para continuar."
                : "La compra seleccionada ya no existe. Limpia los filtros para continuar."}
          </p>
        )}

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
        <RecordsTableSkeleton
          columns={7}
          label="Cargando lotes pendientes de ubicación…"
          rows={6}
        />
      )}

      {lotsResource.status === "error" && lots.length === 0 && (
        lotsResource.error?.kind === "forbidden" ? (
          <AccessState description="Tu rol no tiene permisos para consultar la bandeja de almacén. Tu sesión sigue activa." />
        ) : (
          <RecordsLoadError
            backHref="/app"
            backLabel="Volver al inicio"
            description={inboxErrorMessage(
              lotsResource.error,
              "No pudimos cargar la bandeja.",
            )}
            onRetry={
              lotsResource.error?.canRetry ? reloadLots : undefined
            }
            title="No pudimos cargar la bandeja"
          />
        )
      )}

      {lotsResource.status !== "loading" &&
        !(lotsResource.status === "error" && lots.length === 0) && (
          <section
            aria-busy={
              lotsResource.status === "refreshing" || undefined
            }
            aria-label="Listado de lotes de la bandeja"
            className="space-y-4"
          >
            {lotsResource.status === "refreshing" && (
              <>
                <div aria-hidden="true" className="reload-bar" />
                <p aria-live="polite" className="sr-only">
                  Actualizando la bandeja…
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
                {inboxErrorMessage(
                  lotsResource.error,
                  "No pudimos actualizar la bandeja. Mostramos los datos disponibles.",
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
                  ) : undefined
                }
                description={
                  filtersActive
                    ? "Ajusta los filtros para ver otros resultados."
                    : "Los lotes aparecen aquí cuando una compra confirmada los deja pendientes."
                }
                title={
                  filtersActive
                    ? "No hay lotes con estos filtros."
                    : "No hay lotes pendientes de ubicación."
                }
              />
            ) : (
              <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
                <RecordsTable
                  caption={tableCaption}
                  columns={columns}
                  getRowKey={(lot) => String(lot.id)}
                  getRowLabel={(lot) =>
                    `lote ${lot.number} de ${lotProductName(lot.product, lot.product_id)}`
                  }
                  renderCard={renderCard}
                  rowActions={renderActions}
                  rows={lots}
                />
              </div>
            )}
          </section>
        )}

      <LotLocationDialog
        lot={locationLot}
        onClose={() => setLocationLot(null)}
        onConflict={() => {
          setLocationLot(null);
          reloadLots();
        }}
        onLocated={() => {
          setLocationLot(null);
          reloadLots();
        }}
      />
    </div>
  );
}
