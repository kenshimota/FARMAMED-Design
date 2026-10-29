import Link from "next/link";
import { Icon } from "@/components/icons";
import { NoticeBanner } from "@/components/erp/ui/banner";

type RecoveryPlaceholderProps = {
  step: "solicitud" | "codigo" | "nueva";
};

const content = {
  solicitud: {
    title: "Solicitud aún no habilitada",
    description: "La solicitud de códigos de recuperación se incorporará en una próxima etapa. Esta pantalla no envía correos ni procesa datos.",
  },
  codigo: {
    title: "Validación aún no habilitada",
    description: "La validación de códigos se incorporará en una próxima etapa. Esta pantalla no solicita ni verifica códigos.",
  },
  nueva: {
    title: "Cambio aún no habilitado",
    description: "La definición de una nueva contraseña se incorporará en una próxima etapa. Esta pantalla no solicita ni guarda contraseñas o tokens.",
  },
} as const;

export function RecoveryPlaceholder({ step }: RecoveryPlaceholderProps) {
  const current = content[step];
  return (
    <div>
      <NoticeBanner role="status" title={current.title} tone="info">
        {current.description}
      </NoticeBanner>
      <Link className="mt-6 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline" href="/app/login">
        Volver a iniciar sesión
        <Icon name="arrow-right" size={16} />
      </Link>
    </div>
  );
}
