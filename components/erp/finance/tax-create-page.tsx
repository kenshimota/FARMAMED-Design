"use client";

import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { canWriteModule } from "@/lib/permissions";
import { TaxForm } from "@/components/erp/finance/tax-form";

export function TaxCreatePage() {
  const { user } = useSession();
  if (!canWriteModule(user.role, "impuestos")) return <AccessState />;
  return <TaxForm mode="create" />;
}
