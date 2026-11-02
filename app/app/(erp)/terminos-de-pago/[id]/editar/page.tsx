import type { Metadata } from "next";
import { PaymentTermFormPage } from "@/components/erp/records/payment-term-form";

export const metadata: Metadata = {
  title: "Editar término de pago",
  description:
    "Actualiza el nombre, la descripción, los días y el estado de un término de pago de Farmamed.",
};

type EditPaymentTermRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPaymentTermRoute({
  params,
}: EditPaymentTermRouteProps) {
  const { id } = await params;
  return <PaymentTermFormPage key={id} mode="edit" termId={id} />;
}
