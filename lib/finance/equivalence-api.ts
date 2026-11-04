import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type EquivalenceRecordId = number | string;

export type EquivalenceScope = "order" | "invoice";

export type EquivalenceCurrency = {
  id: EquivalenceRecordId | null;
  code: string;
  name: string;
  symbol: string;
};

export type EquivalenceAmountBlock = {
  currency: EquivalenceCurrency | null;
  subtotal: number | null;
  taxAmount: number | null;
  total: number | null;
  paidAmount: number | null;
  balanceDue: number | null;
};

export type EquivalencePaymentTerm = {
  id: EquivalenceRecordId | null;
  code: string;
  name: string;
  days: number | null;
};

export type EquivalencePayment = {
  isCash: boolean | null;
  amountDueSource: number | null;
  amountDueTarget: number | null;
};

export type EquivalenceRateUpdates = {
  source: string | null;
  target: string | null;
};

export type EquivalenceLine = {
  orderItemId: EquivalenceRecordId | null;
  productId: EquivalenceRecordId | null;
  productName: string;
  productReference: string;
  itemStateId: EquivalenceRecordId | null;
  itemStateName: string;
  quantity: number | null;
  unitPriceSource: number | null;
  subtotalSource: number | null;
  unitPriceTarget: number | null;
  subtotalTarget: number | null;
};

type EquivalenceCommon = {
  source: EquivalenceAmountBlock;
  target: EquivalenceAmountBlock;
  paymentTerm: EquivalencePaymentTerm | null;
  payment: EquivalencePayment;
  exchangeRate: number;
  roundingAdjustment: number;
  ratesUpdatedAt: EquivalenceRateUpdates | null;
  calculatedAt: string | null;
  lines: EquivalenceLine[];
};

export type OrderEquivalence = EquivalenceCommon & {
  scope: "order";
  order: {
    id: EquivalenceRecordId | null;
    number: number | null;
    status: string;
    customerId: EquivalenceRecordId | null;
    createdAt: string | null;
  };
};

export type InvoiceEquivalence = EquivalenceCommon & {
  scope: "invoice";
  invoice: {
    id: EquivalenceRecordId | null;
    number: number | null;
    orderId: EquivalenceRecordId | null;
    orderNumber: number | null;
    paymentStatus: string;
    issuedAt: string | null;
    dueDate: string | null;
  };
};

export type RecordEquivalence = OrderEquivalence | InvoiceEquivalence;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readId(value: unknown): EquivalenceRecordId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  }
  return null;
}

function readNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "true") return true;
  if (value === 0 || value === "false") return false;
  return null;
}

function readTimestamp(value: unknown) {
  const text = readText(value);
  return text || null;
}

function readRateUpdates(value: unknown): EquivalenceRateUpdates | null {
  if (typeof value === "string") {
    const timestamp = readTimestamp(value);
    return timestamp ? { source: timestamp, target: null } : null;
  }

  if (!isRecord(value)) return null;

  const source = readTimestamp(value.source);
  const target = readTimestamp(value.target);
  return source || target ? { source, target } : null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function parseEquivalenceCurrency(
  source: unknown,
): EquivalenceCurrency | null {
  if (!isRecord(source)) return null;
  const code = readText(source.code);
  if (!code) return null;
  return {
    id: readId(source.id),
    code,
    name: readText(source.name) || code,
    symbol: readText(source.symbol) || code,
  };
}

function parseAmountBlock(
  source: unknown,
  fallbackCurrency: EquivalenceCurrency | null,
): EquivalenceAmountBlock {
  const record = isRecord(source) ? source : {};
  const currency =
    parseEquivalenceCurrency(record.currency) ??
    parseEquivalenceCurrency(record.source_currency) ??
    parseEquivalenceCurrency(record.target_currency) ??
    parseEquivalenceCurrency(record) ??
    fallbackCurrency;

  return {
    currency,
    subtotal: readNumberOrNull(record.subtotal),
    taxAmount: readNumberOrNull(record.tax_amount),
    total: readNumberOrNull(record.total),
    paidAmount: readNumberOrNull(record.paid_amount),
    balanceDue: readNumberOrNull(record.balance_due),
  };
}

function parsePaymentTerm(source: unknown): EquivalencePaymentTerm | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  const name = readText(source.name) || code;
  const days = readNumberOrNull(source.days);
  if (id === null && !code && !name && days === null) return null;
  return {
    id,
    code: code || "—",
    name: name || "Término de pago",
    days,
  };
}

function parsePayment(source: unknown): EquivalencePayment {
  const record = isRecord(source) ? source : {};
  return {
    isCash: readBooleanOrNull(record.is_cash),
    amountDueSource: readNumberOrNull(record.amount_due_source),
    amountDueTarget: readNumberOrNull(record.amount_due_target),
  };
}

function parseLine(source: unknown): EquivalenceLine | null {
  if (!isRecord(source)) return null;
  const sourceBlock = isRecord(source.source) ? source.source : null;
  const targetBlock = isRecord(source.target) ? source.target : null;
  const product = isRecord(source.product) ? source.product : null;
  const itemState = isRecord(source.item_state) ? source.item_state : null;

  const orderItemId =
    readId(source.order_item_id) ??
    readId(source.orderItemId) ??
    readId(source.invoice_item_id) ??
    readId(source.id);
  const productId = readId(source.product_id) ?? readId(product?.id);
  const itemStateId = readId(source.item_state_id) ?? readId(itemState?.id);
  const productName =
    readText(source.product_name) || readText(product?.name) || "";
  const productReference =
    readText(source.product_reference) || readText(product?.reference) || "";
  const itemStateName =
    readText(source.item_state_name) ||
    readText(source.item_state_label) ||
    readText(itemState?.label) ||
    readText(itemState?.name) ||
    "";

  return {
    orderItemId,
    productId,
    productName,
    productReference,
    itemStateId,
    itemStateName,
    quantity: readNumberOrNull(source.quantity),
    unitPriceSource:
      readNumberOrNull(source.unit_price_source) ??
      readNumberOrNull(source.unit_price) ??
      readNumberOrNull(sourceBlock?.unit_price),
    subtotalSource:
      readNumberOrNull(source.subtotal_source) ??
      readNumberOrNull(source.subtotal) ??
      readNumberOrNull(sourceBlock?.subtotal),
    unitPriceTarget:
      readNumberOrNull(source.unit_price_target) ??
      readNumberOrNull(targetBlock?.unit_price),
    subtotalTarget:
      readNumberOrNull(source.subtotal_target) ??
      readNumberOrNull(targetBlock?.subtotal),
  };
}

function parseLines(value: unknown): EquivalenceLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseLine)
    .filter((line): line is EquivalenceLine => line !== null);
}

function parseCommon(
  record: Record<string, unknown>,
  fallbackSourceCurrency: EquivalenceCurrency | null,
  fallbackTargetCurrency: EquivalenceCurrency | null,
): EquivalenceCommon | null {
  if (!isRecord(record.source) || !isRecord(record.target)) return null;
  const exchangeRate = readNumberOrNull(record.exchange_rate);
  if (exchangeRate === null) return null;

  return {
    source: parseAmountBlock(record.source, fallbackSourceCurrency),
    target: parseAmountBlock(record.target, fallbackTargetCurrency),
    paymentTerm: parsePaymentTerm(record.payment_term),
    payment: parsePayment(record.payment),
    exchangeRate,
    roundingAdjustment: readNumberOrNull(record.rounding_adjustment) ?? 0,
    ratesUpdatedAt:
      readRateUpdates(record.rates_updated_at) ??
      readRateUpdates(record.ratesUpdatedAt),
    calculatedAt:
      readTimestamp(record.calculated_at) ?? readTimestamp(record.calculatedAt),
    lines: parseLines(record.lines),
  };
}

export function parseOrderEquivalence(
  source: unknown,
  options: {
    documentCurrency?: EquivalenceCurrency | null;
    targetCurrency?: EquivalenceCurrency | null;
  } = {},
): OrderEquivalence | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const common = parseCommon(
    record,
    options.documentCurrency ?? null,
    options.targetCurrency ?? null,
  );
  if (!common) return null;

  const order = isRecord(record.order) ? record.order : null;

  return {
    scope: "order",
    order: {
      id: readId(order?.id) ?? readId(record.order_id),
      number:
        readNumberOrNull(order?.number) ?? readNumberOrNull(record.number),
      status: readText(order?.status) || readText(record.status),
      customerId:
        readId(order?.customer_id) ?? readId(record.customer_id),
      createdAt:
        readTimestamp(order?.created_at) ?? readTimestamp(record.created_at),
    },
    ...common,
  };
}

export function parseInvoiceEquivalence(
  source: unknown,
  options: {
    documentCurrency?: EquivalenceCurrency | null;
    targetCurrency?: EquivalenceCurrency | null;
  } = {},
): InvoiceEquivalence | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const common = parseCommon(
    record,
    options.documentCurrency ?? null,
    options.targetCurrency ?? null,
  );
  if (!common) return null;

  const invoice = isRecord(record.invoice) ? record.invoice : null;

  return {
    scope: "invoice",
    invoice: {
      id: readId(invoice?.id) ?? readId(record.invoice_id),
      number:
        readNumberOrNull(invoice?.number) ?? readNumberOrNull(record.number),
      orderId: readId(invoice?.order_id) ?? readId(record.order_id),
      orderNumber:
        readNumberOrNull(invoice?.order_number) ??
        readNumberOrNull(record.order_number),
      paymentStatus:
        readText(invoice?.payment_status) || readText(record.payment_status),
      issuedAt:
        readTimestamp(invoice?.issued_at) ?? readTimestamp(record.issued_at),
      dueDate: readTimestamp(invoice?.due_date) ?? readTimestamp(record.due_date),
    },
    ...common,
  };
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function equivalencePath(path: string, currencyId: EquivalenceRecordId | null) {
  if (currencyId === null) return path;
  const query = new URLSearchParams();
  query.set("currency_id", String(currencyId));
  return `${path}?${query.toString()}`;
}

export async function fetchOrderEquivalence(
  orderId: string,
  currencyId: EquivalenceRecordId | null,
  options: {
    documentCurrency?: EquivalenceCurrency | null;
    targetCurrency?: EquivalenceCurrency | null;
  } = {},
) {
  const payload = await apiFetch<unknown>(
    equivalencePath(
      `/orders/${encodeURIComponent(orderId)}/equivalence`,
      currencyId,
    ),
    authOptions(),
  );
  const equivalence = parseOrderEquivalence(payload, options);
  if (!equivalence) throw new ApiError(500, null);
  return equivalence;
}

export async function fetchInvoiceEquivalence(
  invoiceId: string,
  currencyId: EquivalenceRecordId | null,
  options: {
    documentCurrency?: EquivalenceCurrency | null;
    targetCurrency?: EquivalenceCurrency | null;
  } = {},
) {
  const payload = await apiFetch<unknown>(
    equivalencePath(
      `/invoices/${encodeURIComponent(invoiceId)}/equivalence`,
      currencyId,
    ),
    authOptions(),
  );
  const equivalence = parseInvoiceEquivalence(payload, options);
  if (!equivalence) throw new ApiError(500, null);
  return equivalence;
}

export function sortEquivalenceLines(lines: readonly EquivalenceLine[]) {
  return [...lines].sort((first, second) => {
    if (first.orderItemId === null && second.orderItemId === null) return 0;
    if (first.orderItemId === null) return 1;
    if (second.orderItemId === null) return -1;

    const firstNumber = Number(first.orderItemId);
    const secondNumber = Number(second.orderItemId);
    if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
      return firstNumber - secondNumber;
    }
    return String(first.orderItemId).localeCompare(
      String(second.orderItemId),
      "es",
      { numeric: true },
    );
  });
}
