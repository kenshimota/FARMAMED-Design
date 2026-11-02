import { EmptyState } from "@/components/erp/ui/empty-state";
import { invoiceMoney } from "@/components/erp/records/invoice-shared";
import type { Invoice, InvoiceItem } from "@/lib/finance/invoices-api";
import { formatInteger } from "@/lib/format";

const ITEM_STATE_LABELS: Record<string, string> = {
  sellable: "Vendible",
  vendible: "Vendible",
  available: "Disponible",
  disponible: "Disponible",
  not_sellable: "No vendible",
  no_vendible: "No vendible",
  unsellable: "No vendible",
  non_sellable: "No vendible",
  not_saleable: "No vendible",
  damaged: "Dañado",
  danado: "Dañado",
  dañado: "Dañado",
  expired: "Vencido",
  vencido: "Vencido",
  vencida: "Vencida",
  near_expiry: "Próximo a vencer",
  proximo_a_vencer: "Próximo a vencer",
  returned: "Devuelto",
  devuelto: "Devuelto",
  reserved: "Reservado",
  reservado: "Reservado",
  quarantine: "En cuarentena",
  cuarentena: "En cuarentena",
  blocked: "Bloqueado",
  bloqueado: "Bloqueado",
  discontinued: "Descontinuado",
  descontinuado: "Descontinuado",
  out_of_stock: "Agotado",
  agotado: "Agotado",
  obsolete: "Obsoleto",
  obsoleto: "Obsoleto",
  sample: "Muestra",
  muestra: "Muestra",
};

function itemStateKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function humanizeItemState(value: string) {
  const normalized = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "Sin estado";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function invoiceItemStateLabel(item: InvoiceItem) {
  const source = item.itemStateLabel.trim() || item.itemStateName.trim();
  if (!source) return "Sin estado";
  const mapped = ITEM_STATE_LABELS[itemStateKey(source)];
  return mapped ?? humanizeItemState(source);
}

export function InvoiceLinesSection({ invoice }: { invoice: Invoice }) {
  const items = invoice.items;

  function renderState(item: InvoiceItem) {
    return (
      <span className="inline-flex max-w-full rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-semibold text-brand">
        <span className="break-words">{invoiceItemStateLabel(item)}</span>
      </span>
    );
  }

  function renderCard(item: InvoiceItem) {
    return (
      <div>
        <p className="text-[15px] font-semibold text-ink">{item.productName}</p>
        {item.productReference && (
          <p className="mt-1 font-mono text-[11px] text-muted">
            Ref. {item.productReference}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Estado del ítem
            </dt>
            <dd className="mt-1 text-ink">{invoiceItemStateLabel(item)}</dd>
          </div>
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
              {invoiceMoney(item.unitPrice, invoice.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Subtotal
            </dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">
              {invoiceMoney(item.subtotal, invoice.currency)}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="lineas-factura"
      className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Detalle</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="lineas-factura"
          >
            Líneas de la factura
          </h2>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            Son copias inmutables del pedido al momento de facturar.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink">
          {items.length === 1 ? "1 línea" : `${formatInteger(items.length)} líneas`}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            description="Esta factura no tiene líneas registradas."
            title="Sin líneas de factura"
          />
        </div>
      ) : (
        <div className="mt-5">
          <div className="hidden lg:block">
            <table className="w-full table-fixed border-collapse text-left">
              <caption className="sr-only">
                Líneas de la factura con producto, referencia, estado, cantidad,
                precio unitario y subtotal
              </caption>
              <thead>
                <tr className="border-b border-line">
                  <th
                    className="w-[30%] pb-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Producto
                  </th>
                  <th
                    className="w-[20%] pb-2 pr-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Estado del ítem
                  </th>
                  <th
                    className="w-[10%] pb-2 pr-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Cantidad
                  </th>
                  <th
                    className="w-[20%] pb-2 pr-3 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Precio unitario
                  </th>
                  <th
                    className="w-[20%] pb-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-muted"
                    scope="col"
                  >
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    className="border-b border-line align-top last:border-b-0"
                    key={String(
                      item.orderItemId ??
                        `${item.productId}-${item.itemStateId}-${item.quantity}-${item.unitPrice}`,
                    )}
                  >
                    <td className="py-3 pr-3 text-[12px] text-ink">
                      <span className="block break-words font-semibold">
                        {item.productName}
                      </span>
                      {item.productReference && (
                        <span className="mt-1 block break-all font-mono text-[10px] text-muted">
                          Ref. {item.productReference}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-[12px]">{renderState(item)}</td>
                    <td className="py-3 pr-3 text-right text-[12px] tabular-nums text-ink">
                      {formatInteger(item.quantity)}
                    </td>
                    <td className="py-3 pr-3 text-right text-[12px] tabular-nums text-ink">
                      {invoiceMoney(item.unitPrice, invoice.currency)}
                    </td>
                    <td className="py-3 text-right text-[12px] font-semibold tabular-nums text-ink">
                      {invoiceMoney(item.subtotal, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 lg:hidden">
            {items.map((item) => (
              <li
                className="rounded-2xl border border-line bg-background p-4"
                key={String(
                  item.orderItemId ??
                    `${item.productId}-${item.itemStateId}-${item.quantity}-${item.unitPrice}`,
                )}
              >
                {renderCard(item)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
