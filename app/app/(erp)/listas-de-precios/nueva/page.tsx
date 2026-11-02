import type { Metadata } from "next";
import { PriceListFormPage } from "@/components/erp/records/price-list-form";

export const metadata: Metadata = {
  title: "Nueva lista de precios",
  description:
    "Registra una lista de precios de Farmamed con su nombre, descripción y margen.",
};

export default function NewPriceListPage() {
  return <PriceListFormPage mode="create" />;
}
