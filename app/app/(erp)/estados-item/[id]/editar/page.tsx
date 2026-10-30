import type { Metadata } from "next";
import { ItemStateFormPage } from "@/components/erp/records/item-state-form";

export const metadata: Metadata = {
  title: "Editar estado de ítem",
  description:
    "Actualiza la etiqueta, la descripción y la condición de venta de un estado de ítem de Farmamed.",
};

type EditItemStateRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditItemStateRoute({
  params,
}: EditItemStateRouteProps) {
  const { id } = await params;
  return <ItemStateFormPage key={id} mode="edit" itemStateId={id} />;
}
