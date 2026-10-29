import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Farmamed ERP",
    template: "%s | Farmamed ERP",
  },
  description: "Espacio de trabajo de Farmamed ERP para la gestión de droguerías.",
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return <div className="min-h-screen bg-background text-ink">{children}</div>;
}
