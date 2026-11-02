import type { CartLine } from "@/lib/cart";

export type CartCurrencySummary = {
  currencyId: number;
  currencyCode: string;
  currencySymbol: string | null;
  subtotal: number;
  total: number;
  lines: number;
  units: number;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function cartLineSubtotal(line: CartLine) {
  return roundMoney(line.unitPrice * line.quantity);
}

export function summarizeCart(
  lines: readonly CartLine[],
): CartCurrencySummary[] {
  const byCurrency = new Map<number, CartCurrencySummary>();

  for (const line of lines) {
    const subtotal = cartLineSubtotal(line);
    const current = byCurrency.get(line.currencyId);
    if (current) {
      current.subtotal = roundMoney(current.subtotal + subtotal);
      current.total = current.subtotal;
      current.lines += 1;
      current.units += line.quantity;
      continue;
    }
    byCurrency.set(line.currencyId, {
      currencyId: line.currencyId,
      currencyCode: line.currencyCode,
      currencySymbol: line.currencySymbol,
      subtotal,
      total: subtotal,
      lines: 1,
      units: line.quantity,
    });
  }

  return Array.from(byCurrency.values());
}

export function cartLineCount(lines: readonly CartLine[]) {
  return lines.length;
}

export function cartUnitCount(lines: readonly CartLine[]) {
  return lines.reduce((total, line) => total + line.quantity, 0);
}
