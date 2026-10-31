import type { Metadata } from "next";
import {
  CostListPage,
  type CostListFilters,
} from "@/components/erp/records/cost-list";

export const metadata: Metadata = {
  title: "Costos",
  description:
    "Consulta y administra los costos vigentes por producto y estado de ítem en Farmamed, con su moneda y sin conversión automática.",
};

type CostsRouteProps = {
  searchParams: Promise<{
    product_id?: string | string[];
    item_state_id?: string | string[];
    currency_id?: string | string[];
  }>;
};

function readFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

export default async function CostsPage({ searchParams }: CostsRouteProps) {
  const filters = await searchParams;
  const initialFilters: CostListFilters = {
    productId: readFilter(filters.product_id),
    itemStateId: readFilter(filters.item_state_id),
    currencyId: readFilter(filters.currency_id),
  };
  return <CostListPage initialFilters={initialFilters} />;
}
