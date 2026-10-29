import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export type BannerTone = "info" | "success" | "warning" | "danger";

const TONE_STYLES: Record<BannerTone, { shell: string; icon: IconName; iconClass: string }> = {
  info: {
    shell: "border-brand/20 bg-soft-blue text-ink",
    icon: "shield",
    iconClass: "text-brand",
  },
  success: {
    shell: "border-olive/30 bg-soft-lime text-ink",
    icon: "check",
    iconClass: "text-olive",
  },
  warning: {
    shell: "border-olive/35 bg-soft-lime text-ink",
    icon: "alert",
    iconClass: "text-olive",
  },
  danger: {
    shell: "border-alert/25 bg-alert/[0.06] text-alert-ink",
    icon: "alert",
    iconClass: "text-alert-ink",
  },
};

type NoticeBannerProps = {
  tone?: BannerTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  role?: "status" | "alert";
  className?: string;
};

export function NoticeBanner({
  tone = "info",
  title,
  children,
  action,
  role,
  className = "",
}: NoticeBannerProps) {
  const styles = TONE_STYLES[tone];
  const resolvedRole = role ?? (tone === "danger" ? "alert" : "status");
  return (
    <div
      aria-live={resolvedRole === "alert" ? "assertive" : "polite"}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-[13px] leading-6 ${styles.shell} ${className}`}
      role={resolvedRole}
    >
      <Icon className={`mt-0.5 shrink-0 ${styles.iconClass}`} name={styles.icon} size={20} />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-1" : undefined}>{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
