import type { Metadata } from "next";
import {
  OrderListPage,
  type OrderListFilters,
} from "@/components/erp/records/order-list";

export const metadata: Metadata = {
  title: "Pedidos",
  description:
    "Consulta y gestiona los pedidos de Farmamed con filtros por estado, cliente y número.",
};

type OrdersRouteProps = {
  searchParams: Promise<{
    status?: string | string[];
    customer_id?: string | string[];
    number?: string | string[];
  }>;
};

function readStatusFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim().toLowerCase() ?? "";
  return /^[a-z][a-z0-9_]{1,19}$/.test(trimmed) ? trimmed : "";
}

function readIdFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

export default async function OrdersRoute({ searchParams }: OrdersRouteProps) {
  const params = await searchParams;
  const initialFilters: OrderListFilters = {
    status: readStatusFilter(params.status),
    customerId: readIdFilter(params.customer_id),
    number: readIdFilter(params.number),
  };
  return <OrderListPage initialFilters={initialFilters} />;
}
