import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/erp/auth-card";
import { LoginForm } from "@/components/erp/login-form";
import { SetupAdminLink } from "@/components/erp/setup-admin-link";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default function LoginPage() {
  return (
    <AuthCard eyebrow="Acceso al ERP" title="Bienvenido de nuevo" description="Usa tus credenciales para entrar a tu espacio de trabajo en Farmamed.">
      <Suspense fallback={<p className="text-[13px] text-muted" role="status">Preparando el acceso…</p>}>
        <LoginForm />
      </Suspense>
      <SetupAdminLink />
    </AuthCard>
  );
}
