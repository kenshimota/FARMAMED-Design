import type { Metadata } from "next";
import { WarehouseDetailPage } from "@/components/erp/records/warehouse-detail";

export const metadata: Metadata = {
  title: "Detalle de la bodega",
  description:
    "Consulta los datos registrados de una bodega de Farmamed y accede a sus estantes.",
};

type WarehouseDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function WarehouseDetailRoute({
  params,
}: WarehouseDetailRouteProps) {
  const { id } = await params;
  return <WarehouseDetailPage key={id} warehouseId={id} />;
}
