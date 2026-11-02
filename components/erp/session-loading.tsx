import { Brand } from "@/components/brand";
import { Skeleton, SkeletonText } from "@/components/erp/ui/skeleton";

type SessionLoadingVariant = "erp" | "customer";

export function SessionLoading({
  variant = "erp",
}: {
  variant?: SessionLoadingVariant;
}) {
  const containerClassName =
    variant === "customer" ? "mx-auto w-full max-w-[1180px]" : "w-full";

  return (
    <div aria-busy="true" className="min-h-screen bg-background">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>
      <header className="border-b border-line bg-surface">
        <div
          className={`${containerClassName} flex min-h-16 items-center px-4 sm:px-6 lg:px-8`}
        >
          <Brand />
        </div>
      </header>
      <main
        className={`${containerClassName} px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8 lg:py-10`}
        id="contenido"
        tabIndex={-1}
      >
        <div className="space-y-6" role="status">
          <span className="sr-only">Validando tu sesión…</span>
          <section className="rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-9 lg:p-11">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-6 h-9 w-64 max-w-full" />
            <SkeletonText className="mt-4 max-w-xl" lines={2} />
            <Skeleton className="mt-8 h-12 w-40 rounded-full" />
          </section>
          <section className="rounded-[28px] border border-line bg-surface p-6 sm:p-8">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-5 h-7 w-48 max-w-full" />
            <Skeleton className="mt-6 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-2/3" />
          </section>
        </div>
      </main>
    </div>
  );
}
