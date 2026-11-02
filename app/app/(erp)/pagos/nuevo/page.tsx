import type { Metadata } from "next";
import { PaymentFormPage } from "@/components/erp/records/payment-form";

export const metadata: Metadata = {
  title: "Registrar pago",
  description:
    "Registra un pago recibido de un cliente de Farmamed y acredita su billetera en la moneda del método de pago.",
};

type NewPaymentRouteProps = {
  searchParams: Promise<{ customer_id?: string | string[] }>;
};

function readCustomerId(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return /^[1-9]\d*$/.test(trimmed) ? trimmed : "";
}

export default async function NewPaymentRoute({
  searchParams,
}: NewPaymentRouteProps) {
  const params = await searchParams;
  return (
    <PaymentFormPage
      initialCustomerId={readCustomerId(params.customer_id)}
      mode="create"
    />
  );
}
