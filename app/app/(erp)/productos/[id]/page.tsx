import type { Metadata } from "next";
import { ProductDetailPage } from "@/components/erp/records/product-detail";

export const metadata: Metadata = {
  title: "Detalle del producto",
  description: "Consulta los datos registrados de un producto del catálogo de Farmamed.",
};

type ProductDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function ProductDetailRoute({ params }: ProductDetailRouteProps) {
  const { id } = await params;
  return <ProductDetailPage key={id} productId={id} />;
}
