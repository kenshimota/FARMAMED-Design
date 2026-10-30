import type { Metadata } from "next";
import { ShelfHierarchyPage } from "@/components/erp/records/shelf-hierarchy-page";

export const metadata: Metadata = {
  title: "Estantes y secciones",
  description:
    "Consulta y administra los estantes y las secciones de una bodega de Farmamed, con su código, nombre y descripción.",
};

type ShelvesRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ShelvesRoute({ params }: ShelvesRouteProps) {
  const { id } = await params;
  return <ShelfHierarchyPage key={id} warehouseId={id} />;
}
