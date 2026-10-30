import type { Metadata } from "next";
import { ItemStateListPage } from "@/components/erp/records/item-state-list";

export const metadata: Metadata = {
  title: "Estados de ítem",
  description:
    "Consulta y administra los estados de ítem de Farmamed con su clave estable, etiqueta y condición de venta.",
};

export default function ItemStatesPage() {
  return <ItemStateListPage />;
}
