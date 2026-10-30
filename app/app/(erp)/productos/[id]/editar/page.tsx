import type { Metadata } from "next";
import { ProductFormPage } from "@/components/erp/records/product-form";

export const metadata: Metadata = {
  title: "Editar producto",
  description: "Actualiza los datos registrados de un producto del catálogo de Farmamed.",
};

type EditProductRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductRoute({ params }: EditProductRouteProps) {
  const { id } = await params;
  return <ProductFormPage key={id} mode="edit" productId={id} />;
}
