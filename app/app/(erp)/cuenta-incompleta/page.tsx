import type { Metadata } from "next";
import {
  CustomerIncompleteRoute,
  type CustomerIncompleteReason,
} from "@/components/erp/customer-incomplete";

export const metadata: Metadata = { title: "Cuenta incompleta" };

function readReason(value: string | string[] | undefined): CustomerIncompleteReason {
  const reason = Array.isArray(value) ? value[0] : value;
  if (reason === "vinculo" || reason === "lista") return reason;
  return "general";
}

export default async function CuentaIncompletaPage(
  props: PageProps<"/app/cuenta-incompleta">,
) {
  const searchParams = await props.searchParams;

  return <CustomerIncompleteRoute reason={readReason(searchParams.motivo)} />;
}
