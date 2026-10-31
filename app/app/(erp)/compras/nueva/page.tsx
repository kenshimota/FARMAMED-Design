import type { Metadata } from "next";
import { PurchaseFormPage } from "@/components/erp/records/purchase-form";

export const metadata: Metadata = {
  title: "Nueva compra",
  description:
    "Crea un borrador de compra de Farmamed con proveedor, moneda, notas y líneas con impuesto por monto.",
};

export default function NewPurchaseRoute() {
  return <PurchaseFormPage mode="create" />;
}
