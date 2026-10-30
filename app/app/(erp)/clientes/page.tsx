import type { Metadata } from "next";
// Leaflet publica su hoja de estilos global. Next permite importar CSS de
// paquetes externos desde páginas y layouts; se importa en las páginas del
// módulo de clientes que montan el mapa.
import "leaflet/dist/leaflet.css";
import { CustomerListPage } from "@/components/erp/records/customer-list";

export const metadata: Metadata = {
  title: "Clientes",
  description:
    "Consulta y administra el directorio de clientes de Farmamed con su contacto y ubicación en el mapa.",
};

export default function CustomersPage() {
  return <CustomerListPage />;
}
