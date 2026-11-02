import type { Metadata } from "next";
import { UserDetailPage } from "@/components/erp/user-detail";

export const metadata: Metadata = {
  title: "Detalle del usuario",
  description:
    "Consulta la cuenta, el rol y el cliente vinculado al portal en Farmamed.",
};

type UserDetailRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function UserDetailRoute({ params }: UserDetailRouteProps) {
  const { id } = await params;
  return <UserDetailPage key={id} userId={id} />;
}
