import type { Metadata } from "next";
import { RoleCatalogPage } from "@/components/erp/role-catalog";

export const metadata: Metadata = {
  title: "Roles del sistema",
  description:
    "Catálogo de roles de Farmamed y matriz de permisos de interfaz por módulo y acción.",
};

export default function RolesPage() {
  return <RoleCatalogPage />;
}
