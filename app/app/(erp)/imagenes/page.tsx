import type { Metadata } from "next";
import { ImageListPage } from "@/components/erp/records/image-list";

export const metadata: Metadata = {
  title: "Imágenes",
  description:
    "Consulta las imágenes reutilizables del catálogo de Farmamed, registradas por URL y miniatura.",
};

export default function ImagesPage() {
  return <ImageListPage />;
}
