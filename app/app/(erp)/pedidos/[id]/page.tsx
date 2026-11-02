import type { Metadata } from "next";
import { OrderDetailPage } from "@/components/erp/records/order-detail";

export const metadata: Metadata = {
  title: "Detalle del pedido",
  description:
    "Consulta el cliente, las líneas, el término de pago, el historial y las acciones de un pedido de Farmamed.",
};

type OrderDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailRoute({ params }: OrderDetailRouteProps) {
  const { id } = await params;
  return <OrderDetailPage key={id} orderId={id} />;
}
