import type { Metadata } from "next";
import { LotFormPage } from "@/components/erp/records/lot-form";

export const metadata: Metadata = {
  title: "Editar lote",
  description:
    "Actualiza el vencimiento, las cantidades y la ubicación física de un lote de Farmamed.",
};

type EditLotRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditLotRoute({ params }: EditLotRouteProps) {
  const { id } = await params;
  return <LotFormPage key={id} lotId={id} mode="edit" />;
}
