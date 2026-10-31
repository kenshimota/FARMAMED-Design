import type { Metadata } from "next";
import { PurchaseFormPage } from "@/components/erp/records/purchase-form";

export const metadata: Metadata = {
  title: "Editar compra",
  description:
    "Actualiza la cabecera y las líneas de un borrador de compra de Farmamed sin convertir montos al cambiar la moneda.",
};

type EditPurchaseRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditPurchaseRoute({
  params,
}: EditPurchaseRouteProps) {
  const { id } = await params;
  return <PurchaseFormPage key={id} mode="edit" purchaseId={id} />;
}
