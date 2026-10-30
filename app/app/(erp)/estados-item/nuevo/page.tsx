import type { Metadata } from "next";
import { ItemStateFormPage } from "@/components/erp/records/item-state-form";

export const metadata: Metadata = {
  title: "Nuevo estado de ítem",
  description:
    "Registra un estado de ítem de Farmamed con su clave estable, etiqueta y condición de venta.",
};

export default function NewItemStatePage() {
  return <ItemStateFormPage mode="create" />;
}
