import type { Metadata } from "next";
import { StockDetailPage } from "@/components/erp/records/stock-detail";

export const metadata: Metadata = {
  title: "Detalle de existencia",
  description:
    "Consulta una existencia agregada de Farmamed con su producto, estado de ítem y cantidad registrada.",
};

type StockDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function StockDetailRoute({
  params,
}: StockDetailRouteProps) {
  const { id } = await params;
  return <StockDetailPage key={id} stockId={id} />;
}
