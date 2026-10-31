import type { Metadata } from "next";
import {
  EMPTY_METHOD_PAYMENT_FILTERS,
  MethodPaymentListPage,
  type MethodPaymentListFilters,
} from "@/components/erp/records/method-payment-list";

export const metadata: Metadata = {
  title: "Métodos de pago",
  description:
    "Consulta y administra los datos de cobro registrados en Farmamed por tipo de método de pago y moneda.",
};

type MethodPaymentsRouteProps = {
  searchParams: Promise<{
    method_payment_type_id?: string | string[];
    currency_id?: string | string[];
    is_active?: string | string[];
  }>;
};

function readIdFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

function readActiveFilter(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed === "true" || trimmed === "false" ? trimmed : "";
}

export default async function MethodPaymentsRoute({
  searchParams,
}: MethodPaymentsRouteProps) {
  const params = await searchParams;
  const initialFilters: MethodPaymentListFilters = {
    ...EMPTY_METHOD_PAYMENT_FILTERS,
    methodPaymentTypeId: readIdFilter(params.method_payment_type_id),
    currencyId: readIdFilter(params.currency_id),
    isActive: readActiveFilter(params.is_active),
  };
  return <MethodPaymentListPage initialFilters={initialFilters} />;
}
