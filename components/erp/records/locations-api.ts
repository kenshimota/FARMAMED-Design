import { ApiError, apiFetch } from "@/lib/api";
import { getStoredToken } from "@/lib/session-store";
import { readCollection, type RecordId } from "@/components/erp/records/records-api";

export type StateRecord = {
  id: RecordId;
  name: string;
  code: string;
};

export type CityRecord = {
  id: RecordId;
  name: string;
  state_id: RecordId;
  state: StateRecord | null;
};

export type StateInput = {
  name: string;
  code: string;
};

export type CityInput = {
  name: string;
  state_id: RecordId;
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

function unwrapRecord(payload: unknown) {
  if (isRecord(payload) && isRecord(payload.data)) return payload.data;
  return payload;
}

export function parseState(source: unknown): StateRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const name = readText(record.name);
  const code = readText(record.code);
  if (id === null || !name || !code) return null;

  return { id, name, code };
}

export function parseStateList(payload: unknown): StateRecord[] {
  const list = readCollection(payload);
  const states = list
    .map(parseState)
    .filter((state): state is StateRecord => state !== null);
  if (list.length > 0 && states.length === 0) throw new ApiError(500, null);
  return states;
}

export function parseCity(source: unknown): CityRecord | null {
  const record = unwrapRecord(source);
  if (!isRecord(record)) return null;

  const id = readId(record.id);
  const stateId = readId(record.state_id);
  const name = readText(record.name);
  if (id === null || stateId === null || !name) return null;

  return {
    id,
    name,
    state_id: stateId,
    state: isRecord(record.state) ? parseState(record.state) : null,
  };
}

export function parseCityList(payload: unknown): CityRecord[] {
  const list = readCollection(payload);
  const cities = list
    .map(parseCity)
    .filter((city): city is CityRecord => city !== null);
  if (list.length > 0 && cities.length === 0) throw new ApiError(500, null);
  return cities.sort((first, second) => Number(first.id) - Number(second.id));
}

function authOptions(): { token?: string } {
  return { token: getStoredToken() ?? undefined };
}

export async function fetchStates() {
  const payload = await apiFetch<unknown>("/states", authOptions());
  return parseStateList(payload);
}

export async function fetchState(id: string) {
  const payload = await apiFetch<unknown>(
    `/states/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const state = parseState(payload);
  if (!state) throw new ApiError(500, null);
  return state;
}

export async function fetchCities(stateId?: string) {
  const query = new URLSearchParams();
  if (stateId) query.set("state_id", stateId);
  query.set("include", "state");
  const payload = await apiFetch<unknown>(`/cities?${query.toString()}`, authOptions());
  return parseCityList(payload);
}

export async function fetchCity(id: string) {
  const payload = await apiFetch<unknown>(
    `/cities/${encodeURIComponent(id)}`,
    authOptions(),
  );
  const city = parseCity(payload);
  if (!city) throw new ApiError(500, null);
  return city;
}

export async function createState(values: StateInput) {
  const payload = await apiFetch<unknown>("/states", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
  return parseState(payload);
}

export async function updateState(id: RecordId, values: StateInput) {
  const payload = await apiFetch<unknown>(`/states/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "PUT",
    body: JSON.stringify(values),
  });
  return parseState(payload);
}

export function deleteState(id: RecordId) {
  return apiFetch<void>(`/states/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}

export async function createCity(values: CityInput) {
  const payload = await apiFetch<unknown>("/cities", {
    ...authOptions(),
    method: "POST",
    body: JSON.stringify(values),
  });
  return parseCity(payload);
}

export async function updateCity(id: RecordId, values: CityInput) {
  const payload = await apiFetch<unknown>(`/cities/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "PUT",
    body: JSON.stringify(values),
  });
  return parseCity(payload);
}

export function deleteCity(id: RecordId) {
  return apiFetch<void>(`/cities/${encodeURIComponent(String(id))}`, {
    ...authOptions(),
    method: "DELETE",
  });
}
