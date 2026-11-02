import type { Metadata } from "next";
import { OrderStatusFormPage } from "@/components/erp/records/order-status-form";

export const metadata: Metadata = {
  title: "Nuevo estado de pedido",
  description:
    "Registra un estado adicional para la cadena de pedidos de Farmamed.",
};

export default function NewOrderStatusPage() {
  return <OrderStatusFormPage mode="create" />;
}
