import type { Metadata } from "next";
import { AuthCard } from "@/components/erp/auth-card";
import { RecoveryPasswordForm } from "@/components/erp/recovery-password-form";

export const metadata: Metadata = { title: "Define una nueva contraseña" };

export default function RecoveryNewPasswordPage() {
  return (
    <AuthCard
      description="Elige una contraseña nueva con al menos 8 caracteres para volver a entrar a Farmamed."
      eyebrow="Recuperación de acceso"
      title="Define una nueva contraseña"
    >
      <RecoveryPasswordForm />
    </AuthCard>
  );
}
