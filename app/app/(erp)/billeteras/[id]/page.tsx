import type { Metadata } from "next";
import { WalletDetailPage } from "@/components/erp/records/wallet-detail";

export const metadata: Metadata = {
  title: "Detalle de la billetera",
  description:
    "Consulta el saldo y los movimientos de una billetera de cliente en Farmamed.",
};

type WalletDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function WalletDetailRoute({
  params,
}: WalletDetailRouteProps) {
  const { id } = await params;
  return <WalletDetailPage key={id} walletId={id} />;
}
