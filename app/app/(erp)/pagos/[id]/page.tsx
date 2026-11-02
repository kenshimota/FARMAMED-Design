import type { Metadata } from "next";
import { PaymentDetailPage } from "@/components/erp/records/payment-detail";

export const metadata: Metadata = {
  title: "Detalle del pago",
  description:
    "Consulta el estado, el motivo, el comprobante y el historial de conciliación de un pago en Farmamed.",
};

type PaymentDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function PaymentDetailRoute({
  params,
}: PaymentDetailRouteProps) {
  const { id } = await params;
  return <PaymentDetailPage key={id} paymentId={id} />;
}
