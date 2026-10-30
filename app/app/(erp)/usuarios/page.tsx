import type { Metadata } from "next";
import { UserListPage } from "@/components/erp/user-list";

export const metadata: Metadata = {
  title: "Usuarios",
  description:
    "Consulta quién tiene acceso al ERP, bloquea cuentas y elimina usuarios registrados en Farmamed.",
};

export default function UsersPage() {
  return <UserListPage />;
}
