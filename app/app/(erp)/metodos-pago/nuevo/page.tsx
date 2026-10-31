import type { Metadata } from "next";
import { MethodPaymentFormPage } from "@/components/erp/records/method-payment-form";

export const metadata: Metadata = {
  title: "Nuevo método de pago",
  description:
    "Registra un método de pago de Farmamed con el formulario definido por su tipo y su moneda heredada.",
};

export default function NewMethodPaymentRoute() {
  return <MethodPaymentFormPage mode="create" />;
}
