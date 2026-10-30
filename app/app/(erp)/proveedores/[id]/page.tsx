import type { Metadata } from "next";
import { SupplierDetailPage } from "@/components/erp/records/supplier-detail";

export const metadata: Metadata = {
  title: "Detalle del proveedor",
  description:
    "Consulta los datos registrados de un proveedor de Farmamed y su ubicación.",
};

type SupplierDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function SupplierDetailRoute({
  params,
}: SupplierDetailRouteProps) {
  const { id } = await params;
  return <SupplierDetailPage key={id} supplierId={id} />;
}
