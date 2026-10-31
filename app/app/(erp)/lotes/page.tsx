import type { Metadata } from "next";
import {
  LotListPage,
  type LotListFilters,
} from "@/components/erp/records/lot-list";

export const metadata: Metadata = {
  title: "Lotes",
  description:
    "Consulta los lotes de Farmamed con su número, producto, vencimiento, cantidades y ubicación física.",
};

type LotsRouteProps = {
  searchParams: Promise<{
    product_id?: string | string[];
    item_state_id?: string | string[];
    warehouse_id?: string | string[];
    shelf_id?: string | string[];
    section_id?: string | string[];
    number?: string | string[];
    expired?: string | string[];
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

function readNumber(value: string | string[] | undefined) {
  return readValue(value).slice(0, 100);
}

function readExpired(value: string | string[] | undefined) {
  const raw = readValue(value);
  return raw === "true" || raw === "false" ? raw : "";
}

function readExpiringBefore(value: string | string[] | undefined) {
  const raw = readValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

export default async function LotsPage({ searchParams }: LotsRouteProps) {
  const filters = await searchParams;
  const warehouseId = readId(filters.warehouse_id);
  const shelfId = warehouseId ? readId(filters.shelf_id) : "";
  const sectionId = shelfId ? readId(filters.section_id) : "";
  const initialFilters: LotListFilters = {
    productId: readId(filters.product_id),
    itemStateId: readId(filters.item_state_id),
    warehouseId,
    shelfId,
    sectionId,
    number: readNumber(filters.number),
    expired: readExpired(filters.expired),
    expiringBefore: readExpiringBefore(filters.expiring_before),
  };

  return <LotListPage initialFilters={initialFilters} />;
}
