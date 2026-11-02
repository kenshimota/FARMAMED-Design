"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { Skeleton } from "@/components/erp/ui/skeleton";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  fetchCustomers,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import type { UiError } from "@/lib/api-errors";

export const USER_CUSTOMER_SEARCH_SUFFIX = "-buscar";

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function customerMatches(customer: CustomerRecord, query: string) {
  if (!query) return true;
  return [customer.fullName, customer.email, customer.direction].some((value) =>
    normalizeSearch(value).includes(query),
  );
}

export function customerLoadErrorMessage(error: UiError | null) {
  if (!error) return "No pudimos cargar los clientes.";
  if (error.status === 503) {
    return "No podemos cargar los clientes en este momento.";
  }
  if (error.kind === "forbidden") {
    return "No tienes permiso para consultar clientes.";
  }
  if (error.kind === "session-expired") {
    return "Tu sesión expiró. Inicia sesión de nuevo.";
  }
  return "No pudimos cargar los clientes. Revisa tu conexión e intenta de nuevo.";
}

export function useUserCustomers(enabled: boolean) {
  const resource = useAsyncResource(fetchCustomers, { enabled });
  return {
    customers: resource.data ?? [],
    loading:
      enabled && (resource.status === "loading" || resource.status === "idle"),
    loadError:
      resource.status === "error" ? customerLoadErrorMessage(resource.error) : null,
    retry: resource.reload,
  };
}

type UserCustomerSelectorProps = {
  idPrefix: string;
  customers: CustomerRecord[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  selectedId: string;
  onSelect: (id: string) => void;
  currentCustomerId?: string | null;
  disabled?: boolean;
  label?: string;
  help?: ReactNode;
  fieldError?: string | null;
};

export function UserCustomerSelector({
  idPrefix,
  customers,
  loading,
  loadError,
  onRetry,
  selectedId,
  onSelect,
  currentCustomerId = null,
  disabled = false,
  label = "Buscar cliente",
  help,
  fieldError,
}: UserCustomerSelectorProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const filteredCustomers = useMemo(
    () => customers.filter((customer) => customerMatches(customer, normalizedQuery)),
    [customers, normalizedQuery],
  );
  const selectedCustomer =
    customers.find((customer) => String(customer.id) === selectedId) ?? null;

  const searchId = `${idPrefix}${USER_CUSTOMER_SEARCH_SUFFIX}`;
  const helpId = `${idPrefix}-ayuda`;
  const errorId = `${idPrefix}-error`;
  const describedBy = [help ? helpId : null, fieldError ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label
        className="mb-2 block text-[13px] font-semibold text-ink"
        htmlFor={searchId}
      >
        {label}
      </label>
      {help && (
        <p className="mb-2 text-[12px] leading-5 text-muted" id={helpId}>
          {help}
        </p>
      )}

      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          name="search"
          size={17}
        />
        <input
          aria-describedby={describedBy || undefined}
          aria-invalid={fieldError ? true : undefined}
          className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-11 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
          data-autofocus=""
          disabled={disabled || Boolean(loadError)}
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Busca por nombre, correo o dirección"
          type="search"
          value={query}
        />
        {query && (
          <button
            aria-label="Limpiar búsqueda de clientes"
            className="absolute right-0.5 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-background hover:text-ink"
            onClick={() => setQuery("")}
            type="button"
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {fieldError && (
        <p
          className="mt-2 text-[12px] font-semibold leading-5 text-alert-ink"
          id={errorId}
          role="alert"
        >
          {fieldError}
        </p>
      )}

      <p aria-live="polite" className="mt-3 text-[12px] leading-5 text-muted">
        {selectedCustomer
          ? `Cliente seleccionado: ${selectedCustomer.fullName}.`
          : "Sin cliente seleccionado."}
      </p>

      {loading ? (
        <div
          aria-busy="true"
          className="mt-3 space-y-2 rounded-2xl border border-line bg-background/60 p-4"
          role="status"
        >
          <span className="sr-only">Cargando clientes…</span>
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : loadError ? (
        <div className="mt-3 rounded-2xl border border-alert/25 bg-alert/[0.06] px-4 py-3.5 text-[12px] leading-5 text-alert-ink">
          <p role="alert">{loadError}</p>
          <button
            className="mt-2 min-h-11 rounded-full border border-alert/30 px-4 text-[12px] font-semibold transition-colors hover:bg-surface"
            onClick={onRetry}
            type="button"
          >
            Reintentar
          </button>
        </div>
      ) : customers.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-line bg-background/60 px-4 py-3.5 text-[12px] leading-5 text-muted">
          No hay clientes registrados para vincular.
        </p>
      ) : filteredCustomers.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-line bg-background/60 px-4 py-3.5 text-[12px] leading-5 text-muted">
          No hay clientes que coincidan con la búsqueda.
        </p>
      ) : (
        <ul className="mt-3 max-h-[min(46vh,360px)] space-y-2 overflow-y-auto pr-1">
          {filteredCustomers.map((customer) => {
            const customerKey = String(customer.id);
            const isSelected = customerKey === selectedId;
            const isCurrent = customerKey === currentCustomerId;
            return (
              <li key={customerKey}>
                <button
                  aria-pressed={isSelected}
                  className={`flex w-full min-h-11 flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${
                    isSelected
                      ? "border-brand/45 bg-soft-blue"
                      : "border-line bg-surface hover:border-brand/40 hover:bg-background/60"
                  }`}
                  disabled={disabled}
                  onClick={() => onSelect(isSelected ? "" : customerKey)}
                  type="button"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {customer.fullName}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-soft-lime px-2.5 py-1 text-[10px] font-semibold text-ink">
                        Vinculado actualmente
                      </span>
                    )}
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold text-ink">
                        <Icon name="check" size={12} />
                        Seleccionado
                      </span>
                    )}
                  </span>
                  <span className="break-all text-[12px] leading-5 text-muted">
                    {customer.email || "Correo no registrado"}
                  </span>
                  <span className="text-[12px] leading-5 text-muted">
                    {customer.direction || "Dirección no registrada"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
