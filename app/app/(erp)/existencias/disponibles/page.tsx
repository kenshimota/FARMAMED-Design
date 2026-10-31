import type { Metadata } from "next";
import {
  StockListPage,
  type StockListFilters,
} from "@/components/erp/records/stock-list";

export const metadata: Metadata = {
  title: "Existencias disponibles",
  description:
    "Consulta la disponibilidad vendible de un producto en Farmamed, con su cantidad, costo vigente y moneda.",
};

type AvailableStocksRouteProps = {
  searchParams: Promise<{
    product_id?: string | string[];
  }>;
};

const EMPTY_FILTERS: StockListFilters = {
  productId: "",
  itemStateId: "",
  inStock: "",
};

function readProductId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

export default async function AvailableStocksPage({
  searchParams,
}: AvailableStocksRouteProps) {
  const params = await searchParams;
  const productId = readProductId(params.product_id);

  return (
    <StockListPage
      initialAvailableProductId={productId}
      initialFilters={EMPTY_FILTERS}
    />
  );
}
