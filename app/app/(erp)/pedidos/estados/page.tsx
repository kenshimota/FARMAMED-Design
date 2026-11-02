import type { Metadata } from "next";
import { OrderStatusListPage } from "@/components/erp/records/order-status-list";

export const metadata: Metadata = {
  title: "Estados de pedido",
  description:
    "Configura el orden y la cadena de estados que seguirán los pedidos en Farmamed.",
};

export default function OrderStatusesPage() {
  return <OrderStatusListPage />;
}
