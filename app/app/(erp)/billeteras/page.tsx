import type { Metadata } from "next";
import { WalletListPage } from "@/components/erp/records/wallet-list";

export const metadata: Metadata = {
  title: "Billeteras de clientes",
  description:
    "Consulta el saldo por moneda de las billeteras de los clientes de Farmamed y accede a sus movimientos.",
};

type WalletsRouteProps = {
  searchParams: Promise<{ customer_id?: string | string[] }>;
};

function readCustomerId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

export default async function WalletsRoute({
  searchParams,
}: WalletsRouteProps) {
  const params = await searchParams;
  return <WalletListPage initialCustomerId={readCustomerId(params.customer_id)} />;
}
