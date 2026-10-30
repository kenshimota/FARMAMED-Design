import { TaxForm } from "@/components/erp/finance/tax-form";

export const metadata = { title: "Nuevo impuesto" };

export default function NewTaxPage() {
  return <TaxForm mode="create" />;
}
