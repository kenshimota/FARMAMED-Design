import type { Metadata } from "next";
import { SupplierFormPage } from "@/components/erp/records/supplier-form";

export const metadata: Metadata = {
  title: "Editar proveedor",
  description:
    "Actualiza los datos de contacto y la ubicación de un proveedor de Farmamed.",
};

type EditSupplierRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditSupplierRoute({
  params,
}: EditSupplierRouteProps) {
  const { id } = await params;
  return <SupplierFormPage key={id} mode="edit" supplierId={id} />;
}
