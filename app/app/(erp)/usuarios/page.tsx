import { ModulePlaceholder } from "@/components/erp/module-placeholder";
import { NewUserLink } from "@/components/erp/new-user-link";

export const metadata = { title: "Usuarios" };

export default function UsersPage() {
  return <ModulePlaceholder actions={<NewUserLink />} routePath="/app/usuarios" />;
}
