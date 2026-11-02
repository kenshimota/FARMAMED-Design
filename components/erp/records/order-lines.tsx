"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { BusyButton } from "@/components/erp/ui/action-button";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { FormDialog } from "@/components/erp/ui/form-dialog";
import { focusFirstInvalidField } from "@/components/erp/ui/form";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  ORDER_COPY,
  mapOrderItemFieldErrors,
  orderErrorMessage,
} from "@/components/erp/records/orders-errors";
import {
  addOrderItem,
  deleteOrderItem,
  fetchStoreProducts,
  updateOrderItemQuantity,
  type OrderItem,
  type OrderRecord,
  type OrderStatusRecord,
} from "@/components/erp/records/orders-api";
import {
  orderItemStateLabel,
  orderMoney,
  orderProductLabel,
  type OrderDisplayCurrency,
} from "@/components/erp/records/orders-shared";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import {
  RecordActionButton,
  RecordActions,
} from "@/components/erp/records/record-actions";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import { toApiId } from "@/components/erp/records/records-api";
import { isTerminalOrderStatus } from "@/components/erp/records/orders-shared";
import { formatInteger } from "@/lib/format";

const QUANTITY_PATTERN = /^\d{1,3}$/;

function parseQuantity(value: string) {
  const trimmed = value.trim();
  if (!QUANTITY_PATTERN.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 999 ? parsed : null;
}

function variantKey(productId: string | number, itemStateId: string | number) {
  return `${String(productId)}:${String(itemStateId)}`;
}

export function OrderLinesSection({
  order,
  statuses,
  currency,
  canWrite,
  onReload,
}: {
  order: OrderRecord;
  statuses: readonly OrderStatusRecord[];
  currency: OrderDisplayCurrency | null;
  canWrite: boolean;
  onReload: () => void;
}) {
  const toast = useToast();
  const items = order.items ?? [];
  const isDraft = order.status === "draft";
  const editable = isDraft && canWrite && !isTerminalOrderStatus(order.status, statuses);

  const [addOpen, setAddOpen] = useState(false);
  const [productKey, setProductKey] = useState("");
  const [addQuantity, setAddQuantity] = useState("1");
  const [addErrors, setAddErrors] = useState<{ productId?: string; quantity?: string }>({});
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editFieldError, setEditFieldError] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);

  const [deletingItem, setDeletingItem] = useState<OrderItem | null>(null);

  const storeResource = useAsyncResource(
    () =>
      order.customerId === null
        ? Promise.resolve([])
        : fetchStoreProducts(order.customerId),
    { enabled: editable && order.customerId !== null },
  );

  const existingKeys = new Set(
    items.map((item) => variantKey(item.productId, item.itemStateId)),
  );
  const storeProducts = (storeResource.data ?? []).filter(
    (product) => !existingKeys.has(variantKey(product.id, product.itemState.id)),
  );
  const productOptions = storeProducts.map((product) => ({
    value: variantKey(product.id, product.itemState.id),
    label: `${product.name}${product.reference ? ` (${product.reference})` : ""} · ${product.itemState.label} · ${orderMoney(product.price, product.currency ?? currency)}`,
  }));

  function openAdd() {
    setProductKey("");
    setAddQuantity("1");
    setAddErrors({});
    setAddMessage(null);
    setAddOpen(true);
  }

  function closeAdd() {
    if (addBusy) return;
    setAddOpen(false);
    setAddMessage(null);
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addBusy) return;
    if (items.length >= 50) {
      setAddMessage("Un pedido admite hasta 50 líneas.");
      return;
    }

    const selected = storeProducts.find(
      (product) => variantKey(product.id, product.itemState.id) === productKey,
    );
    const quantity = parseQuantity(addQuantity);
    const nextErrors: typeof addErrors = {};
    if (!selected) nextErrors.productId = "Selecciona un producto y estado.";
    if (quantity === null) {
      nextErrors.quantity = "La cantidad debe ser un entero entre 1 y 999.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setAddErrors(nextErrors);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }
    if (!selected || quantity === null) return;

    setAddBusy(true);
    setAddMessage(null);
    try {
      await addOrderItem(order.id, {
        product_id: toApiId(String(selected.id)),
        item_state_id: toApiId(String(selected.itemState.id)),
        quantity,
      });
      toast.success(ORDER_COPY.itemAdded);
      setAddOpen(false);
      onReload();
    } catch (caught) {
      const mapped = mapOrderItemFieldErrors(caught);
      if (mapped.productId || mapped.quantity) {
        setAddErrors({
          productId: mapped.productId,
          quantity: mapped.quantity,
        });
      }
      setAddMessage(mapped.general ?? orderErrorMessage(caught));
    } finally {
      setAddBusy(false);
    }
  }

  function openEdit(item: OrderItem) {
    setEditingItem(item);
    setEditQuantity(String(item.quantity));
    setEditFieldError(null);
    setEditMessage(null);
  }

  function closeEdit() {
    if (editBusy) return;
    setEditingItem(null);
    setEditFieldError(null);
    setEditMessage(null);
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingItem || editBusy) return;
    const quantity = parseQuantity(editQuantity);
    if (quantity === null) {
      setEditFieldError("La cantidad debe ser un entero entre 1 y 999.");
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setEditBusy(true);
    setEditFieldError(null);
    setEditMessage(null);
    try {
      await updateOrderItemQuantity(order.id, editingItem.id, quantity);
      toast.success(ORDER_COPY.itemUpdated);
      setEditingItem(null);
      onReload();
    } catch (caught) {
      setEditMessage(orderErrorMessage(caught));
    } finally {
      setEditBusy(false);
    }
  }

  const columns: RecordsTableColumn<OrderItem>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (item) => (
        <div>
          <span className="font-semibold text-ink">
            {orderProductLabel(item.product, item.productId)}
          </span>
          {item.product?.reference && (
            <span className="mt-1 block font-mono text-[11px] text-muted">
              Ref. {item.product.reference}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "estado",
      header: "Estado del ítem",
      render: (item) => (
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {orderItemStateLabel(item.itemState, item.itemStateId)}
        </span>
      ),
    },
    {
      key: "cantidad",
      header: "Cantidad",
      className: "whitespace-nowrap tabular-nums",
      render: (item) => formatInteger(item.quantity),
    },
    {
      key: "precio",
      header: "Precio unitario",
      className: "whitespace-nowrap tabular-nums",
      render: (item) => orderMoney(item.unitPrice, currency),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      className: "whitespace-nowrap font-semibold tabular-nums",
      render: (item) => orderMoney(item.subtotal, currency),
    },
  ];

  function renderActions(item: OrderItem) {
    return (
      <RecordActions>
        <RecordActionButton
          aria-label={`Cambiar la cantidad de ${orderProductLabel(item.product, item.productId)}`}
          icon="arrow-right"
          onClick={() => openEdit(item)}
        >
          Cantidad
        </RecordActionButton>
        <RecordActionButton
          aria-label={`Quitar ${orderProductLabel(item.product, item.productId)} del pedido`}
          danger
          icon="close"
          onClick={() => setDeletingItem(item)}
        >
          Quitar
        </RecordActionButton>
      </RecordActions>
    );
  }

  function renderCard(item: OrderItem) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">
              {orderProductLabel(item.product, item.productId)}
            </p>
            {item.product?.reference && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                Ref. {item.product.reference}
              </p>
            )}
          </div>
          <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
            {orderItemStateLabel(item.itemState, item.itemStateId)}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Cantidad
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {formatInteger(item.quantity)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Precio unitario
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {orderMoney(item.unitPrice, currency)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Subtotal
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {orderMoney(item.subtotal, currency)}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="lineas-pedido"
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Detalle</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="lineas-pedido"
          >
            Líneas del pedido
          </h2>
        </div>
        {editable && (
          <button
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            onClick={openAdd}
            type="button"
          >
            {ORDER_COPY.addLine}
            <Icon name="arrow-right" size={17} />
          </button>
        )}
      </div>

      <p className="mt-3 text-[13px] leading-6 text-muted">
        Las líneas muestran producto, estado de ítem, cantidad, precio y subtotal.
        No se exponen lotes, costos ni ubicaciones internas.
      </p>

      <div className="mt-5">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-line bg-background px-6 py-8 text-center">
            <p className="text-[13px] font-semibold text-ink">
              Este pedido no tiene líneas.
            </p>
            <p className="mx-auto mt-2 max-w-md text-[12px] leading-6 text-muted">
              {editable
                ? "Agrega la primera línea con el catálogo del cliente."
                : "El pedido no tiene productos registrados."}
            </p>
          </div>
        ) : (
          <div className="rounded-[20px] border border-line bg-surface p-4">
            <RecordsTable
              caption="Líneas del pedido con producto, estado de ítem, cantidad, precio unitario y subtotal"
              columns={columns}
              getRowKey={(item) => String(item.id)}
              getRowLabel={(item) =>
                `${orderProductLabel(item.product, item.productId)} en estado ${orderItemStateLabel(item.itemState, item.itemStateId)}`
              }
              renderCard={renderCard}
              rowActions={editable ? renderActions : undefined}
              rows={items}
            />
          </div>
        )}
      </div>

      <FormDialog
        description="Selecciona una variante con precio y existencia para este cliente."
        mobileFullscreen
        onClose={closeAdd}
        open={addOpen}
        title={ORDER_COPY.addLine}
      >
        <form className="mt-6 space-y-5" noValidate onSubmit={handleAdd}>
          {addMessage && (
            <NoticeBanner role="alert" tone="danger">
              {addMessage}
            </NoticeBanner>
          )}
          <SelectField
            emptyLabel="Todas las variantes disponibles ya están en el pedido."
            error={addErrors.productId}
            id="pedido-linea-variante"
            label="Producto y estado"
            loading={storeResource.status === "loading"}
            loadingLabel="Cargando catálogo del cliente…"
            loadError={
              storeResource.status === "error"
                ? storeResource.error?.kind === "forbidden"
                  ? "No pudimos consultar el catálogo del cliente. Verifica que tenga una lista de precios asignada y que esté asignado a tu usuario."
                  : storeResource.error?.message ??
                    "No pudimos cargar el catálogo del cliente."
                : null
            }
            onChange={(value) => {
              setProductKey(value);
              setAddErrors((current) => ({ ...current, productId: undefined }));
            }}
            onRetry={storeResource.reload}
            options={productOptions}
            placeholder="Selecciona un producto"
            required
            value={productKey}
          />
          <TextField
            error={addErrors.quantity}
            help="Entero entre 1 y 999."
            id="pedido-linea-cantidad"
            inputMode="numeric"
            label="Cantidad"
            maxLength={3}
            onChange={(value) => {
              setAddQuantity(value.replace(/\D/g, "").slice(0, 3));
              setAddErrors((current) => ({ ...current, quantity: undefined }));
            }}
            required
            value={addQuantity}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="button-base button-secondary min-h-11 px-5"
              disabled={addBusy}
              onClick={closeAdd}
              type="button"
            >
              Cancelar
            </button>
            <BusyButton
              busy={addBusy}
              busyLabel="Agregando…"
              type="submit"
            >
              {ORDER_COPY.addLine}
              <Icon name="arrow-right" size={17} />
            </BusyButton>
          </div>
        </form>
      </FormDialog>

      <FormDialog
        description="El producto y su estado no cambian; solo la cantidad."
        onClose={closeEdit}
        open={editingItem !== null}
        title="Cambiar cantidad"
      >
        <form className="mt-6 space-y-5" noValidate onSubmit={handleEdit}>
          {editMessage && (
            <NoticeBanner role="alert" tone="danger">
              {editMessage}
            </NoticeBanner>
          )}
          {editingItem && (
            <div>
              <p className="text-[12px] font-semibold text-ink">
                Línea seleccionada
              </p>
              <p className="mt-2 rounded-xl border border-line bg-background px-4 py-3 text-[13px] text-ink">
                {orderProductLabel(editingItem.product, editingItem.productId)} ·{" "}
                {orderItemStateLabel(editingItem.itemState, editingItem.itemStateId)}
              </p>
            </div>
          )}
          <TextField
            error={editFieldError ?? undefined}
            help="Entero entre 1 y 999."
            id="pedido-cantidad"
            inputMode="numeric"
            label="Cantidad"
            maxLength={3}
            onChange={(value) => {
              setEditQuantity(value.replace(/\D/g, "").slice(0, 3));
              setEditFieldError(null);
            }}
            required
            value={editQuantity}
          />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              className="button-base button-secondary min-h-11 px-5"
              disabled={editBusy}
              onClick={closeEdit}
              type="button"
            >
              Cancelar
            </button>
            <BusyButton busy={editBusy} busyLabel="Guardando…" type="submit">
              Guardar cantidad
            </BusyButton>
          </div>
        </form>
      </FormDialog>

      <ConfirmDialog
        confirmBusyLabel="Quitando…"
        confirmLabel="Quitar línea"
        description={
          deletingItem ? (
            <p>
              Se quitará{" "}
              <span className="font-semibold text-ink">
                {orderProductLabel(deletingItem.product, deletingItem.productId)}
              </span>{" "}
              del pedido. Los totales se recalcularán.
            </p>
          ) : undefined
        }
        onClose={() => setDeletingItem(null)}
        onConfirm={async () => {
          if (!deletingItem) return;
          await deleteOrderItem(order.id, deletingItem.id);
          toast.success(ORDER_COPY.itemRemoved);
          onReload();
        }}
        onError={(error) => toast.error(error.message)}
        open={deletingItem !== null}
        title="Quitar línea del pedido"
      />
    </section>
  );
}
