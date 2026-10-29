import type { Metadata } from "next";
import { AuthCard } from "@/components/erp/auth-card";
import { RecoveryPlaceholder } from "@/components/erp/recovery-placeholder";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default function NewPasswordPage() {
  return (
    <AuthCard eyebrow="Recuperación de acceso" title="Define una nueva contraseña" description="Este espacio está reservado para completar la recuperación con un token válido.">
      <RecoveryPlaceholder step="nueva" />
    </AuthCard>
  );
}
