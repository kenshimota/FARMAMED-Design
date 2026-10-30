"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { useSession } from "@/components/erp/session-context";
import { canWriteModule } from "@/lib/permissions";

export function NewUserLink() {
  const { user } = useSession();
  if (!canWriteModule(user.role, "usuarios")) return null;

  return (
    <div className="flex justify-end">
      <Link
        className="button-base button-primary min-h-11 px-5 text-[13px]"
        href="/app/usuarios/nuevo"
      >
        Nuevo usuario
        <Icon name="user" size={17} />
      </Link>
    </div>
  );
}
