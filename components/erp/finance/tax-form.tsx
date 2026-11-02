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
import { SwitchField, TextAreaField, TextField } from "@/components/erp/records/form-controls";
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

function normalizeRate(value: string) {
  return value.replace(/,/g, ".");
}

function validateRate(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return "La tasa es obligatoria.";
  if (!/^\d+(\.\d*)?$/.test(trimmed)) {
    return "La tasa debe ser un número entre 0 y 100.";
  }
  const decimals = trimmed.split(".")[1]?.length ?? 0;
  if (decimals > 2) return "La tasa debe tener máximo dos decimales.";
  const parsed = Number(trimmed);
  if (parsed < 0 || parsed > 100) {
    return "La tasa debe estar entre 0 y 100.";
  }
  return null;
}

const FIELD_LABELS: Record<string, string> = {
  code: "Código",
  name: "Nombre",
  rate: "Tasa",
  description: "Descripción",
  is_active: "Disponibilidad",
};

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
      (!isEdit &&
        (code.trim() || name.trim() || rate.trim() || description.trim() || !isActive)),
  );

  useUnsavedChangesWarning(hasChanges && !busy);

  const codeId = useId();
  const nameId = useId();
  const rateId = useId();
  const descriptionId = useId();
  const activeId = useId();

  const fieldIds = useMemo<Record<string, string>>(
    () => ({
      code: codeId,
      name: nameId,
      rate: rateId,
      description: descriptionId,
      is_active: activeId,
    }),
    [codeId, nameId, rateId, descriptionId, activeId],
  );

  const errors: FormErrorItem[] = useMemo(() => {
    const list: FormErrorItem[] = [];
    if (!isEdit) {
      if (code.trim().length < 2 || code.trim().length > 20) {
        list.push({ fieldId: codeId, label: "Código", message: "El código debe tener entre 2 y 20 caracteres y usar solo letras, números o guion bajo." });
      }
    }
    if (name.trim().length < 2 || name.trim().length > 100) {
      list.push({ fieldId: nameId, label: "Nombre", message: "El nombre debe tener entre 2 y 100 caracteres." });
    }
    const rateError = validateRate(rate);
    if (rateError) {
      list.push({ fieldId: rateId, label: "Tasa", message: rateError });
    }
    if (description.trim().length > 255) {
      list.push({ fieldId: descriptionId, label: "Descripción", message: "La descripción no puede superar los 255 caracteres." });
    }
    return list;
  }, [code, name, rate, description, isEdit, codeId, nameId, rateId, descriptionId]);

  const visibleErrors = useMemo(() => {
    const result: Record<string, string> = {};
    for (const error of errors) {
      if (touched[error.fieldId]) result[error.fieldId] = error.message;
    }
    for (const [field, message] of Object.entries(fieldErrors)) {
      const id = fieldIds[field];
      if (id) result[id] = message;
    }
    return result;
  }, [errors, touched, fieldErrors, fieldIds]);

  const apiErrorItems = useMemo<FormErrorItem[]>(
    () =>
      Object.entries(fieldErrors)
        .filter(([field]) => fieldIds[field])
        .map(([field, message]) => ({
          fieldId: fieldIds[field],
          label: FIELD_LABELS[field] ?? field,
          message,
        })),
    [fieldErrors, fieldIds],
  );

  function clearFieldError(field: string) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

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

          <FormErrorSummary
            errors={[...errors.filter((error) => touched[error.fieldId]), ...apiErrorItems]}
          />

          {isEdit ? (
            <TextField
              help="El código no se puede cambiar."
              id={codeId}
              label="Código"
              onChange={() => undefined}
              readOnly
              value={tax?.code ?? ""}
            />
          ) : (
            <TextField
              error={visibleErrors[codeId]}
              id={codeId}
              label="Código"
              maxLength={20}
              onBlur={() => setTouched((current) => ({ ...current, [codeId]: true }) as Record<string, boolean>)}
              onChange={(value) => {
                clearFieldError("code");
                setCode(normalizeCode(value));
              }}
              placeholder="IVA"
              required
              value={code}
            />
          )}

          <TextField
            error={visibleErrors[nameId]}
            id={nameId}
            label="Nombre"
            maxLength={100}
            onBlur={() => setTouched((current) => ({ ...current, [nameId]: true }) as Record<string, boolean>)}
            onChange={(value) => {
              clearFieldError("name");
              setName(value);
            }}
            placeholder="Impuesto al valor agregado"
            required
            value={name}
          />

          <TextField
            error={visibleErrors[rateId]}
            help="Porcentaje entre 0 y 100 con hasta dos decimales. Acepta coma o punto; en el listado se mostrará como 16,00 %."
            id={rateId}
            inputMode="decimal"
            label="Tasa"
            maxLength={6}
            onBlur={() => setTouched((current) => ({ ...current, [rateId]: true }) as Record<string, boolean>)}
            onChange={(value) => {
              clearFieldError("rate");
              setRate(normalizeRate(value));
            }}
            placeholder="16,00"
            required
            value={rate}
          />

          <TextAreaField
            error={visibleErrors[descriptionId]}
            id={descriptionId}
            label="Descripción"
            maxLength={255}
            onChange={(value) => {
              clearFieldError("description");
              setDescription(value);
            }}
            placeholder="Descripción opcional del impuesto"
            value={description}
          />

          <SwitchField
            checked={isActive}
            error={visibleErrors[activeId]}
            help={
              isEdit
                ? "Los impuestos inactivos no se ofrecerán en pedidos futuros."
                : "Puedes crearlo inactivo y activarlo más adelante."
            }
            id={activeId}
            label="Disponible para futuros pedidos"
            offLabel="No disponible"
            onChange={(checked) => {
              clearFieldError("is_active");
              setIsActive(checked);
            }}
            onLabel="Disponible"
          />
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
