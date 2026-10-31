"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  FormErrorSummary,
  focusFirstInvalidField,
} from "@/components/erp/ui/form";
import {
  PURCHASE_COPY,
  PURCHASE_LINE_FIELD_IDS,
  purchaseErrorMessage,
  PURCHASE_LINE_LABELS,
  formatAmountInput,
  lineSummaryItems,
  mapLineFieldErrors,
  parseQuantity,
  parseTaxAmount,
  parseUnitCost,
  type PurchaseLineFieldKey,
} from "@/components/erp/records/purchase-errors";
import {
  SelectField,
  TextField,
} from "@/components/erp/records/form-controls";
import {
  findById,
  type ProductRecord,
  type RecordId,
} from "@/components/erp/records/records-api";
import type { ItemStateRecord } from "@/components/erp/records/item-states-api";
import {
  lineSubtotal,
  lineTotal,
  purchaseMoney,
  type PurchaseMoney,
} from "@/components/erp/records/purchase-shared";

export type PurchaseLineValues = {
  product_id: string;
  item_state_id: string;
  quantity: string;
  unit_cost: string;
  tax_amount: string;
};

export type PurchaseLineRow = {
  key: string;
  id: RecordId | null;
  product_id: RecordId;
  item_state_id: RecordId;
  quantity: number;
  unit_cost: number;
  tax_amount: number;
};

export const EMPTY_LINE_VALUES: PurchaseLineValues = {
  product_id: "",
  item_state_id: "",
  quantity: "",
  unit_cost: "",
  tax_amount: "",
};

export function lineValuesFromRow(row: PurchaseLineRow): PurchaseLineValues {
  return {
    product_id: String(row.product_id),
    item_state_id: String(row.item_state_id),
    quantity: String(row.quantity),
    unit_cost: formatAmountInput(row.unit_cost),
    tax_amount: formatAmountInput(row.tax_amount),
  };
}

export function validateLineValues(
  values: PurchaseLineValues,
  { requireTax }: { requireTax: boolean },
) {
  const errors: Partial<Record<PurchaseLineFieldKey, string>> = {};
  if (!values.product_id) errors.product_id = PURCHASE_COPY.productRequired;
  if (!values.item_state_id) errors.item_state_id = PURCHASE_COPY.itemStateRequired;

  if (!values.quantity.trim()) {
    errors.quantity = PURCHASE_COPY.quantityRequired;
  } else if (parseQuantity(values.quantity) === null) {
    errors.quantity = PURCHASE_COPY.quantityFormat;
  }

  if (!values.unit_cost.trim()) {
    errors.unit_cost = PURCHASE_COPY.unitCostRequired;
  } else if (parseUnitCost(values.unit_cost) === null) {
    errors.unit_cost = PURCHASE_COPY.unitCostFormat;
  }

  const tax = values.tax_amount.trim();
  if (!tax) {
    if (requireTax) errors.tax_amount = PURCHASE_COPY.taxRequired;
  } else if (parseTaxAmount(tax) === null) {
    errors.tax_amount = PURCHASE_COPY.taxInvalid;
  }

  return errors as Record<string, string>;
}

type PurchaseLinesEditorProps = {
  rows: PurchaseLineRow[];
  currency: PurchaseMoney | null;
  products: ProductRecord[];
  productsLoading: boolean;
  productsError: string | null;
  onRetryProducts: () => void;
  itemStates: ItemStateRecord[];
  itemStatesLoading: boolean;
  itemStatesError: string | null;
  onRetryItemStates: () => void;
  onAdd: (values: PurchaseLineValues) => void | Promise<void>;
  onUpdate: (key: string, values: PurchaseLineValues) => void | Promise<void>;
  onDelete: (row: PurchaseLineRow) => void | Promise<void>;
};

export function PurchaseLinesEditor({
  rows,
  currency,
  products,
  productsLoading,
  productsError,
  onRetryProducts,
  itemStates,
  itemStatesLoading,
  itemStatesError,
  onRetryItemStates,
  onAdd,
  onUpdate,
  onDelete,
}: PurchaseLinesEditorProps) {
  const [addValues, setAddValues] = useState<PurchaseLineValues>(EMPTY_LINE_VALUES);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValues, setEditValues] =
    useState<PurchaseLineValues>(EMPTY_LINE_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editingRow = editingKey
    ? (rows.find((row) => row.key === editingKey) ?? null)
    : null;
  const values = editingRow ? editValues : addValues;

  function updateField(field: PurchaseLineFieldKey, value: string) {
    if (editingRow) {
      setEditValues((current) => ({ ...current, [field]: value }));
    } else {
      setAddValues((current) => ({ ...current, [field]: value }));
    }
    setNotice(null);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function startEdit(row: PurchaseLineRow) {
    setEditingKey(row.key);
    setEditValues(lineValuesFromRow(row));
    setErrors({});
    setShowSummary(false);
    setNotice(null);
    window.requestAnimationFrame(() => {
      document.getElementById(PURCHASE_LINE_FIELD_IDS.product_id)?.focus();
    });
  }

  function cancelEdit() {
    setEditingKey(null);
    setEditValues(EMPTY_LINE_VALUES);
    setErrors({});
    setShowSummary(false);
    setNotice(null);
  }

  async function runOp(action: () => void | Promise<void>) {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (caught) {
      setBusy(false);
      const mapped = mapLineFieldErrors(caught);
      if (Object.keys(mapped).length > 0) {
        setErrors(mapped);
        setShowSummary(true);
        window.requestAnimationFrame(() => focusFirstInvalidField());
      } else {
        setNotice(purchaseErrorMessage(caught));
      }
      return;
    }
    setBusy(false);
    setErrors({});
    setShowSummary(false);
    setNotice(null);
    setAddValues(EMPTY_LINE_VALUES);
    setEditingKey(null);
    setEditValues(EMPTY_LINE_VALUES);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const nextErrors = validateLineValues(values, { requireTax: !editingRow });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      setNotice(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    const key = editingKey;
    void runOp(() => (key ? onUpdate(key, values) : onAdd(values)));
  }

  const productOptions = products.map((product) => ({
    value: String(product.id),
    label: `${product.name} (${product.reference})`,
  }));
  const itemStateOptions = itemStates.map((itemState) => ({
    value: String(itemState.id),
    label: itemState.label,
  }));

  function productNameFor(row: PurchaseLineRow) {
    return findById(products, row.product_id)?.name ?? `Producto #${row.product_id}`;
  }

  function itemStateLabelFor(row: PurchaseLineRow) {
    return (
      findById(itemStates, row.item_state_id)?.label ?? `Estado #${row.item_state_id}`
    );
  }

  const summaryItems = lineSummaryItems(errors);

  const fields: ReactNode = (
    <>
      <SelectField
        emptyLabel="No hay productos registrados."
        error={errors.product_id}
        id={PURCHASE_LINE_FIELD_IDS.product_id}
        label={PURCHASE_LINE_LABELS.product_id}
        loading={productsLoading}
        loadingLabel="Cargando productos…"
        loadError={productsError}
        onChange={(value) => updateField("product_id", value)}
        onRetry={onRetryProducts}
        options={productOptions}
        placeholder="Selecciona un producto"
        required
        value={values.product_id}
      />
      <SelectField
        emptyLabel="No hay estados de ítem registrados."
        error={errors.item_state_id}
        id={PURCHASE_LINE_FIELD_IDS.item_state_id}
        label={PURCHASE_LINE_LABELS.item_state_id}
        loading={itemStatesLoading}
        loadingLabel="Cargando estados…"
        loadError={itemStatesError}
        onChange={(value) => updateField("item_state_id", value)}
        onRetry={onRetryItemStates}
        options={itemStateOptions}
        placeholder="Selecciona un estado"
        required
        value={values.item_state_id}
      />
      <TextField
        disabled={busy}
        error={errors.quantity}
        help="Unidades enteras, mayor que 0."
        id={PURCHASE_LINE_FIELD_IDS.quantity}
        inputMode="numeric"
        label={PURCHASE_LINE_LABELS.quantity}
        maxLength={9}
        onChange={(value) => updateField("quantity", value)}
        placeholder="0"
        required
        value={values.quantity}
      />
      <TextField
        disabled={busy}
        error={errors.unit_cost}
        help="Monto antes de impuesto, con máximo 2 decimales."
        id={PURCHASE_LINE_FIELD_IDS.unit_cost}
        inputMode="decimal"
        label={PURCHASE_LINE_LABELS.unit_cost}
        maxLength={12}
        onChange={(value) => updateField("unit_cost", value)}
        placeholder="0,00"
        required
        value={values.unit_cost}
      />
      <TextField
        disabled={busy}
        error={errors.tax_amount}
        help={
          editingRow
            ? "Monto absoluto. Si lo dejas vacío se conserva el valor actual."
            : "Monto absoluto en la moneda de la compra, con máximo 2 decimales."
        }
        id={PURCHASE_LINE_FIELD_IDS.tax_amount}
        inputMode="decimal"
        label={PURCHASE_LINE_LABELS.tax_amount}
        maxLength={13}
        onChange={(value) => updateField("tax_amount", value)}
        placeholder="0,00"
        required={!editingRow}
        value={values.tax_amount}
      />
    </>
  );

  const formActions = (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <BusyButton busy={busy} busyLabel="Guardando…" type="submit">
        {editingRow ? "Guardar la línea" : PURCHASE_COPY.addLine}
        <Icon name="arrow-right" size={17} />
      </BusyButton>
      {editingRow && (
        <button
          className="button-base button-secondary min-h-11 px-5"
          disabled={busy}
          onClick={cancelEdit}
          type="button"
        >
          Cancelar
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-brand/15 bg-soft-blue p-5 md:hidden">
        <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Icon aria-hidden="true" className="text-brand" name="clipboard" size={18} />
          {PURCHASE_COPY.desktopOnly}
        </p>
        <p className="mt-2 text-[13px] leading-6 text-muted">
          {PURCHASE_COPY.desktopOnlyHelp}
        </p>
        {rows.length === 0 && (
          <p className="mt-2 text-[13px] font-semibold text-ink">
            {PURCHASE_COPY.noLines}
          </p>
        )}
      </div>

      <div className="hidden md:block">
        {notice && (
          <NoticeBanner className="mb-4" role="alert" tone="danger">
            {notice}
          </NoticeBanner>
        )}

        {showSummary && summaryItems.length > 0 && (
          <div className="mb-4">
            <FormErrorSummary errors={summaryItems} />
          </div>
        )}

        {!editingRow && (
          <form
            aria-label="Agregar una línea a la compra"
            className="rounded-[20px] border border-line bg-background p-4"
            noValidate
            onSubmit={handleSubmit}
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{fields}</div>
            {formActions}
          </form>
        )}

        <div className="mt-4 overflow-x-auto rounded-[20px] border border-line bg-surface">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">
              Líneas de la compra con producto, estado de ítem, cantidad, costo
              unitario, subtotal, impuesto y total
            </caption>
            <thead>
              <tr className="border-b border-line">
                {[
                  PURCHASE_LINE_LABELS.product_id,
                  PURCHASE_LINE_LABELS.item_state_id,
                  PURCHASE_LINE_LABELS.quantity,
                  PURCHASE_LINE_LABELS.unit_cost,
                  "Subtotal",
                  PURCHASE_LINE_LABELS.tax_amount,
                  "Total",
                ].map((header) => (
                  <th
                    className="px-4 pb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                    key={header}
                    scope="col"
                  >
                    {header}
                  </th>
                ))}
                <th
                  className="px-4 pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                  scope="col"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-[13px] leading-6 text-muted" colSpan={8}>
                    {PURCHASE_COPY.noLines}
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                if (editingKey === row.key) {
                  return (
                    <tr className="border-b border-line bg-background align-middle" key={row.key}>
                      <td className="px-4 py-4" colSpan={8}>
                        <form
                          aria-label="Editar la línea de la compra"
                          noValidate
                          onSubmit={handleSubmit}
                        >
                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {fields}
                          </div>
                          {formActions}
                        </form>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr
                    className="border-b border-line align-middle last:border-b-0"
                    key={row.key}
                  >
                    <td className="px-4 py-3.5 text-[13px] text-ink">
                      <span className="font-semibold">{productNameFor(row)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-[13px] text-ink">
                      <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
                        {itemStateLabelFor(row)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-ink">
                      {row.quantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-ink">
                      {purchaseMoney(row.unit_cost, currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-ink">
                      {purchaseMoney(lineSubtotal(row.quantity, row.unit_cost), currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] tabular-nums text-ink">
                      {purchaseMoney(row.tax_amount, currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[13px] font-semibold tabular-nums text-ink">
                      {purchaseMoney(lineTotal(row), currency)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div
                        aria-label={`Acciones para la línea de ${productNameFor(row)}`}
                        className="flex flex-wrap items-center justify-end gap-2"
                        role="group"
                      >
                        <button
                          aria-label={`Editar la línea de ${productNameFor(row)}`}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={busy}
                          onClick={() => startEdit(row)}
                          type="button"
                        >
                          <Icon name="arrow-right" size={15} />
                          Editar
                        </button>
                        <button
                          aria-label={`Eliminar la línea de ${productNameFor(row)}`}
                          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-alert/30 bg-surface px-3.5 text-[12px] font-semibold text-alert-ink transition-colors hover:border-alert hover:bg-alert/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={busy}
                          onClick={() => void runOp(() => onDelete(row))}
                          type="button"
                        >
                          <Icon name="close" size={15} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[12px] leading-5 text-muted">
          Las líneas heredan la moneda de la compra
          {currency?.code ? ` (${currency.code})` : ""}. El impuesto se registra
          como monto absoluto, nunca como porcentaje.
        </p>
      </div>
    </div>
  );
}
