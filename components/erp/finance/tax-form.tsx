"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createTax,
  updateTax,
  type Tax,
  type TaxInput,
  type TaxUpdate,
} from "@/lib/finance/taxes-api";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { TextAreaField, TextField } from "@/components/erp/records/form-controls";
import { BusyButton } from "@/components/erp/ui/action-button";
import {
  focusFirstInvalidField,
  FormErrorSummary,
  type FormErrorItem,
  useUnsavedChangesWarning,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { translateApiError } from "@/lib/api-errors";

type TaxFormProps = {
  mode: "create" | "edit";
  tax?: Tax;
};

function normalizeCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
}

function validateRate(value: string) {
  if (value.trim() === "") return "La tasa es obligatoria.";
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    return "La tasa debe estar entre 0 y 100.";
  }
  const decimals = value.includes(".") ? value.split(".")[1].length : 0;
  if (decimals > 2) return "La tasa debe tener máximo dos decimales.";
  return null;
}

export function TaxForm({ mode, tax }: TaxFormProps) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = mode === "edit";

  const [code, setCode] = useState(tax?.code ?? "");
  const [name, setName] = useState(tax?.name ?? "");
  const [rate, setRate] = useState(tax ? String(tax.rate) : "");
  const [description, setDescription] = useState(tax?.description ?? "");
  const [isActive, setIsActive] = useState(tax?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const hasChanges = Boolean(
    (isEdit &&
      (name !== (tax?.name ?? "") ||
        rate !== String(tax?.rate ?? "") ||
        description !== (tax?.description ?? "") ||
        isActive !== (tax?.is_active ?? true))) ||
      (!isEdit && (code.trim() || name.trim() || rate.trim() || description.trim())),
  );

  useUnsavedChangesWarning(hasChanges && !busy);

  const codeId = useId();
  const nameId = useId();
  const rateId = useId();
  const descriptionId = useId();
  const activeId = useId();

  const errors: FormErrorItem[] = useMemo(() => {
    const list: FormErrorItem[] = [];
    if (!isEdit) {
      if (code.trim().length < 2 || code.trim().length > 20) {
        list.push({ fieldId: codeId, label: "Código", message: "El código debe tener entre 2 y 20 caracteres alfanuméricos." });
      }
    }
    if (name.trim().length < 2) {
      list.push({ fieldId: nameId, label: "Nombre", message: "El nombre es obligatorio." });
    }
    const rateError = validateRate(rate);
    if (rateError) {
      list.push({ fieldId: rateId, label: "Tasa", message: rateError });
    }
    return list;
  }, [code, name, rate, isEdit, codeId, nameId, rateId]);

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
      if (isEdit && tax) {
        const update: TaxUpdate = {
          name: name.trim(),
          rate: Number(rate),
          description: description.trim(),
          is_active: isActive,
        };
        await updateTax(String(tax.id), update);
        toast.success("Cambios guardados.");
        router.push("/app/impuestos");
      } else {
        const input: TaxInput = {
          code: normalizeCode(code),
          name: name.trim(),
          rate: Number(rate),
          description: description.trim() || undefined,
          is_active: isActive,
        };
        await createTax(input);
        toast.success("Impuesto creado.");
        router.push("/app/impuestos");
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
            ? "Actualiza los datos del impuesto. El código no se puede cambiar."
            : "Registra una definición de impuesto con su código, nombre y tasa porcentual."
        }
        eyebrow="Finanzas"
        title={isEdit ? `Editar ${tax?.code ?? "impuesto"}` : "Nuevo impuesto"}
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
              placeholder="IVA"
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
            placeholder="Impuesto al valor agregado"
            required
            value={name}
          />

          <TextField
            error={visibleErrors[rateId]}
            help="Porcentaje con hasta dos decimales. Ejemplo: 16,00 significa 16 %."
            id={rateId}
            label="Tasa"
            onBlur={() => setTouched((current) => ({ ...current, [rateId]: true }) as Record<string, boolean>)}
            onChange={(value) => {
              const sanitized = value.replace(/[^0-9.]/g, "");
              setRate(sanitized);
            }}
            placeholder="16,00"
            required
            value={rate}
          />

          <TextAreaField
            id={descriptionId}
            label="Descripción"
            onChange={setDescription}
            placeholder="Descripción opcional del impuesto"
            value={description}
          />

          {isEdit && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-background p-4">
              <div>
                <label className="block text-[13px] font-semibold text-ink" htmlFor={activeId}>
                  Disponible para futuros pedidos
                </label>
                <p className="mt-1 text-[12px] leading-5 text-muted">
                  Los impuestos inactivos no se ofrecerán en pedidos futuros.
                </p>
              </div>
              <button
                aria-checked={isActive}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  isActive ? "bg-brand" : "bg-muted/40"
                }`}
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
            href="/app/impuestos"
          >
            Cancelar
          </Link>
          <BusyButton busy={busy} busyLabel="Guardando…" className="min-h-11 px-6" type="submit">
            {isEdit ? "Guardar cambios" : "Crear impuesto"}
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
