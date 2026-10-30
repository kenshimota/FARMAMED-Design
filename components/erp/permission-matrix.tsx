"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/icons";
import {
  formatPermissionCode,
  getModulePermissionLevels,
  PERMISSION_MATRIX_ROWS,
  ROLES,
  ROLE_LABELS,
  type ModuleKey,
  type PermissionLevel,
} from "@/lib/permissions";
import { ERP_ROUTES } from "@/lib/routes";

const STACKED_QUERY = "(min-width: 768px)";
const mediaQueryLists = new Map<string, MediaQueryList>();
const mediaSubscriptions = new Map<
  string,
  (onChange: () => void) => () => void
>();

function getMediaQueryList(query: string) {
  let list = mediaQueryLists.get(query);
  if (!list) {
    list = window.matchMedia(query);
    mediaQueryLists.set(query, list);
  }
  return list;
}

function getMediaSubscription(query: string) {
  let subscribe = mediaSubscriptions.get(query);
  if (!subscribe) {
    subscribe = (onChange: () => void) => {
      const list = getMediaQueryList(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    };
    mediaSubscriptions.set(query, subscribe);
  }
  return subscribe;
}

function useStackedMatrix() {
  return useSyncExternalStore(
    getMediaSubscription(STACKED_QUERY),
    () => getMediaQueryList(STACKED_QUERY).matches,
    () => false,
  );
}

const SCREENLESS_MODULES = new Set(
  PERMISSION_MATRIX_ROWS.map((row) => row.module).filter(
    (module) => !ERP_ROUTES.some((route) => route.module === module),
  ),
);

const LEVEL_WORDS: Record<PermissionLevel, string> = {
  read: "lectura",
  write: "escritura",
  own: "solo lo propio",
};

function permissionPhrase(levels: readonly PermissionLevel[]) {
  if (levels.length === 0) return "oculto";
  const phrase = levels.map((level) => LEVEL_WORDS[level]).join(", ");
  return phrase.replace(/, ([^,]*)$/, " y $1");
}

type MatrixRow = {
  label: string;
  module: ModuleKey;
};

function MatrixRowLabel({ row }: { row: MatrixRow }) {
  return (
    <span className="block min-w-0">
      <span className="block text-[13px] font-semibold text-ink">
        {row.label}
      </span>
      {SCREENLESS_MODULES.has(row.module) && (
        <span className="mt-1 block text-[10px] font-medium text-muted">
          Sin pantalla propia aún
        </span>
      )}
    </span>
  );
}

function PermissionCell({ levels }: { levels: readonly PermissionLevel[] }) {
  const hidden = levels.length === 0;
  return (
    <span className="inline-flex">
      <span
        aria-hidden="true"
        className={`inline-flex min-w-[3.25rem] justify-center rounded-full border border-ink/10 bg-background px-2.5 py-1 font-mono text-[11px] font-semibold ${
          hidden ? "text-muted" : "text-ink"
        }`}
      >
        {formatPermissionCode(levels)}
      </span>
      <span className="sr-only">{permissionPhrase(levels)}</span>
    </span>
  );
}

function MatrixAccordionItem({
  row,
  open,
  onToggle,
}: {
  row: MatrixRow;
  open: boolean;
  onToggle: () => void;
}) {
  const baseId = useId();
  const buttonId = `${baseId}-boton`;
  const panelId = `${baseId}-panel`;

  return (
    <section className="rounded-2xl border border-line bg-background">
      <h3>
        <button
          aria-controls={panelId}
          aria-expanded={open}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-soft-blue"
          id={buttonId}
          onClick={onToggle}
          type="button"
        >
          <MatrixRowLabel row={row} />
          <Icon
            className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
            name="chevron-down"
            size={16}
          />
        </button>
      </h3>
      <div
        aria-labelledby={buttonId}
        className="px-4 pb-4"
        hidden={!open}
        id={panelId}
        role="region"
      >
        <dl className="divide-y divide-line rounded-xl border border-line bg-surface px-4">
          {ROLES.map((role) => (
            <div
              className="flex items-center justify-between gap-3 py-2.5"
              key={role}
            >
              <dt className="text-[12px] text-muted">{ROLE_LABELS[role]}</dt>
              <dd>
                <PermissionCell
                  levels={getModulePermissionLevels(role, row.module)}
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function PermissionMatrix() {
  const stacked = useStackedMatrix();
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  function isOpen(label: string) {
    return overrides[label] ?? stacked;
  }

  function toggleRow(label: string) {
    setOverrides((current) => ({
      ...current,
      [label]: !(current[label] ?? stacked),
    }));
  }

  return (
    <section
      aria-labelledby="titulo-matriz"
      className="rounded-[28px] border border-ink/[0.08] bg-surface p-6 shadow-[0_18px_60px_rgba(27,12,104,0.05)] sm:p-8 lg:p-10"
    >
      <span className="eyebrow">Referencia de acceso</span>
      <h2
        className="mt-4 text-balance text-2xl font-semibold tracking-[-0.035em] text-ink sm:text-3xl"
        id="titulo-matriz"
      >
        Matriz de permisos de interfaz
      </h2>
      <p className="mt-3 max-w-2xl text-[14px] leading-7 text-muted">
        Esta matriz gobierna la navegación, los botones y los estados sin
        permisos de Farmamed. Es informativa y no requiere interacción.
      </p>

      <h3 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
        Leyenda
      </h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {[
          { code: "L", text: "lectura" },
          { code: "E", text: "escritura" },
          { code: "P", text: "solo lo propio" },
          { code: "—", text: "oculto" },
        ].map((item) => (
          <li
            className="rounded-full border border-ink/10 bg-background px-3 py-1.5 text-[11px] font-semibold text-ink"
            key={item.code}
          >
            <span className="font-mono">{item.code}</span> = {item.text}
          </li>
        ))}
      </ul>

      <p className="mt-4 max-w-2xl rounded-xl border border-olive/20 bg-soft-lime px-4 py-3 text-[12px] leading-6 text-ink">
        Los módulos marcados con — se ocultan de la navegación del rol. Las
        acciones de escritura solo aparecen con permiso E y, con permiso P, el
        rol solo accede a sus propios registros según el contrato del API.
      </p>

      <div className="mt-8 hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <caption className="sr-only">
            Permisos de interfaz por módulo y rol: lectura, escritura, solo lo
            propio u oculto
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th
                className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                scope="col"
              >
                Módulo
              </th>
              {ROLES.map((role) => (
                <th
                  className="pb-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                  key={role}
                  scope="col"
                >
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MATRIX_ROWS.map((row) => (
              <tr
                className="border-b border-line align-middle last:border-b-0"
                key={row.label}
              >
                <th
                  className="py-3 pr-4 text-[13px] font-semibold text-ink"
                  scope="row"
                >
                  <MatrixRowLabel row={row} />
                </th>
                {ROLES.map((role) => (
                  <td className="py-3 pr-4" key={role}>
                    <PermissionCell
                      levels={getModulePermissionLevels(role, row.module)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 space-y-3 lg:hidden">
        {PERMISSION_MATRIX_ROWS.map((row) => (
          <MatrixAccordionItem
            key={row.label}
            onToggle={() => toggleRow(row.label)}
            open={isOpen(row.label)}
            row={row}
          />
        ))}
      </div>
    </section>
  );
}
