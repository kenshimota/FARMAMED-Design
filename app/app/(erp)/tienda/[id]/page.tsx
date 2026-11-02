import type { Metadata } from "next";
import { StoreProductDetailPage } from "@/components/erp/store/store-product-detail";

export const metadata: Metadata = {
  title: "Detalle del producto",
  description:
    "Consulta el precio, la disponibilidad y los estados de un producto de la tienda de Farmamed.",
};

type StoreProductRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function StoreProductRoute({
  params,
}: StoreProductRouteProps) {
  const { id } = await params;
  return <StoreProductDetailPage key={id} productId={id} />;
}
