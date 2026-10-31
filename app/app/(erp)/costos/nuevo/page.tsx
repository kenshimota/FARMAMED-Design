import type { Metadata } from "next";
import { CostFormPage } from "@/components/erp/records/cost-form";

export const metadata: Metadata = {
  title: "Nuevo costo",
  description:
    "Registra el costo vigente de un producto para un estado de ítem en Farmamed.",
};

type NewCostRouteProps = {
  searchParams: Promise<{ product_id?: string | string[] }>;
};

function readProductId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : undefined;
}

export default async function NewCostPage({
  searchParams,
}: NewCostRouteProps) {
  const params = await searchParams;
  return (
    <CostFormPage
      initialProductId={readProductId(params.product_id)}
      mode="create"
    />
  );
}
