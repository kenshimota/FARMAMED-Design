import type { Metadata } from "next";
import { ProductCostsPage } from "@/components/erp/records/product-costs";

export const metadata: Metadata = {
  title: "Costos del producto",
  description:
    "Consulta el costo vigente de un producto por estado de ítem en Farmamed.",
};

type ProductCostsRouteProps = {
  params: Promise<{ product_id: string }>;
};

export default async function ProductCostsRoute({
  params,
}: ProductCostsRouteProps) {
  const { product_id } = await params;
  return <ProductCostsPage key={product_id} productId={product_id} />;
}
