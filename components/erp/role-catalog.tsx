"use client";

import Link from "next/link";
import { AccessState } from "@/components/erp/access-state";
import { PermissionMatrix } from "@/components/erp/permission-matrix";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import {
  RecordsLoadError,
  RecordsTableSkeleton,
} from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import { useSession } from "@/components/erp/session-context";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  fetchRoles,
  rolesErrorMessage,
  type RoleRecord,
} from "@/components/erp/roles-api";
import {
  canReadModule,
  getRolePresentation,
  hasOperationalModules,
  ROLES,
  ROLE_LABELS,
} from "@/lib/permissions";

function roleNameCell(entry: RoleRecord) {
  return (
    <span className="font-mono text-[12px] text-ink">{entry.name}</span>
  );
}

function roleIdCell(entry: RoleRecord) {
  return (
    <span className="font-mono text-[12px] text-muted">#{entry.id}</span>
  );
}

function RoleLabelCell({ entry }: { entry: RoleRecord }) {
  const presentation = getRolePresentation(entry.name);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[11px] font-semibold text-ink">
        {presentation.label}
      </span>
      {!presentation.recognized && (
        <span className="inline-flex rounded-full bg-alert/[0.08] px-2.5 py-1 text-[10px] font-semibold text-alert-ink">
          Rol no reconocido
        </span>
      )}
    </span>
  );
}

function RoleDescriptionCell({ entry }: { entry: RoleRecord }) {
  const presentation = getRolePresentation(entry.name);
  return (
    <p className="max-w-md text-[12px] leading-6 text-muted">
      {presentation.description ?? "—"}
    </p>
  );
}

function RoleCard({ entry }: { entry: RoleRecord }) {
  const presentation = getRolePresentation(entry.name);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[15px] font-semibold text-ink">
          {presentation.label}
        </p>
        <span className="font-mono text-[11px] text-muted">#{entry.id}</span>
        {!presentation.recognized && (
          <span className="inline-flex rounded-full bg-alert/[0.08] px-2.5 py-1 text-[10px] font-semibold text-alert-ink">
            Rol no reconocido
          </span>
        )}
      </div>
      <p className="mt-1 font-mono text-[12px] text-ink">{entry.name}</p>
      <div className="mt-3">
        <RoleDescriptionCell entry={entry} />
      </div>
    </div>
  );
}

function catalogOnlyRoleLabels() {
  return ROLES.filter((role) => !hasOperationalModules(role)).map(
    (role) => ROLE_LABELS[role],
  );
}

export function RoleCatalogPage() {
  const { user } = useSession();
  if (!canReadModule(user.role, "roles")) return <AccessState />;
  return <RoleCatalogContent />;
}

function RoleCatalogContent() {
  const resource = useAsyncResource(fetchRoles);

  const columns: RecordsTableColumn<RoleRecord>[] = [
    { key: "id", header: "ID", render: roleIdCell },
    { key: "name", header: "Nombre técnico", render: roleNameCell },
    {
      key: "etiqueta",
      header: "Etiqueta",
      render: (entry) => <RoleLabelCell entry={entry} />,
    },
    {
      key: "descripcion",
      header: "Descripción",
      render: (entry) => <RoleDescriptionCell entry={entry} />,
    },
  ];

  const catalogOnly = catalogOnlyRoleLabels();

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        description="Los roles son fijos. Se asignan al crear un usuario y no se editan desde aquí."
        eyebrow="Administración"
        title="Roles del sistema"
      >
        <p className="max-w-2xl rounded-xl border border-brand/15 bg-soft-blue px-4 py-3 text-[12px] leading-6 text-ink">
          Asigna roles al crear un usuario en{" "}
          <Link
            className="font-semibold text-brand underline-offset-4 hover:underline"
            href="/app/usuarios"
          >
            Usuarios
          </Link>
          .
        </p>
      </RecordsPageHeader>

      {resource.status === "loading" && (
        <RecordsTableSkeleton columns={4} label="Cargando roles…" rows={6} />
      )}

      {resource.status === "error" && (
        <>
          {resource.error?.kind === "forbidden" ? (
            <AccessState
              description="Solo un administrador puede ver los roles."
              headingLevel="h2"
            />
          ) : (
            <RecordsLoadError
              description={
                resource.error
                  ? rolesErrorMessage(resource.error)
                  : "Intenta de nuevo."
              }
              onRetry={resource.reload}
              title="No pudimos cargar los roles."
            />
          )}
        </>
      )}

      {resource.status !== "loading" && resource.status !== "error" && (
        <>
          <section aria-label="Catálogo de roles" className="space-y-4">
            {resource.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {resource.data !== null && resource.data.length === 0 ? (
              <EmptyState
                description="Revisa la migración del API."
                title="No hay roles configurados."
              />
            ) : (
              <RecordsTable
                caption="Roles del sistema con su identificador, nombre técnico, etiqueta y descripción"
                columns={columns}
                getRowKey={(entry) => String(entry.id)}
                getRowLabel={(entry) =>
                  getRolePresentation(entry.name).label
                }
                renderCard={(entry) => <RoleCard entry={entry} />}
                rows={resource.data ?? []}
              />
            )}

            {catalogOnly.length > 0 && (
              <p className="max-w-2xl rounded-xl border border-olive/20 bg-soft-lime px-4 py-3 text-[12px] leading-6 text-ink">
                <span className="font-semibold">
                  {catalogOnly.join(" y ")}
                </span>{" "}
                {catalogOnly.length === 1
                  ? "aún no tiene módulos propios: solo consulta el catálogo."
                  : "aún no tienen módulos propios: solo consultan el catálogo."}
              </p>
            )}
          </section>

          <PermissionMatrix />
        </>
      )}
    </div>
  );
}
