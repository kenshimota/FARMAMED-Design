"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { BusyButton } from "@/components/erp/ui/action-button";
import {
  FormErrorSummary,
  focusFirstInvalidField,
  useUnsavedChangesWarning,
  type FormErrorItem,
} from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { TextAreaField, TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  createPriceList,
  fetchPriceList,
  updatePriceList,
  type PriceList,
  type PriceListInput,
} from "@/components/erp/records/price-lists-api";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import { ApiError } from "@/lib/api";
import { translateApiError, translateFieldMessage } from "@/lib/api-errors";
import { canReadModule, canWriteModule } from "@/lib/permissions";

const NAME_MAX_LENGTH = 150;
const DESCRIPTION_MAX_LENGTH = 500;

const COPY = {
  nameRequired: "Ingresa el nombre de la lista.",
  nameLength: "El nombre debe tener máximo 150 caracteres.",
  descriptionLength: "La descripción no puede superar los 500 caracteres.",
  percentageRequired: "Ingresa el porcentaje de margen.",
  percentageNumber: "El porcentaje debe ser un número.",
  percentageNegative: "El porcentaje no puede ser negativo.",
  percentageRange: "El porcentaje debe ser menor que 100.",
  percentageDecimals: "El porcentaje debe tener máximo dos decimales.",
  duplicate: "Ya existe una lista con ese nombre.",
  forbidden: "No tienes permiso para administrar listas.",
  notFound: "No encontramos esa lista. Puede que haya sido eliminada.",
  session: "Tu sesión expiró. Inicia sesión de nuevo.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  validation: "Revisa los datos del formulario.",
  generic:
    "No pudimos guardar la lista de precios. Revisa tu conexión e intenta de nuevo.",
  marginHelp:
    "El porcentaje es un margen sobre el costo. El cliente solo ve el precio final. Acepta de 0 a 99,99 con máximo dos decimales; no es un descuento sobre el precio de venta.",
} as const;

function percentageError(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return COPY.percentageRequired;

  const normalized = trimmed.replace(",", ".");
  if (normalized.startsWith("-")) return COPY.percentageNegative;
  if (!/^(\d+(\.\d*)?|\.\d+)$/.test(normalized)) {
    return COPY.percentageNumber;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return COPY.percentageNumber;
  if (parsed < 0) return COPY.percentageNegative;
  if (parsed >= 100) return COPY.percentageRange;

  const decimals = normalized.includes(".")
    ? normalized.split(".")[1].length
    : 0;
  if (decimals > 2) return COPY.percentageDecimals;

  return null;
}

function parsePercentage(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

type PriceListFormPageProps = {
  mode: "create" | "edit";
  priceListId?: string;
};

export function PriceListFormPage({ mode, priceListId }: PriceListFormPageProps) {
  const { user } = useSession();

  if (!canReadModule(user.role, "listas_precios")) {
    return <AccessState description="No tienes permiso para administrar listas." />;
  }

  if (!canWriteModule(user.role, "listas_precios")) {
    return (
      <AccessState description="Tu rol puede consultar listas de precios, pero no crearlas ni editarlas." />
    );
  }

  if (mode === "edit" && !isPositiveRecordId(priceListId)) {
    return (
      <RecordsLoadError
        backHref="/app/listas-de-precios"
        backLabel="Volver a listas de precios"
        description="Puede que el enlace no sea válido o que la lista ya no exista."
        headingLevel="h1"
        title="No encontramos esa lista"
      />
    );
  }

  return <PriceListFormLoader mode={mode} priceListId={priceListId} />;
}

function PriceListFormLoader({ mode, priceListId }: PriceListFormPageProps) {
  const editing = mode === "edit";
  const loader = useCallback(
    () => fetchPriceList(priceListId ?? ""),
    [priceListId],
  );
  const resource = useAsyncResource(loader, { enabled: editing });

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/listas-de-precios"
        >
          Volver a listas
        </Link>
      }
      description={
        editing
          ? "Actualiza el nombre, la descripción y el porcentaje de margen de la lista."
          : "Registra una lista con su nombre, descripción opcional y porcentaje de margen."
      }
      eyebrow="Catálogo"
      title={editing ? "Editar lista de precios" : "Nueva lista de precios"}
    />
  );

  if (editing && resource.status === "loading") {
    return (
      <div className="space-y-5">
        {header}
        <RecordsFormSkeleton />
      </div>
    );
  }

  if (editing && resource.status === "error") {
    const notFound = resource.error?.kind === "not-found";
    return (
      <div className="space-y-5">
        {header}
        <RecordsLoadError
          backHref="/app/listas-de-precios"
          backLabel="Volver a listas de precios"
          description={
            notFound
              ? "Puede que haya sido eliminada o que el enlace no sea válido."
              : resource.error?.message ?? "No pudimos cargar la lista de precios."
          }
          onRetry={notFound ? undefined : resource.reload}
          title={
            notFound
              ? "No encontramos esa lista"
              : "No pudimos cargar la lista de precios"
          }
        />
      </div>
    );
  }

  if (editing && !resource.data) return null;

  return <PriceListFormContent mode={mode} priceList={resource.data ?? undefined} />;
}

function PriceListFormContent({
  mode,
  priceList,
}: {
  mode: "create" | "edit";
  priceList?: PriceList;
}) {
  const router = useRouter();
  const toast = useToast();
  const isEdit = mode === "edit" && priceList !== undefined;

  const nameId = useId();
  const descriptionId = useId();
  const percentageId = useId();

  const initialName = priceList?.name ?? "";
  const initialDescription = priceList?.description ?? "";
  const initialPercentage = priceList ? String(priceList.percentage) : "";

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [percentage, setPercentage] = useState(initialPercentage);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const clientErrors: FormErrorItem[] = useMemo(() => {
    const list: FormErrorItem[] = [];
    const normalizedName = name.trim();

    if (!normalizedName) {
      list.push({
        fieldId: nameId,
        label: "Nombre",
        message: COPY.nameRequired,
      });
    } else if (normalizedName.length > NAME_MAX_LENGTH) {
      list.push({
        fieldId: nameId,
        label: "Nombre",
        message: COPY.nameLength,
      });
    }

    if (description.trim().length > DESCRIPTION_MAX_LENGTH) {
      list.push({
        fieldId: descriptionId,
        label: "Descripción",
        message: COPY.descriptionLength,
      });
    }

    const percentError = percentageError(percentage);
    if (percentError) {
      list.push({
        fieldId: percentageId,
        label: "Porcentaje",
        message: percentError,
      });
    }

    return list;
  }, [description, descriptionId, name, nameId, percentage, percentageId]);

  const visibleErrors = useMemo(() => {
    const result: Record<string, string> = {};
    for (const error of clientErrors) {
      if (touched[error.fieldId] || attempted) result[error.fieldId] = error.message;
    }
    return { ...result, ...serverFieldErrors };
  }, [attempted, clientErrors, serverFieldErrors, touched]);

  const summaryErrors = useMemo(() => {
    const items = clientErrors.filter(
      (error) => attempted || touched[error.fieldId],
    );
    const indexes = new Map(
      items.map((error, index) => [error.fieldId, index]),
    );
    const labels: Record<string, string> = {
      [nameId]: "Nombre",
      [descriptionId]: "Descripción",
      [percentageId]: "Porcentaje",
    };

    for (const [fieldId, message] of Object.entries(serverFieldErrors)) {
      const error: FormErrorItem = {
        fieldId,
        label: labels[fieldId] ?? "Revisa el campo",
        message,
      };
      const index = indexes.get(fieldId);
      if (index === undefined) {
        indexes.set(fieldId, items.length);
        items.push(error);
      } else {
        items[index] = error;
      }
    }

    return items;
  }, [
    attempted,
    clientErrors,
    descriptionId,
    nameId,
    percentageId,
    serverFieldErrors,
    touched,
  ]);

  const hasChanges = useMemo(() => {
    if (isEdit) {
      return (
        name !== initialName ||
        description !== initialDescription ||
        percentage !== initialPercentage
      );
    }
    return Boolean(name.trim() || description.trim() || percentage.trim());
  }, [
    description,
    initialDescription,
    initialName,
    initialPercentage,
    isEdit,
    name,
    percentage,
  ]);

  useUnsavedChangesWarning(hasChanges && !busy);

  function clearServerFieldError(fieldId: string) {
    setServerFieldErrors((current) => {
      if (!(fieldId in current)) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
    setSubmitError(null);
  }

  function applySubmitError(caught: unknown) {
    setServerFieldErrors({});
    setSubmitError(null);

    if (!(caught instanceof ApiError)) {
      setSubmitError(COPY.generic);
      return;
    }

    if (caught.status === 409) {
      const message = caught.message.trim().toLowerCase();
      if (message === "price list already exists") {
        setSubmitError(COPY.duplicate);
        setServerFieldErrors({ [nameId]: COPY.duplicate });
        setTouched((current) => ({ ...current, [nameId]: true }));
        window.requestAnimationFrame(() => focusFirstInvalidField());
        return;
      }
      setSubmitError(translateApiError(caught).message);
      return;
    }

    if (caught.status === 422) {
      const next: Record<string, string> = {};
      if (caught.fieldErrors.name) {
        next[nameId] = translateFieldMessage(caught.fieldErrors.name);
      }
      if (caught.fieldErrors.description) {
        next[descriptionId] = translateFieldMessage(
          caught.fieldErrors.description,
        );
      }
      if (caught.fieldErrors.percentage) {
        next[percentageId] = translateFieldMessage(
          caught.fieldErrors.percentage,
        );
      }

      if (Object.keys(next).length > 0) {
        setServerFieldErrors(next);
        setTouched((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.keys(next).map((fieldId) => [fieldId, true]),
          ),
        }));
        window.requestAnimationFrame(() => focusFirstInvalidField());
      } else {
        setSubmitError(COPY.validation);
      }
      return;
    }

    if (caught.status === 400) {
      setSubmitError(COPY.missingData);
      return;
    }
    if (caught.status === 401) {
      setSubmitError(COPY.session);
      return;
    }
    if (caught.status === 403) {
      setSubmitError(COPY.forbidden);
      return;
    }
    if (caught.status === 404) {
      setSubmitError(COPY.notFound);
      return;
    }

    setSubmitError(translateApiError(caught).message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    setAttempted(true);
    setSubmitError(null);
    setServerFieldErrors({});

    if (clientErrors.length > 0) {
      setTouched((current) => ({
        ...current,
        ...Object.fromEntries(
          clientErrors.map((error) => [error.fieldId, true]),
        ),
      }));
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    const parsedPercentage = parsePercentage(percentage);
    if (parsedPercentage === null) return;

    const input: PriceListInput = {
      name: name.trim(),
      description: description.trim() || null,
      percentage: parsedPercentage,
    };

    setBusy(true);
    try {
      if (isEdit && priceList) {
        const saved = await updatePriceList(String(priceList.id), input);
        toast.success("Lista actualizada.");
        router.push(`/app/listas-de-precios/${saved.id}`);
      } else {
        const saved = await createPriceList(input);
        toast.success("Lista creada.");
        router.push(`/app/listas-de-precios/${saved.id}`);
      }
    } catch (caught) {
      applySubmitError(caught);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/listas-de-precios"
          >
            Volver a listas
          </Link>
        }
        description={
          isEdit
            ? "Actualiza el nombre, la descripción y el porcentaje de margen de la lista."
            : "Registra una lista con su nombre, descripción opcional y porcentaje de margen."
        }
        eyebrow="Catálogo"
        title={
          isEdit
            ? `Editar ${priceList?.name ?? "lista de precios"}`
            : "Nueva lista de precios"
        }
      />

      <form
        aria-busy={busy}
        className="rounded-[24px] border border-line bg-surface p-5 sm:p-8"
        noValidate
        onSubmit={handleSubmit}
      >
        <div className="space-y-6">
          {submitError && (
            <div
              className="rounded-2xl border border-alert/25 bg-alert/[0.06] px-4 py-3.5"
              role="alert"
              tabIndex={-1}
            >
              <p className="text-[13px] font-semibold text-alert-ink">
                {submitError}
              </p>
            </div>
          )}

          <FormErrorSummary errors={summaryErrors} />

          <TextField
            disabled={busy}
            error={visibleErrors[nameId]}
            help="Obligatorio. El nombre debe ser único y de máximo 150 caracteres."
            id={nameId}
            label="Nombre"
            maxLength={NAME_MAX_LENGTH}
            onBlur={() =>
              setTouched((current) => ({ ...current, [nameId]: true }))
            }
            onChange={(value) => {
              clearServerFieldError(nameId);
              setName(value);
            }}
            placeholder="Ej. Mayorista 30"
            required
            value={name}
          />

          <TextAreaField
            disabled={busy}
            error={visibleErrors[descriptionId]}
            help={`Opcional. ${description.length} de 500 caracteres.`}
            id={descriptionId}
            label="Descripción"
            maxLength={DESCRIPTION_MAX_LENGTH}
            onChange={(value) => {
              clearServerFieldError(descriptionId);
              setDescription(value);
            }}
            placeholder="Ej. Margen para clientes mayoristas."
            rows={3}
            value={description}
          />

          <TextField
            disabled={busy}
            error={visibleErrors[percentageId]}
            help={COPY.marginHelp}
            id={percentageId}
            inputMode="decimal"
            label="Porcentaje de margen"
            maxLength={10}
            onBlur={() =>
              setTouched((current) => ({ ...current, [percentageId]: true }))
            }
            onChange={(value) => {
              clearServerFieldError(percentageId);
              setPercentage(value.replace(",", "."));
            }}
            placeholder="Ej. 30"
            required
            value={percentage}
          />
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-end">
          <Link
            className="button-base button-secondary min-h-11 px-6 text-center"
            href="/app/listas-de-precios"
          >
            Cancelar
          </Link>
          <BusyButton
            busy={busy}
            busyLabel="Guardando…"
            className="min-h-11 px-6"
            type="submit"
          >
            {isEdit ? "Guardar cambios" : "Guardar"}
            <Icon name="arrow-right" size={17} />
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
