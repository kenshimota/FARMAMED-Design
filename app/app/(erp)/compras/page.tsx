import type { Metadata } from "next";
import {
  PurchaseListPage,
  type PurchaseListFilters,
} from "@/components/erp/records/purchase-list";

export const metadata: Metadata = {
  title: "Compras",
  description:
    "Consulta y administra las compras a proveedores de Farmamed, con su moneda, líneas y ciclo de borrador, confirmada o cancelada.",
};

type PurchasesRouteProps = {
  searchParams: Promise<{
    supplier_id?: string | string[];
    status?: string | string[];
    number?: string | string[];
    currency_id?: string | string[];
  }>;
};

function readIdFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

function readStatusFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed === "draft" || trimmed === "confirmed" || trimmed === "cancelled"
    ? trimmed
    : "";
}

function readNumberFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed.slice(0, 32);
}

export default async function PurchasesRoute({
  searchParams,
}: PurchasesRouteProps) {
  const params = await searchParams;
  const initialFilters: PurchaseListFilters = {
    supplierId: readIdFilter(params.supplier_id),
    status: readStatusFilter(params.status),
    number: readNumberFilter(params.number),
    currencyId: readIdFilter(params.currency_id),
  };
  return <PurchaseListPage initialFilters={initialFilters} />;
}
