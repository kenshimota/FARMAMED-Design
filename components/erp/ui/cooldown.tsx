"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

export { RECOVERY_COOLDOWN_SECONDS } from "@/lib/feedback";

export type CooldownTrigger = {
  seconds: number;
  id: number;
};

export function useRetryCooldown(trigger: CooldownTrigger | null) {
  const [remaining, setRemaining] = useState(0);
  const [prevTriggerId, setPrevTriggerId] = useState<number | null>(trigger?.id ?? null);
  const triggerId = trigger?.id ?? null;

  if (triggerId !== prevTriggerId) {
    setPrevTriggerId(triggerId);
    setRemaining(trigger ? trigger.seconds : 0);
  }

  const active = remaining > 0;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setRemaining((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  return remaining;
}

export function CooldownText({ remaining }: { remaining: number }) {
  return (
    <span className="tabular-nums" role="timer">
      {formatDuration(remaining)}
    </span>
  );
}
