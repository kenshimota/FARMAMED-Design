import {
  RECOVERY_CODE_TTL_SECONDS,
  RECOVERY_COOLDOWN_SECONDS,
} from "@/lib/feedback";

export const RECOVERY_FLOW_KEY = "farmamed.recovery.flow";

export type RecoveryFlow = {
  email: string;
  sentAt: number | null;
  token: string | null;
};

const listeners = new Set<() => void>();
let snapshot: RecoveryFlow | null | undefined;

function parseFlow(raw: string | null): RecoveryFlow | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.email !== "string" || !record.email.trim()) return null;
    return {
      email: record.email.trim(),
      sentAt: typeof record.sentAt === "number" ? record.sentAt : null,
      token:
        typeof record.token === "string" && record.token.trim()
          ? record.token
          : null,
    };
  } catch {
    return null;
  }
}

function notify() {
  snapshot = undefined;
  for (const listener of listeners) listener();
}

export function subscribeRecoveryFlow(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRecoveryFlowSnapshot(): RecoveryFlow | null {
  if (typeof window === "undefined") return null;
  if (snapshot === undefined) {
    snapshot = parseFlow(window.sessionStorage.getItem(RECOVERY_FLOW_KEY));
  }
  return snapshot;
}

export function getServerRecoveryFlowSnapshot(): null {
  return null;
}

export function getRecoveryFlow(): RecoveryFlow | null {
  return getRecoveryFlowSnapshot();
}

export function saveRecoveryFlow(flow: RecoveryFlow) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(RECOVERY_FLOW_KEY, JSON.stringify(flow));
  notify();
}

export function updateRecoveryFlow(patch: Partial<RecoveryFlow>) {
  const current = getRecoveryFlowSnapshot() ?? {
    email: "",
    sentAt: null,
    token: null,
  };
  const next: RecoveryFlow = { ...current, ...patch };
  saveRecoveryFlow(next);
  return next;
}

export function clearRecoveryFlow() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(RECOVERY_FLOW_KEY);
  notify();
}

function remainingFrom(sentAt: number | null, totalSeconds: number) {
  if (!sentAt) return 0;
  const elapsed = (Date.now() - sentAt) / 1000;
  return Math.max(0, Math.ceil(totalSeconds - elapsed));
}

export function cooldownRemainingSeconds(sentAt: number | null) {
  return remainingFrom(sentAt, RECOVERY_COOLDOWN_SECONDS);
}

export function validityRemainingSeconds(sentAt: number | null) {
  return remainingFrom(sentAt, RECOVERY_CODE_TTL_SECONDS);
}
