import { CART_CHANGE_EVENT } from "@/lib/cart-events";

export type CartLine = {
  productId: number;
  itemStateId: number;
  name: string;
  reference: string | null;
  itemStateLabel: string;
  unitPrice: number;
  currencyId: number;
  currencyCode: string;
  currencySymbol: string | null;
  quantity: number;
  imageUrl: string | null;
};

const CART_STORAGE_PREFIX = "farmamed.cart.v1";
export const CART_MAX_LINES = 50;
const MAX_CART_LINES = CART_MAX_LINES;
const MAX_QUANTITY = 999;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function notifyCartChange(customerId: number | string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CART_CHANGE_EVENT, {
      detail: { customerId: String(customerId) },
    }),
  );
}

export function cartStorageKey(customerId: number | string): string {
  return `${CART_STORAGE_PREFIX}.${String(customerId).trim()}`;
}

function readPositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function readNonNegativeNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function readOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readRequiredText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clampQuantity(value: unknown): number {
  const parsed = readPositiveInteger(value) ?? 1;
  return Math.min(MAX_QUANTITY, parsed);
}

function normalizeImageUrl(value: unknown): string | null {
  const text = readOptionalText(value);
  if (!text) return null;
  if (
    text.startsWith("https://") ||
    text.startsWith("http://") ||
    text.startsWith("/")
  ) {
    return text;
  }
  return null;
}

function sanitizeLine(value: unknown): CartLine | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;

  const productId = readPositiveInteger(record.productId);
  const itemStateId = readPositiveInteger(record.itemStateId);
  const name = readRequiredText(record.name);
  const itemStateLabel = readRequiredText(record.itemStateLabel);
  const unitPrice = readNonNegativeNumber(record.unitPrice);
  const currencyId = readPositiveInteger(record.currencyId);
  const currencyCode = readRequiredText(record.currencyCode);

  if (
    productId === null ||
    itemStateId === null ||
    !name ||
    !itemStateLabel ||
    unitPrice === null ||
    currencyId === null ||
    !currencyCode
  ) {
    return null;
  }

  return {
    productId,
    itemStateId,
    name,
    reference: readOptionalText(record.reference),
    itemStateLabel,
    unitPrice,
    currencyId,
    currencyCode,
    currencySymbol: readOptionalText(record.currencySymbol),
    quantity: clampQuantity(record.quantity),
    imageUrl: normalizeImageUrl(record.imageUrl),
  };
}

function lineKey(
  productId: number | string,
  itemStateId: number | string,
) {
  return `${String(productId)}:${String(itemStateId)}`;
}

function normalizeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];

  const byKey = new Map<string, CartLine>();
  for (const entry of value) {
    const line = sanitizeLine(entry);
    if (!line) continue;

    const key = lineKey(line.productId, line.itemStateId);
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, {
        ...line,
        quantity: Math.min(MAX_QUANTITY, existing.quantity + line.quantity),
      });
    } else {
      byKey.set(key, line);
    }
  }

  return Array.from(byKey.values()).slice(0, MAX_CART_LINES);
}

export function readCart(customerId: number | string): CartLine[] {
  const storage = getStorage();
  if (!storage) return [];

  let raw: string | null = null;
  try {
    raw = storage.getItem(cartStorageKey(customerId));
  } catch {
    return [];
  }
  if (!raw) return [];

  try {
    return normalizeLines(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function writeCart(
  customerId: number | string,
  lines: readonly CartLine[],
): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(
      cartStorageKey(customerId),
      JSON.stringify(normalizeLines(lines)),
    );
    notifyCartChange(customerId);
  } catch {
    // El carrito local no debe bloquear la operación si la cuota está llena.
  }
}

export function addCartLine(
  customerId: number | string,
  line: Omit<CartLine, "quantity"> & { quantity?: number },
): CartLine[] {
  const normalized = sanitizeLine(line);
  if (!normalized) return readCart(customerId);

  const lines = readCart(customerId);
  const key = lineKey(normalized.productId, normalized.itemStateId);
  const existingIndex = lines.findIndex(
    (entry) => lineKey(entry.productId, entry.itemStateId) === key,
  );

  if (existingIndex >= 0) {
    const existing = lines[existingIndex];
    lines[existingIndex] = {
      ...normalized,
      quantity: Math.min(MAX_QUANTITY, existing.quantity + normalized.quantity),
    };
  } else if (lines.length < MAX_CART_LINES) {
    lines.push(normalized);
  } else {
    return lines;
  }

  writeCart(customerId, lines);
  return normalizeLines(lines);
}

export function updateCartQuantity(
  customerId: number | string,
  productId: number | string,
  itemStateId: number | string,
  quantity: number | string,
): CartLine[] {
  const key = lineKey(productId, itemStateId);
  if (typeof quantity === "string" && !quantity.trim()) {
    return readCart(customerId);
  }
  const parsedQuantity =
    typeof quantity === "number" ? quantity : Number(quantity.trim());

  if (!Number.isInteger(parsedQuantity)) return readCart(customerId);
  if (parsedQuantity < 1) {
    return removeCartLine(customerId, productId, itemStateId);
  }
  const normalizedQuantity = Math.min(MAX_QUANTITY, parsedQuantity);

  const lines = readCart(customerId).map((line) =>
    lineKey(line.productId, line.itemStateId) === key
      ? { ...line, quantity: normalizedQuantity }
      : line,
  );

  writeCart(customerId, lines);
  return normalizeLines(lines);
}

export function removeCartLine(
  customerId: number | string,
  productId: number | string,
  itemStateId: number | string,
): CartLine[] {
  const key = lineKey(productId, itemStateId);
  const lines = readCart(customerId).filter(
    (line) => lineKey(line.productId, line.itemStateId) !== key,
  );

  writeCart(customerId, lines);
  return lines;
}

export function clearCart(customerId: number | string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(cartStorageKey(customerId));
    notifyCartChange(customerId);
  } catch {
    // Sin almacenamiento disponible no hay nada más que limpiar.
  }
}
