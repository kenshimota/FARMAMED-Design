"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { BusyButton } from "@/components/erp/ui/action-button";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import {
  FormErrorSummary,
  focusFirstInvalidField,
  useUnsavedChangesWarning,
  type FormErrorItem,
} from "@/components/erp/ui/form";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  DateField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsFormSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import {
  fetchCustomers,
  type CustomerRecord,
} from "@/components/erp/records/customers-api";
import {
  fetchMethodPayments,
  type MethodPayment,
} from "@/components/erp/records/method-payments-api";
import {
  createPayment,
  fetchPayment,
  paymentPaidAtTimestamp,
  updatePayment,
  type PaymentRecord,
  type PaymentUpdateInput,
} from "@/components/erp/records/payments-api";
import {
  currencyInputValue,
  paymentMethodLabel,
} from "@/components/erp/records/payment-shared";
import { translateApiError } from "@/lib/api-errors";
import { formatDateInputValue, formatMoney } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type FieldKey =
  | "customer"
  | "method"
  | "amount"
  | "paidAt"
  | "reference"
  | "notes";

type FieldErrors = Partial<Record<FieldKey, string>>;

const FIELD_LABELS: Record<FieldKey, string> = {
  customer: "Cliente",
  method: "Método de pago",
  amount: "Monto",
  paidAt: "Fecha del pago",
  reference: "Referencia",
  notes: "Notas",
};

const AMOUNT_PATTERN = /^\d{1,12}([.,]\d{1,2})?$/;
const AMOUNT_MAX = 999999999999.99;
const REFERENCE_MAX_LENGTH = 100;
const NOTES_MAX_LENGTH = 1000;

const NO_CUSTOMERS: CustomerRecord[] = [];
const NO_METHODS: MethodPayment[] = [];

const COPY = {
  customerRequired: "Selecciona un cliente.",
  methodRequired: "Selecciona un método de pago activo.",
  amountRequired: "Ingresa el monto del pago.",
  amountFormat:
    "Usa un monto mayor que cero, con máximo dos decimales y 12 dígitos enteros.",
  amountRange: "El monto supera el máximo permitido.",
  dateRequired: "Ingresa la fecha del pago.",
  referenceLength: "La referencia no puede superar los 100 caracteres.",
  notesLength: "Las notas no pueden superar los 1000 caracteres.",
  missingData: "Faltan datos obligatorios. Revisa el formulario.",
  conflict:
    "Este pago ya está aplicado a una factura y no se puede modificar. Los montos de pagos aplicados no se alteran.",
  notFoundPayment: "No encontramos el pago. Puede que haya sido eliminado.",
  notFoundReference:
    "No encontramos el cliente o el método de pago seleccionado. Actualiza la lista e intenta de nuevo.",
  generic:
    "No pudimos guardar el pago. Revisa tu conexión e intenta de nuevo.",
  createSuccess: "Pago registrado. La billetera del cliente se actualizó.",
  updateSuccess: "Pago actualizado.",
} as const;

function parseAmount(value: string) {
  const trimmed = value.trim();
  if (!AMOUNT_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > AMOUNT_MAX) {
    return null;
  }
  return parsed;
}

function amountInputValue(amount: number) {
  return amount.toFixed(2).replace(".", ",");
}

function mapServerFieldErrors(
  fieldErrors: Record<string, string>,
): FieldErrors {
  const mapped: FieldErrors = {};
  const entries: Record<string, FieldKey> = {
    customer_id: "customer",
    method_payment_id: "method",
    amount: "amount",
    paid_at: "paidAt",
    reference: "reference",
    notes: "notes",
  };
  for (const [field, message] of Object.entries(fieldErrors)) {
    const key = entries[field];
    if (key) mapped[key] = message;
  }
  return mapped;
}

type PaymentFormPageProps = {
  mode: "create" | "edit";
  paymentId?: string;
  initialCustomerId?: string;
};

export function PaymentFormPage({
  mode,
  paymentId,
  initialCustomerId = "",
}: PaymentFormPageProps) {
  const { user } = useSession();
  const canRead = canReadModule(user.role, "pagos");
  const canWrite = canWriteModule(user.role, "pagos");

  if (!canRead) {
    return (
      <AccessState description="No tienes permiso para consultar pagos recibidos." />
    );
  }

  if (!canWrite) {
    return (
      <AccessState description="Tu rol puede consultar pagos, pero no registrarlos ni editarlos." />
    );
  }

  if (mode === "edit" && !isPositiveRecordId(paymentId)) {
    return (
      <RecordsLoadError
        backHref="/app/pagos"
        backLabel="Volver a pagos"
        description="Puede que el enlace no sea válido o que el pago ya no exista."
        headingLevel="h1"
        title="No encontramos ese pago"
      />
    );
  }

  return (
    <PaymentFormLoader
      initialCustomerId={initialCustomerId}
      mode={mode}
      paymentId={paymentId}
    />
  );
}

function PaymentFormLoader({
  mode,
  paymentId,
  initialCustomerId = "",
}: PaymentFormPageProps) {
  const editing = mode === "edit";
  const loader = useCallback(
    () => fetchPayment(paymentId ?? ""),
    [paymentId],
  );
  const resource = useAsyncResource(loader, { enabled: editing });

  const header = (
    <RecordsPageHeader
      actions={
        <Link
          className="button-base button-secondary min-h-11 px-5 text-[13px]"
          href="/app/pagos"
        >
          Volver a pagos
        </Link>
      }
      description="La moneda se toma del método de pago seleccionado; no se elige ni se convierte en el formulario."
      eyebrow="Finanzas"
      title={editing ? "Editar pago" : "Registrar pago"}
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
          backHref="/app/pagos"
          backLabel="Volver a pagos"
          description={
            notFound
              ? "Puede que haya sido eliminado o que el enlace no sea válido."
              : resource.error?.message ?? "No pudimos cargar el pago."
          }
          onRetry={notFound ? undefined : resource.reload}
          title={notFound ? "No encontramos ese pago" : "No pudimos cargar el pago"}
        />
      </div>
    );
  }

  if (editing && !resource.data) return null;

  return (
    <PaymentFormContent
      initialCustomerId={initialCustomerId}
      mode={mode}
      payment={resource.data ?? undefined}
    />
  );
}

function PaymentFormContent({
  mode,
  payment,
  initialCustomerId,
}: {
  mode: "create" | "edit";
  payment?: PaymentRecord;
  initialCustomerId: string;
}) {
  const { user } = useSession();
  const router = useRouter();
  const toast = useToast();
  const editing = mode === "edit" && payment !== undefined;

  const formRef = useRef<HTMLFormElement>(null);
  const customerFieldId = useId();
  const methodFieldId = useId();
  const amountFieldId = useId();
  const currencyFieldId = useId();
  const paidAtFieldId = useId();
  const referenceFieldId = useId();
  const notesFieldId = useId();

  const initialCustomer = payment
    ? String(payment.customer_id)
    : initialCustomerId;
  const initialMethod = payment ? String(payment.method_payment_id) : "";
  const initialAmount = payment ? amountInputValue(payment.amount) : "";
  const initialPaidAt = payment?.paid_at
    ? formatDateInputValue(payment.paid_at)
    : "";
  const initialReference = payment?.reference ?? "";
  const initialNotes = payment?.notes ?? "";

  const [customerId, setCustomerId] = useState(initialCustomer);
  const [methodPaymentId, setMethodPaymentId] = useState(initialMethod);
  const [amount, setAmount] = useState(initialAmount);
  const [paidAt, setPaidAt] = useState(initialPaidAt);
  const [reference, setReference] = useState(initialReference);
  const [notes, setNotes] = useState(initialNotes);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});

  const customersResource = useAsyncResource(fetchCustomers);
  const methodsResource = useAsyncResource(() =>
    fetchMethodPayments({ is_active: true }),
  );
  const customers = customersResource.data ?? NO_CUSTOMERS;
  const methods = methodsResource.data ?? NO_METHODS;

  const customer = useMemo(
    () =>
      customers.find((item) => String(item.id) === customerId) ??
      (payment && String(payment.customer_id) === customerId
        ? ({ id: payment.customer_id, fullName: `Cliente #${payment.customer_id}` } as CustomerRecord)
        : null),
    [customerId, customers, payment],
  );

  const selectedMethod = useMemo(
    () =>
      methods.find((method) => String(method.id) === methodPaymentId) ?? null,
    [methodPaymentId, methods],
  );

  const currency = payment?.currency ?? selectedMethod?.currency ?? null;
  const methodLabel = payment
    ? paymentMethodLabel(payment.method_payment, payment.method_payment_id)
    : null;

  const clientErrors = useMemo<FieldErrors>(() => {
    const errors: FieldErrors = {};
    if (!customerId) errors.customer = COPY.customerRequired;
    if (!methodPaymentId) errors.method = COPY.methodRequired;

    const parsedAmount = parseAmount(amount);
    if (!amount.trim()) {
      errors.amount = COPY.amountRequired;
    } else if (parsedAmount === null) {
      errors.amount = Number(amount.trim().replace(",", ".")) > AMOUNT_MAX
        ? COPY.amountRange
        : COPY.amountFormat;
    }

    if (editing && !paidAt) errors.paidAt = COPY.dateRequired;
    if (reference.trim().length > REFERENCE_MAX_LENGTH) {
      errors.reference = COPY.referenceLength;
    }
    if (notes.trim().length > NOTES_MAX_LENGTH) {
      errors.notes = COPY.notesLength;
    }
    return errors;
  }, [amount, customerId, editing, methodPaymentId, notes, paidAt, reference]);

  const visibleError = (key: FieldKey) =>
    serverErrors[key] ?? (attempted || touched[key] ? clientErrors[key] : undefined);

  const dirty = editing
    ? customerId !== initialCustomer ||
      methodPaymentId !== initialMethod ||
      amount !== initialAmount ||
      paidAt !== initialPaidAt ||
      reference !== initialReference ||
      notes !== initialNotes
    : customerId !== initialCustomer ||
      Boolean(methodPaymentId || amount || paidAt || reference || notes);

  useUnsavedChangesWarning(dirty && !submitting);

  const canCreateCustomers = canWriteModule(user.role, "clientes");
  const canCreateMethods = canWriteModule(user.role, "metodos_pago");

  const customerOptions = useMemo(
    () =>
      customers.map((item) => ({
        value: String(item.id),
        label: item.email ? `${item.fullName} — ${item.email}` : item.fullName,
      })),
    [customers],
  );

  const methodOptions = useMemo(
    () =>
      methods.map((method: MethodPayment) => ({
        value: String(method.id),
        label: method.currency
          ? `${method.label} · ${method.currency.code}`
          : method.label,
      })),
    [methods],
  );

  const summaryErrors: FormErrorItem[] = [];
  const fieldKeys: FieldKey[] = [
    "customer",
    "method",
    "amount",
    "paidAt",
    "reference",
    "notes",
  ];
  const fieldIds: Record<FieldKey, string> = {
    customer: customerFieldId,
    method: methodFieldId,
    amount: amountFieldId,
    paidAt: paidAtFieldId,
    reference: referenceFieldId,
    notes: notesFieldId,
  };
  for (const key of fieldKeys) {
    const message = visibleError(key);
    if (!message) continue;
    summaryErrors.push({
      fieldId: fieldIds[key],
      label: FIELD_LABELS[key],
      message,
    });
  }

  function touch(key: FieldKey) {
    setTouched((current) => ({ ...current, [key]: true }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setAttempted(true);
    setSubmitError(null);
    setServerErrors({});

    if (Object.keys(clientErrors).length > 0) {
      window.requestAnimationFrame(() => {
        focusFirstInvalidField(formRef.current ?? document);
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editing && payment) {
        const input: PaymentUpdateInput = {
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        };
        if (paidAt && paidAt !== initialPaidAt) {
          input.paid_at = paymentPaidAtTimestamp(paidAt);
        }
        await updatePayment(String(payment.id), input);
        toast.success(COPY.updateSuccess);
        router.push(`/app/pagos/${payment.id}`);
        return;
      }

      const created = await createPayment({
        customer_id: customerId,
        method_payment_id: methodPaymentId,
        amount: parseAmount(amount) ?? 0,
        paid_at: paidAt ? paymentPaidAtTimestamp(paidAt) : undefined,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      const balance = created.wallet
        ? ` Saldo actual: ${formatMoney(
            created.wallet.balance,
            created.currency ?? created.wallet.currency ?? {},
          )}`
        : "";
      toast.success(`${COPY.createSuccess}${balance}`);
      router.push(`/app/pagos/${created.id}`);
    } catch (caught) {
      const ui = translateApiError(caught);
      if (ui.kind === "conflict") {
        setSubmitError(COPY.conflict);
      } else if (ui.kind === "not-found") {
        setSubmitError(
          editing ? COPY.notFoundPayment : COPY.notFoundReference,
        );
      } else if (ui.kind === "validation") {
        setServerErrors(mapServerFieldErrors(ui.fieldErrors));
        setSubmitError(ui.message);
        window.requestAnimationFrame(() => {
          focusFirstInvalidField(formRef.current ?? document);
        });
      } else if (ui.kind === "bad-request") {
        setSubmitError(COPY.missingData);
      } else if (ui.kind === "forbidden") {
        setSubmitError(
          editing
            ? "No tienes permiso para editar pagos."
            : "No tienes permiso para registrar pagos.",
        );
      } else {
        setSubmitError(ui.message || COPY.generic);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href={editing && payment ? `/app/pagos/${payment.id}` : "/app/pagos"}
          >
            {editing ? "Volver al detalle" : "Volver a pagos"}
          </Link>
        }
        description={
          editing
            ? "Solo puedes actualizar la referencia, las notas y la fecha. El cliente, el método, la moneda y el monto son inmutables."
            : "Registra el dinero recibido del cliente. El depósito acredita su billetera en la moneda del método de pago."
        }
        eyebrow="Finanzas"
        title={editing ? "Editar pago" : "Registrar pago"}
      />

      <CurrencyNoticeBanner />

      <form
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
        noValidate
        onSubmit={handleSubmit}
        ref={formRef}
      >
        <div className="flex flex-col gap-2 border-b border-line pb-5">
          <span className="eyebrow">Datos del pago</span>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">
            {editing ? "Datos registrados" : "Nuevo pago recibido"}
          </h2>
          <p className="max-w-2xl text-[13px] leading-6 text-muted">
            {editing
              ? "Los campos bloqueados se muestran solo para consulta. Los montos de pagos aplicados no se alteran."
              : "El pago acredita la billetera del cliente. El registro es manual y no ejecuta cobros en línea."}
          </p>
        </div>

        {summaryErrors.length > 0 && (
          <div className="mt-5">
            <FormErrorSummary errors={summaryErrors} />
          </div>
        )}

        {submitError && (
          <div className="mt-5">
            <NoticeBanner role="alert" tone="danger">
              {submitError}
            </NoticeBanner>
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {editing ? (
            <>
              <TextField
                disabled={submitting}
                help="El cliente no se puede modificar después de registrar el pago."
                id={customerFieldId}
                label="Cliente"
                onChange={() => undefined}
                readOnly
                value={customer?.fullName ?? `Cliente #${initialCustomer}`}
              />
              <TextField
                disabled={submitting}
                help="El método no se puede modificar después de registrar el pago."
                id={methodFieldId}
                label="Método de pago"
                onChange={() => undefined}
                readOnly
                value={methodLabel ?? `Método #${initialMethod}`}
              />
            </>
          ) : (
            <>
              <SelectField
                createHref={canCreateCustomers ? "/app/clientes/nuevo" : undefined}
                createLabel={canCreateCustomers ? "Registrar cliente" : undefined}
                emptyLabel="No hay clientes registrados."
                error={visibleError("customer")}
                help="El pago se acredita a la billetera de este cliente."
                id={customerFieldId}
                label="Cliente"
                loading={customersResource.status === "loading"}
                loadingLabel="Cargando clientes…"
                loadError={
                  customersResource.status === "error"
                    ? customersResource.error?.message ??
                      "No pudimos cargar los clientes."
                    : null
                }
                onChange={(value) => {
                  setCustomerId(value);
                  touch("customer");
                }}
                onRetry={customersResource.reload}
                options={customerOptions}
                placeholder="Selecciona un cliente"
                required
                value={customerId}
              />
              <SelectField
                createHref={canCreateMethods ? "/app/metodos-pago/nuevo" : undefined}
                createLabel={canCreateMethods ? "Registrar método de pago" : undefined}
                emptyLabel="No hay métodos de pago activos."
                error={visibleError("method")}
                help="Solo se muestran métodos activos. La moneda se deriva de este método."
                id={methodFieldId}
                label="Método de pago"
                loading={methodsResource.status === "loading"}
                loadingLabel="Cargando métodos…"
                loadError={
                  methodsResource.status === "error"
                    ? methodsResource.error?.message ??
                      "No pudimos cargar los métodos de pago."
                    : null
                }
                onChange={(value) => {
                  setMethodPaymentId(value);
                  touch("method");
                  setServerErrors({});
                }}
                onRetry={methodsResource.reload}
                options={methodOptions}
                placeholder="Selecciona un método"
                required
                value={methodPaymentId}
              />
            </>
          )}

          <TextField
            disabled={submitting}
            error={editing ? undefined : visibleError("amount")}
            help={
              editing
                ? "El monto no se puede modificar. Para corregirlo, un administrador puede eliminar el pago si no tiene asignaciones."
                : "Obligatorio. Mayor que cero y con máximo dos decimales."
            }
            id={amountFieldId}
            inputMode="decimal"
            label="Monto"
            maxLength={15}
            onChange={(value) => {
              setAmount(value);
              touch("amount");
            }}
            placeholder="0,00"
            readOnly={editing}
            required={!editing}
            value={amount}
          />

          <TextField
            disabled={submitting}
            help="La moneda se toma del método de pago seleccionado."
            id={currencyFieldId}
            label="Moneda"
            onChange={() => undefined}
            placeholder="Se deriva del método de pago"
            readOnly
            value={currencyInputValue(currency)}
          />

          <DateField
            disabled={submitting}
            error={visibleError("paidAt")}
            help={
              editing
                ? "Actualiza la fecha registrada del pago."
                : "Opcional. Si la dejas vacía, se usa la fecha de registro."
            }
            id={paidAtFieldId}
            label="Fecha del pago"
            onChange={(value) => {
              setPaidAt(value);
              touch("paidAt");
            }}
            required={editing}
            value={paidAt}
          />

          <TextField
            disabled={submitting}
            error={visibleError("reference")}
            help="Opcional. Número de transacción o referencia del comprobante."
            id={referenceFieldId}
            label="Referencia"
            maxLength={REFERENCE_MAX_LENGTH}
            onChange={(value) => {
              setReference(value);
              touch("reference");
            }}
            placeholder="Ej. TRX-123"
            value={reference}
          />
        </div>

        <div className="mt-5">
          <TextAreaField
            disabled={submitting}
            error={visibleError("notes")}
            help="Opcional. Detalle interno del pago recibido."
            id={notesFieldId}
            label="Notas"
            maxLength={NOTES_MAX_LENGTH}
            onChange={(value) => {
              setNotes(value);
              touch("notes");
            }}
            placeholder="Ej. Depósito recibido en la cuenta de la empresa"
            rows={4}
            value={notes}
          />
        </div>

        <div className="mt-6 space-y-3 rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-5 text-ink">
          <p>
            El pago genera un movimiento <strong>Depósito</strong> en la
            billetera del cliente con el saldo resultante.
          </p>
          <p>
            No hay conversión de moneda: el monto se acredita en la moneda del
            método de pago. El registro es manual y no ejecuta cobros en línea.
          </p>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:justify-end">
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href={editing && payment ? `/app/pagos/${payment.id}` : "/app/pagos"}
          >
            Cancelar
          </Link>
          <BusyButton
            busy={submitting}
            busyLabel={editing ? "Guardando…" : "Registrando…"}
            className="min-h-11 px-5 text-[13px]"
            type="submit"
          >
            {editing ? "Guardar cambios" : "Registrar pago"}
            <Icon name="arrow-right" size={17} />
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
