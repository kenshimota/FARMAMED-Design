import { Brand } from "@/components/brand";

export function ErpLoading() {
  return (
    <main className="min-h-screen bg-background" aria-busy="true">
      <div className="flex min-h-screen">
        <div aria-hidden="true" className="hidden w-20 shrink-0 border-r border-line bg-surface p-4 md:block xl:w-[264px]">
          <div className="h-10 w-10 rounded-xl bg-soft-blue xl:w-40" />
          <div className="mt-10 space-y-3">
            <div className="h-11 rounded-xl bg-background" />
            <div className="h-11 rounded-xl bg-background" />
            <div className="h-11 rounded-xl bg-background" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div aria-hidden="true" className="flex h-16 items-center justify-between border-b border-line bg-surface px-4 sm:px-6 xl:px-8">
            <div className="h-3 w-32 rounded-full bg-line" />
            <div className="h-9 w-9 rounded-full bg-soft-blue" />
          </div>
          <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 xl:p-8">
            <section className="flex min-h-[340px] flex-col items-center justify-center rounded-[28px] border border-ink/[0.08] bg-surface p-8 text-center shadow-[0_18px_60px_rgba(27,12,104,0.06)]">
              <Brand />
              <div aria-hidden="true" className="mt-8 w-full max-w-xs space-y-3">
                <div className="mx-auto h-3 w-40 rounded-full bg-line" />
                <div className="mx-auto h-3 w-56 max-w-full rounded-full bg-soft-blue" />
              </div>
              <p className="mt-6 text-[13px] font-medium text-muted" role="status">Validando tu sesión…</p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
