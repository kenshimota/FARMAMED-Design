import type { Metadata } from "next";
import { CustomerOrderDraft } from "@/components/erp/customer-order-draft";

export const metadata: Metadata = {
  title: "Editar borrador",
  description:
    "Ajusta las líneas y los datos de entrega de un borrador de pedido en Farmamed.",
};

type DraftEditRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function DraftEditRoute({ params }: DraftEditRouteProps) {
  const { id } = await params;
  return <CustomerOrderDraft key={id} orderId={id} />;
}
