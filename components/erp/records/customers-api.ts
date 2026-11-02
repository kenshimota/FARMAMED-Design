import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import {
  readCollection,
  type RecordId,
} from "@/components/erp/records/records-api";
import {
  parsePaymentTermSummary,
  type PaymentTermSummary,
} from "@/lib/finance/payment-terms-api";

export type CustomerPriceList = {
  id: RecordId;
  name: string;
};

export type CustomerRecord = {
  id: RecordId;
  fullName: string;
  email: string;
  direction: string;
  latitude: number | null;
  longitude: number | null;
  price_list_id: RecordId | null;
  price_list: CustomerPriceList | null;
  payment_term_id: RecordId | null;
  payment_term: PaymentTermSummary | null;
};

export type CustomerInput = {
  fullName: string;
  email: string;
  direction: string;
  latitude: number;
  longitude: number;
  price_list_id?: RecordId | null;
  payment_term_id?: RecordId | null;
};

export const LATITUDE_RANGE = { min: -90, max: 90 } as const;
export const LONGITUDE_RANGE = { min: -180, max: 180 } as const;

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

function readCoordinate(
  value: unknown,
  range: { min: number; max: number },
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed) || parsed < range.min || parsed > range.max) {
    return null;
  }
  return parsed;
}

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

function parseCustomerPriceList(source: unknown): CustomerPriceList | null {
  if (!isRecord(source)) return null;
  const id = readId(source.id);
  const name = readText(source.name);
  if (id === null || !name) return null;
  return { id, name };
}

export function parseCustomer(source: unknown): CustomerRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const fullName = readText(record.fullName) || readText(record.full_name);
  if (id === null || !fullName) return null;

  const priceList = parseCustomerPriceList(record.price_list);
  const priceListId = readId(record.price_list_id) ?? priceList?.id ?? null;
  const paymentTerm = parsePaymentTermSummary(record.payment_term);
  const paymentTermId =
    readId(record.payment_term_id) ?? paymentTerm?.id ?? null;

  return {
    id,
    fullName,
    email: readText(record.email),
    direction: readText(record.direction),
    latitude: readCoordinate(record.latitude, LATITUDE_RANGE),
    longitude: readCoordinate(record.longitude, LONGITUDE_RANGE),
    price_list_id: priceListId,
    price_list: priceList,
    payment_term_id: paymentTermId,
    payment_term: paymentTerm,
  };
}

export function parseCustomerList(payload: unknown): CustomerRecord[] {
  const list = readCollection(payload);
  const customers = list
    .map(parseCustomer)
    .filter((customer): customer is CustomerRecord => customer !== null);
  if (list.length > 0 && customers.length === 0) throw new ApiError(500, null);
  return customers.sort((first, second) => {
    const firstId = Number(first.id);
    const secondId = Number(second.id);
    if (Number.isFinite(firstId) && Number.isFinite(secondId)) {
      return firstId - secondId;
    }
    return String(first.id).localeCompare(String(second.id), "es");
  });
}

export function hasCoordinates(
  customer: CustomerRecord,
): customer is CustomerRecord & { latitude: number; longitude: number } {
  return customer.latitude !== null && customer.longitude !== null;
}


function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchCustomers() {
  const payload = await apiFetch<unknown>("/customers", authOptions());
  return parseCustomerList(payload);
}

export async function fetchCustomer(id: string) {
  const payload = await apiFetch<unknown>(
    `/customers/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const customer = parseCustomer(payload);
  if (!customer) throw new ApiError(500, null);
  return customer;
}

export async function createCustomer(values: CustomerInput) {
  const payload = await apiFetch<unknown>("/customers", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
  return parseCustomer(payload);
}

export async function updateCustomer(id: RecordId, values: CustomerInput) {
  const payload = await apiFetch<unknown>(
    `/customers/${encodeURIComponent(String(id))}`,
    {
      ...authOptions(),
      method: "PUT",
      body: JSON.stringify(values),
    },
  );
  return parseCustomer(payload);
}

export function deleteCustomer(id: RecordId) {
  return apiFetch<void>(`/customers/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
