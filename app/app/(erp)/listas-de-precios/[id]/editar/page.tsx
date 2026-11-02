import type { Metadata } from "next";
import { PriceListFormPage } from "@/components/erp/records/price-list-form";

export const metadata: Metadata = {
  title: "Editar lista de precios",
  description:
    "Actualiza el nombre, la descripción y el margen de una lista de precios de Farmamed.",
};

type EditPriceListRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPriceListRoute({
  params,
}: EditPriceListRouteProps) {
  const { id } = await params;
  return <PriceListFormPage key={id} mode="edit" priceListId={id} />;
}
