import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  buildListQuery,
  parsePaginated,
  pickListFilters,
  type ListQuery,
  type Paginated,
} from "@/lib/pagination";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";
import {
  parseWallet,
  parseWalletCurrency,
  type CustomerWallet,
  type WalletCurrency,
} from "@/components/erp/records/wallets-api";

export type PaymentMethodSummary = {
  id: RecordId;
  label: string;
};

export type PaymentRecord = {
  id: RecordId;
  customer_id: RecordId;
  method_payment_id: RecordId;
  method_payment: PaymentMethodSummary | null;
  currency_id: RecordId;
  currency: WalletCurrency | null;
  amount: number;
  paid_at: string | null;
  reference: string;
  notes: string;
  wallet?: CustomerWallet | null;
};

export type PaymentFilters = {
  customerId?: string;
  methodPaymentId?: string;
  currencyId?: string;
  paidFrom?: string;
  paidTo?: string;
};

export type PaymentCreateInput = {
  customer_id: RecordId;
  method_payment_id: RecordId;
  amount: number;
  paid_at?: string;
  reference?: string | null;
  notes?: string | null;
};

export type PaymentUpdateInput = {
  reference?: string | null;
  notes?: string | null;
  paid_at?: string;
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

function readNumber(value: unknown): number | null {
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

function parseMethodPaymentSummary(source: unknown): PaymentMethodSummary | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const label = readText(source.label);
  if (id === null || !label) return null;
  return { id, label };
}

export function parsePayment(source: unknown): PaymentRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const customerId = readId(record.customer_id);
  const methodPaymentId = readId(record.method_payment_id);
  const currencyId = readId(record.currency_id);
  const amount = readNumber(record.amount);
  if (
    id === null ||
    customerId === null ||
    methodPaymentId === null ||
    currencyId === null ||
    amount === null
  ) {
    return null;
  }

  return {
    id,
    customer_id: customerId,
    method_payment_id: methodPaymentId,
    method_payment: parseMethodPaymentSummary(record.method_payment),
    currency_id: currencyId,
    currency: parseWalletCurrency(record.currency),
    amount,
    paid_at: readTimestamp(record.paid_at),
    reference: readText(record.reference),
    notes: readText(record.notes),
    wallet: record.wallet === undefined ? undefined : parseWallet(record.wallet),
  };
}

export function parsePaymentList(payload: unknown): PaymentRecord[] {
  const list = readCollection(payload);
  const payments = list
    .map(parsePayment)
    .filter((payment): payment is PaymentRecord => payment !== null);
  if (list.length > 0 && payments.length === 0) throw new ApiError(500, null);
  return payments.sort((first, second) => {
    const firstDate = first.paid_at ? Date.parse(first.paid_at) : 0;
    const secondDate = second.paid_at ? Date.parse(second.paid_at) : 0;
    if (firstDate !== secondDate) return secondDate - firstDate;
    const firstId = Number(first.id);
    const secondId = Number(second.id);
    if (Number.isFinite(firstId) && Number.isFinite(secondId)) {
      return secondId - firstId;
    }
    return String(second.id).localeCompare(String(first.id), "es");
  });
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

const PAYMENT_FILTERS = [
  "customer_id",
  "invoice_id",
  "method_payment_id",
  "currency_id",
  "status",
  "paid_from",
  "paid_to",
  "from",
  "to",
] as const;

export async function fetchPaymentPage(
  query: ListQuery = {},
): Promise<Paginated<PaymentRecord>> {
  const payload = await apiFetch<unknown>(
    `/payments${buildListQuery({
      ...query,
      filters: pickListFilters(query.filters, PAYMENT_FILTERS),
    })}`,
    authOptions(),
  );
  return parsePaginated(payload, parsePayment, {
    page: query.page,
    pageSize: query.pageSize,
  });
}

export async function fetchPayments(filters: PaymentFilters = {}) {
  const query = new URLSearchParams();
  if (filters.customerId) query.set("customer_id", filters.customerId);
  if (filters.methodPaymentId) {
    query.set("method_payment_id", filters.methodPaymentId);
  }
  if (filters.currencyId) query.set("currency_id", filters.currencyId);
  if (filters.paidFrom) query.set("paid_from", filters.paidFrom);
  if (filters.paidTo) query.set("paid_to", filters.paidTo);
  const search = query.toString();
  const payload = await apiFetch<unknown>(
    `/payments${search ? `?${search}` : ""}`,
    authOptions(),
  );
  return parsePaymentList(payload);
}

export async function fetchPayment(id: string) {
  const payload = await apiFetch<unknown>(
    `/payments/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const payment = parsePayment(payload);
  if (!payment) throw new ApiError(500, null);
  return payment;
}

export async function createPayment(input: PaymentCreateInput) {
  const payload = await apiFetch<unknown>("/payments", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(input),
  });
  const payment = parsePayment(payload);
  if (!payment) throw new ApiError(500, null);
  return payment;
}

export async function updatePayment(id: string, input: PaymentUpdateInput) {
  const payload = await apiFetch<unknown>(
    `/payments/${encodeURIComponent(id)}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const payment = parsePayment(payload);
  if (!payment) throw new ApiError(500, null);
  return payment;
}

export function deletePayment(id: string) {
  return apiFetch<void>(`/payments/${encodeURIComponent(id)}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export function paymentPaidAtTimestamp(date: string) {
  return `${date}T12:00:00.000Z`;
}
