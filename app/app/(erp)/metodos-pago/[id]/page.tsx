import type { Metadata } from "next";
import { MethodPaymentDetailPage } from "@/components/erp/records/method-payment-detail";

export const metadata: Metadata = {
  title: "Detalle del método de pago",
  description:
    "Consulta la etiqueta, el tipo, la moneda y los datos de cobro de un método de pago de Farmamed.",
};

type MethodPaymentDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function MethodPaymentDetailRoute({
  params,
}: MethodPaymentDetailRouteProps) {
  const { id } = await params;
  return <MethodPaymentDetailPage key={id} methodId={id} />;
}
