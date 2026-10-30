"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createCurrency,
  formatRate,
  isBaseCurrency,
  updateCurrency,
  type Currency,
  type CurrencyInput,
  type CurrencyUpdate,
} from "@/lib/finance/currencies-api";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { TextField } from "@/components/erp/records/form-controls";
import { BusyButton } from "@/components/erp/ui/action-button";
import {
  focusFirstInvalidField,
  FormErrorSummary,
  type FormErrorItem,
  useUnsavedChangesWarning,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { translateApiError } from "@/lib/api-errors";

type FormMode = "create" | "edit";

type CurrencyFormProps = {
  mode: FormMode;
  currency?: Currency;
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
}

function validateRate(value: string) {
  if (value.trim() === "") return "La tasa es obligatoria.";
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return "La tasa debe ser mayor que 0.";
  const decimals = value.includes(".") ? value.split(".")[1].length : 0;
  if (decimals > 6) return "La tasa debe tener máximo 6 decimales.";
  return null;
}

export function CurrencyForm({ mode, currency }: CurrencyFormProps) {
  const router = useRouter();
  const toast = useToast();
  const isBase = currency ? isBaseCurrency(currency) : false;
  const isEdit = mode === "edit";

  const [code, setCode] = useState(currency?.code ?? "");
  const [name, setName] = useState(currency?.name ?? "");
  const [symbol, setSymbol] = useState(currency?.symbol ?? "");
  const [rate, setRate] = useState(currency ? formatRate(currency.rate) : "");
  const [isActive, setIsActive] = useState(currency?.is_active ?? true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const originalRate = useMemo(() => (currency ? formatRate(currency.rate) : ""), [currency]);
  const rateChanged = isEdit && rate !== originalRate && rate.trim() !== "";

  const hasChanges = Boolean(
    (isEdit &&
      (name !== (currency?.name ?? "") ||
        symbol !== (currency?.symbol ?? "") ||
        rate !== originalRate ||
        isActive !== (currency?.is_active ?? true))) ||
      (!isEdit && (code.trim() || name.trim() || symbol.trim() || rate.trim())),
  );

  useUnsavedChangesWarning(hasChanges && !busy);

  const codeId = useId();
  const nameId = useId();
  const symbolId = useId();
  const rateId = useId();
  const reasonId = useId();
  const activeId = useId();

  const errors: FormErrorItem[] = useMemo(() => {
    const list: FormErrorItem[] = [];
    if (!isEdit) {
      if (code.trim().length < 2 || code.trim().length > 10) {
        list.push({ fieldId: codeId, label: "Código", message: "El código debe tener entre 2 y 10 caracteres." });
      }
    }
    if (name.trim().length < 1) {
      list.push({ fieldId: nameId, label: "Nombre", message: "El nombre es obligatorio." });
    }
    if (symbol.trim().length < 1) {
      list.push({ fieldId: symbolId, label: "Símbolo", message: "El símbolo es obligatorio." });
    }
    const rateError = validateRate(rate);
    if (rateError) {
      list.push({ fieldId: rateId, label: "Tasa", message: rateError });
    }
    return list;
  }, [code, name, symbol, rate, isEdit, codeId, nameId, symbolId, rateId]);

  const visibleErrors = useMemo(() => {
    const result: Record<string, string> = {};
    for (const error of errors) {
      if (touched[error.fieldId]) result[error.fieldId] = error.message;
    }
    for (const [field, message] of Object.entries(fieldErrors)) {
      result[field] = message;
    }
    return result;
  }, [errors, touched, fieldErrors]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    if (errors.length > 0) {
      setTouched(Object.fromEntries(errors.map((error) => [error.fieldId, true])) as Record<string, boolean>);
      setTimeout(() => focusFirstInvalidField(), 0);
      return;
    }

    setBusy(true);
    try {
      if (isEdit && currency) {
        const update: CurrencyUpdate = {
          name: name.trim(),
          symbol: symbol.trim(),
          rate: Number(rate),
          is_active: isActive,
        };
        if (rateChanged && reason.trim()) {
          update.reason = reason.trim();
        }
        await updateCurrency(String(currency.id), update);
        toast.success("Cambios guardados.");
        router.push("/app/monedas");
      } else {
        const input: CurrencyInput = {
          code: normalizeCode(code),
          name: name.trim(),
          symbol: symbol.trim(),
          rate: Number(rate),
        };
        await createCurrency(input);
        toast.success("Moneda creada.");
        router.push("/app/monedas");
      }
    } catch (caught) {
      const uiError = translateApiError(caught);
      setSubmitError(uiError.message);
      if (Object.keys(uiError.fieldErrors).length > 0) {
        setFieldErrors(uiError.fieldErrors);
      }
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        description={
          isEdit
            ? "Actualiza los datos de la moneda. El código no se puede cambiar."
            : "Registra una nueva moneda con su código, nombre, símbolo y tasa de referencia."
        }
        eyebrow="Finanzas"
        title={isEdit ? `Editar ${currency?.code ?? "moneda"}` : "Nueva moneda"}
      />

      <form
        className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
        onSubmit={handleSubmit}
      >
        <div className="space-y-6">
          {submitError && (
            <div className="rounded-2xl border border-alert/25 bg-alert/[0.06] px-4 py-3.5" role="alert" tabIndex={-1}>
              <p className="text-[13px] font-semibold text-alert-ink">{submitError}</p>
            </div>
          )}

          <FormErrorSummary errors={errors.filter((error) => touched[error.fieldId])} />

          {!isEdit && (
            <TextField
              error={visibleErrors[codeId]}
              id={codeId}
              label="Código"
              onBlur={() => setTouched((current) => ({ ...current, [codeId]: true }) as Record<string, boolean>)}
              onChange={(value) => setCode(normalizeCode(value))}
              placeholder="USD_BCV"
              required
              value={code}
            />
          )}

          <TextField
            error={visibleErrors[nameId]}
            id={nameId}
            label="Nombre"
            onBlur={() => setTouched((current) => ({ ...current, [nameId]: true }) as Record<string, boolean>)}
            onChange={setName}
            placeholder="Dólar BCV"
            required
            value={name}
          />

          <TextField
            error={visibleErrors[symbolId]}
            id={symbolId}
            label="Símbolo"
            onBlur={() => setTouched((current) => ({ ...current, [symbolId]: true }) as Record<string, boolean>)}
            onChange={setSymbol}
            placeholder="$"
            required
            value={symbol}
          />

          <TextField
            disabled={isBase}
            error={visibleErrors[rateId]}
            help={
              isBase
                ? "El bolívar siempre vale 1."
                : `Expresa cuántos VES equivalen a 1 ${code || "moneda"}.`
            }
            id={rateId}
            label="Tasa"
            onBlur={() => setTouched((current) => ({ ...current, [rateId]: true }) as Record<string, boolean>)}
            onChange={(value) => {
              const sanitized = value.replace(/[^0-9.]/g, "");
              setRate(sanitized);
            }}
            placeholder="36,50"
            required
            value={rate}
          />

          {isEdit && rateChanged && !isBase && (
            <TextField
              help="Opcional. Se guardará en el historial de tasas."
              id={reasonId}
              label="Motivo del cambio"
              onChange={setReason}
              placeholder="Ajuste por variación del mercado"
              value={reason}
            />
          )}

          {isEdit && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-background p-4">
              <div>
                <label className="block text-[13px] font-semibold text-ink" htmlFor={activeId}>
                  Activa
                </label>
                <p className="mt-1 text-[12px] leading-5 text-muted">
                  {isBase
                    ? "La moneda base no se puede desactivar."
                    : currency?.is_default_for_transactions
                      ? "La moneda de transacciones no se puede desactivar."
                      : "Las monedas inactivas no aparecen en selecciones de registros."}
                </p>
              </div>
              <button
                aria-checked={isActive}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  isActive ? "bg-brand" : "bg-muted/40"
                } ${isBase || currency?.is_default_for_transactions ? "opacity-60" : ""}`}
                disabled={isBase || currency?.is_default_for_transactions}
                id={activeId}
                onClick={() => setIsActive((current) => !current)}
                role="switch"
                type="button"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-surface shadow transition-transform ${
                    isActive ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            className="button-base button-secondary min-h-11 px-6 text-center"
            href="/app/monedas"
          >
            Cancelar
          </Link>
          <BusyButton busy={busy} busyLabel="Guardando…" className="min-h-11 px-6" type="submit">
            {isEdit ? "Guardar cambios" : "Crear moneda"}
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
