import type { Metadata } from "next";
import { PriceListListPage } from "@/components/erp/records/price-list-list";

export const metadata: Metadata = {
  title: "Listas de precios",
  description:
    "Administra los márgenes sobre el costo que se asignan a los clientes de Farmamed.",
};

export default function PriceListsPage() {
  return <PriceListListPage />;
}
