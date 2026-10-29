import type { ReactNode } from "react";

type AuthCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthCard({ eyebrow, title, description, children }: AuthCardProps) {
  return (
    <section className="w-full max-w-[480px] rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_24px_70px_rgba(27,12,104,0.09)] sm:p-9">
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="mt-5 text-balance text-3xl font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-[14px] leading-6 text-muted">{description}</p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
