import type { Metadata } from "next";
import { InvoiceDetailPage } from "@/components/erp/records/invoice-detail";

export const metadata: Metadata = {
  title: "Detalle de la factura",
  description:
    "Consulta las líneas, los totales, el saldo pendiente, el vencimiento y los pagos aplicados a una factura de Farmamed.",
};

type InvoiceDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function InvoiceDetailRoute({
  params,
}: InvoiceDetailRouteProps) {
  const { id } = await params;
  return <InvoiceDetailPage key={id} invoiceId={id} />;
}
