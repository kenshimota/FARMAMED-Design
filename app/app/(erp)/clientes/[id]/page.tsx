import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import { CustomerDetailPage } from "@/components/erp/records/customer-detail";

export const metadata: Metadata = {
  title: "Detalle del cliente",
  description:
    "Consulta los datos registrados de un cliente de Farmamed y su ubicación.",
};

type CustomerDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function CustomerDetailRoute({
  params,
}: CustomerDetailRouteProps) {
  const { id } = await params;
  return <CustomerDetailPage key={id} customerId={id} />;
}
