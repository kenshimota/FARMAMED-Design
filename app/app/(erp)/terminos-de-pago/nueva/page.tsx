import type { Metadata } from "next";
import { PaymentTermFormPage } from "@/components/erp/records/payment-term-form";

export const metadata: Metadata = {
  title: "Nuevo término de pago",
  description:
    "Registra un término de pago de Farmamed con su código, nombre y días.",
};

export default function NewPaymentTermPage() {
  return <PaymentTermFormPage mode="create" />;
}
