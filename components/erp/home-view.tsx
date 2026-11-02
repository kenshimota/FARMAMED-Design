"use client";

import { CustomerHome } from "@/components/erp/customer-home";
import { DashboardHome } from "@/components/erp/dashboard-home";
import { useSession } from "@/components/erp/session-context";

export function HomeView() {
  const { user } = useSession();

  if (user.role === "customer") return <CustomerHome />;

  return <DashboardHome />;
}
