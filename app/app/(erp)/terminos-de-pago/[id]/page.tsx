import type { Metadata } from "next";
import { PaymentTermDetailPage } from "@/components/erp/records/payment-term-detail";

export const metadata: Metadata = {
  title: "Detalle del término de pago",
  description:
    "Consulta el código, los días y el estado de un término de pago de Farmamed.",
};

type PaymentTermDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function PaymentTermDetailRoute({
  params,
}: PaymentTermDetailRouteProps) {
  const { id } = await params;
  return <PaymentTermDetailPage key={id} termId={id} />;
}
