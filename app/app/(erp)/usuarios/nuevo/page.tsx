import type { Metadata } from "next";
import { AuthCard } from "@/components/erp/auth-card";
import { UserCreateForm } from "@/components/erp/user-create-form";

export const metadata: Metadata = { title: "Nuevo usuario" };

const hints = [
  {
    title: "Correo de bienvenida",
    description:
      "Se envía al crear la cuenta. Si el correo falla, la cuenta igual queda creada.",
  },
  {
    title: "Rol del usuario",
    description:
      "Define qué puede hacer dentro del ERP; la lista de roles disponibles la entrega el sistema.",
  },
  {
    title: "Contraseña",
    description: "Mínimo 8 caracteres. La defines tú al crear la cuenta.",
  },
] as const;

export default function NewUserPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:items-start">
      <AuthCard
        description="Crea una cuenta y define su rol. El usuario recibirá un correo de bienvenida."
        eyebrow="Administración"
        size="wide"
        title="Nuevo usuario"
      >
        <UserCreateForm />
      </AuthCard>

      <aside
        aria-labelledby="ayuda-nuevo-usuario"
        className="rounded-[28px] border border-line bg-surface p-6 lg:sticky lg:top-8"
      >
        <span className="eyebrow">A tener en cuenta</span>
        <h2
          className="mt-4 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="ayuda-nuevo-usuario"
        >
          Alta de una cuenta
        </h2>
        <ul className="mt-5 space-y-4">
          {hints.map((hint) => (
            <li key={hint.title}>
              <p className="text-[13px] font-semibold text-ink">{hint.title}</p>
              <p className="mt-1 text-[12px] leading-5 text-muted">{hint.description}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          Después de crearlo, el usuario podrá iniciar sesión con su correo o nombre de usuario.
        </p>
      </aside>
    </div>
  );
}
