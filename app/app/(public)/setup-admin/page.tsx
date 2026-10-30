import type { Metadata } from "next";
import { AuthCard } from "@/components/erp/auth-card";
import { SetupStatus } from "@/components/erp/setup-status";

export const metadata: Metadata = { title: "Configura el administrador" };

const hints = [
  {
    title: "Credenciales únicas",
    description: "El nombre de usuario y el correo no pueden repetirse en el sistema.",
  },
  {
    title: "Contraseña segura",
    description: "Mínimo 8 caracteres.",
  },
  {
    title: "Acceso inmediato",
    description: "La cuenta se crea sin sesión iniciada; entra desde el acceso con tus credenciales.",
  },
] as const;

export default function SetupAdminPage() {
  return (
    <div className="grid w-full max-w-4xl gap-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
      <AuthCard
        description="Crea la cuenta que administrará el ERP. Solo está disponible mientras el sistema no tenga administrador."
        eyebrow="Configuración inicial"
        size="wide"
        title="Configura el administrador"
      >
        <SetupStatus />
      </AuthCard>

      <aside
        aria-labelledby="ayuda-administrador"
        className="rounded-[28px] border border-line bg-surface/80 p-6 lg:sticky lg:top-8"
      >
        <span className="eyebrow">Antes de empezar</span>
        <h2
          className="mt-4 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ayuda-administrador"
        >
          Una sola cuenta inicial
        </h2>
        <ul className="mt-5 space-y-4">
          {hints.map((hint, index) => (
            <li className="flex gap-3" key={hint.title}>
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-soft-lime text-[12px] font-bold text-ink"
              >
                {index + 1}
              </span>
              <div>
                <p className="text-[13px] font-semibold text-ink">{hint.title}</p>
                <p className="mt-1 text-[12px] leading-5 text-muted">{hint.description}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          Cuando exista un administrador, esta pantalla se bloquea y las cuentas nuevas se crean
          desde Usuarios.
        </p>
      </aside>
    </div>
  );
}
