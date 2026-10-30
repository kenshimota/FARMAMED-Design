import type { Metadata } from "next";
import { StateDetailPage } from "@/components/erp/records/state-detail";

export const metadata: Metadata = {
  title: "Detalle del estado",
  description:
    "Consulta un estado geográfico de Venezuela y las ciudades registradas para él en Farmamed.",
};

type StateDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function StateDetailRoute({ params }: StateDetailRouteProps) {
  const { id } = await params;
  return <StateDetailPage key={id} stateId={id} />;
}
