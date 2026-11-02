import type { Metadata } from "next";
import { ProductFormPage } from "@/components/erp/records/product-form";

export const metadata: Metadata = {
  title: "Nuevo producto",
  description:
    "Registra un producto del catálogo de Farmamed con su categoría y una imagen nueva o existente.",
};

export default function NewProductPage() {
  return <ProductFormPage mode="create" />;
}
