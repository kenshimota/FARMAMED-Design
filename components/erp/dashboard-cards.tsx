import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import type { DashboardData } from "@/components/erp/ui/use-dashboard-data";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { PanelError } from "@/components/erp/ui/panel-error";
import { SkeletonCard } from "@/components/erp/ui/skeleton";
import type { CurrencyStatus } from "@/components/erp/ui/use-currency-status";
import type { AsyncResource } from "@/components/erp/ui/use-async-resource";
import { formatCount, isApproximateCount } from "@/lib/dashboard";
import { canReadModule, type ModuleKey, type Role } from "@/lib/permissions";

type SummaryCard = {
  key: string;
  label: string;
  icon: IconName;
  href: string;
  status: "loading" | "error" | "ready";
  count: number;
  onRetry: () => void;
};

type SummaryCardSlot = Omit<SummaryCard, "key" | "label" | "icon" | "href">;

function fromResource<T>(
  resource: AsyncResource<T>,
  countOf: (data: T) => number,
): SummaryCardSlot {
  const status =
    resource.status === "loading" ||
    resource.status === "refreshing" ||
    resource.status === "idle"
      ? "loading"
      : resource.status === "error"
        ? "error"
        : "ready";
  return {
    status,
    count: resource.data !== null ? countOf(resource.data) : 0,
    onRetry: resource.reload,
  };
}

function fromCurrencyStatus(currencies: CurrencyStatus): SummaryCardSlot {
  return {
    status:
      currencies.status === "loading" ||
      currencies.status === "refreshing" ||
      currencies.status === "idle"
        ? "loading"
        : currencies.status === "error"
          ? "error"
          : "ready",
    count: currencies.currencies.length,
    onRetry: currencies.reload,
  };
}

const CARD_ORDER: {
  key: string;
  label: string;
  icon: IconName;
  module: ModuleKey;
  href: string;
}[] = [
  {
    key: "products",
    label: "Productos en catálogo",
    icon: "package",
    module: "catalogo",
    href: "/app/productos",
  },
  {
    key: "customers",
    label: "Clientes registrados",
    icon: "users",
    module: "clientes",
    href: "/app/clientes",
  },
  {
    key: "purchases",
    label: "Compras en borrador",
    icon: "clipboard",
    module: "compras",
    href: "/app/compras",
  },
  {
    key: "lots",
    label: "Lotes vencidos",
    icon: "clock",
    module: "lotes",
    href: "/app/lotes",
  },
  {
    key: "stocks",
    label: "Existencias con stock",
    icon: "box",
    module: "existencias",
    href: "/app/existencias",
  },
  {
    key: "currencies",
    label: "Monedas activas",
    icon: "coins",
    module: "monedas",
    href: "/app/monedas",
  },
];

function buildCards(
  role: Role,
  data: DashboardData,
  currencies: CurrencyStatus | null,
): SummaryCard[] {
  const slots: Record<string, SummaryCardSlot | null> = {
    products: fromResource(data.products, (count) => count),
    customers: fromResource(data.customers, (count) => count),
    purchases: fromResource(data.purchases, (list) => list.count),
    lots: fromResource(data.expiredLots, (list) => list.count),
    stocks: fromResource(data.stocks, (list) => list.count),
    currencies: currencies ? fromCurrencyStatus(currencies) : null,
  };

  return CARD_ORDER.filter(
    (definition) =>
      slots[definition.key] !== null && canReadModule(role, definition.module),
  )
    .slice(0, 4)
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      icon: definition.icon,
      href: definition.href,
      ...slots[definition.key]!,
    }));
}

export function DashboardCards({
  role,
  data,
  currencies,
}: {
  role: Role;
  data: DashboardData;
  currencies: CurrencyStatus | null;
}) {
  const cards = buildCards(role, data, currencies);
  const anyLoading = cards.some((card) => card.status === "loading");

  return (
    <section
      aria-labelledby="titulo-resumen"
      className="rounded-[28px] border border-ink/[0.08] bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-7"
    >
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <span className="eyebrow">Resumen operativo</span>
          <h2
            className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-ink"
            id="titulo-resumen"
          >
            Resumen de hoy
          </h2>
        </div>
        <p className="text-[12px] text-muted">Datos reales de tu ERP</p>
      </div>

      {cards.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            description="Tu rol todavía no tiene tarjetas de resumen habilitadas."
            title="Sin resumen disponible"
          />
        </div>
      ) : (
        <div aria-busy={anyLoading || undefined} className="mt-6">
          {anyLoading && (
            <span className="sr-only" role="status">
              Cargando el resumen de hoy…
            </span>
          )}
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <li key={card.key}>
                {card.status === "loading" ? (
                  <div className="min-h-36 rounded-2xl border border-line bg-background p-5">
                    <SkeletonCard />
                  </div>
                ) : card.status === "error" ? (
                  <div className="min-h-36 rounded-2xl border border-line bg-background p-4">
                    <PanelError
                      description="No pudimos cargar este dato."
                      onRetry={card.onRetry}
                    />
                  </div>
                ) : (
                  <Link
                    className="group flex min-h-36 flex-col justify-between rounded-2xl border border-line bg-background p-5 transition-colors hover:border-brand/30 hover:bg-soft-blue"
                    href={card.href}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                        {card.label}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand shadow-sm">
                        <Icon name={card.icon} size={18} />
                      </span>
                    </span>
                    <span className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-ink">
                      {formatCount(card.count)}
                      {isApproximateCount(card.count) && (
                        <span className="sr-only"> (cifra aproximada)</span>
                      )}
                    </span>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand">
                      Ver listado
                      <Icon
                        className="transition-transform group-hover:translate-x-0.5"
                        name="arrow-right"
                        size={14}
                      />
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
