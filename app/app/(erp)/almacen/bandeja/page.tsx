import type { Metadata } from "next";
import {
  WarehouseInboxPage,
  type WarehouseInboxListFilters,
} from "@/components/erp/records/warehouse-inbox-list";

export const metadata: Metadata = {
  title: "Bandeja de almacén",
  description:
    "Lotes pendientes de ubicación en Farmamed, con inicio de ubicación y asignación de bodega, estante y sección.",
};

type WarehouseInboxRouteProps = {
  searchParams: Promise<{
    product_id?: string | string[];
    purchase_id?: string | string[];
    lot_number?: string | string[];
    status?: string | string[];
    expiring_before?: string | string[];
  }>;
};

function readValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function readId(value: string | string[] | undefined) {
  const trimmed = readValue(value);
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

function readStatus(
  value: string | string[] | undefined,
): WarehouseInboxListFilters["status"] {
  const raw = readValue(value);
  return raw === "pending" ||
    raw === "in_progress" ||
    raw === "located" ||
    raw === "all"
    ? raw
    : "";
}

function readLotNumber(value: string | string[] | undefined) {
  return readValue(value).slice(0, 100);
}

function readExpiringBefore(value: string | string[] | undefined) {
  const raw = readValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

export default async function WarehouseInboxRoute({
  searchParams,
}: WarehouseInboxRouteProps) {
  const filters = await searchParams;
  const initialFilters: WarehouseInboxListFilters = {
    productId: readId(filters.product_id),
    purchaseId: readId(filters.purchase_id),
    lotNumber: readLotNumber(filters.lot_number),
    status: readStatus(filters.status),
    expiringBefore: readExpiringBefore(filters.expiring_before),
  };

  return <WarehouseInboxPage initialFilters={initialFilters} />;
}
