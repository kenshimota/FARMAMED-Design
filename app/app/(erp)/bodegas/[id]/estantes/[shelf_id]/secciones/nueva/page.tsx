import type { Metadata } from "next";
import { SectionFormPage } from "@/components/erp/records/shelf-forms";

export const metadata: Metadata = {
  title: "Nueva sección",
  description:
    "Registra una sección dentro de un estante de Farmamed con su código, nombre y descripción.",
};

type NewSectionRouteProps = {
  params: Promise<{ id: string; shelf_id: string }>;
};

export default async function NewSectionRoute({ params }: NewSectionRouteProps) {
  const { id, shelf_id: shelfId } = await params;
  return (
    <SectionFormPage
      key={`${id}-${shelfId}`}
      shelfId={shelfId}
      warehouseId={id}
    />
  );
}
