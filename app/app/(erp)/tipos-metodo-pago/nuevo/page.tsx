import type { Metadata } from "next";
import { MethodPaymentTypeFormPage } from "@/components/erp/finance/method-payment-type-form";

export const metadata: Metadata = {
  title: "Nuevo tipo",
  description:
    "Registra un tipo de método de pago de Farmamed con su moneda y campos de cobro.",
};

export default function NewMethodPaymentTypePage() {
  return <MethodPaymentTypeFormPage mode="create" />;
}
