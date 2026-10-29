import { Suspense, type ReactNode } from "react";
import { ErpLoading } from "@/components/erp/erp-loading";
import { SessionGate } from "@/components/erp/session-gate";

export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ErpLoading />}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}
