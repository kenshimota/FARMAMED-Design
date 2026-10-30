import type { Metadata } from "next";
import { AssignmentFormPage } from "@/components/erp/records/assignment-form";

export const metadata: Metadata = {
  title: "Nueva asignación",
  description:
    "Asigna un cliente de Farmamed a un vendedor activo con rol Vendedor.",
};

type NewAssignmentRouteProps = {
  searchParams: Promise<{ customer_id?: string | string[] }>;
};

function readCustomerId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : undefined;
}

export default async function NewAssignmentPage({
  searchParams,
}: NewAssignmentRouteProps) {
  const { customer_id } = await searchParams;
  return (
    <AssignmentFormPage
      initialCustomerId={readCustomerId(customer_id)}
      mode="create"
    />
  );
}
