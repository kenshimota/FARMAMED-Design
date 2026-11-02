import type { Metadata } from "next";
import { CustomerWalletPage } from "@/components/erp/customer/customer-wallet";

export const metadata: Metadata = {
  title: "Mi billetera",
  description:
    "Consulta el saldo por moneda y los movimientos de tu billetera en Farmamed.",
};

export default function CustomerWalletRoute() {
  return <CustomerWalletPage />;
}
