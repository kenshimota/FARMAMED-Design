import type { Metadata } from "next";
import {
  StockListPage,
  type StockInStockFilter,
  type StockListFilters,
} from "@/components/erp/records/stock-list";

export const metadata: Metadata = {
  title: "Existencias",
  description:
    "Consulta las existencias agregadas por producto y estado de ítem en Farmamed, con acceso a la disponibilidad vendible y sus costos.",
};

type StocksRouteProps = {
  searchParams: Promise<{
    product_id?: string | string[];
    item_state_id?: string | string[];
    in_stock?: string | string[];
  }>;
};

function readFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

function readInStock(value: string | string[] | undefined): StockInStockFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed === "true" || trimmed === "false" ? trimmed : "";
}

export default async function StocksPage({ searchParams }: StocksRouteProps) {
  const filters = await searchParams;
  const productId = readFilter(filters.product_id);
  const initialFilters: StockListFilters = {
    productId,
    itemStateId: readFilter(filters.item_state_id),
    inStock: readInStock(filters.in_stock),
  };

  return (
    <StockListPage
      initialAvailableProductId=""
      initialFilters={initialFilters}
    />
  );
}
