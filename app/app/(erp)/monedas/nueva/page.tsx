import { CurrencyForm } from "@/components/erp/finance/currency-form";

export const metadata = { title: "Nueva moneda" };

export default function NewCurrencyPage() {
  return <CurrencyForm mode="create" />;
}
