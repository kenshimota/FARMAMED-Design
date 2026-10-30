import type { Metadata } from "next";
import { ShelfDetailPage } from "@/components/erp/records/shelf-detail";

export const metadata: Metadata = {
  title: "Detalle del estante",
  description:
    "Consulta un estante de Farmamed y administra sus secciones dentro de la bodega.",
};

type ShelfDetailRouteProps = {
  params: Promise<{ id: string; shelf_id: string }>;
};

export default async function ShelfDetailRoute({ params }: ShelfDetailRouteProps) {
  const { id, shelf_id: shelfId } = await params;
  return (
    <ShelfDetailPage
      key={`${id}-${shelfId}`}
      shelfId={shelfId}
      warehouseId={id}
    />
  );
}
