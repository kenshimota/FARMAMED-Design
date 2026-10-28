import { Brand } from "@/components/brand";
import { Icon, type IconName } from "@/components/icons";
import { PharmaExperience } from "@/components/pharma-experience";
import { ProductShowcase } from "@/components/product-showcase";
import { SiteHeader } from "@/components/site-header";

const modules: { icon: IconName; number: string; title: string; description: string; detail: string }[] = [
  {
    icon: "box",
    number: "01",
    title: "Inventario inteligente",
    description: "Conoce existencias, movimientos y puntos de reposición sin perseguir hojas de cálculo.",
    detail: "Stock en tiempo real",
  },
  {
    icon: "layers",
    number: "02",
    title: "Lotes y vencimientos",
    description: "Ubica cada unidad por lote y anticipa vencimientos con alertas oportunas para tu equipo.",
    detail: "Trazabilidad completa",
  },
  {
    icon: "truck",
    number: "03",
    title: "Compras y proveedores",
    description: "Planifica reposiciones, compara necesidades y recibe mercancía con todo conectado.",
    detail: "Reposición ordenada",
  },
  {
    icon: "cart",
    number: "04",
    title: "Ventas conectadas",
    description: "Cada venta actualiza tu operación y te entrega una lectura clara del movimiento diario.",
    detail: "Información al instante",
  },
  {
    icon: "chart",
    number: "05",
    title: "Reportes accionables",
    description: "Convierte los datos de tu droguería en respuestas para comprar, vender y crecer mejor.",
    detail: "Decisiones con contexto",
  },
  {
    icon: "shield",
    number: "06",
    title: "Roles y seguridad",
    description: "Define accesos por responsabilidad y mantén cada acción importante bajo control.",
    detail: "Acceso por perfiles",
  },
];

const steps: { number: string; icon: IconName; title: string; description: string }[] = [
  {
    number: "01",
    icon: "database",
    title: "Conecta tu información",
    description: "Reúne productos, proveedores, existencias y ventas en un solo espacio de trabajo.",
  },
  {
    number: "02",
    icon: "sparkles",
    title: "Automatiza lo repetitivo",
    description: "Actualiza movimientos y activa avisos para que tu equipo se enfoque en lo importante.",
  },
  {
    number: "03",
    icon: "chart",
    title: "Decide con claridad",
    description: "Lee el estado de tu droguería y convierte cada dato en el siguiente paso.",
  },
];

const benefits: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "clock",
    title: "Más tiempo útil",
    description: "Menos digitación y conciliaciones manuales para tu equipo.",
  },
  {
    icon: "search",
    title: "Más visibilidad",
    description: "La información que necesitas, fácil de encontrar y entender.",
  },
  {
    icon: "clipboard",
    title: "Más control",
    description: "Cada lote, compra y movimiento con un contexto claro.",
  },
  {
    icon: "users",
    title: "Mejor trabajo en equipo",
    description: "Todos colaboran sobre una misma versión de la operación.",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="inicio">
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="technical-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
          <div aria-hidden="true" className="absolute -left-40 top-24 h-96 w-96 rounded-full bg-lime/10 blur-[100px]" />

          <div className="section-shell relative grid items-center gap-6 pb-12 pt-14 sm:pt-18 lg:min-h-[690px] lg:grid-cols-[1.02fr_0.98fr] lg:gap-0 lg:pb-16 lg:pt-10">
            <div className="relative z-10 max-w-[650px]">
              <div className="hero-enter inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white/80 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-brand shadow-sm sm:text-[11px]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-olive" />
                </span>
                Tecnología que cuida tu negocio
              </div>

              <h1 className="hero-enter-delay mt-7 text-balance text-[clamp(3.15rem,6.1vw,5.5rem)] font-semibold leading-[0.98] tracking-[-0.065em] text-ink">
                Toda tu droguería.
                <span className="mt-1 block text-brand">Una sola fórmula.</span>
              </h1>

              <p className="hero-enter-delay mt-7 max-w-[535px] text-[16px] leading-7 text-muted sm:text-[17px]">
                Centraliza inventario, compras, ventas y vencimientos en una plataforma simple. Farmamed ERP te ayuda a decidir con información clara, no con intuición.
              </p>

              <div className="hero-enter-late mt-8 flex flex-col gap-3 sm:flex-row">
                <a className="button-base button-primary" href="#producto">
                  Explorar la plataforma
                  <Icon name="arrow-up-right" size={18} />
                </a>
                <a className="button-base button-secondary" href="#modulos">
                  Conocer los módulos
                  <Icon name="arrow-right" size={17} />
                </a>
              </div>

              <div className="hero-enter-late mt-8 flex flex-wrap gap-x-5 gap-y-3 text-[11px] font-medium text-ink/65">
                <span className="inline-flex items-center gap-2"><Icon className="text-olive" name="check" size={15} />Trazabilidad por lote</span>
                <span className="inline-flex items-center gap-2"><Icon className="text-olive" name="check" size={15} />Alertas de vencimiento</span>
              </div>
            </div>

            <div className="hero-enter-late relative lg:-mr-7">
              <PharmaExperience />
            </div>
          </div>

          <div className="section-shell relative pb-14">
            <div className="grid overflow-hidden rounded-2xl border border-ink/[0.08] bg-white/80 shadow-[0_18px_60px_rgba(27,12,104,0.05)] backdrop-blur sm:grid-cols-3">
              {[
                { value: "En tiempo real", label: "Existencias y movimientos", icon: "box" as IconName },
                { value: "De principio a fin", label: "Trazabilidad de cada lote", icon: "layers" as IconName },
                { value: "Antes de vencer", label: "Alertas para actuar a tiempo", icon: "bell" as IconName },
              ].map((item) => (
                <div className="flex items-center gap-4 border-b border-ink/[0.07] px-6 py-5 last:border-0 sm:border-b-0 sm:border-r sm:last:border-0 lg:px-8" key={item.value}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-soft-lime text-olive"><Icon name={item.icon} size={20} /></span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{item.value}</p>
                    <p className="mt-1 text-[10px] text-muted">{item.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-label="Áreas conectadas" className="border-y border-ink/[0.07] bg-white">
          <div className="section-shell flex flex-col items-center justify-between gap-5 py-6 md:flex-row">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">Un mismo pulso para cada área</p>
            <div className="flex flex-wrap justify-center gap-x-7 gap-y-3 text-[12px] font-semibold text-ink/55 sm:gap-x-10">
              <span>Compras</span><span>Almacén</span><span>Mostrador</span><span>Administración</span>
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24 lg:py-30" id="modulos">
          <div className="section-shell">
            <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <span className="eyebrow">Un ecosistema conectado</span>
                <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-ink sm:text-5xl">
                  Menos tareas manuales.
                  <br />Más control.
                </h2>
              </div>
              <p className="max-w-md text-[15px] leading-7 text-muted">
                Herramientas que trabajan juntas para que cada área avance con la misma información.
              </p>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {modules.map((module, index) => (
                <article
                  className={`group relative overflow-hidden rounded-[22px] border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(27,12,104,0.08)] ${
                    index === 0 ? "border-brand/15 bg-soft-blue" : "border-ink/[0.08] bg-white"
                  }`}
                  key={module.title}
                >
                  <div aria-hidden="true" className="absolute -right-9 -top-9 h-28 w-28 rounded-full bg-lime/0 blur-2xl transition-colors group-hover:bg-lime/20" />
                  <div className="relative flex items-start justify-between">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${index === 0 ? "bg-brand text-white" : "bg-soft-lime text-olive"}`}>
                      <Icon name={module.icon} size={23} />
                    </span>
                    <span className="font-mono text-[10px] text-muted/60">{module.number}</span>
                  </div>
                  <h3 className="relative mt-7 text-[20px] font-semibold tracking-[-0.025em] text-ink">{module.title}</h3>
                  <p className="relative mt-3 text-[13px] leading-6 text-muted">{module.description}</p>
                  <div className="relative mt-6 flex items-center gap-2 border-t border-ink/[0.07] pt-4 text-[10px] font-semibold text-brand">
                    <span className="h-1.5 w-1.5 rounded-full bg-lime" />{module.detail}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell pb-20 sm:pb-24 lg:pb-30" id="producto">
          <ProductShowcase />
        </section>

        <section className="bg-white py-20 sm:py-24 lg:py-30" id="como-funciona">
          <div className="section-shell">
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow">Simple desde el inicio</span>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-ink sm:text-5xl">Del dato a la decisión, sin fricción.</h2>
              <p className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-muted">Una experiencia pensada para que la tecnología se sienta como una aliada, no como otra tarea.</p>
            </div>

            <div className="relative mt-14 grid gap-5 lg:grid-cols-3">
              <div aria-hidden="true" className="absolute left-[17%] right-[17%] top-10 hidden border-t border-dashed border-brand/25 lg:block" />
              {steps.map((step) => (
                <article className="relative rounded-[24px] border border-ink/[0.08] bg-background p-7 sm:p-8" key={step.number}>
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="flex h-20 w-20 items-center justify-center rounded-full border-8 border-white bg-ink text-lime shadow-sm"><Icon name={step.icon} size={25} /></span>
                    <span className="font-mono text-[11px] text-brand/60">{step.number}</span>
                  </div>
                  <h3 className="mt-7 text-[21px] font-semibold tracking-[-0.025em] text-ink">{step.title}</h3>
                  <p className="mt-3 text-[13px] leading-6 text-muted">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 sm:py-24 lg:py-30" id="beneficios">
          <div className="section-shell grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <span className="eyebrow">Una operación más saludable</span>
              <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.07] tracking-[-0.045em] text-ink sm:text-5xl">La claridad también hace crecer tu negocio.</h2>
              <p className="mt-6 max-w-lg text-[15px] leading-7 text-muted">Cuando tu equipo deja de buscar datos y empieza a usarlos, cada decisión se vuelve más ágil y segura.</p>
              <a className="mt-8 inline-flex items-center gap-2 text-[13px] font-semibold text-brand transition-colors hover:text-ink" href="#producto">
                Descubre una forma más simple de trabajar <Icon name="arrow-up-right" size={17} />
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((benefit, index) => (
                <article className={`rounded-[22px] p-6 ${index === 0 || index === 3 ? "bg-soft-lime" : "border border-ink/[0.08] bg-white"}`} key={benefit.title}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-olive shadow-sm"><Icon name={benefit.icon} size={20} /></span>
                  <h3 className="mt-6 text-[17px] font-semibold tracking-[-0.02em] text-ink">{benefit.title}</h3>
                  <p className="mt-2 text-[12px] leading-5 text-muted">{benefit.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell pb-8 pt-4 sm:pb-10">
          <div className="relative overflow-hidden rounded-[30px] bg-brand px-6 py-14 text-center sm:px-10 sm:py-18">
            <div aria-hidden="true" className="dot-grid absolute inset-0 opacity-20 [mask-image:linear-gradient(90deg,black,transparent_45%,transparent_55%,black)]" />
            <div aria-hidden="true" className="absolute -left-20 -top-28 h-64 w-64 rounded-full border-[50px] border-lime/15" />
            <div aria-hidden="true" className="absolute -bottom-28 -right-16 h-64 w-64 rounded-full border-[45px] border-cyan/25" />
            <div className="relative mx-auto max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white"><Icon name="sparkles" size={14} />El siguiente paso es simple</span>
              <h2 className="mt-6 text-balance text-4xl font-semibold leading-[1.06] tracking-[-0.045em] text-white sm:text-5xl">Haz que cada parte de tu droguería trabaje en conjunto.</h2>
              <p className="mx-auto mt-5 max-w-xl text-[14px] leading-6 text-white/70">Explora cómo Farmamed ERP convierte una operación compleja en una experiencia clara y conectada.</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a className="button-base bg-lime text-ink shadow-lg shadow-ink/15 transition-transform hover:-translate-y-0.5 hover:bg-white" href="#producto">Ver la demostración <Icon name="arrow-up-right" size={18} /></a>
                <a className="button-base border border-white/25 text-white transition-colors hover:bg-white/10" href="#inicio">Volver al inicio</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-ink">
        <div className="section-shell flex flex-col gap-8 py-10 md:flex-row md:items-center md:justify-between">
          <a aria-label="Farmamed ERP, volver al inicio" href="#inicio"><Brand inverse /></a>
          <nav aria-label="Navegación del pie de página" className="flex flex-wrap gap-x-6 gap-y-3 text-[11px] text-white/55">
            <a className="transition-colors hover:text-white" href="#producto">Plataforma</a>
            <a className="transition-colors hover:text-white" href="#modulos">Módulos</a>
            <a className="transition-colors hover:text-white" href="#como-funciona">Cómo funciona</a>
            <a className="transition-colors hover:text-white" href="#beneficios">Beneficios</a>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="section-shell flex flex-col gap-2 py-5 text-[9px] text-white/35 sm:flex-row sm:items-center sm:justify-between">
            <p>© Farmamed. Sistema ERP para droguerías.</p>
            <p>Información clara. Operación saludable.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
