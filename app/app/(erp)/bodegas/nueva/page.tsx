import type { Metadata } from "next";
import { WarehouseFormPage } from "@/components/erp/records/warehouse-form";

export const metadata: Metadata = {
  title: "Nueva bodega",
  description:
    "Registra una bodega de Farmamed con su nombre, dirección y observaciones opcionales.",
};

export default function NewWarehousePage() {
  return <WarehouseFormPage mode="create" />;
}
