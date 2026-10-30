"use client";

import { useParams } from "next/navigation";
import { CurrencyForm } from "@/components/erp/finance/currency-form";
import { fetchCurrency } from "@/lib/finance/currencies-api";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { canWriteModule } from "@/lib/permissions";

export default function EditCurrencyPage() {
  const { user } = useSession();
  if (!canWriteModule(user.role, "monedas")) return <AccessState />;
  return <EditCurrencyContent />;
}

function EditCurrencyContent() {
  const params = useParams();
  const id = String(params.id);
  const resource = useAsyncResource(() => fetchCurrency(id));

  if (resource.status === "loading") {
    return (
      <div aria-busy="true" className="space-y-5" role="status">
        <span className="sr-only">Cargando moneda…</span>
        <div className="rounded-[28px] border border-line bg-surface p-8">
          <div className="skeleton h-8 w-1/3" />
          <div className="skeleton mt-6 h-40 w-full" />
        </div>
      </div>
    );
  }

  if (resource.status === "error") {
    return (
      <RecordsLoadError
        description={resource.error?.message ?? "No pudimos cargar la moneda."}
        onRetry={resource.reload}
        title="No pudimos cargar la moneda"
      />
    );
  }

  if (!resource.data) return null;

  return <CurrencyForm currency={resource.data} mode="edit" />;
}
