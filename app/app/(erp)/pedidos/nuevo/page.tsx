import type { Metadata } from "next";
import { OrderCreatePage } from "@/components/erp/records/order-create";

export const metadata: Metadata = {
  title: "Nuevo pedido",
  description:
    "Venta asistida de Farmamed para crear un pedido de un cliente asignado con su catálogo y precios.",
};

export default function NewOrderRoute() {
  return <OrderCreatePage />;
}
