import type { Metadata } from "next";
import { CustomerCheckout } from "@/components/erp/customer-checkout";

export const metadata: Metadata = {
  title: "Finalizar pedido",
  description:
    "Completa la dirección de entrega y confirma el borrador de tu pedido en Farmamed.",
};

export default function CustomerCheckoutRoute() {
  return <CustomerCheckout />;
}
