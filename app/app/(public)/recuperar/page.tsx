import type { Metadata } from "next";
import { AuthCard } from "@/components/erp/auth-card";
import { RecoveryRequestForm } from "@/components/erp/recovery-request-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

// El segmento lee searchParams y puede bloquear la navegación; se exceptúa de la validación instantánea.
export const instant = false;

export default async function RecoveryPage(props: PageProps<"/app/recuperar">) {
  const searchParams = await props.searchParams;
  const aviso = typeof searchParams.aviso === "string" ? searchParams.aviso : null;

  return (
    <AuthCard
      description="Escribe el correo de tu cuenta de Farmamed y te enviaremos un código de 8 dígitos para recuperar tu acceso."
      eyebrow="Recuperación de acceso"
      title="Recupera tu contraseña"
    >
      <RecoveryRequestForm aviso={aviso} />
    </AuthCard>
  );
}
