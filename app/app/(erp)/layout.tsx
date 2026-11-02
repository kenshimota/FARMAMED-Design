import { Suspense, type ReactNode } from "react";
import { SessionGate } from "@/components/erp/session-gate";
import { SessionLoading } from "@/components/erp/session-loading";

export default function ErpLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<SessionLoading />}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}
