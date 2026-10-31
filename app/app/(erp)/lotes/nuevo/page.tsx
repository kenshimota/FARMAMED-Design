import type { Metadata } from "next";
import { LotFormPage } from "@/components/erp/records/lot-form";

export const metadata: Metadata = {
  title: "Nuevo lote",
  description:
    "Registra un lote de Farmamed con su número, vencimiento, cantidades y ubicación física.",
};

export default function NewLotPage() {
  return <LotFormPage mode="create" />;
}
