const PENDING_CHECKOUT_KEY = "farmamed.cart.pending-checkout";

type PendingCheckout = {
  customerId: string;
  orderId: string;
};

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function markCartCheckout(
  customerId: number | string,
  orderId: number | string,
): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;

  const pending: PendingCheckout = {
    customerId: String(customerId),
    orderId: String(orderId),
  };
  try {
    storage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

export function consumeCartCheckout(
  customerId: number | string,
  orderId: number | string,
): boolean {
  const storage = getSessionStorage();
  if (!storage) return false;

  let raw: string | null = null;
  try {
    raw = storage.getItem(PENDING_CHECKOUT_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  let pending: PendingCheckout | null = null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const record = parsed as Record<string, unknown>;
      if (
        typeof record.customerId === "string" &&
        typeof record.orderId === "string"
      ) {
        pending = { customerId: record.customerId, orderId: record.orderId };
      }
    }
  } catch {
    pending = null;
  }

  const matches =
    pending !== null &&
    pending.customerId === String(customerId) &&
    pending.orderId === String(orderId);

  if (matches || pending === null) {
    try {
      storage.removeItem(PENDING_CHECKOUT_KEY);
    } catch {
      // Sin almacenamiento disponible no hay nada más que limpiar.
    }
  }

  return matches;
}
