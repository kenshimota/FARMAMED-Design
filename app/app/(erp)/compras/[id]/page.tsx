import type { Metadata } from "next";
import { PurchaseDetailPage } from "@/components/erp/records/purchase-detail";

export const metadata: Metadata = {
  title: "Detalle de la compra",
  description:
    "Consulta la cabecera, las líneas y los totales de una compra de Farmamed.",
};

type PurchaseDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function PurchaseDetailRoute({
  params,
}: PurchaseDetailRouteProps) {
  const { id } = await params;
  return <PurchaseDetailPage key={id} purchaseId={id} />;
}
