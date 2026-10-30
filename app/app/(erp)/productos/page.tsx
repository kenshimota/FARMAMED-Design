import type { Metadata } from "next";
import { ProductListPage } from "@/components/erp/records/product-list";

export const metadata: Metadata = {
  title: "Productos",
  description:
    "Consulta y administra los productos del catálogo de Farmamed con su categoría e imagen.",
};

export default function ProductsPage() {
  return <ProductListPage />;
}
