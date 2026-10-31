import type { Metadata } from "next";
import { ImageFormPage } from "@/components/erp/records/image-form";

export const metadata: Metadata = {
  title: "Editar imagen",
  description:
    "Actualiza la referencia, la URL y la miniatura de una imagen de Farmamed.",
};

type EditImageRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditImageRoute({ params }: EditImageRouteProps) {
  const { id } = await params;
  return <ImageFormPage key={id} imageId={id} mode="edit" />;
}
