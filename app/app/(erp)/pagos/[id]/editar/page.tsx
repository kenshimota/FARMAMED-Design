import type { Metadata } from "next";
import { PaymentFormPage } from "@/components/erp/records/payment-form";

export const metadata: Metadata = {
  title: "Editar pago",
  description:
    "Actualiza la referencia, las notas, la fecha y el comprobante de un pago recibido en Farmamed.",
};

type EditPaymentRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPaymentRoute({
  params,
}: EditPaymentRouteProps) {
  const { id } = await params;
  return <PaymentFormPage key={id} mode="edit" paymentId={id} />;
}
