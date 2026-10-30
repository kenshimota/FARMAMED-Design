import type { Metadata } from "next";
import { SupplierListPage } from "@/components/erp/records/supplier-list";

export const metadata: Metadata = {
  title: "Proveedores",
  description:
    "Consulta y administra el directorio de proveedores de Farmamed con su contacto y ubicación.",
};

export default function SuppliersPage() {
  return <SupplierListPage />;
}
