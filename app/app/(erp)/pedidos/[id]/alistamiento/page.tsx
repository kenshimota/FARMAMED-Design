import type { Metadata } from "next";
import { OrderPickingPage } from "@/components/erp/records/order-picking";

export const metadata: Metadata = {
  title: "Alistamiento del pedido",
  description:
    "Lista de alistamiento con los lotes, las cantidades a empacar y la ubicación física de cada producto de un pedido de Farmamed.",
};

type OrderPickingRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function OrderPickingRoute({
  params,
}: OrderPickingRouteProps) {
  const { id } = await params;
  return <OrderPickingPage key={id} orderId={id} />;
}
