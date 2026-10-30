import type { Metadata } from "next";
import { AssignmentFormPage } from "@/components/erp/records/assignment-form";

export const metadata: Metadata = {
  title: "Reasignar vendedor",
  description:
    "Cambia el vendedor responsable de un cliente de Farmamed sin modificar el cliente.",
};

type EditAssignmentRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function EditAssignmentRoute({
  params,
}: EditAssignmentRouteProps) {
  const { id } = await params;
  return <AssignmentFormPage key={id} assignmentId={id} mode="edit" />;
}
