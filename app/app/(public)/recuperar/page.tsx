import type { Metadata } from "next";
import { AuthCard } from "@/components/erp/auth-card";
import { RecoveryPlaceholder } from "@/components/erp/recovery-placeholder";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoveryPage() {
  return (
    <AuthCard eyebrow="Recuperación de acceso" title="Recupera tu contraseña" description="Este espacio está reservado para solicitar un código de recuperación.">
      <RecoveryPlaceholder step="solicitud" />
    </AuthCard>
  );
}
