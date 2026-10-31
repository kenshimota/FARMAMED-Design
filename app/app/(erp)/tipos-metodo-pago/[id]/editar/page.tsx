import type { Metadata } from "next";
import { MethodPaymentTypeFormPage } from "@/components/erp/finance/method-payment-type-form";

export const metadata: Metadata = {
  title: "Editar tipo",
  description:
    "Actualiza un tipo de método de pago de Farmamed y los campos de cobro que exigirá.",
};

type EditMethodPaymentTypeRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditMethodPaymentTypePage({
  params,
}: EditMethodPaymentTypeRouteProps) {
  const { id } = await params;
  return <MethodPaymentTypeFormPage key={id} mode="edit" typeId={id} />;
}
