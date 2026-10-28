"use client";

import { useState } from "react";
import { Icon, type IconName } from "./icons";

type ViewKey = "inventario" | "compras" | "ventas";
type Tone = "green" | "blue" | "amber";

type ProductView = {
  label: string;
  icon: IconName;
  welcome: string;
  action: string;
  stats: { label: string; value: string; detail: string }[];
  chartTitle: string;
  chartCaption: string;
  bars: number[];
  columns: string[];
  rows: { values: string[]; tone: Tone }[];
};

const views: Record<ViewKey, ProductView> = {
  inventario: {
    label: "Inventario",
    icon: "box",
    welcome: "Tu inventario, de un vistazo",
    action: "Nuevo ingreso",
    stats: [
      { label: "Unidades disponibles", value: "18.420", detail: "+8,2% este mes" },
      { label: "Productos activos", value: "1.284", detail: "6 categorías" },
      { label: "Alertas por revisar", value: "08", detail: "3 priorizadas" },
    ],
    chartTitle: "Movimiento de inventario",
    chartCaption: "Entradas y salidas · últimos 7 días",
    bars: [48, 62, 54, 76, 66, 88, 72],
    columns: ["Producto", "Lote", "Disponible", "Estado"],
    rows: [
      { values: ["Losartán 50 mg", "LT-2408", "1.240 und", "Saludable"], tone: "green" },
      { values: ["Ibuprofeno 400 mg", "IB-1932", "860 und", "Saludable"], tone: "green" },
      { values: ["Vitamina C 500 mg", "VC-0821", "124 und", "Stock bajo"], tone: "amber" },
    ],
  },
  compras: {
    label: "Compras",
    icon: "truck",
    welcome: "Compras siempre a tiempo",
    action: "Nueva orden",
    stats: [
      { label: "Órdenes abiertas", value: "12", detail: "4 llegan hoy" },
      { label: "Unidades por recibir", value: "3.680", detail: "18 referencias" },
      { label: "Proveedores activos", value: "24", detail: "100% verificados" },
    ],
    chartTitle: "Recepciones de la semana",
    chartCaption: "Unidades recibidas · últimos 7 días",
    bars: [35, 52, 70, 46, 82, 68, 92],
    columns: ["Orden", "Proveedor", "Entrega", "Estado"],
    rows: [
      { values: ["OC-00284", "Distribuidora Central", "Hoy, 2:30 p. m.", "En tránsito"], tone: "blue" },
      { values: ["OC-00285", "Laboratorios del Norte", "Mañana", "Confirmada"], tone: "green" },
      { values: ["OC-00286", "Insumos Médicos SAS", "30 oct.", "Por aprobar"], tone: "amber" },
    ],
  },
  ventas: {
    label: "Ventas",
    icon: "chart",
    welcome: "Cada venta, mejor conectada",
    action: "Nueva venta",
    stats: [
      { label: "Ventas de hoy", value: "$8.460", detail: "+12,5% vs. ayer" },
      { label: "Transacciones", value: "146", detail: "Ticket medio $58" },
      { label: "Productos vendidos", value: "382", detail: "28 categorías" },
    ],
    chartTitle: "Ritmo de ventas",
    chartCaption: "Ventas netas · últimos 7 días",
    bars: [58, 46, 72, 62, 84, 76, 94],
    columns: ["Comprobante", "Canal", "Hora", "Estado"],
    rows: [
      { values: ["FV-01482", "Punto de venta", "10:42 a. m.", "Completada"], tone: "green" },
      { values: ["FV-01481", "Mostrador", "10:38 a. m.", "Completada"], tone: "green" },
      { values: ["FV-01480", "Pedido digital", "10:31 a. m.", "Por entregar"], tone: "blue" },
    ],
  },
};

const toneClasses: Record<Tone, string> = {
  green: "bg-[#e9f5dc] text-[#4c7316]",
  blue: "bg-soft-blue text-brand",
  amber: "bg-[#fff4d9] text-[#8a5a00]",
};

const order: ViewKey[] = ["inventario", "compras", "ventas"];

export function ProductShowcase() {
  const [active, setActive] = useState<ViewKey>("inventario");
  const view = views[active];

  return (
    <div className="relative overflow-hidden rounded-[30px] bg-ink px-5 py-14 sm:px-8 sm:py-18 lg:px-14 lg:py-20">
      <div aria-hidden="true" className="absolute -right-24 -top-32 h-96 w-96 rounded-full bg-cyan/20 blur-[110px]" />
      <div aria-hidden="true" className="absolute -bottom-44 -left-24 h-96 w-96 rounded-full bg-lime/15 blur-[120px]" />

      <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <span className="eyebrow !text-lime">La plataforma</span>
          <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-white sm:text-5xl">
            Información clara.
            <br />
            Decisiones inmediatas.
          </h2>
        </div>
        <p className="max-w-md text-[15px] leading-7 text-white/60">
          Cada área comparte la misma fuente de verdad. Menos cruces de datos, más tiempo para atender tu negocio.
        </p>
      </div>

      <div className="relative mt-9 flex flex-wrap gap-2" aria-label="Vistas del panel demostrativo">
        {order.map((key) => {
          const item = views[key];
          const selected = active === key;
          return (
            <button
              aria-pressed={selected}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[13px] font-medium transition-colors ${
                selected ? "bg-lime text-ink" : "border border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              key={key}
              onClick={() => setActive(key)}
              type="button"
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-5 overflow-hidden rounded-[22px] bg-white p-2 shadow-2xl shadow-black/20">
        <div className="flex h-12 items-center justify-between border-b border-ink/[0.07] px-3 sm:px-4">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-[9px] font-bold text-lime">FM</span>
            <span className="hidden text-[11px] text-muted sm:inline">Farmamed</span>
            <span className="hidden text-[11px] text-line sm:inline">/</span>
            <span className="text-[11px] font-semibold text-ink">{view.label}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="hidden items-center gap-2 rounded-full bg-[#f2f5f3] px-3 py-1.5 text-[9px] font-medium text-muted sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-olive" /> Datos de demostración
            </span>
            <Icon className="text-muted" name="bell" size={15} />
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-soft-blue text-[9px] font-bold text-brand">AD</span>
          </div>
        </div>

        <div className="flex min-h-[490px]">
          <aside className="hidden w-[154px] shrink-0 flex-col border-r border-ink/[0.07] px-3 py-5 md:flex">
            <p className="px-3 text-[8px] font-semibold uppercase tracking-[0.16em] text-muted/70">Espacio de trabajo</p>
            <div className="mt-3 space-y-1">
              {order.map((key) => {
                const item = views[key];
                return (
                  <button
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[10px] font-medium ${
                      active === key ? "bg-soft-blue text-brand" : "text-muted hover:bg-background"
                    }`}
                    key={key}
                    onClick={() => setActive(key)}
                    type="button"
                  >
                    <Icon name={item.icon} size={14} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-auto rounded-xl bg-soft-lime p-3">
              <Icon className="text-olive" name="sparkles" size={17} />
              <p className="mt-2 text-[9px] font-semibold leading-4 text-ink">Todo sincronizado</p>
              <p className="mt-0.5 text-[8px] leading-3 text-muted">Última revisión: ahora</p>
            </div>
          </aside>

          <div className="min-w-0 flex-1 bg-[#f8faf9] p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-medium text-muted">Resumen operativo</p>
                <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.025em] text-ink sm:text-xl">{view.welcome}</h3>
              </div>
              <span className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-brand px-3 text-[9px] font-semibold text-white sm:px-4">
                <span className="mr-1.5 text-sm leading-none">+</span>{view.action}
              </span>
            </div>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {view.stats.map((stat) => (
                <div className="rounded-xl border border-ink/[0.06] bg-white p-3.5" key={stat.label}>
                  <p className="truncate text-[8px] font-medium text-muted">{stat.label}</p>
                  <p className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-ink">{stat.value}</p>
                  <p className="mt-1 text-[8px] text-olive">{stat.detail}</p>
                </div>
              ))}
            </div>

            <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1.45fr_1fr]">
              <div className="rounded-xl border border-ink/[0.06] bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold text-ink">{view.chartTitle}</p>
                    <p className="mt-1 text-[8px] text-muted">{view.chartCaption}</p>
                  </div>
                  <span className="rounded-md bg-soft-lime px-2 py-1 text-[8px] font-medium text-olive">7 días</span>
                </div>
                <div className="mt-4 flex h-[92px] items-end justify-between gap-2 border-b border-ink/[0.07] px-1">
                  {view.bars.map((height, index) => (
                    <div className="flex h-full flex-1 items-end" key={`${active}-${index}`}>
                      <div
                        className={`w-full rounded-t-[4px] ${index === 5 ? "bg-lime" : "bg-brand/80"}`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between px-1 text-[7px] text-muted">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
                </div>
              </div>

              <div className="hidden rounded-xl border border-ink/[0.06] bg-white p-4 lg:block">
                <p className="text-[10px] font-semibold text-ink">Salud de la operación</p>
                <div className="mt-3 flex items-center gap-4">
                  <div className="relative flex h-[74px] w-[74px] shrink-0 items-center justify-center rounded-full border-[8px] border-soft-lime border-t-olive border-r-lime">
                    <span className="text-[16px] font-semibold text-ink">92%</span>
                  </div>
                  <div>
                    <p className="text-[9px] font-medium text-ink">Operación saludable</p>
                    <p className="mt-1 text-[8px] leading-3 text-muted">La mayoría de indicadores están al día.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2.5 overflow-hidden rounded-xl border border-ink/[0.06] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[470px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-ink/[0.06] text-[7px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {view.columns.map((column) => <th className="px-4 py-2.5 font-semibold" key={column}>{column}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows.map((row) => (
                      <tr className="border-b border-ink/[0.05] last:border-0" key={row.values[0]}>
                        {row.values.map((value, index) => (
                          <td className={`px-4 py-3 text-[8px] ${index === 0 ? "font-semibold text-ink" : "text-muted"}`} key={value}>
                            {index === 3 ? <span className={`rounded-full px-2 py-1 font-medium ${toneClasses[row.tone]}`}>{value}</span> : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="relative mt-4 text-center text-[10px] text-white/40">Interfaz ilustrativa. Los datos mostrados no corresponden a una operación real.</p>
    </div>
  );
}
