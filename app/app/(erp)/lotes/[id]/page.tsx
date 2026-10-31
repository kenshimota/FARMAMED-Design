import type { Metadata } from "next";
import { LotDetailPage } from "@/components/erp/records/lot-detail";

export const metadata: Metadata = {
  title: "Detalle del lote",
  description:
    "Consulta el vencimiento, las cantidades y la ubicación física de un lote de Farmamed.",
};

type LotDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function LotDetailRoute({ params }: LotDetailRouteProps) {
  const { id } = await params;
  return <LotDetailPage key={id} lotId={id} />;
}
