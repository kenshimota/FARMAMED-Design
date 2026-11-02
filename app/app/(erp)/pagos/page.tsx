import type { Metadata } from "next";
import {
  EMPTY_PAYMENT_FILTERS,
  PaymentListPage,
  type PaymentListFilters,
} from "@/components/erp/records/payment-list";

export const metadata: Metadata = {
  title: "Pagos recibidos",
  description:
    "Registra, concilia y consulta los pagos recibidos de los clientes de Farmamed, con su estado, comprobante y efecto en la billetera.",
};

const PAYMENT_STATUS_VALUES = new Set(["pending", "conciliated", "rejected"]);

type PaymentsRouteProps = {
  searchParams: Promise<{
    customer_id?: string | string[];
    method_payment_id?: string | string[];
    currency_id?: string | string[];
    paid_from?: string | string[];
    paid_to?: string | string[];
    status?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function readIdFilter(value: string | string[] | undefined) {
  const trimmed = firstValue(value);
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

function readDateFilter(value: string | string[] | undefined) {
  const trimmed = firstValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function readStatusFilter(value: string | string[] | undefined) {
  const trimmed = firstValue(value).toLowerCase();
  return PAYMENT_STATUS_VALUES.has(trimmed) ? trimmed : "";
}

export default async function PaymentsRoute({
  searchParams,
}: PaymentsRouteProps) {
  const params = await searchParams;
  const initialFilters: PaymentListFilters = {
    ...EMPTY_PAYMENT_FILTERS,
    customerId: readIdFilter(params.customer_id),
    methodPaymentId: readIdFilter(params.method_payment_id),
    currencyId: readIdFilter(params.currency_id),
    paidFrom: readDateFilter(params.paid_from),
    paidTo: readDateFilter(params.paid_to),
    status: readStatusFilter(params.status),
  };
  return <PaymentListPage initialFilters={initialFilters} />;
}
