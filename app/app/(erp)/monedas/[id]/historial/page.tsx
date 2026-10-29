import { ModulePlaceholder } from "@/components/erp/module-placeholder";

export const metadata = { title: "Historial de tasas" };

export default function CurrencyHistoryPage() {
  return <ModulePlaceholder routePath="/app/monedas/[id]/historial" />;
}
