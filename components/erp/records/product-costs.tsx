"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { CurrencyNoticeBanner } from "@/components/erp/ui/currency-notice-banner";
import { useCurrencyStatusContext } from "@/components/erp/ui/currency-status-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { CostDeleteDialog } from "@/components/erp/records/cost-delete-dialog";
import {
  fetchCostsByProduct,
  type CostCurrency,
  type CostRecord,
} from "@/components/erp/records/costs-api";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordActionButton,
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import {
  RecordsLoadError,
  RecordsTableSkeleton,
} from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import {
  fetchProducts,
  findById,
  isPositiveRecordId,
  type ProductRecord,
} from "@/components/erp/records/records-api";
import { canReadModule, canWriteModule } from "@/lib/permissions";
import { formatInteger, formatMoney } from "@/lib/format";

const NO_COSTS: CostRecord[] = [];
const NO_PRODUCTS: ProductRecord[] = [];

function productNameFor(product: ProductRecord | null, productId: string) {
  return product?.name ?? `Producto #${productId}`;
}

function costCountLabel(count: number) {
  return count === 1 ? "1 costo" : `${formatInteger(count)} costos`;
}

export function ProductCostsPage({ productId }: { productId: string }) {
  const { user } = useSession();
  if (!canReadModule(user.role, "costos")) return <AccessState />;
  if (!isPositiveRecordId(productId)) {
    return (
      <RecordsLoadError
        backHref="/app/costos"
        backLabel="Volver a costos"
        description="Puede que el enlace no sea válido o que el producto no exista."
        headingLevel="h1"
        title="No encontramos este producto"
      />
    );
  }
  return <ProductCostsContent productId={productId} />;
}

function ProductCostsContent({ productId }: { productId: string }) {
  const { user } = useSession();
  const currencyStatus = useCurrencyStatusContext();
  const canWrite = canWriteModule(user.role, "costos");

  const productsResource = useAsyncResource(fetchProducts);
  const costsLoader = useCallback(
    () => fetchCostsByProduct(productId),
    [productId],
  );
  const costsResource = useAsyncResource(costsLoader);

  const [deleteTarget, setDeleteTarget] = useState<CostRecord | null>(null);

  const products = productsResource.data ?? NO_PRODUCTS;
  const currencies = currencyStatus?.currencies ?? [];
  const costs = costsResource.data ?? NO_COSTS;
  const product = findById(products, productId);
  const productName = productNameFor(product, productId);
  const productMissing = productsResource.data !== null && !product;

  function currencyFor(cost: CostRecord): CostCurrency | null {
    if (cost.currency) return cost.currency;
    if (cost.currency_id === null) return null;
    const currency = currencies.find(
      (item) => item.id !== null && String(item.id) === String(cost.currency_id),
    );
    if (!currency || currency.id === null) return null;
    return {
      id: currency.id,
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    };
  }

  function itemStateLabelFor(cost: CostRecord) {
    return cost.item_state?.label ?? `Estado #${cost.item_state_id}`;
  }

  const columns: RecordsTableColumn<CostRecord>[] = [
    {
      key: "estado",
      header: "Estado del ítem",
      render: (cost) => (
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {itemStateLabelFor(cost)}
        </span>
      ),
    },
    {
      key: "costo",
      header: "Costo",
      className: "whitespace-nowrap",
      render: (cost) => {
        const currency = currencyFor(cost);
        return (
          <span className="font-semibold tabular-nums text-ink">
            {cost.cost === null
              ? "—"
              : formatMoney(cost.cost, {
                  code: currency?.code,
                  symbol: currency?.symbol,
                })}
          </span>
        );
      },
    },
    {
      key: "moneda",
      header: "Moneda",
      className: "whitespace-nowrap",
      render: (cost) => {
        const currency = currencyFor(cost);
        if (!currency) {
          return <span className="text-muted">Sin moneda</span>;
        }
        return (
          <div>
            <span className="font-semibold text-ink">{currency.code}</span>
            <span className="mt-0.5 block text-[11px] text-muted">
              {currency.symbol}
            </span>
          </div>
        );
      },
    },
  ];

  function renderActions(cost: CostRecord) {
    return (
      <RecordActions>
        <RecordActionLink
          ariaLabel={`Editar el costo en estado ${itemStateLabelFor(cost)}`}
          href={`/app/costos/${cost.id}/editar`}
          icon="arrow-right"
        >
          Editar
        </RecordActionLink>
        <RecordActionButton
          aria-label={`Eliminar el costo en estado ${itemStateLabelFor(cost)}`}
          danger
          icon="close"
          onClick={() => setDeleteTarget(cost)}
        >
          Eliminar
        </RecordActionButton>
      </RecordActions>
    );
  }

  function renderCard(cost: CostRecord) {
    const currency = currencyFor(cost);
    return (
      <div>
        <span className="inline-flex rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
          {itemStateLabelFor(cost)}
        </span>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Costo
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {cost.cost === null
                ? "—"
                : formatMoney(cost.cost, {
                    code: currency?.code,
                    symbol: currency?.symbol,
                  })}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Moneda
            </dt>
            <dd className="mt-1 font-semibold text-ink">
              {currency?.code ?? "Sin moneda"}
              {currency && (
                <span className="ml-1 text-[11px] font-normal text-muted">
                  {currency.symbol}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  const headerDescription = product
    ? `Costo vigente de ${product.name} (${product.reference}) por estado de ítem. Las existencias se consultan aparte.`
    : "Costo vigente del producto por estado de ítem. Las existencias se consultan aparte.";

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <>
            <Link
              className="button-base button-secondary min-h-11 px-5 text-[13px]"
              href="/app/costos"
            >
              Volver a costos
            </Link>
            {canWrite && !productMissing && (
              <Link
                className="button-base button-primary min-h-11 px-5 text-[13px]"
                href={`/app/costos/nuevo?product_id=${productId}`}
              >
                Nuevo costo
                <Icon name="arrow-right" size={17} />
              </Link>
            )}
          </>
        }
        description={headerDescription}
        eyebrow="Inventario"
        title="Costos del producto"
      />

      <CurrencyNoticeBanner />

      <NoticeBanner
        action={
          <Link
            className="font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
            href="/app/existencias"
          >
            Ir a existencias
          </Link>
        }
        tone="info"
      >
        Las existencias y los costos son fuentes independientes. El módulo de
        existencias sigue en preparación y por ahora abre su vista principal;
        esta pantalla no duplica sus datos.
      </NoticeBanner>

      {costsResource.status === "loading" && (
        <RecordsTableSkeleton columns={4} label="Cargando costos del producto…" rows={5} />
      )}

      {costsResource.status === "error" && costs.length === 0 && (
        <RecordsLoadError
          backHref="/app/costos"
          backLabel="Volver a costos"
          description={
            costsResource.error?.message ??
            "No pudimos cargar los costos del producto."
          }
          onRetry={costsResource.reload}
          title="No pudimos cargar los costos del producto"
        />
      )}

      {costsResource.status !== "loading" &&
        !(costsResource.status === "error" && costs.length === 0) && (
          <section aria-label="Costos del producto" className="space-y-4">
            {costsResource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {costsResource.status === "error" && costs.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={costsResource.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {costsResource.error?.message ??
                  "No pudimos actualizar los costos. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <p className="text-[14px] font-semibold text-ink">{productName}</p>
                  {product?.reference && (
                    <p className="mt-1 font-mono text-[11px] text-muted">
                      Ref. {product.reference}
                    </p>
                  )}
                </div>
                <p aria-live="polite" className="text-[12px] font-semibold text-muted">
                  {costCountLabel(costs.length)}
                </p>
              </div>

              {costs.length === 0 ? (
                <EmptyState
                  action={
                    productMissing ? (
                      <Link
                        className="button-base button-secondary min-h-11 px-5"
                        href="/app/costos"
                      >
                        Volver a costos
                      </Link>
                    ) : canWrite ? (
                      <Link
                        className="button-base button-primary min-h-11 px-5"
                        href={`/app/costos/nuevo?product_id=${productId}`}
                      >
                        Nuevo costo
                        <Icon name="arrow-right" size={17} />
                      </Link>
                    ) : undefined
                  }
                  description={
                    productMissing
                      ? "Puede que haya sido eliminado o que el enlace no sea válido."
                      : "Se crean manualmente o al confirmar una compra."
                  }
                  title={
                    productMissing
                      ? "No encontramos este producto."
                      : "Este producto todavía no tiene costos registrados."
                  }
                />
              ) : (
                <RecordsTable
                  caption={`Costos vigentes de ${productName} por estado de ítem, con su moneda y acciones`}
                  columns={columns}
                  getRowKey={(cost) => String(cost.id)}
                  getRowLabel={(cost) =>
                    `${productName} en estado ${itemStateLabelFor(cost)}`
                  }
                  renderCard={renderCard}
                  rowActions={canWrite ? renderActions : undefined}
                  rows={costs}
                />
              )}
            </div>
          </section>
        )}

      <CostDeleteDialog
        cost={deleteTarget}
        itemStateLabel={deleteTarget ? itemStateLabelFor(deleteTarget) : ""}
        onClose={() => setDeleteTarget(null)}
        onDeleted={costsResource.reload}
        productName={productName}
      />
    </div>
  );
}
