import type { Metadata } from "next";
import { AuthCard } from "@/components/erp/auth-card";
import { RecoveryPlaceholder } from "@/components/erp/recovery-placeholder";

export const metadata: Metadata = { title: "Validar código" };

export default function RecoveryCodePage() {
  return (
    <AuthCard eyebrow="Recuperación de acceso" title="Valida tu código" description="Este espacio está reservado para validar el código de recuperación.">
      <RecoveryPlaceholder step="codigo" />
    </AuthCard>
  );
}
