import type { Metadata } from "next";
import { SupplierFormPage } from "@/components/erp/records/supplier-form";

export const metadata: Metadata = {
  title: "Nuevo proveedor",
  description:
    "Registra un proveedor de Farmamed con sus datos de contacto y su ubicación.",
};

export default function NewSupplierPage() {
  return <SupplierFormPage mode="create" />;
}
