import type { Metadata } from "next";
import { ShelfDirectoryPage } from "@/components/erp/records/shelf-directory-page";

export const metadata: Metadata = {
  title: "Estantes",
  description:
    "Consulta la jerarquía de estantes y secciones de Farmamed agrupada por bodega.",
};

export default function ShelvesDirectoryPage() {
  return <ShelfDirectoryPage />;
}
