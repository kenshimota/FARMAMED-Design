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
  parseImage,
  readCollection,
  type ImageRecord,
  type RecordId,
} from "@/components/erp/records/records-api";
import {
  parseWallet,
  parseWalletCurrency,
  type CustomerWallet,
  type WalletCurrency,
} from "@/components/erp/records/wallets-api";

export const PAYMENT_STATUSES = ["pending", "conciliated", "rejected"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number] | "unknown";

export type PaymentMethodSummary = {
  id: RecordId;
  label: string;
};

export type PaymentStatusActor = {
  id: RecordId;
  username: string;
  email: string;
};

export type PaymentHistoryEntry = {
  id: RecordId;
  from_status: PaymentStatus | null;
  to_status: PaymentStatus;
  reason: string;
  created_at: string | null;
  actor: PaymentStatusActor | null;
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
  status: PaymentStatus;
  status_name: string;
  rejection_reason: string;
  reference_image_id: RecordId | null;
  reference_image: ImageRecord | null;
  wallet?: CustomerWallet | null;
  history?: PaymentHistoryEntry[];
};

export type PaymentFilters = {
  customerId?: string;
  methodPaymentId?: string;
  currencyId?: string;
  paidFrom?: string;
  paidTo?: string;
  status?: string;
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

export type PaymentStatusInput = {
  status: "conciliated" | "rejected";
  reason?: string | null;
};

export type PaymentStatusResult = {
  id: RecordId;
  status: PaymentStatus;
  status_name: string;
  rejection_reason: string;
  wallet: CustomerWallet | null;
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

export function parsePaymentStatus(value: unknown): PaymentStatus | null {
  const text = readText(value).toLowerCase();
  return (PAYMENT_STATUSES as readonly string[]).includes(text)
    ? (text as PaymentStatus)
    : null;
}

function parsePaymentActor(source: unknown): PaymentStatusActor | null {
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

function parsePaymentHistoryEntry(source: unknown): PaymentHistoryEntry | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const toStatus = parsePaymentStatus(source.to_status);
  if (id === null || !toStatus) return null;
  return {
    id,
    from_status: parsePaymentStatus(source.from_status),
    to_status: toStatus,
    reason: readText(source.reason),
    created_at: readTimestamp(source.created_at),
    actor: parsePaymentActor(source.actor),
  };
}

function sortHistory(history: PaymentHistoryEntry[]) {
  return history.sort((first, second) => {
    const firstTime = first.created_at ? Date.parse(first.created_at) : 0;
    const secondTime = second.created_at ? Date.parse(second.created_at) : 0;
    if (firstTime !== secondTime) return firstTime - secondTime;
    const firstId = Number(first.id);
    const secondId = Number(second.id);
    if (Number.isFinite(firstId) && Number.isFinite(secondId)) {
      return firstId - secondId;
    }
    return String(first.id).localeCompare(String(second.id), "es");
  });
}

function parseHistoryArray(value: unknown): PaymentHistoryEntry[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return sortHistory(
    value
      .map(parsePaymentHistoryEntry)
      .filter((entry): entry is PaymentHistoryEntry => entry !== null),
  );
}

export function parsePaymentHistoryList(payload: unknown): PaymentHistoryEntry[] {
  const list = readCollection(payload);
  const history = list
    .map(parsePaymentHistoryEntry)
    .filter((entry): entry is PaymentHistoryEntry => entry !== null);
  if (list.length > 0 && history.length === 0) throw new ApiError(500, null);
  return sortHistory(history);
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

  const status = parsePaymentStatus(record.status) ?? "unknown";

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
    status,
    status_name: readText(record.status_name),
    rejection_reason: readText(record.rejection_reason),
    reference_image_id: readId(record.reference_image_id),
    reference_image: parseImage(record.reference_image),
    wallet: record.wallet === undefined ? undefined : parseWallet(record.wallet),
    history: parseHistoryArray(record.history),
  };
}

export function parsePaymentStatusResult(
  payload: unknown,
): PaymentStatusResult | null {
  const record = unwrapRecord(payload);
  if (!isRecord(record)) return null;
  const id = readId(record.id);
  const status = parsePaymentStatus(record.status);
  if (id === null || !status) return null;
  return {
    id,
    status,
    status_name: readText(record.status_name),
    rejection_reason: readText(record.rejection_reason),
    wallet: record.wallet === undefined ? null : parseWallet(record.wallet),
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

function appendPaymentField(
  formData: FormData,
  key: string,
  value: string | number | null | undefined,
) {
  if (value === undefined) return;
  formData.set(key, value === null ? "" : String(value));
}

function buildPaymentFormData(
  input: PaymentCreateInput | PaymentUpdateInput,
  image?: File | null,
) {
  const formData = new FormData();
  appendPaymentField(formData, "reference", input.reference);
  appendPaymentField(formData, "notes", input.notes);
  appendPaymentField(formData, "paid_at", input.paid_at);
  if ("customer_id" in input) {
    appendPaymentField(formData, "customer_id", input.customer_id);
  }
  if ("method_payment_id" in input) {
    appendPaymentField(formData, "method_payment_id", input.method_payment_id);
  }
  if ("amount" in input) {
    appendPaymentField(formData, "amount", input.amount);
  }
  if (image) formData.set("image", image);
  return formData;
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
  if (filters.status) query.set("status", filters.status);
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

export async function fetchPaymentHistory(id: string) {
  const payload = await apiFetch<unknown>(
    `/payments/${encodeURIComponent(id)}/history`,
    authOptions(),
  );
  return parsePaymentHistoryList(payload);
}

export async function createPayment(
  input: PaymentCreateInput,
  image?: File | null,
) {
  const payload = await apiFetch<unknown>("/payments", {
    ...authOptions(),
    method: "POST",
    body: image ? buildPaymentFormData(input, image) : JSON.stringify(input),
  });
  const payment = parsePayment(payload);
  if (!payment) throw new ApiError(500, null);
  return payment;
}

export async function updatePayment(
  id: string,
  input: PaymentUpdateInput,
  image?: File | null,
) {
  const payload = await apiFetch<unknown>(
    `/payments/${encodeURIComponent(id)}`,
    {
      ...authOptions(),
      method: "PUT",
      body: buildPaymentFormData(input, image),
    },
  );
  const payment = parsePayment(payload);
  if (!payment) throw new ApiError(500, null);
  return payment;
}

export async function changePaymentStatus(
  id: string,
  input: PaymentStatusInput,
) {
  const payload = await apiFetch<unknown>(
    `/payments/${encodeURIComponent(id)}/status`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(input),
    },
  );
  const result = parsePaymentStatusResult(payload);
  if (!result) throw new ApiError(500, null);
  return result;
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
