"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import { focusFirstInvalidField } from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { SelectField } from "@/components/erp/records/form-controls";
import {
  lotProductName,
  lotSectionLabel,
  lotShelfLabel,
} from "@/components/erp/records/lot-shared";
import {
  fetchShelves,
  fetchSections,
} from "@/components/erp/records/shelves-api";
import {
  assignWarehouseInboxLocation,
  type WarehouseInboxLot,
} from "@/components/erp/records/warehouse-inbox-api";
import { fetchWarehouses } from "@/components/erp/records/warehouses-api";
import { toApiId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError } from "@/lib/api-errors";
import { formatDateOnly } from "@/lib/format";

type LotLocationDialogProps = {
  lot: WarehouseInboxLot | null;
  onClose: () => void;
  onLocated: () => void;
  onConflict: () => void;
};

export function LotLocationDialog({
  lot,
  onClose,
  onLocated,
  onConflict,
}: LotLocationDialogProps) {
  if (!lot) return null;
  return (
    <LotLocationDialogContent
      key={String(lot.id)}
      lot={lot}
      onClose={onClose}
      onLocated={onLocated}
      onConflict={onConflict}
    />
  );
}

function LotLocationDialogContent({
  lot,
  onClose,
  onLocated,
  onConflict,
}: {
  lot: WarehouseInboxLot;
  onClose: () => void;
  onLocated: () => void;
  onConflict: () => void;
}) {
  const toast = useToast();
  const [warehouseId, setWarehouseId] = useState("");
  const [shelfId, setShelfId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const warehousesResource = useAsyncResource(fetchWarehouses);

  const shelvesLoader = useCallback(
    () => fetchShelves(warehouseId),
    [warehouseId],
  );
  const shelvesResource = useAsyncResource(shelvesLoader, {
    enabled: Boolean(warehouseId),
  });
  const reloadShelves = shelvesResource.reload;
  const previousWarehouseId = useRef(warehouseId);

  useEffect(() => {
    const previous = previousWarehouseId.current;
    previousWarehouseId.current = warehouseId;
    if (!warehouseId || !previous) return;
    reloadShelves();
  }, [reloadShelves, warehouseId]);

  const sectionsLoader = useCallback(
    () => fetchSections(shelfId),
    [shelfId],
  );
  const sectionsResource = useAsyncResource(sectionsLoader, {
    enabled: Boolean(shelfId),
  });
  const reloadSections = sectionsResource.reload;
  const previousShelfId = useRef(shelfId);

  useEffect(() => {
    const previous = previousShelfId.current;
    previousShelfId.current = shelfId;
    if (!shelfId || !previous) return;
    reloadSections();
  }, [reloadSections, shelfId]);

  const warehouses = useMemo(
    () => warehousesResource.data ?? [],
    [warehousesResource.data],
  );
  const shelves = useMemo(
    () => shelvesResource.data ?? [],
    [shelvesResource.data],
  );
  const sections = useMemo(
    () => sectionsResource.data ?? [],
    [sectionsResource.data],
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
    [shelves, warehouseId],
  );

  const sectionOptions = useMemo(
    () =>
      sections
        .filter((section) => String(section.shelf_id) === shelfId)
        .map((section) => ({
          value: String(section.id),
          label: lotSectionLabel(section),
        })),
    [sections, shelfId],
  );

  function clearError(field: string) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateWarehouse(value: string) {
    setWarehouseId(value);
    setShelfId("");
    setSectionId("");
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
    setShelfId(value);
    setSectionId("");
    setMessage(null);
    clearError("shelf_id");
    clearError("section_id");
  }

  function updateSection(value: string) {
    setSectionId(value);
    setMessage(null);
    clearError("section_id");
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!warehouseId) next.warehouse_id = "Selecciona una bodega.";
    if (!shelfId) next.shelf_id = "Selecciona un estante.";
    if (!sectionId) next.section_id = "Selecciona una sección.";
    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate();
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setMessage(null);

    try {
      await assignWarehouseInboxLocation(lot.id, {
        warehouse_id: toApiId(warehouseId),
        shelf_id: toApiId(shelfId),
        section_id: toApiId(sectionId),
      });
      toast.success("Lote ubicado.");
      onLocated();
    } catch (caught) {
      if (caught instanceof ApiError) {
        const translated = translateApiError(caught);
        if (caught.status === 422) {
          const fieldErrors: Record<string, string> = {};
          if (translated.fieldErrors.warehouse_id) {
            fieldErrors.warehouse_id =
              translated.fieldErrors.warehouse_id;
          }
          if (translated.fieldErrors.shelf_id) {
            fieldErrors.shelf_id = translated.fieldErrors.shelf_id;
          }
          if (translated.fieldErrors.section_id) {
            fieldErrors.section_id = translated.fieldErrors.section_id;
          }
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(translated.message);
          }
        } else if (caught.status === 409) {
          toast.error(translated.message);
          onConflict();
        } else if (caught.status === 403) {
          setMessage("No tienes permisos para asignar ubicaciones.");
        } else if (caught.status === 404) {
          toast.error(
            "No encontramos este lote. Actualiza la bandeja e intenta de nuevo.",
          );
          onConflict();
        } else {
          setMessage(translated.message);
        }
      } else {
        setMessage(
          "No pudimos asignar la ubicación. Revisa tu conexión e intenta de nuevo.",
        );
      }
      setSubmitting(false);
    }
  }

  const productName = lotProductName(lot.product, lot.product_id);
  const startedBy =
    lot.started_by?.username ||
    lot.location_started_by?.username ||
    "";

  return (
    <FormDialog
      closeDisabled={submitting}
      description="Selecciona bodega, estante y sección en orden. El estante debe pertenecer a la bodega y la sección al estante."
      mobileFullscreen
      onClose={onClose}
      open
      title={`Asignar ubicación al lote ${lot.number}`}
    >
      <div className="mt-5 rounded-2xl border border-line bg-background p-4">
        <p className="text-[13px] font-semibold text-ink">{productName}</p>
        <p className="mt-1 text-[12px] leading-5 text-muted">
          Lote {lot.number} · Vence el {formatDateOnly(lot.expiration_date)} ·
          Existencia {lot.stock} · Reservado {lot.reserved}
        </p>
        {startedBy && (
          <p className="mt-1 text-[12px] leading-5 text-muted">
            Ubicando por {startedBy}
          </p>
        )}
      </div>

      {message && (
        <NoticeBanner className="mt-4" role="alert" tone="danger">
          {message}
        </NoticeBanner>
      )}

      <form className="mt-5 space-y-5" noValidate onSubmit={handleSubmit}>
        <SelectField
          emptyLabel="No hay bodegas registradas."
          error={errors.warehouse_id}
          id="ubicacion-bodega"
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
          value={warehouseId}
        />
        <SelectField
          disabled={!warehouseId}
          emptyLabel={
            warehouseId
              ? "La bodega no tiene estantes registrados."
              : "Elige una bodega para ver sus estantes."
          }
          error={errors.shelf_id}
          id="ubicacion-estante"
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
          placeholder={
            warehouseId
              ? "Selecciona un estante"
              : "Elige una bodega primero"
          }
          required
          value={shelfId}
        />
        <SelectField
          disabled={!shelfId}
          emptyLabel={
            shelfId
              ? "El estante no tiene secciones registradas."
              : "Elige un estante para ver sus secciones."
          }
          error={errors.section_id}
          id="ubicacion-seccion"
          label="Sección"
          loading={
            Boolean(shelfId) &&
            (sectionsResource.status === "loading" ||
              sectionsResource.status === "refreshing")
          }
          loadingLabel="Cargando secciones…"
          loadError={
            shelfId && sectionsResource.status === "error"
              ? sectionsResource.error?.message ??
                "No pudimos cargar las secciones."
              : null
          }
          onChange={updateSection}
          onRetry={reloadSections}
          options={sectionOptions}
          placeholder={
            shelfId
              ? "Selecciona una sección"
              : "Elige un estante primero"
          }
          required
          value={sectionId}
        />

        <p aria-live="polite" className="sr-only">
          {warehouseId &&
          (shelvesResource.status === "loading" ||
            shelvesResource.status === "refreshing")
            ? "Cargando los estantes de la bodega seleccionada."
            : ""}
          {shelfId &&
          (sectionsResource.status === "loading" ||
            sectionsResource.status === "refreshing")
            ? "Cargando las secciones del estante seleccionado."
            : ""}
        </p>

        <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            className="button-base button-secondary min-h-11 px-5"
            disabled={submitting}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <BusyButton
            busy={submitting}
            busyLabel="Ubicando…"
            className="sm:min-w-[190px]"
            type="submit"
          >
            Asignar ubicación
          </BusyButton>
        </div>
      </form>
    </FormDialog>
  );
}
