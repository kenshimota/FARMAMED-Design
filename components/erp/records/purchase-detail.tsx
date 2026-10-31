"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  PURCHASE_COPY,
} from "@/components/erp/records/purchase-errors";
import {
  PurchaseCancelDialog,
  PurchaseConfirmDialog,
  PurchaseDeleteDialog,
} from "@/components/erp/records/purchase-dialogs";
import {
  fetchPurchase,
  type PurchaseCurrency,
  type PurchaseItem,
} from "@/components/erp/records/purchases-api";
import {
  PurchaseStatusBadge,
  purchaseCurrencyLabel,
  purchaseMoney,
  purchaseNumberLabel,
  PurchaseTotalsSummary,
  resolvePurchaseCurrency,
} from "@/components/erp/records/purchase-shared";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  findById,
  isPositiveRecordId,
  fetchProducts,
} from "@/components/erp/records/records-api";
import { fetchItemStates } from "@/components/erp/records/item-states-api";
import { formatDateTime, formatInteger } from "@/lib/format";
import { canReadModule, canWriteModule } from "@/lib/permissions";

type PurchaseDialog = "confirm" | "cancel" | "delete" | null;

export function PurchaseDetailPage({ purchaseId }: { purchaseId: string }) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();
  if (!canReadModule(user.role, "compras")) {
    return activityVisible ? (
      <AccessState description="Tu rol no tiene acceso al módulo de compras. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }
  if (!isPositiveRecordId(purchaseId)) {
    return activityVisible ? (
      <RecordsLoadError
        backHref="/app/compras"
        backLabel="Volver a compras"
        description="Puede que el enlace no sea válido o que la compra ya no exista."
        headingLevel="h1"
        title="No encontramos esta compra"
      />
    ) : null;
  }
  return <PurchaseDetailContent purchaseId={purchaseId} />;
}

function PurchaseDetailContent({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const activityVisible = useActivityVisible();
  const canWrite = canWriteModule(user.role, "compras");
  const [dialog, setDialog] = useState<PurchaseDialog>(null);

  const loader = useCallback(() => fetchPurchase(purchaseId), [purchaseId]);
  const resource = useAsyncResource(loader);
  const productsResource = useAsyncResource(fetchProducts);
  const itemStatesResource = useAsyncResource(fetchItemStates);

  if (!activityVisible) return null;

  const products = productsResource.data ?? [];
  const itemStates = itemStatesResource.data ?? [];
  const currencyCatalog: PurchaseCurrency[] = (currencyStatus?.currencies ?? [])
    .filter((currency) => currency.id !== null)
    .map((currency) => ({
      id: currency.id as number,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    }));

  if (resource.status === "loading") {
    return (
      <div className="space-y-5">
        <RecordsPageHeader
          actions={
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/compras"
            >
              Volver a compras
            </Link>
          }
          description="Consulta la cabecera, las líneas y los totales de la compra."
          eyebrow="Inventario"
          title="Detalle de la compra"
        />
        <RecordsDetailSkeleton />
      </div>
    );
  }

  if (resource.status === "error" || !resource.data) {
    const notFound = resource.error?.kind === "not-found";
    return (
      <RecordsLoadError
        backHref="/app/compras"
        backLabel="Volver a compras"
        description={
          notFound
            ? PURCHASE_COPY.purchaseNotFound
            : resource.error?.message ?? "No pudimos cargar la compra."
        }
        headingLevel="h1"
        onRetry={notFound ? undefined : resource.reload}
        title={
          notFound ? "No encontramos esta compra" : "No pudimos cargar la compra"
        }
      />
    );
  }

  const purchase = resource.data;
  const items = purchase.items ?? [];
  const isDraft = purchase.status === "draft";
  const currency = resolvePurchaseCurrency(
    purchase.currency,
    currencyCatalog,
    purchase.currency_id,
  );

  function productNameFor(item: PurchaseItem) {
    return findById(products, item.product_id)?.name ?? `Producto #${item.product_id}`;
  }

  function productReferenceFor(item: PurchaseItem) {
    return findById(products, item.product_id)?.reference ?? null;
  }

  function itemStateLabelFor(item: PurchaseItem) {
    return (
      findById(itemStates, item.item_state_id)?.label ??
      `Estado #${item.item_state_id}`
    );
  }

  const columns: RecordsTableColumn<PurchaseItem>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (item) => {
        const reference = productReferenceFor(item);
        return (
          <div>
            <span className="font-semibold text-ink">{productNameFor(item)}</span>
            {reference && (
              <span className="mt-1 block font-mono text-[11px] text-muted">
                Ref. {reference}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "estado",
      header: "Estado del ítem",
      render: (item) => (
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {itemStateLabelFor(item)}
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
      key: "costo",
      header: "Costo unitario",
      className: "whitespace-nowrap tabular-nums",
      render: (item) => purchaseMoney(item.unit_cost, currency),
    },
    {
      key: "subtotal",
      header: "Subtotal",
      className: "whitespace-nowrap tabular-nums",
      render: (item) =>
        purchaseMoney(item.subtotal, currency),
    },
    {
      key: "impuesto",
      header: "Impuesto (monto)",
      className: "whitespace-nowrap tabular-nums",
      render: (item) => purchaseMoney(item.tax_amount, currency),
    },
    {
      key: "total",
      header: "Total",
      className: "whitespace-nowrap font-semibold tabular-nums",
      render: (item) => purchaseMoney(item.total, currency),
    },
  ];

  function renderItemCard(item: PurchaseItem) {
    return (
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">
              {productNameFor(item)}
            </p>
            {productReferenceFor(item) && (
              <p className="mt-1 font-mono text-[11px] text-muted">
                Ref. {productReferenceFor(item)}
              </p>
            )}
          </div>
          <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
            {itemStateLabelFor(item)}
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
              Costo unitario
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {purchaseMoney(item.unit_cost, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Subtotal
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {purchaseMoney(item.subtotal, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Impuesto (monto)
            </dt>
            <dd className="mt-1 tabular-nums text-ink">
              {purchaseMoney(item.tax_amount, currency)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Total
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {purchaseMoney(item.total, currency)}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/compras"
          >
            Volver a compras
          </Link>
        }
        description="Consulta la cabecera, las líneas y los totales de esta compra en Farmamed."
        eyebrow="Inventario"
        title={purchaseNumberLabel(purchase.number)}
      />

      <CurrencyNoticeBanner />

      <section
        aria-labelledby="datos-compra"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow">Cabecera</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="datos-compra"
            >
              Datos de la compra
            </h2>
          </div>
          <PurchaseStatusBadge status={purchase.status} />
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Proveedor
            </dt>
            <dd className="mt-1.5">
              <Link
                className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
                href={`/app/proveedores/${purchase.supplier_id}`}
              >
                {purchase.supplier?.name ?? `Proveedor #${purchase.supplier_id}`}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1.5 font-semibold text-ink">
              {purchaseCurrencyLabel(currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Estado
            </dt>
            <dd className="mt-1.5">
              <PurchaseStatusBadge status={purchase.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Fecha de confirmación
            </dt>
            <dd className="mt-1.5 tabular-nums text-ink">
              {purchase.confirmed_at ? formatDateTime(purchase.confirmed_at) : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Notas
            </dt>
            <dd className="mt-1.5 whitespace-pre-line text-[13px] leading-6 text-ink">
              {purchase.notes || "Sin notas registradas."}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="acciones-compra"
        className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
      >
        <span className="eyebrow">Acciones</span>
        <h2
          className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
          id="acciones-compra"
        >
          Acciones de la compra
        </h2>

        {!isDraft && (
          <NoticeBanner className="mt-4" role="status" tone="warning">
            {PURCHASE_COPY.notEditable}
          </NoticeBanner>
        )}

        {isDraft && !canWrite && (
          <NoticeBanner className="mt-4" role="status" tone="info">
            Tu rol puede consultar esta compra, pero no tiene permisos para
            confirmarla, cancelarla ni eliminarla.
          </NoticeBanner>
        )}

        {isDraft && canWrite && (
          <>
            <p className="mt-3 text-[13px] leading-6 text-muted">
              {items.length === 0
                ? PURCHASE_COPY.noLines
                : "Al confirmar la compra se actualizan costos y existencias de forma irreversible."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href={`/app/compras/${purchase.id}/editar`}
              >
                Editar
                <Icon name="arrow-right" size={17} />
              </Link>
              <button
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                onClick={() => setDialog("confirm")}
                type="button"
              >
                {PURCHASE_COPY.confirmPurchase}
                <Icon name="check" size={17} />
              </button>
              <button
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                onClick={() => setDialog("cancel")}
                type="button"
              >
                {PURCHASE_COPY.cancelPurchase}
              </button>
              <button
                className="button-base min-h-11 border border-alert/35 bg-surface px-5 text-[13px] text-alert-ink hover:border-alert hover:bg-alert/[0.06] hover:shadow-[0_10px_28px_rgba(193,39,45,0.14)]"
                onClick={() => setDialog("delete")}
                type="button"
              >
                {PURCHASE_COPY.deleteDraft}
                <Icon name="close" size={17} />
              </button>
            </div>
            {items.length === 0 && (
              <p className="mt-3 text-[12px] leading-5 text-muted">
                {PURCHASE_COPY.noLines}
              </p>
            )}
          </>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="lineas-compra" className="min-w-0">
          <div className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7">
            <span className="eyebrow">Detalle</span>
            <h2
              className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
              id="lineas-compra"
            >
              Líneas de la compra
            </h2>
            <div className="mt-5">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-line bg-background px-6 py-8 text-center">
                  <p className="text-[13px] font-semibold text-ink">
                    {PURCHASE_COPY.noLines}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-[12px] leading-6 text-muted">
                    {isDraft && canWrite
                      ? "Abre la edición del borrador para agregar productos."
                      : "Esta compra no tiene productos registrados."}
                  </p>
                </div>
              ) : (
                <div className="rounded-[20px] border border-line bg-surface p-4">
                  <RecordsTable
                    caption="Líneas de la compra con producto, estado de ítem, cantidad, costo unitario, subtotal, impuesto y total"
                    columns={columns}
                    getRowKey={(item) => String(item.id)}
                    getRowLabel={(item) =>
                      `${productNameFor(item)} en estado ${itemStateLabelFor(item)}`
                    }
                    renderCard={renderItemCard}
                    rows={items}
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <PurchaseTotalsSummary
            currency={currency}
            empty={items.length === 0}
            notice={PURCHASE_COPY.noLines}
            totals={{
              subtotal: purchase.subtotal,
              tax_amount: purchase.tax_amount,
              total: purchase.total,
            }}
          />
        </aside>
      </div>

      <PurchaseConfirmDialog
        onClose={() => setDialog(null)}
        onDone={resource.reload}
        onRefresh={resource.reload}
        purchase={dialog === "confirm" ? purchase : null}
      />
      <PurchaseCancelDialog
        onClose={() => setDialog(null)}
        onDone={resource.reload}
        onRefresh={resource.reload}
        purchase={dialog === "cancel" ? purchase : null}
      />
      <PurchaseDeleteDialog
        onClose={() => setDialog(null)}
        onDone={() => router.push("/app/compras")}
        onRefresh={resource.reload}
        purchase={dialog === "delete" ? purchase : null}
      />
    </div>
  );
}
