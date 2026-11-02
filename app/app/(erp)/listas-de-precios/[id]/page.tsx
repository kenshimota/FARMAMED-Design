import type { Metadata } from "next";
import { PriceListDetailPage } from "@/components/erp/records/price-list-detail";

export const metadata: Metadata = {
  title: "Detalle de la lista de precios",
  description:
    "Consulta el nombre, la descripción y el porcentaje de una lista de precios de Farmamed.",
};

type PriceListDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function PriceListDetailRoute({
  params,
}: PriceListDetailRouteProps) {
  const { id } = await params;
  return <PriceListDetailPage key={id} priceListId={id} />;
}
