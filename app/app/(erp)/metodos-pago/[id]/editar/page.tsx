import type { Metadata } from "next";
import { MethodPaymentFormPage } from "@/components/erp/records/method-payment-form";

export const metadata: Metadata = {
  title: "Editar método de pago",
  description:
    "Actualiza la etiqueta, los datos de cobro y el estado de un método de pago de Farmamed sin cambiar su tipo.",
};

type EditMethodPaymentRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditMethodPaymentRoute({
  params,
}: EditMethodPaymentRouteProps) {
  const { id } = await params;
  return <MethodPaymentFormPage key={id} mode="edit" methodId={id} />;
}
