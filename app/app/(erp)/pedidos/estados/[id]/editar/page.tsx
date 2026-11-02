import type { Metadata } from "next";
import { OrderStatusFormPage } from "@/components/erp/records/order-status-form";

export const metadata: Metadata = {
  title: "Editar estado de pedido",
  description:
    "Actualiza el nombre, la descripción, el orden y el siguiente estado de un estado de pedido de Farmamed.",
};

type EditOrderStatusRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditOrderStatusPage({
  params,
}: EditOrderStatusRouteProps) {
  const { id } = await params;
  return <OrderStatusFormPage key={id} mode="edit" statusId={id} />;
}
