import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/erp/auth-card";
import { SetupStatus } from "@/components/erp/setup-status";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Administrador inicial" };

export default function SetupAdminPage() {
  return (
    <AuthCard eyebrow="Configuración inicial" title="Administrador inicial" description="Consulta si el registro inicial está disponible. Esta etapa no incluye el formulario de registro.">
      <SetupStatus />
      <Link className="mt-6 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline" href="/app/login">
        Volver a iniciar sesión
        <Icon name="arrow-right" size={16} />
      </Link>
    </AuthCard>
  );
}
