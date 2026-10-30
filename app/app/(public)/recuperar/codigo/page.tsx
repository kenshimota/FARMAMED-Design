import type { Metadata } from "next";
import { AuthCard } from "@/components/erp/auth-card";
import { RecoveryCodeForm } from "@/components/erp/recovery-code-form";

export const metadata: Metadata = { title: "Ingresa el código" };

export default function RecoveryCodePage() {
  return (
    <AuthCard
      description="Ingresa el código de 8 dígitos que enviamos a tu correo para confirmar que eres tú."
      eyebrow="Recuperación de acceso"
      title="Ingresa el código"
    >
      <RecoveryCodeForm />
    </AuthCard>
  );
}
