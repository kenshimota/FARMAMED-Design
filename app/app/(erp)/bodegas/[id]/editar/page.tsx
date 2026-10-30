import type { Metadata } from "next";
import { WarehouseFormPage } from "@/components/erp/records/warehouse-form";

export const metadata: Metadata = {
  title: "Editar bodega",
  description:
    "Actualiza el nombre, la dirección y las observaciones de una bodega de Farmamed.",
};

type EditWarehouseRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditWarehouseRoute({
  params,
}: EditWarehouseRouteProps) {
  const { id } = await params;
  return <WarehouseFormPage key={id} mode="edit" warehouseId={id} />;
}
