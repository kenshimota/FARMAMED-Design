import type { Metadata } from "next";
import { MethodPaymentTypeListPage } from "@/components/erp/finance/method-payment-type-list";

export const metadata: Metadata = {
  title: "Tipos de métodos de pago",
  description:
    "Catálogo de tipos de métodos de pago de Farmamed con su moneda y campos de cobro.",
};

export default function MethodPaymentTypesPage() {
  return <MethodPaymentTypeListPage />;
}
