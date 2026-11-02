import type { Metadata } from "next";
import { CustomerCart } from "@/components/erp/customer-cart";

export const metadata: Metadata = {
  title: "Carrito",
  description:
    "Revisa las líneas de tu pedido y ajusta cantidades antes de finalizar en Farmamed.",
};

export default function CustomerCartRoute() {
  return <CustomerCart />;
}
