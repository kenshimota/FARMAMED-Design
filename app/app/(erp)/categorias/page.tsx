import type { Metadata } from "next";
import { CategoryListPage } from "@/components/erp/records/category-list";

export const metadata: Metadata = {
  title: "Categorías",
  description:
    "Consulta, crea, renombra y elimina las categorías que organizan el catálogo de Farmamed.",
};

export default function CategoriesPage() {
  return <CategoryListPage />;
}
