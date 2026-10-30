import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import { CustomerFormPage } from "@/components/erp/records/customer-form";

export const metadata: Metadata = {
  title: "Editar cliente",
  description:
    "Actualiza los datos de contacto y la ubicación de un cliente de Farmamed.",
};

type EditCustomerRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCustomerRoute({
  params,
}: EditCustomerRouteProps) {
  const { id } = await params;
  return <CustomerFormPage key={id} mode="edit" customerId={id} />;
}
