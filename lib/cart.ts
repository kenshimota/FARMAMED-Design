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

const CART_KEY_PREFIX = "farmamed.cart.v1";
const MAX_QUANTITY = 999;

export const CART_MAX_LINES = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableText(value: unknown) {
  const text = readText(value);
  return text || null;
}

function readPositiveInteger(value: unknown) {
  const parsed =
    typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

function readPrice(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function normalizeQuantity(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(parsed)));
}

function parseLine(value: unknown): CartLine | null {
  if (!isRecord(value)) return null;

  const productId = readPositiveInteger(value.productId);
  const itemStateId = readPositiveInteger(value.itemStateId);
  const name = readText(value.name);
  const itemStateLabel = readText(value.itemStateLabel);
  const unitPrice = readPrice(value.unitPrice);
  const currencyId = readPositiveInteger(value.currencyId);
  const currencyCode = readText(value.currencyCode);

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
    reference: readNullableText(value.reference),
    itemStateLabel,
    unitPrice,
    currencyId,
    currencyCode,
    currencySymbol: readNullableText(value.currencySymbol),
    quantity: normalizeQuantity(value.quantity),
    imageUrl: readNullableText(value.imageUrl),
  };
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sameLine(line: CartLine, productId: number, itemStateId: number) {
  return line.productId === productId && line.itemStateId === itemStateId;
}

function notifyCartChange() {
  if (typeof window === "undefined") return;
  if (typeof window.dispatchEvent !== "function") return;
  window.dispatchEvent(new Event("farmamed:cart-change"));
}

export function cartStorageKey(customerId: number | string): string {
  return `${CART_KEY_PREFIX}.${String(customerId)}`;
}

export function readCart(customerId: number | string): CartLine[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const raw = storage.getItem(cartStorageKey(customerId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(parseLine)
      .filter((line): line is CartLine => line !== null)
      .slice(0, CART_MAX_LINES);
  } catch {
    return [];
  }
}

export function writeCart(customerId: number | string, lines: CartLine[]): void {
  const storage = getStorage();
  if (!storage) return;

  const normalized = lines
    .map(parseLine)
    .filter((line): line is CartLine => line !== null)
    .slice(0, CART_MAX_LINES);

  try {
    storage.setItem(cartStorageKey(customerId), JSON.stringify(normalized));
  } catch {
    return;
  }

  notifyCartChange();
}

export function addCartLine(
  customerId: number | string,
  line: Omit<CartLine, "quantity"> & { quantity?: number },
): CartLine[] {
  const current = readCart(customerId);
  const quantity = normalizeQuantity(line.quantity);
  const existing = current.find((item) =>
    sameLine(item, line.productId, line.itemStateId),
  );

  if (existing) {
    const next = current.map((item) =>
      sameLine(item, line.productId, line.itemStateId)
        ? { ...item, quantity: normalizeQuantity(item.quantity + quantity) }
        : item,
    );
    writeCart(customerId, next);
    return next;
  }

  if (current.length >= CART_MAX_LINES) return current;

  const parsed = parseLine({ ...line, quantity });
  if (!parsed) return current;

  const next = [...current, parsed];
  writeCart(customerId, next);
  return next;
}

export function updateCartQuantity(
  customerId: number | string,
  productId: number,
  itemStateId: number,
  quantity: number,
): CartLine[] {
  const current = readCart(customerId);
  const next = current.map((line) =>
    sameLine(line, productId, itemStateId)
      ? { ...line, quantity: normalizeQuantity(quantity) }
      : line,
  );
  writeCart(customerId, next);
  return next;
}

export function removeCartLine(
  customerId: number | string,
  productId: number,
  itemStateId: number,
): CartLine[] {
  const next = readCart(customerId).filter(
    (line) => !sameLine(line, productId, itemStateId),
  );
  writeCart(customerId, next);
  return next;
}

export function clearCart(customerId: number | string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(cartStorageKey(customerId));
  } catch {
    return;
  }
  notifyCartChange();
}
