import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import { CustomerFormPage } from "@/components/erp/records/customer-form";

export const metadata: Metadata = {
  title: "Nuevo cliente",
  description:
    "Registra un cliente de Farmamed con su correo, dirección y ubicación en el mapa.",
};

export default function NewCustomerPage() {
  return <CustomerFormPage mode="create" />;
}
