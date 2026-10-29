import Link from "next/link";
import { Icon } from "@/components/icons";

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
      <div className="rounded-2xl border border-brand/20 bg-soft-blue p-5">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 shrink-0 text-brand" name="clock" size={21} />
          <div>
            <h2 className="text-sm font-semibold text-ink">{current.title}</h2>
            <p className="mt-2 text-[13px] leading-6 text-muted">{current.description}</p>
          </div>
        </div>
      </div>
      <Link className="mt-6 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline" href="/app/login">
        Volver a iniciar sesión
        <Icon name="arrow-right" size={16} />
      </Link>
    </div>
  );
}
