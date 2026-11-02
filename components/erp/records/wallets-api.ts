import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";

export type WalletCurrency = {
  id: RecordId;
  code: string;
  name: string;
  symbol: string;
};

export type CustomerWallet = {
  id: RecordId;
  customer_id: RecordId;
  currency_id: RecordId;
  currency: WalletCurrency | null;
  balance: number;
};

export type WalletTransactionType = "deposit" | "invoice_payment";

export type WalletTransaction = {
  id: RecordId;
  transaction_type: WalletTransactionType;
  amount: number;
  balance_after: number;
  currency: WalletCurrency | null;
  payment_id: RecordId | null;
  invoice_id: RecordId | null;
  payment_allocation_id: RecordId | null;
  description: string;
  created_at: string | null;
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

export function parseWalletCurrency(source: unknown): WalletCurrency | null {
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

export function parseWallet(source: unknown): CustomerWallet | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const customerId = readId(record.customer_id);
  const currencyId = readId(record.currency_id);
  const balance = readNumber(record.balance);
  if (id === null || customerId === null || currencyId === null || balance === null) {
    return null;
  }

  return {
    id,
    customer_id: customerId,
    currency_id: currencyId,
    currency: parseWalletCurrency(record.currency),
    balance,
  };
}

export function parseWalletList(payload: unknown): CustomerWallet[] {
  const list = readCollection(payload);
  const wallets = list
    .map(parseWallet)
    .filter((wallet): wallet is CustomerWallet => wallet !== null);
  if (list.length > 0 && wallets.length === 0) throw new ApiError(500, null);
  return wallets;
}

function parseTransactionType(value: unknown): WalletTransactionType | null {
  const text = readText(value);
  return text === "deposit" || text === "invoice_payment" ? text : null;
}

export function parseWalletTransaction(
  source: unknown,
): WalletTransaction | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const transactionType = parseTransactionType(record.transaction_type);
  const amount = readNumber(record.amount);
  const balanceAfter = readNumber(record.balance_after);
  if (id === null || !transactionType || amount === null || balanceAfter === null) {
    return null;
  }

  return {
    id,
    transaction_type: transactionType,
    amount,
    balance_after: balanceAfter,
    currency: parseWalletCurrency(record.currency),
    payment_id: readId(record.payment_id),
    invoice_id: readId(record.invoice_id),
    payment_allocation_id: readId(record.payment_allocation_id),
    description: readText(record.description),
    created_at: readTimestamp(record.created_at),
  };
}

export function parseWalletTransactionList(payload: unknown): WalletTransaction[] {
  const list = readCollection(payload);
  const transactions = list
    .map(parseWalletTransaction)
    .filter((transaction): transaction is WalletTransaction => transaction !== null);
  if (list.length > 0 && transactions.length === 0) throw new ApiError(500, null);
  return transactions;
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchWallets(customerId?: string) {
  const query = customerId ? `?customer_id=${encodeURIComponent(customerId)}` : "";
  const payload = await apiFetch<unknown>(
    `/customer-wallets${query}`,
    authOptions(),
  );
  return parseWalletList(payload);
}

export async function fetchWallet(id: string) {
  const payload = await apiFetch<unknown>(
    `/customer-wallets/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const wallet = parseWallet(payload);
  if (!wallet) throw new ApiError(500, null);
  return wallet;
}

export async function fetchWalletTransactions(id: string) {
  const payload = await apiFetch<unknown>(
    `/customer-wallets/${encodeURIComponent(id)}/transactions`,
    authOptions(),
  );
  return parseWalletTransactionList(payload);
}
