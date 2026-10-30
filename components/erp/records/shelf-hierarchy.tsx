import Link from "next/link";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { Skeleton } from "@/components/erp/ui/skeleton";
import {
  RecordActionButton,
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import type {
  ShelfRecord,
  ShelfSectionRecord,
} from "@/components/erp/records/shelves-api";
import type { RecordId } from "@/components/erp/records/records-api";
import { formatInteger } from "@/lib/format";

export const IMMUTABLE_PARENT_NOTICE =
  "Un estante no se puede mover a otra bodega y una sección no se puede mover a otro estante.";

export const SHELF_LOTS_CONFLICT =
  "No puedes eliminar este estante porque tiene lotes asociados.";

export const SECTION_LOTS_CONFLICT =
  "No puedes eliminar esta sección porque tiene lotes asociados.";

export function shelfListHref(warehouseId: RecordId) {
  return `/app/bodegas/${warehouseId}/estantes`;
}

export function shelfDetailHref(warehouseId: RecordId, shelfId: RecordId) {
  return `/app/bodegas/${warehouseId}/estantes/${shelfId}`;
}

export function newShelfHref(warehouseId: RecordId) {
  return `/app/bodegas/${warehouseId}/estantes/nuevo`;
}

export function newSectionHref(warehouseId: RecordId, shelfId: RecordId) {
  return `/app/bodegas/${warehouseId}/estantes/${shelfId}/secciones/nueva`;
}

export function shelfCountLabel(count: number) {
  if (count === 0) return "Sin estantes";
  return count === 1 ? "1 estante" : `${formatInteger(count)} estantes`;
}

export function sectionCountLabel(count: number) {
  if (count === 0) return "Sin secciones";
  return count === 1 ? "1 sección" : `${formatInteger(count)} secciones`;
}

function elementId(prefix: string, ...values: RecordId[]) {
  return `${prefix}-${values.map((value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "-")).join("-")}`;
}

type ShelfBreadcrumbsProps = {
  warehouse: { id: RecordId; name: string };
  shelfCode?: string;
  shelfId?: RecordId;
  current?: string;
};

export function ShelfBreadcrumbs({
  warehouse,
  shelfCode,
  shelfId,
  current,
}: ShelfBreadcrumbsProps) {
  const shelfList = shelfListHref(warehouse.id);
  const shelfHref =
    shelfCode && shelfId !== undefined
      ? shelfDetailHref(warehouse.id, shelfId)
      : null;
  const showShelfListLink = Boolean(shelfCode || current);

  return (
    <nav aria-label="Ubicación en la jerarquía de la bodega">
      <ol className="flex flex-wrap items-center gap-2 text-[12px]">
        <li>
          <Link
            className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-brand hover:underline"
            href="/app/bodegas"
          >
            Bodegas
          </Link>
        </li>
        <li aria-hidden="true">
          <Icon className="text-muted" name="arrow-right" size={12} />
        </li>
        <li>
          <Link
            className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-brand hover:underline"
            href={`/app/bodegas/${warehouse.id}`}
          >
            {warehouse.name}
          </Link>
        </li>
        <li aria-hidden="true">
          <Icon className="text-muted" name="arrow-right" size={12} />
        </li>
        {showShelfListLink ? (
          <li>
            <Link
              className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-brand hover:underline"
              href={shelfList}
            >
              Estantes
            </Link>
          </li>
        ) : (
          <li>
            <span aria-current="page" className="font-semibold text-ink">
              Estantes
            </span>
          </li>
        )}
        {shelfCode && (
          <>
            <li aria-hidden="true">
              <Icon className="text-muted" name="arrow-right" size={12} />
            </li>
            <li>
              {current ? (
                shelfHref ? (
                  <Link
                    className="inline-flex min-h-11 items-center text-muted underline-offset-4 hover:text-brand hover:underline"
                    href={shelfHref}
                  >
                    Estante {shelfCode}
                  </Link>
                ) : (
                  <span className="text-muted">Estante {shelfCode}</span>
                )
              ) : (
                <span aria-current="page" className="font-semibold text-ink">
                  Estante {shelfCode}
                </span>
              )}
            </li>
          </>
        )}
        {current && (
          <>
            <li aria-hidden="true">
              <Icon className="text-muted" name="arrow-right" size={12} />
            </li>
            <li>
              <span aria-current="page" className="font-semibold text-ink">
                {current}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

type SectionActionsProps = {
  shelfCode: string;
  section: ShelfSectionRecord;
  onEdit: (section: ShelfSectionRecord) => void;
  onDelete: (section: ShelfSectionRecord) => void;
};

function SectionActions({
  shelfCode,
  section,
  onEdit,
  onDelete,
}: SectionActionsProps) {
  return (
    <RecordActions>
      <RecordActionButton
        aria-label={`Editar la sección ${section.code} del estante ${shelfCode}`}
        icon="arrow-right"
        onClick={() => onEdit(section)}
      >
        Editar
      </RecordActionButton>
      <RecordActionButton
        aria-label={`Eliminar la sección ${section.code} del estante ${shelfCode}`}
        danger
        icon="close"
        onClick={() => onDelete(section)}
      >
        Eliminar
      </RecordActionButton>
    </RecordActions>
  );
}

type ShelfSectionsListProps = {
  warehouseId: RecordId;
  shelf: ShelfRecord;
  sections: ShelfSectionRecord[];
  canWrite: boolean;
  onEditSection?: (shelf: ShelfRecord, section: ShelfSectionRecord) => void;
  onDeleteSection?: (shelf: ShelfRecord, section: ShelfSectionRecord) => void;
};

export function ShelfSectionsList({
  warehouseId,
  shelf,
  sections,
  canWrite,
  onEditSection,
  onDeleteSection,
}: ShelfSectionsListProps) {
  if (sections.length === 0) {
    return (
      <div className="pt-1">
        <EmptyState
          action={
            canWrite ? (
              <Link
                className="button-base button-secondary min-h-11 px-5"
                href={newSectionHref(warehouseId, shelf.id)}
              >
                Nueva sección
                <Icon name="layers" size={16} />
              </Link>
            ) : undefined
          }
          description={
            canWrite
              ? "Crea la primera sección para detallar la ubicación dentro del estante."
              : "Aún no hay secciones registradas para este estante."
          }
          title="Este estante todavía no tiene secciones."
        />
      </div>
    );
  }

  const canManage = Boolean(
    canWrite && onEditSection && onDeleteSection,
  );

  return (
    <ul aria-label={`Secciones del estante ${shelf.code}`} className="space-y-2.5">
      {sections.map((section) => (
        <li
          className="rounded-2xl border border-line bg-background p-4"
          id={elementId("seccion", shelf.id, section.id)}
          key={String(section.id)}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[12px] font-semibold text-brand">
                  <span className="sr-only">Código </span>
                  {section.code}
                </span>
                <span className="text-[14px] font-semibold text-ink">
                  {section.name || "Sin nombre"}
                </span>
              </div>
              {section.description && (
                <p className="mt-2 max-w-xl whitespace-pre-line text-[12px] leading-5 text-muted">
                  {section.description}
                </p>
              )}
            </div>
            {canManage && onEditSection && onDeleteSection && (
              <SectionActions
                onDelete={(target) => onDeleteSection(shelf, target)}
                onEdit={(target) => onEditSection(shelf, target)}
                section={section}
                shelfCode={shelf.code}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

type ShelfCardProps = {
  warehouseId: RecordId;
  shelf: ShelfRecord;
  expanded: boolean;
  onToggle: () => void;
  canWrite: boolean;
  onEditShelf: (shelf: ShelfRecord) => void;
  onDeleteShelf: (shelf: ShelfRecord) => void;
  onEditSection: (shelf: ShelfRecord, section: ShelfSectionRecord) => void;
  onDeleteSection: (shelf: ShelfRecord, section: ShelfSectionRecord) => void;
};

export function ShelfCard({
  warehouseId,
  shelf,
  expanded,
  onToggle,
  canWrite,
  onEditShelf,
  onDeleteShelf,
  onEditSection,
  onDeleteSection,
}: ShelfCardProps) {
  const panelId = elementId("estante-secciones", shelf.id);
  const toggleId = elementId("estante-toggle", shelf.id);
  const sections = shelf.sections;
  const actions = (
    <>
      <RecordActionButton
        aria-label={`Editar el estante ${shelf.code}`}
        icon="arrow-right"
        onClick={() => onEditShelf(shelf)}
      >
        Editar
      </RecordActionButton>
      <RecordActionButton
        aria-label={`Eliminar el estante ${shelf.code}`}
        danger
        icon="close"
        onClick={() => onDeleteShelf(shelf)}
      >
        Eliminar
      </RecordActionButton>
      <RecordActionLink
        ariaLabel={`Nueva sección en el estante ${shelf.code}`}
        href={newSectionHref(warehouseId, shelf.id)}
        icon="layers"
      >
        Nueva sección
      </RecordActionLink>
    </>
  );

  return (
    <li className="overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_14px_44px_rgba(27,12,104,0.04)]">
      <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <button
          aria-controls={panelId}
          aria-expanded={expanded}
          className="flex min-h-11 flex-1 items-start gap-3 rounded-xl text-left"
          id={toggleId}
          onClick={onToggle}
          type="button"
        >
          <span
            aria-hidden="true"
            className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-soft-blue text-brand transition-transform motion-reduce:transition-none ${
              expanded ? "rotate-0" : "-rotate-90"
            }`}
          >
            <Icon name="chevron-down" size={15} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-lg bg-soft-blue px-2 py-1 font-mono text-[12px] font-semibold text-brand">
                <span className="sr-only">Código </span>
                {shelf.code}
              </span>
              <span className="text-[15px] font-semibold text-ink">
                {shelf.name || "Sin nombre"}
              </span>
            </span>
            {shelf.description && (
              <span className="mt-2 block max-w-2xl whitespace-pre-line text-[12px] leading-5 text-muted">
                {shelf.description}
              </span>
            )}
            <span className="mt-2 block text-[12px] font-semibold text-muted">
              {sectionCountLabel(sections.length)}
            </span>
          </span>
        </button>

        {canWrite && (
          <>
            <div className="hidden lg:block">
              <RecordActions>{actions}</RecordActions>
            </div>
            <details className="lg:hidden">
              <summary
                aria-label={`Acciones del estante ${shelf.code}`}
                className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand"
              >
                Acciones
                <Icon name="chevron-down" size={14} />
              </summary>
              <div className="mt-2 flex flex-col gap-2">{actions}</div>
            </details>
          </>
        )}
      </div>

      <div
        aria-labelledby={toggleId}
        className="border-t border-line bg-surface p-4 sm:p-5 lg:pl-14"
        hidden={!expanded}
        id={panelId}
        role="region"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-ink">
            Secciones de {shelf.code}
          </h3>
          <span className="text-[11px] font-semibold text-muted">
            {sectionCountLabel(sections.length)}
          </span>
        </div>
        <ShelfSectionsList
          canWrite={canWrite}
          onDeleteSection={onDeleteSection}
          onEditSection={onEditSection}
          sections={sections}
          shelf={shelf}
          warehouseId={warehouseId}
        />
      </div>
    </li>
  );
}

export function ShelfHierarchySkeleton() {
  return (
    <div aria-busy="true" className="space-y-4" role="status">
      <span className="sr-only">Cargando estantes y secciones…</span>
      {[0, 1, 2].map((index) => (
        <div
          aria-hidden="true"
          className="rounded-[24px] border border-line bg-surface p-5"
          key={index}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="mt-4 space-y-2.5 lg:pl-10">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShelfSectionsSkeleton({ label = "Cargando secciones…" }: { label?: string }) {
  return (
    <div aria-busy="true" className="space-y-2.5" role="status">
      <span className="sr-only">{label}</span>
      {[0, 1].map((index) => (
        <div
          aria-hidden="true"
          className="rounded-2xl border border-line bg-background p-4"
          key={index}
        >
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="mt-3 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
