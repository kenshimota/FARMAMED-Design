import type { Metadata } from "next";
import { ShelfFormPage } from "@/components/erp/records/shelf-forms";

export const metadata: Metadata = {
  title: "Nuevo estante",
  description:
    "Registra un estante dentro de una bodega de Farmamed con su código, nombre y descripción.",
};

type NewShelfRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function NewShelfRoute({ params }: NewShelfRouteProps) {
  const { id } = await params;
  return <ShelfFormPage key={id} warehouseId={id} />;
}
