import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-line bg-background px-6 py-10 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-soft-blue text-brand">
        <Icon name="box" size={21} />
      </span>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-muted">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
