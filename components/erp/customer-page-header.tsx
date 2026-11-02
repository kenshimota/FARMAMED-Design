import type { ReactNode, RefObject } from "react";

type CustomerPageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  headingRef?: RefObject<HTMLHeadingElement | null>;
};

export function CustomerPageHeader({
  eyebrow,
  title,
  description,
  actions,
  headingRef,
}: CustomerPageHeaderProps) {
  return (
    <section
      aria-labelledby="titulo-pagina-cliente"
      className="relative overflow-hidden rounded-[28px] border border-ink/[0.08] bg-surface shadow-[0_18px_60px_rgba(27,12,104,0.05)]"
    >
      <div
        aria-hidden="true"
        className="technical-grid absolute inset-0 opacity-50 [mask-image:linear-gradient(135deg,black,transparent_58%)]"
      />
      <div
        aria-hidden="true"
        className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[44px] border-lime/10"
      />
      <div className="relative p-6 sm:p-8 lg:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="eyebrow">{eyebrow}</span>
            <h1
              className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-4xl"
              id="titulo-pagina-cliente"
              ref={headingRef}
              tabIndex={-1}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-3 max-w-2xl text-[14px] leading-7 text-muted">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
