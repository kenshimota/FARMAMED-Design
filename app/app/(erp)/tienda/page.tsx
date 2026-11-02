import type { Metadata } from "next";
import { StoreCatalogPage } from "@/components/erp/store/store-catalog";

export const metadata: Metadata = {
  title: "Tienda",
  description:
    "Consulta los productos disponibles con el precio de tu lista en la tienda de Farmamed.",
};

export default function StorePage() {
  return <StoreCatalogPage />;
}
