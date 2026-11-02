import type { Metadata } from "next";
import {
  InvoiceListPage,
  type InvoiceListFilters,
} from "@/components/erp/records/invoice-list";

export const metadata: Metadata = {
  title: "Facturas",
  description:
    "Consulta las facturas de Farmamed, filtra por pedido, cliente, número o estado de pago y revisa el saldo pendiente.",
};

type InvoicesRouteProps = {
  searchParams: Promise<{
    order_id?: string | string[];
    customer_id?: string | string[];
    number?: string | string[];
    payment_status?: string | string[];
  }>;
};

function readIdFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

function readPaymentStatusFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim().toLowerCase() ?? "";
  return ["pending", "partial", "paid"].includes(trimmed) ? trimmed : "";
}

export default async function InvoicesRoute({ searchParams }: InvoicesRouteProps) {
  const params = await searchParams;
  const initialFilters: InvoiceListFilters = {
    orderId: readIdFilter(params.order_id),
    customerId: readIdFilter(params.customer_id),
    number: readIdFilter(params.number),
    paymentStatus: readPaymentStatusFilter(params.payment_status),
  };
  return <InvoiceListPage initialFilters={initialFilters} />;
}
