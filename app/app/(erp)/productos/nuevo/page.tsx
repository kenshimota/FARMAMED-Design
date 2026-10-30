import type { Metadata } from "next";
import { ProductFormPage } from "@/components/erp/records/product-form";

export const metadata: Metadata = {
  title: "Nuevo producto",
  description: "Registra un producto del catálogo de Farmamed con su categoría e imagen.",
};

export default function NewProductPage() {
  return <ProductFormPage mode="create" />;
}
