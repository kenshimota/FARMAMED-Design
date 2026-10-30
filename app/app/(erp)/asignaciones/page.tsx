import type { Metadata } from "next";
import { AssignmentListPage } from "@/components/erp/records/assignment-list";

export const metadata: Metadata = {
  title: "Asignaciones",
  description:
    "Consulta y administra los vendedores asignados a cada cliente de Farmamed.",
};

export default function AssignmentsPage() {
  return <AssignmentListPage />;
}
