"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { useSession } from "@/components/erp/session-context";
import {
  STORE_CART_ADD_ERROR,
  STORE_CART_FULL_MESSAGE,
  StoreAccountIssue,
  StoreAvailability,
  StoreDetailSkeleton,
  StoreErrorState,
  StoreFeedbackBanner,
  StoreImage,
  StoreItemStateBadge,
  StoreQuantitySelector,
  describeStoreError,
  formatStoreMoney,
  storeQuantityLabel,
  type StoreFeedback,
} from "@/components/erp/store/store-shared";
import { useStoreResource } from "@/components/erp/store/use-store-resource";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { CART_MAX_LINES, addCartLine, readCart } from "@/lib/cart";
import { getCustomerAccessIssue } from "@/lib/customer";
import {
  fetchStoreProduct,
  isPositiveStoreId,
} from "@/lib/store";

function StoreProductContent({
  productId,
  customerId,
}: {
  productId: string;
  customerId: number | string;
}) {
  const loader = useCallback(() => fetchStoreProduct(productId), [productId]);
  const resource = useStoreResource(loader, `producto:${productId}`);
  const [selectedItemStateId, setSelectedItemStateId] = useState<string | null>(
    null,
  );
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<StoreFeedback | null>(null);

  if (resource.status === "loading") {
    return <StoreDetailSkeleton />;
  }

  if (resource.error) {
    const accessIssue = getCustomerAccessIssue(resource.error);
    if (accessIssue) {
      return (
        <StoreAccountIssue onRetry={resource.reload} reason={accessIssue} />
      );
    }

    const copy = describeStoreError(resource.error, "detail");
    return (
      <StoreErrorState
        {...copy}
        headingLevel="h1"
        onRetry={copy.canRetry ? resource.reload : undefined}
      />
    );
  }

  const product = resource.data;
  if (!product || product.variants.length === 0) {
    return (
      <StoreErrorState
        backHref="/app/tienda"
        backLabel="Volver a la tienda"
        canRetry={false}
        description="No hay estados disponibles para tu lista en este momento."
        headingLevel="h1"
        title="Este producto ya no está disponible."
      />
    );
  }

  const selectedVariant =
    product.variants.find(
      (variant) => String(variant.itemState.id) === selectedItemStateId,
    ) ??
    product.variants.find((variant) => variant.available) ??
    product.variants[0];
  const canAdd = selectedVariant.available && selectedVariant.currency !== null;

  function addToOrder() {
    if (!product || !canAdd || !selectedVariant.currency) return;

    const currentCart = readCart(customerId);
    const existingLine = currentCart.find(
      (line) =>
        line.productId === product.id &&
        line.itemStateId === selectedVariant.itemState.id,
    );
    if (!existingLine && currentCart.length >= CART_MAX_LINES) {
      setFeedback({ tone: "error", message: STORE_CART_FULL_MESSAGE });
      return;
    }

    const lines = addCartLine(customerId, {
      productId: product.id,
      itemStateId: selectedVariant.itemState.id,
      name: product.name,
      reference: product.reference || null,
      itemStateLabel: selectedVariant.itemState.label,
      unitPrice: selectedVariant.price,
      currencyId: selectedVariant.currency.id,
      currencyCode: selectedVariant.currency.code,
      currencySymbol: selectedVariant.currency.symbol,
      imageUrl: product.imageUrl,
      quantity,
    });
    const line = lines.find(
      (item) =>
        item.productId === product.id &&
        item.itemStateId === selectedVariant.itemState.id,
    );
    if (!line) {
      setFeedback({ tone: "error", message: STORE_CART_ADD_ERROR });
      return;
    }

    setFeedback({
      tone: "success",
      message: `Agregamos ${product.name} (${selectedVariant.itemState.label}) a tu pedido. Ahora tienes ${storeQuantityLabel(line.quantity)}.`,
    });
  }

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/tienda"
          >
            Volver a la tienda
          </Link>
        }
        description={`Referencia ${product.reference || "sin referencia"} · ${product.category?.name ?? "Sin categoría"}`}
        eyebrow="Tienda"
        title={product.name}
      />

      <StoreFeedbackBanner feedback={feedback} />

      <section
        aria-labelledby="ficha-compra"
        className="grid gap-6 rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]"
      >
        <div>
          <StoreImage
            className="h-72 w-full lg:h-[420px]"
            label={product.name}
            src={product.imageUrl}
          />
          <p className="mt-3 text-[11px] leading-5 text-muted">
            {product.imageUrl
              ? "Imagen del producto."
              : "Este producto no tiene una imagen disponible."}
          </p>
        </div>

        <div className="min-w-0">
          <span className="eyebrow">Ficha de compra</span>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <StoreItemStateBadge label={selectedVariant.itemState.label} />
            <StoreAvailability available={selectedVariant.available} />
          </div>

          <h2
            className="mt-5 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="ficha-compra"
          >
            Datos del producto
          </h2>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Referencia
              </dt>
              <dd className="mt-1.5 text-[14px] text-ink">
                {product.reference || "Sin referencia"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Categoría
              </dt>
              <dd className="mt-1.5 text-[14px] text-ink">
                {product.category?.name ?? "Sin categoría"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Descripción
              </dt>
              <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
                {product.description || "Sin descripción registrada."}
              </dd>
            </div>
          </dl>

          <div className="mt-7 rounded-2xl border border-line bg-background p-4 sm:p-5">
            {product.variants.length > 1 ? (
              <div>
                <label
                  className="block text-[13px] font-semibold text-ink"
                  htmlFor="tienda-estado-detalle"
                >
                  Estado del producto
                </label>
                <select
                  className="mt-2 h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[14px] text-ink transition-colors hover:border-brand/45 focus:border-brand"
                  id="tienda-estado-detalle"
                  onChange={(event) => {
                    setSelectedItemStateId(event.target.value);
                    setFeedback(null);
                  }}
                  value={String(selectedVariant.itemState.id)}
                >
                  {product.variants.map((variant) => (
                    <option
                      key={variant.itemState.id}
                      value={String(variant.itemState.id)}
                    >
                      {variant.itemState.label}
                      {variant.available ? "" : " — Agotado"}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[12px] leading-5 text-muted">
                  El precio y la disponibilidad cambian con el estado
                  seleccionado.
                </p>
              </div>
            ) : (
              <p className="text-[13px] leading-6 text-muted">
                Estado:{" "}
                <span className="font-semibold text-ink">
                  {selectedVariant.itemState.label}
                </span>
              </p>
            )}

            <div className="mt-5 border-t border-line pt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
                Precio
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-ink">
                {formatStoreMoney(
                  selectedVariant.price,
                  selectedVariant.currency,
                )}
              </p>
              <p className="mt-1 text-[12px] leading-5 text-muted">
                Precio de tu lista para el estado seleccionado. No se convierte
                la moneda.
              </p>
              {!selectedVariant.currency && (
                <p className="mt-2 text-[12px] font-semibold leading-5 text-alert-ink">
                  La moneda de este precio no está disponible.
                </p>
              )}
            </div>

            {!selectedVariant.available && (
              <NoticeBanner className="mt-5" role="status" tone="warning">
                Este producto está agotado en el estado seleccionado. Elige otro
                estado o vuelve a la tienda.
              </NoticeBanner>
            )}

            <div className="mt-5 border-t border-line pt-5">
              <StoreQuantitySelector
                disabled={!canAdd}
                id="tienda-cantidad"
                onChange={setQuantity}
                productName={product.name}
                value={quantity}
              />

              <button
                aria-label={`Agregar ${product.name} (${selectedVariant.itemState.label}) al pedido`}
                className="button-base button-primary mt-4 w-full sm:w-auto"
                disabled={!canAdd}
                onClick={addToOrder}
                type="button"
              >
                Agregar al pedido
                <Icon aria-hidden="true" name="arrow-right" size={17} />
              </button>

              {!selectedVariant.available && (
                <p className="mt-2 text-[12px] leading-5 text-muted">
                  No puedes agregar este estado mientras esté agotado.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function StoreProductDetailPage({
  productId,
}: {
  productId: string;
}) {
  const { user } = useSession();

  if (user.role !== "customer") {
    return (
      <AccessState description="Esta sección pertenece al portal del cliente. Usa la navegación del ERP para continuar." />
    );
  }

  if (user.customer_id === null) {
    return <StoreAccountIssue reason="vinculo" />;
  }

  if (!isPositiveStoreId(productId)) {
    return (
      <StoreErrorState
        backHref="/app/tienda"
        backLabel="Volver a la tienda"
        canRetry={false}
        description="El identificador del producto no es válido. Vuelve a la tienda y elige un producto."
        headingLevel="h1"
        title="Este producto ya no está disponible."
      />
    );
  }

  return (
    <StoreProductContent customerId={user.customer_id} productId={productId} />
  );
}
