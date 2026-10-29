"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSession } from "@/components/erp/session-context";
import { canReadModule } from "@/lib/permissions";
import {
  useCurrencyStatus,
  type CurrencyStatus,
} from "@/components/erp/ui/use-currency-status";

const CurrencyStatusContext = createContext<CurrencyStatus | null>(null);

export function CurrencyStatusProvider({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const status = useCurrencyStatus(canReadModule(user.role, "monedas"));
  return (
    <CurrencyStatusContext.Provider value={status}>
      {children}
    </CurrencyStatusContext.Provider>
  );
}

export function useCurrencyStatusContext() {
  return useContext(CurrencyStatusContext);
}
