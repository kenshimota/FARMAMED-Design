import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";

export type RecordId = number | string;

export const INVOICE_PAYMENT_STATUSES = ["pending", "partial", "paid"] as const;

export type InvoicePaymentStatus = (typeof INVOICE_PAYMENT_STATUSES)[number];

export type InvoiceCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
};

export type InvoiceCustomer = {
  id: RecordId;
  fullName: string;
  email: string;
  direction: string;
};

export type InvoicePaymentTerm = {
  id: RecordId;
  code: string;
  name: string;
  days: number;
};

export type InvoiceInvoicedBy = {
  id: RecordId;
  username: string;
  email: string;
};

export type InvoiceItem = {
  orderItemId: RecordId | null;
  productId: RecordId;
  productName: string;
  productReference: string;
  itemStateId: RecordId;
  itemStateName: string;
  itemStateLabel: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type InvoicePaymentHistory = {
  paymentId: RecordId;
  amount: number;
  currency: InvoiceCurrency | null;
  appliedAmount: number;
  allocatedAt: string | null;
};

export type Invoice = {
  id: RecordId;
  number: number;
  orderId: RecordId | null;
  orderNumber: number | null;
  customerId: RecordId;
  currencyId: RecordId | null;
  paymentTermId: RecordId | null;
  subtotal: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  balanceDue: number;
  paymentStatus: InvoicePaymentStatus;
  issuedAt: string | null;
  dueDate: string | null;
  notes: string;
  customer: InvoiceCustomer | null;
  currency: InvoiceCurrency | null;
  paymentTerm: InvoicePaymentTerm | null;
  invoicedBy: InvoiceInvoicedBy | null;
  items: InvoiceItem[];
  paymentHistory: InvoicePaymentHistory[];
  paymentsCount: number;
};

export type InvoicePaymentMethod = {
  id: RecordId;
  label: string;
};

export type InvoicePaymentMethodType = {
  id: RecordId;
  code: string;
  name: string;
};

export type InvoicePaymentAllocation = {
  id: RecordId;
  paymentId: RecordId;
  amount: number;
  currency: InvoiceCurrency | null;
  appliedAmount: number;
  exchangeRate: number;
  allocatedAt: string | null;
  methodPayment: InvoicePaymentMethod | null;
  methodPaymentType: InvoicePaymentMethodType | null;
  createdBy: InvoiceInvoicedBy | null;
};

export type CustomerPayment = {
  id: RecordId;
  customerId: RecordId | null;
  methodPayment: InvoicePaymentMethod | null;
  currency: InvoiceCurrency | null;
  amount: number;
  paidAt: string | null;
  reference: string;
  notes: string;
  status: "pending" | "conciliated" | "rejected" | null;
};

export type InvoiceFilters = {
  orderId?: string;
  customerId?: string;
  number?: string;
  paymentStatus?: string;
};

export type InvoicePaymentInput = {
  paymentId: RecordId;
  amount: number;
};

export type InvoicePaymentResult = {
  allocation: InvoicePaymentAllocation;
  invoice: {
    id: RecordId;
    number: number;
    total: number;
    paidAmount: number;
    balanceDue: number;
    paymentStatus: InvoicePaymentStatus;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readId(value: unknown): RecordId | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  }
  return null;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readTimestamp(value: unknown) {
  const text = readText(value);
  return text || null;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function readCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.data)) return payload.data;
  throw new ApiError(500, null);
}

function timestampValue(value: string | null) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePaymentStatus(value: unknown): InvoicePaymentStatus | null {
  const text = readText(value).toLowerCase();
  return (INVOICE_PAYMENT_STATUSES as readonly string[]).includes(text)
    ? (text as InvoicePaymentStatus)
    : null;
}

function parseCustomerPaymentStatus(
  value: unknown,
): "pending" | "conciliated" | "rejected" | null {
  const text = readText(value).toLowerCase();
  return text === "pending" || text === "conciliated" || text === "rejected"
    ? text
    : null;
}

export function parseInvoiceCurrency(source: unknown): InvoiceCurrency | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  if (id === null || !code) return null;
  return {
    id,
    code,
    name: readText(source.name) || code,
    symbol: readText(source.symbol) || code,
  };
}

function parseInvoiceCustomer(source: unknown): InvoiceCustomer | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const fullName = readText(source.fullName) || readText(source.full_name);
  if (id === null || !fullName) return null;
  return {
    id,
    fullName,
    email: readText(source.email),
    direction: readText(source.direction),
  };
}

function parsePaymentTerm(source: unknown): InvoicePaymentTerm | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  const name = readText(source.name);
  if (id === null || !code || !name) return null;
  return {
    id,
    code,
    name,
    days: Math.max(0, Math.trunc(readNumber(source.days))),
  };
}

function parseUser(source: unknown): InvoiceInvoicedBy | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const username = readText(source.username) || readText(source.email);
  if (id === null || !username) return null;
  return {
    id,
    username,
    email: readText(source.email),
  };
}

function parseInvoiceItem(source: unknown): InvoiceItem | null {
  if (!isRecord(source)) return null;
  const productId = readId(source.product_id);
  const itemStateId = readId(source.item_state_id);
  const productName = readText(source.product_name);
  const itemStateName = readText(source.item_state_name);
  const itemStateLabel =
    readText(source.item_state_label) ||
    (isRecord(source.item_state) ? readText(source.item_state.label) : "");
  const quantity = Math.trunc(readNumber(source.quantity, -1));
  const unitPrice = readNumber(source.unit_price, -1);
  if (
    productId === null ||
    itemStateId === null ||
    !productName ||
    !itemStateName ||
    quantity < 1 ||
    unitPrice < 0
  ) {
    return null;
  }
  return {
    orderItemId: readId(source.order_item_id),
    productId,
    productName,
    productReference: readText(source.product_reference),
    itemStateId,
    itemStateName,
    itemStateLabel,
    quantity,
    unitPrice,
    subtotal: readNumber(source.subtotal, roundMoney(quantity * unitPrice)),
  };
}

function parseInvoiceItemList(value: unknown): InvoiceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseInvoiceItem)
    .filter((item): item is InvoiceItem => item !== null);
}

function parseInvoicePaymentHistory(source: unknown): InvoicePaymentHistory | null {
  if (!isRecord(source)) return null;
  const paymentId = readId(source.payment_id);
  if (paymentId === null) return null;
  return {
    paymentId,
    amount: readNumber(source.amount),
    currency: parseInvoiceCurrency(source.currency),
    appliedAmount: readNumber(source.applied_amount),
    allocatedAt: readTimestamp(source.allocated_at),
  };
}

function parseInvoicePaymentHistoryList(value: unknown): InvoicePaymentHistory[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(parseInvoicePaymentHistory)
    .filter((entry): entry is InvoicePaymentHistory => entry !== null);
}

export function parseInvoice(source: unknown): Invoice | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const number = Math.trunc(readNumber(record.number, -1));
  const customerId = readId(record.customer_id);
  const paymentStatus = parsePaymentStatus(record.payment_status);
  if (id === null || number < 0 || customerId === null || !paymentStatus) {
    return null;
  }

  const customer = parseInvoiceCustomer(record.customer);
  const currency = parseInvoiceCurrency(record.currency);
  const paymentTerm = parsePaymentTerm(record.payment_term);
  const order = isRecord(record.order) ? record.order : null;
  const paymentHistory = parseInvoicePaymentHistoryList(record.payment_history);

  return {
    id,
    number,
    orderId: readId(record.order_id),
    orderNumber:
      readNumberOrNull(record.order_number) ??
      (order ? readNumberOrNull(order.number) : null),
    customerId,
    currencyId: readId(record.currency_id),
    paymentTermId: readId(record.payment_term_id),
    subtotal: readNumber(record.subtotal),
    taxAmount: readNumber(record.tax_amount),
    total: readNumber(record.total),
    paidAmount: readNumber(record.paid_amount),
    balanceDue: readNumber(record.balance_due),
    paymentStatus,
    issuedAt: readTimestamp(record.issued_at),
    dueDate: readTimestamp(record.due_date),
    notes: readText(record.notes),
    customer,
    currency,
    paymentTerm,
    invoicedBy: parseUser(record.invoiced_by),
    items: parseInvoiceItemList(record.items ?? record.invoice_items),
    paymentHistory,
    paymentsCount: Math.max(
      0,
      Math.trunc(readNumber(record.payments_count, paymentHistory.length)),
    ),
  };
}

export function parseInvoiceList(payload: unknown): Invoice[] {
  const list = readCollection(payload);
  const invoices = list
    .map(parseInvoice)
    .filter((invoice): invoice is Invoice => invoice !== null);
  if (list.length > 0 && invoices.length === 0) throw new ApiError(500, null);
  return invoices.sort((first, second) => {
    const firstTime = timestampValue(first.issuedAt);
    const secondTime = timestampValue(second.issuedAt);
    if (firstTime !== secondTime) return secondTime - firstTime;
    return Number(second.id) - Number(first.id);
  });
}

function parseMethodPayment(source: unknown): InvoicePaymentMethod | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const label = readText(source.label);
  if (id === null || !label) return null;
  return { id, label };
}

function parseMethodPaymentType(
  source: unknown,
): InvoicePaymentMethodType | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const code = readText(source.code);
  const name = readText(source.name);
  if (id === null || !code || !name) return null;
  return { id, code, name };
}

export function parseInvoicePaymentAllocation(
  source: unknown,
): InvoicePaymentAllocation | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const paymentId = readId(record.payment_id);
  if (id === null || paymentId === null) return null;

  return {
    id,
    paymentId,
    amount: readNumber(record.amount),
    currency: parseInvoiceCurrency(record.currency),
    appliedAmount: readNumber(record.applied_amount),
    exchangeRate: readNumber(record.exchange_rate, 1),
    allocatedAt: readTimestamp(record.allocated_at),
    methodPayment: parseMethodPayment(record.method_payment),
    methodPaymentType: parseMethodPaymentType(record.method_payment_type),
    createdBy: parseUser(record.created_by),
  };
}

export function parseInvoicePaymentAllocationList(
  payload: unknown,
): InvoicePaymentAllocation[] {
  const list = readCollection(payload);
  const allocations = list
    .map(parseInvoicePaymentAllocation)
    .filter((entry): entry is InvoicePaymentAllocation => entry !== null);
  if (list.length > 0 && allocations.length === 0) throw new ApiError(500, null);
  return allocations.sort((first, second) => {
    const firstTime = timestampValue(first.allocatedAt);
    const secondTime = timestampValue(second.allocatedAt);
    if (firstTime !== secondTime) return firstTime - secondTime;
    return Number(first.id) - Number(second.id);
  });
}

export function parseCustomerPayment(source: unknown): CustomerPayment | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;
  const id = readId(record.id);
  const amount = readNumber(record.amount, -1);
  if (id === null || amount < 0) return null;
  return {
    id,
    customerId: readId(record.customer_id),
    methodPayment: parseMethodPayment(record.method_payment),
    currency: parseInvoiceCurrency(record.currency),
    amount,
    paidAt: readTimestamp(record.paid_at),
    reference: readText(record.reference),
    notes: readText(record.notes),
    status: parseCustomerPaymentStatus(record.status),
  };
}

export function parseCustomerPaymentList(payload: unknown): CustomerPayment[] {
  const list = readCollection(payload);
  const payments = list
    .map(parseCustomerPayment)
    .filter((payment): payment is CustomerPayment => payment !== null);
  if (list.length > 0 && payments.length === 0) throw new ApiError(500, null);
  return payments.sort((first, second) => {
    const firstTime = timestampValue(first.paidAt);
    const secondTime = timestampValue(second.paidAt);
    if (firstTime !== secondTime) return secondTime - firstTime;
    return Number(second.id) - Number(first.id);
  });
}

function parseInvoicePaymentResult(payload: unknown): InvoicePaymentResult | null {
  const record = unwrapRecord(payload);
  if (!isRecord(record)) return null;
  const allocation = parseInvoicePaymentAllocation(record);
  const invoice = isRecord(record.invoice) ? record.invoice : null;
  const invoiceId = readId(invoice?.id) ?? readId(record.invoice_id);
  const invoiceNumber = Math.trunc(readNumber(invoice?.number, -1));
  const paymentStatus = parsePaymentStatus(invoice?.payment_status);
  if (!allocation || invoiceId === null || invoiceNumber < 0 || !paymentStatus) {
    return null;
  }
  return {
    allocation,
    invoice: {
      id: invoiceId,
      number: invoiceNumber,
      total: readNumber(invoice?.total),
      paidAmount: readNumber(invoice?.paid_amount),
      balanceDue: readNumber(invoice?.balance_due),
      paymentStatus,
    },
  };
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function appendFilter(
  query: URLSearchParams,
  key: string,
  value: string | undefined,
) {
  const normalized = value?.trim();
  if (normalized) query.set(key, normalized);
}

export async function fetchInvoices(filters: InvoiceFilters = {}) {
  const query = new URLSearchParams();
  appendFilter(query, "order_id", filters.orderId);
  appendFilter(query, "customer_id", filters.customerId);
  appendFilter(query, "number", filters.number);
  appendFilter(query, "payment_status", filters.paymentStatus);
  const suffix = query.toString();
  const payload = await apiFetch<unknown>(
    `/invoices${suffix ? `?${suffix}` : ""}`,
    authOptions(),
  );
  return parseInvoiceList(payload);
}

export async function fetchInvoice(id: string) {
  const payload = await apiFetch<unknown>(
    `/invoices/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const invoice = parseInvoice(payload);
  if (!invoice) throw new ApiError(500, null);
  return invoice;
}

export async function fetchOrderInvoice(orderId: string) {
  const payload = await apiFetch<unknown>(
    `/orders/${encodeURIComponent(orderId)}/invoice`,
    authOptions(),
  );
  const invoice = parseInvoice(payload);
  if (!invoice) throw new ApiError(500, null);
  return invoice;
}

export async function fetchInvoicePayments(id: string) {
  const payload = await apiFetch<unknown>(
    `/invoices/${encodeURIComponent(id)}/payments`,
    authOptions(),
  );
  return parseInvoicePaymentAllocationList(payload);
}

export async function fetchCustomerPayments(customerId: RecordId) {
  const payload = await apiFetch<unknown>(
    `/payments?customer_id=${encodeURIComponent(String(customerId))}`,
    authOptions(),
  );
  return parseCustomerPaymentList(payload);
}

export async function applyInvoicePayment(
  invoiceId: RecordId,
  input: InvoicePaymentInput,
) {
  const payload = await apiFetch<unknown>(
    `/invoices/${encodeURIComponent(String(invoiceId))}/payments`,
    {
      ...authOptions(),
      method: "POST",
      body: JSON.stringify({
        payment_id: input.paymentId,
        amount: input.amount,
      }),
    },
  );
  const result = parseInvoicePaymentResult(payload);
  if (!result) throw new ApiError(500, null);
  return result;
}
