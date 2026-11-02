import type { Metadata } from "next";
import { PaymentDetailPage } from "@/components/erp/records/payment-detail";

export const metadata: Metadata = {
  title: "Detalle del pago",
  description:
    "Consulta el pago recibido, su método, moneda y el saldo de la billetera del cliente en Farmamed.",
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
