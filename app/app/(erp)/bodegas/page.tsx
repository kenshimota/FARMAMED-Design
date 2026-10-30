import type { Metadata } from "next";
import { WarehouseListPage } from "@/components/erp/records/warehouse-list";

export const metadata: Metadata = {
  title: "Bodegas",
  description:
    "Consulta y administra las bodegas de Farmamed, su ubicación física y el acceso a sus estantes y secciones.",
};

export default function WarehousesPage() {
  return <WarehouseListPage />;
}
