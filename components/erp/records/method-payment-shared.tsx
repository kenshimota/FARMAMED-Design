import { Icon } from "@/components/icons";
import type {
  MethodPaymentDetails,
} from "@/components/erp/records/method-payments-api";
import type {
  MethodPaymentTypeCurrency,
  MethodPaymentTypeField,
} from "@/components/erp/records/method-payment-types-api";
import { METHOD_PAYMENT_COPY } from "@/components/erp/records/method-payment-errors";

export type MethodPaymentStatusBadgeProps = {
  isActive: boolean;
};

export function MethodPaymentStatusBadge({
  isActive,
}: MethodPaymentStatusBadgeProps) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted">
        <Icon name="eye-off" size={13} />
        Inactivo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
      <Icon name="check" size={13} />
      Activo
    </span>
  );
}

export function methodPaymentCountLabel(count: number) {
  return count === 1 ? "1 método de pago" : `${count} métodos de pago`;
}

type TypeDisplay = {
  code: string;
  name: string;
};

export function MethodTypeBadge({ type }: { type: TypeDisplay | null }) {
  if (!type) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[11px] font-semibold text-brand">
        {type.code}
      </span>
      <span className="font-semibold text-ink">{type.name}</span>
    </span>
  );
}

export function MethodCurrencyBadge({
  currency,
}: {
  currency: MethodPaymentTypeCurrency | null;
}) {
  if (!currency) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-semibold text-ink">{currency.code}</span>
      <span className="text-[12px] text-muted">{currency.symbol}</span>
    </span>
  );
}

export type DetailRow = {
  key: string;
  label: string;
  value: string | number | boolean;
};

export function resolveDetailRows(
  details: MethodPaymentDetails,
  fields: readonly MethodPaymentTypeField[],
): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const field of fields) {
    const value = details[field.key];
    if (value === undefined || value === null || value === "") continue;
    rows.push({ key: field.key, label: field.label, value });
  }
  for (const [key, value] of Object.entries(details)) {
    if (rows.some((row) => row.key === key)) continue;
    if (value === undefined || value === null || value === "") continue;
    rows.push({ key, label: key, value });
  }
  return rows;
}

export function formatDetailValue(value: string | number | boolean) {
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

export function MethodPaymentDetailsSummary({
  details,
  fields,
}: {
  details: MethodPaymentDetails;
  fields: readonly MethodPaymentTypeField[];
}) {
  const rows = resolveDetailRows(details, fields);
  if (rows.length === 0) {
    return <span className="text-muted">—</span>;
  }
  const visible = rows.slice(0, 2);
  const extra = rows.length - visible.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
      {visible.map((row) => (
        <span className="text-[12px]" key={row.key}>
          {row.label}
        </span>
      ))}
      {extra > 0 && (
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-ink">
          +{extra} más
        </span>
      )}
    </span>
  );
}

export function MethodPaymentDetailsList({
  details,
  fields,
}: {
  details: MethodPaymentDetails;
  fields: readonly MethodPaymentTypeField[];
}) {
  const rows = resolveDetailRows(details, fields);
  if (rows.length === 0) {
    return (
      <p className="text-[13px] leading-6 text-muted">
        {fields.length === 0
          ? METHOD_PAYMENT_COPY.typeNoFields
          : "Sin datos registrados."}
      </p>
    );
  }
  return (
    <dl className="space-y-3">
      {rows.map((row) => (
        <div
          className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-background px-4 py-3"
          key={row.key}
        >
          <dt className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
            {row.label}
          </dt>
          <dd className="max-w-full break-words text-[13px] font-semibold text-ink">
            {formatDetailValue(row.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
