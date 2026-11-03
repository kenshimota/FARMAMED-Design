import type { Metadata } from "next";
import { OrderStatusListPage } from "@/components/erp/records/order-status-list";

export const metadata: Metadata = {
  title: "Estados de pedido",
  description:
    "Consulta la cadena de estados que sigue el ciclo de vida de los pedidos en Farmamed.",
};

export default function OrderStatusesPage() {
  return <OrderStatusListPage />;
}
