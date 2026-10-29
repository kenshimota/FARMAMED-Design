"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { SessionUser } from "@/lib/session";

type SessionContextValue = {
  user: SessionUser;
  logout: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  user,
  logout,
  children,
}: SessionContextValue & { children: ReactNode }) {
  return (
    <SessionContext.Provider value={{ user, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("La sesión solo está disponible dentro del panel protegido.");
  }
  return context;
}
