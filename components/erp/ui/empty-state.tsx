import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4;
};

export function EmptyState({
  title,
  description,
  action,
  headingLevel = 3,
}: EmptyStateProps) {
  const Heading =
    headingLevel === 2 ? "h2" : headingLevel === 4 ? "h4" : "h3";

  return (
    <div className="rounded-2xl border border-line bg-background px-6 py-10 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-blue text-brand">
        <Icon name="box" size={21} />
      </span>
      <Heading className="mt-4 text-[15px] font-semibold text-ink">
        {title}
      </Heading>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
