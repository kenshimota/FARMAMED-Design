import type { Metadata } from "next";
import { CostFormPage } from "@/components/erp/records/cost-form";

export const metadata: Metadata = {
  title: "Editar costo",
  description:
    "Actualiza el costo vigente de un producto para un estado de ítem en Farmamed.",
};

type EditCostRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCostRoute({ params }: EditCostRouteProps) {
  const { id } = await params;
  return <CostFormPage key={id} costId={id} mode="edit" />;
}
