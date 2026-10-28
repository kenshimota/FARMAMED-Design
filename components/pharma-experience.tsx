"use client";

import dynamic from "next/dynamic";
import { Icon } from "./icons";

function ScenePlaceholder() {
  return (
    <div className="scene-loading absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="relative h-40 w-28 rounded-[28px] border border-brand/10 bg-white/80 shadow-xl">
        <div className="absolute -top-5 left-1/2 h-7 w-[104px] -translate-x-1/2 rounded-lg bg-lime/80" />
        <div className="absolute left-2 right-2 top-16 h-16 rounded-lg bg-soft-blue">
          <div className="mx-auto mt-5 h-2 w-16 rounded-full bg-brand/30" />
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-olive/30" />
        </div>
      </div>
    </div>
  );
}

const PharmaScene = dynamic(() => import("./pharma-scene"), {
  ssr: false,
  loading: ScenePlaceholder,
});

export function PharmaExperience() {
  return (
    <div
      aria-label="Composición tridimensional animada de un frasco, empaques y cápsulas Farmamed, rodeada por indicadores de inventario y trazabilidad."
      className="relative mx-auto h-[450px] w-full max-w-[640px] sm:h-[550px] lg:h-[600px]"
      role="img"
    >
      <div aria-hidden="true" className="scene-shell absolute inset-[3%] rounded-full" />
      <div aria-hidden="true" className="dot-grid absolute inset-[9%] rounded-full opacity-35 [mask-image:radial-gradient(circle,black,transparent_70%)]" />
      <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[73%] w-[73%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/[0.08]" />

      <PharmaScene />
      <div aria-hidden="true" className="scene-vignette pointer-events-none absolute inset-0" />

      <div className="glass-card pointer-events-none absolute right-0 top-[13%] rounded-2xl p-3.5 sm:right-[2%] sm:p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-soft-lime text-olive"><Icon name="box" size={18} /></span>
          <div>
            <p className="text-[9px] font-medium text-muted">Inventario sincronizado</p>
            <p className="mt-1 text-[12px] font-semibold text-ink">Todo bajo control</p>
          </div>
          <span className="ml-2 h-2 w-2 rounded-full bg-lime shadow-[0_0_0_4px_rgba(165,215,55,0.18)]" />
        </div>
      </div>

      <div className="glass-card pointer-events-none absolute bottom-[12%] left-0 rounded-2xl p-3.5 sm:left-[1%] sm:p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-soft-blue text-brand"><Icon name="layers" size={18} /></span>
          <div>
            <p className="text-[9px] font-medium text-muted">Trazabilidad de lote</p>
            <p className="mt-1 font-mono text-[11px] font-semibold text-ink">FM–0248 · Activo</p>
          </div>
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-ink/[0.06]"><div className="h-full w-[82%] rounded-full bg-brand" /></div>
      </div>

      <div className="glass-card pointer-events-none absolute bottom-[5%] right-[3%] hidden items-center gap-2 rounded-full px-3.5 py-2.5 sm:flex">
        <Icon className="text-olive" name="check" size={14} />
        <span className="text-[9px] font-semibold text-ink">Vencimientos monitoreados</span>
      </div>
    </div>
  );
}
