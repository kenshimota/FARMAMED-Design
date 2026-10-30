import type { Metadata } from "next";
import { LocationListPage } from "@/components/erp/records/location-list";

export const metadata: Metadata = {
  title: "Ubicaciones",
  description:
    "Consulta y administra los estados y las ciudades de Venezuela del catálogo de Farmamed.",
};

export default function LocationsPage() {
  return <LocationListPage />;
}
