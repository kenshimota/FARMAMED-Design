import type { Metadata } from "next";
import { ProductStocksPage } from "@/components/erp/records/product-stocks";

export const metadata: Metadata = {
  title: "Existencias del producto",
  description:
    "Consulta todas las existencias de un producto en Farmamed por estado de ítem, con enlaces a lotes y disponibilidad.",
};

type ProductStocksRouteProps = {
  params: Promise<{ product_id: string }>;
};

export default async function ProductStocksRoute({
  params,
}: ProductStocksRouteProps) {
  const { product_id } = await params;
  return <ProductStocksPage key={product_id} productId={product_id} />;
}
