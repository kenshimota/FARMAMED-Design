import type { Metadata } from "next";
import { PaymentTermListPage } from "@/components/erp/records/payment-term-list";

export const metadata: Metadata = {
  title: "Términos de pago",
  description:
    "Administra las condiciones de contado y crédito que definen el vencimiento de las facturas de Farmamed.",
};

export default function PaymentTermsPage() {
  return <PaymentTermListPage />;
}
