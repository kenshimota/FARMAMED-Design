"use client";

import { useId } from "react";
import { CurrencyChip } from "@/components/erp/ui/currency-select";
import { EmptyState } from "@/components/erp/ui/empty-state";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonText,
} from "@/components/erp/ui/skeleton";
import { formatDateTime, formatInteger, formatMoney, formatRate } from "@/lib/format";
import {
  sortEquivalenceLines,
  type EquivalenceCurrency,
  type EquivalenceLine,
  type RecordEquivalence,
} from "@/lib/finance/equivalence-api";
import { EQUIVALENCE_COPY } from "@/components/erp/records/equivalence/equivalence-copy";

type EquivalenceDetailsProps = {
  data: RecordEquivalence;
  documentCurrency: EquivalenceCurrency | null;
  targetCurrency: EquivalenceCurrency;
};

type LineRow = EquivalenceLine & { rowKey: string };

function money(value: number | null, currency: EquivalenceCurrency | null) {
  if (value === null) return "—";
  return formatMoney(value, {
    code: currency?.code,
    symbol: currency?.symbol,
  });
}

function quantityText(value: number | null) {
  return value === null ? "—" : formatInteger(value);
}

function lineName(line: EquivalenceLine) {
  return line.productName || "Producto no disponible";
}

function lineState(line: EquivalenceLine) {
  return line.itemStateName || "Sin estado";
}

function AmountRow({
  label,
  value,
  currency,
}: {
  label: string;
  value: number | null;
  currency: EquivalenceCurrency | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums text-ink">{money(value, currency)}</dd>
    </div>
  );
}

function EquivalenceSummary({
  data,
  documentCurrency,
  targetCurrency,
}: EquivalenceDetailsProps) {
  const sourceCurrency = data.source.currency ?? documentCurrency;
  const equivalentCurrency = data.target.currency ?? targetCurrency;
  const isInvoice = data.scope === "invoice";
  const primarySource = isInvoice ? data.source.balanceDue : data.source.total;
  const primaryTarget = isInvoice ? data.target.balanceDue : data.target.total;
  const primaryLabel = isInvoice
    ? EQUIVALENCE_COPY.invoiceBalance
    : EQUIVALENCE_COPY.totalOrder;
  const equivalentPrimaryLabel = isInvoice
    ? "Saldo pendiente equivalente"
    : "Total equivalente";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <article className="rounded-2xl border border-line bg-background p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold text-ink">
              {primaryLabel}
            </h3>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {EQUIVALENCE_COPY.documentCurrency}
            </p>
          </div>
          <CurrencyChip currency={sourceCurrency} />
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-ink">
          {money(primarySource, sourceCurrency)}
        </p>
        <dl className="mt-4 space-y-2 border-t border-line pt-3 text-[12px]">
          <AmountRow
            currency={sourceCurrency}
            label="Subtotal"
            value={data.source.subtotal}
          />
          {isInvoice && (
            <>
              <AmountRow
                currency={sourceCurrency}
                label="Impuesto"
                value={data.source.taxAmount}
              />
              <AmountRow
                currency={sourceCurrency}
                label="Total"
                value={data.source.total}
              />
              <AmountRow
                currency={sourceCurrency}
                label="Pagado"
                value={data.source.paidAmount}
              />
            </>
          )}
        </dl>
      </article>

      <article className="rounded-2xl border border-brand/20 bg-soft-blue p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-[13px] font-semibold text-ink">
              {EQUIVALENCE_COPY.equivalentIn} {equivalentCurrency?.code ?? "—"}
            </h3>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              {equivalentPrimaryLabel}
            </p>
          </div>
          <CurrencyChip currency={equivalentCurrency} />
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-ink">
          {money(primaryTarget, equivalentCurrency)}
        </p>
        <dl className="mt-4 space-y-2 border-t border-brand/15 pt-3 text-[12px]">
          <AmountRow
            currency={equivalentCurrency}
            label="Subtotal equivalente"
            value={data.target.subtotal}
          />
          {isInvoice && (
            <>
              <AmountRow
                currency={equivalentCurrency}
                label="Impuesto equivalente"
                value={data.target.taxAmount}
              />
              <AmountRow
                currency={equivalentCurrency}
                label="Total equivalente"
                value={data.target.total}
              />
              <AmountRow
                currency={equivalentCurrency}
                label="Pagado equivalente"
                value={data.target.paidAmount}
              />
            </>
          )}
        </dl>
      </article>
    </div>
  );
}

function EquivalenceRateStamp({
  data,
  documentCurrency,
  targetCurrency,
}: EquivalenceDetailsProps) {
  const titleId = useId();
  const sourceCurrency = data.source.currency ?? documentCurrency;
  const equivalentCurrency = data.target.currency ?? targetCurrency;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-brand/15 bg-surface p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            className="text-[13px] font-semibold text-ink"
            id={titleId}
          >
            {EQUIVALENCE_COPY.rate}
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-muted">
            {EQUIVALENCE_COPY.rateMayChange}
          </p>
        </div>
        <span className="rounded-full border border-line bg-background px-3 py-1.5 font-mono text-[13px] font-semibold tabular-nums text-ink">
          {formatRate(data.exchangeRate)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CurrencyChip currency={sourceCurrency} />
        <span aria-hidden="true" className="text-muted">
          →
        </span>
        <span className="sr-only">a</span>
        <CurrencyChip currency={equivalentCurrency} />
      </div>

      <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            {EQUIVALENCE_COPY.rateSourceUpdatedAt}
          </dt>
          <dd className="mt-1 tabular-nums text-ink">
            {data.ratesUpdatedAt?.source
              ? formatDateTime(data.ratesUpdatedAt.source)
              : "No registrada"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            {EQUIVALENCE_COPY.rateTargetUpdatedAt}
          </dt>
          <dd className="mt-1 tabular-nums text-ink">
            {data.ratesUpdatedAt?.target
              ? formatDateTime(data.ratesUpdatedAt.target)
              : "No registrada"}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            {EQUIVALENCE_COPY.calculatedAt}
          </dt>
          <dd className="mt-1 tabular-nums text-ink">
            {data.calculatedAt
              ? formatDateTime(data.calculatedAt)
              : "No registrada"}
          </dd>
        </div>
        {data.roundingAdjustment !== 0 && (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              {EQUIVALENCE_COPY.rounding}
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {money(data.roundingAdjustment, equivalentCurrency)}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function EquivalenceCashNotice({
  data,
  targetCurrency,
}: {
  data: RecordEquivalence;
  targetCurrency: EquivalenceCurrency;
}) {
  const titleId = useId();
  const equivalentCurrency = data.target.currency ?? targetCurrency;
  const isInvoice = data.scope === "invoice";
  const primaryTarget = isInvoice ? data.target.balanceDue : data.target.total;
  const amountDue = data.payment.amountDueTarget ?? primaryTarget;
  const amountLabel = isInvoice ? "Saldo pendiente equivalente" : "Total equivalente";

  if (data.payment.isCash === true) {
    return (
      <section
        aria-labelledby={titleId}
        className="rounded-2xl border border-olive/35 bg-soft-lime p-4 sm:p-5"
      >
        <h3 className="text-[15px] font-semibold text-ink" id={titleId}>
          {EQUIVALENCE_COPY.cashAmountPrefix} {equivalentCurrency.code}
        </h3>
        <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink">
          {money(amountDue, equivalentCurrency)}
        </p>
        <p className="mt-2 text-[12px] leading-5 text-ink">
          {EQUIVALENCE_COPY.cashHelp}
        </p>
      </section>
    );
  }

  if (data.payment.isCash === false) {
    const days = data.paymentTerm?.days ?? null;
    const creditLabel =
      days === null
        ? "Crédito"
        : `${EQUIVALENCE_COPY.creditPrefix} ${days} ${
            days === 1 ? "día" : "días"
          }`;

    return (
      <section
        aria-labelledby={titleId}
        className="rounded-2xl border border-line bg-background p-4 sm:p-5"
      >
        <h3 className="text-[14px] font-semibold text-ink" id={titleId}>
          {creditLabel}
        </h3>
        <p className="mt-2 flex flex-wrap items-baseline gap-2 text-[13px] text-muted">
          <span>{amountLabel}:</span>
          <span className="font-semibold tabular-nums text-ink">
            {money(amountDue, equivalentCurrency)}
          </span>
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-line bg-background p-4 sm:p-5"
    >
      <h3 className="text-[14px] font-semibold text-ink" id={titleId}>
        {EQUIVALENCE_COPY.termPending}
      </h3>
      <p className="mt-2 flex flex-wrap items-baseline gap-2 text-[13px] text-muted">
        <span>{amountLabel}:</span>
        <span className="font-semibold tabular-nums text-ink">
          {money(amountDue, equivalentCurrency)}
        </span>
      </p>
    </section>
  );
}

function EquivalenceLines({
  data,
  documentCurrency,
  targetCurrency,
}: EquivalenceDetailsProps) {
  const titleId = useId();
  const sourceCurrency = data.source.currency ?? documentCurrency;
  const equivalentCurrency = data.target.currency ?? targetCurrency;
  const rows: LineRow[] = sortEquivalenceLines(data.lines).map((line, index) => ({
    ...line,
    rowKey: `linea-${line.orderItemId ?? "sin-id"}-${index}`,
  }));

  const columns: RecordsTableColumn<LineRow>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (line) => (
        <div>
          <span className="font-semibold text-ink">{lineName(line)}</span>
          {line.productReference && (
            <span className="mt-1 block font-mono text-[11px] text-muted">
              Ref. {line.productReference}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (line) => (
        <span className="inline-flex max-w-full rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          <span className="break-words">{lineState(line)}</span>
        </span>
      ),
    },
    {
      key: "cantidad",
      header: "Cantidad",
      className: "whitespace-nowrap text-right tabular-nums",
      headerClassName: "text-right",
      render: (line) => quantityText(line.quantity),
    },
    {
      key: "precio-original",
      header: "Precio unit. original",
      className: "whitespace-nowrap text-right tabular-nums",
      headerClassName: "text-right",
      render: (line) => money(line.unitPriceSource, sourceCurrency),
    },
    {
      key: "subtotal-original",
      header: "Subtotal original",
      className: "whitespace-nowrap text-right font-semibold tabular-nums",
      headerClassName: "text-right",
      render: (line) => money(line.subtotalSource, sourceCurrency),
    },
    {
      key: "precio-equivalente",
      header: "Precio unit. equivalente",
      className: "whitespace-nowrap text-right tabular-nums",
      headerClassName: "text-right",
      render: (line) => money(line.unitPriceTarget, equivalentCurrency),
    },
    {
      key: "subtotal-equivalente",
      header: "Subtotal equivalente",
      className: "whitespace-nowrap text-right font-semibold tabular-nums",
      headerClassName: "text-right",
      render: (line) => money(line.subtotalTarget, equivalentCurrency),
    },
  ];

  function renderCard(line: LineRow) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">{lineName(line)}</p>
            {line.productReference && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                Ref. {line.productReference}
              </p>
            )}
          </div>
          <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
            {lineState(line)}
          </span>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3 text-[12px]">
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Cantidad
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {quantityText(line.quantity)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-semibold text-ink">Original</dt>
            <dd className="mt-1 text-[12px] tabular-nums text-ink">
              {money(line.subtotalSource, sourceCurrency)}
            </dd>
            <p className="mt-1 text-[11px] text-muted">
              Precio unitario: {money(line.unitPriceSource, sourceCurrency)}
            </p>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-semibold text-ink">Equivalente</dt>
            <dd className="mt-1 text-[12px] tabular-nums text-ink">
              {money(line.subtotalTarget, equivalentCurrency)}
            </dd>
            <p className="mt-1 text-[11px] text-muted">
              Precio unitario: {money(line.unitPriceTarget, equivalentCurrency)}
            </p>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <section aria-labelledby={titleId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold text-ink" id={titleId}>
            {EQUIVALENCE_COPY.linesHeading}
          </h3>
          <p className="mt-1 text-[12px] leading-5 text-muted">
            Los importes originales se mantienen y los equivalentes usan la tasa
            aplicada.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
          {rows.length === 1 ? "1 línea" : `${formatInteger(rows.length)} líneas`}
        </span>
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState
            description={EQUIVALENCE_COPY.noLines}
            headingLevel={4}
            title={EQUIVALENCE_COPY.noLinesTitle}
          />
        ) : (
          <RecordsTable
            caption={`Líneas del ${data.scope === "order" ? "pedido" : "factura"} con producto, estado, cantidad, precio unitario y subtotal originales y equivalentes`}
            columns={columns}
            getRowKey={(line) => line.rowKey}
            getRowLabel={(line) => lineName(line)}
            renderCard={renderCard}
            rows={rows}
          />
        )}
      </div>
    </section>
  );
}

export function DocumentCashNotice({
  amount,
  currency,
}: {
  amount: number | null;
  currency: EquivalenceCurrency | null;
}) {
  const titleId = useId();

  if (amount === null || currency === null) return null;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-2xl border border-olive/35 bg-soft-lime p-4 sm:p-5"
    >
      <h3 className="text-[15px] font-semibold text-ink" id={titleId}>
        {EQUIVALENCE_COPY.cashAmountPrefix} {currency.code}
      </h3>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.03em] tabular-nums text-ink">
        {money(amount, currency)}
      </p>
      <p className="mt-2 text-[12px] leading-5 text-ink">
        {EQUIVALENCE_COPY.cashHelp}
      </p>
    </section>
  );
}

export function EquivalenceDetails(props: EquivalenceDetailsProps) {
  return (
    <div className="space-y-5">
      <EquivalenceSummary {...props} />
      <EquivalenceRateStamp {...props} />
      <EquivalenceCashNotice
        data={props.data}
        targetCurrency={props.targetCurrency}
      />
      <EquivalenceLines {...props} />
    </div>
  );
}

export function EquivalenceLoading() {
  return (
    <div aria-busy="true" className="space-y-5" role="status">
      <span className="sr-only">Calculando el equivalente…</span>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-background p-4 sm:p-5">
          <SkeletonCard />
        </div>
        <div className="rounded-2xl border border-line bg-background p-4 sm:p-5">
          <SkeletonCard />
        </div>
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <Skeleton className="h-3 w-32" />
        <SkeletonText className="mt-4" lines={2} />
      </div>
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <Skeleton className="h-3 w-48" />
        <div className="mt-4">
          <SkeletonTable columns={5} rows={3} />
        </div>
      </div>
    </div>
  );
}
