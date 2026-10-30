import type { Metadata } from "next";
import { CityDetailPage } from "@/components/erp/records/city-detail";

export const metadata: Metadata = {
  title: "Detalle de la ciudad",
  description:
    "Consulta una ciudad geográfica de Venezuela y el estado al que pertenece en Farmamed.",
};

type CityDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function CityDetailRoute({ params }: CityDetailRouteProps) {
  const { id } = await params;
  return <CityDetailPage key={id} cityId={id} />;
}
