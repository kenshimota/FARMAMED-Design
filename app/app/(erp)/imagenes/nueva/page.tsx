import type { Metadata } from "next";
import { ImageFormPage } from "@/components/erp/records/image-form";

export const metadata: Metadata = {
  title: "Registrar imagen",
  description:
    "Registra una imagen reutilizable de Farmamed con su referencia, URL y miniatura.",
};

export default function NewImagePage() {
  return <ImageFormPage mode="create" />;
}
