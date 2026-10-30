"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { NewUserLink } from "@/components/erp/new-user-link";
import { useSession } from "@/components/erp/session-context";
import {
  RecordActionButton,
  RecordActions,
} from "@/components/erp/records/record-actions";
import { SelectField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { Skeleton, SkeletonTable } from "@/components/erp/ui/skeleton";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import {
  deleteUser,
  fetchUsers,
  setUserBlocked,
  userErrorMessage,
  type UserRecord,
} from "@/components/erp/users-api";
import { LARGE_LIST_NOTICE, LARGE_LIST_THRESHOLD } from "@/lib/feedback";
import { formatInteger } from "@/lib/format";
import {
  canReadModule,
  getRoleLabel,
  ROLES,
  ROLE_LABELS,
} from "@/lib/permissions";

const NO_USERS: UserRecord[] = [];

type DialogKind = "block" | "unblock" | "delete";

type DialogTarget = {
  user: UserRecord;
  kind: DialogKind;
};

function displayNameOf(user: UserRecord) {
  return user.name?.trim() || user.username;
}

function usersLabel(count: number) {
  return count === 1 ? "1 usuario" : `${formatInteger(count)} usuarios`;
}

function blockedLabel(count: number) {
  return count === 1 ? "1 bloqueado" : `${formatInteger(count)} bloqueados`;
}

type UserActionButtonsProps = {
  entry: UserRecord;
  displayName: string;
  pending: boolean;
  toggleReason: string | null;
  deleteReason: string | null;
  onToggle: () => void;
  onDelete: () => void;
};

function UserActionButtons({
  entry,
  displayName,
  pending,
  toggleReason,
  deleteReason,
  onToggle,
  onDelete,
}: UserActionButtonsProps) {
  const toggleReasonId = useId();
  const deleteReasonId = useId();
  const toggleLabel = entry.isBlocked
    ? "Restablecer acceso"
    : "Bloquear acceso";

  return (
    <>
      <RecordActionButton
        aria-describedby={toggleReason ? toggleReasonId : undefined}
        aria-label={`${toggleLabel} de ${displayName}`}
        disabled={pending || Boolean(toggleReason)}
        icon={entry.isBlocked ? "eye" : "eye-off"}
        onClick={onToggle}
        title={toggleReason ?? undefined}
      >
        {toggleLabel}
      </RecordActionButton>
      {toggleReason && (
        <span className="sr-only" id={toggleReasonId}>
          {toggleReason}
        </span>
      )}
      <RecordActionButton
        aria-describedby={deleteReason ? deleteReasonId : undefined}
        aria-label={`Eliminar usuario ${displayName}`}
        danger
        disabled={pending || Boolean(deleteReason)}
        icon="close"
        onClick={onDelete}
        title={deleteReason ?? undefined}
      >
        Eliminar
      </RecordActionButton>
      {deleteReason && (
        <span className="sr-only" id={deleteReasonId}>
          {deleteReason}
        </span>
      )}
    </>
  );
}

function UsersListSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4" role="status">
      <span className="sr-only">Cargando usuarios…</span>
      <div
        aria-hidden="true"
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <Skeleton className="h-16 w-full sm:max-w-xs" />
        <Skeleton className="h-16 w-full sm:max-w-[420px]" />
      </div>
      <div
        aria-hidden="true"
        className="rounded-[24px] border border-line bg-surface p-5"
      >
        <SkeletonTable columns={5} rows={6} />
      </div>
    </div>
  );
}

export function UserListPage() {
  const { user } = useSession();
  if (!canReadModule(user.role, "usuarios")) return <AccessState />;
  return <UserListContent />;
}

function UserListContent() {
  const { user } = useSession();
  const toast = useToast();
  const resource = useAsyncResource(fetchUsers);
  const countRef = useRef<HTMLParagraphElement>(null);
  const focusAfterDeleteRef = useRef(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [pendingUserId, setPendingUserId] = useState<UserRecord["id"] | null>(
    null,
  );
  const [updates, setUpdates] = useState<Record<string, UserRecord>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (dialog !== null || !focusAfterDeleteRef.current) return;
    focusAfterDeleteRef.current = false;
    countRef.current?.focus();
  }, [dialog]);

  const baseUsers = resource.data ?? NO_USERS;
  const users = useMemo(
    () =>
      baseUsers
        .filter((entry) => !removed[String(entry.id)])
        .map((entry) => updates[String(entry.id)] ?? entry),
    [baseUsers, removed, updates],
  );

  const sessionUserId = user.id;
  const sessionEmail = user.email.trim().toLowerCase();
  function isSelf(entry: UserRecord) {
    if (sessionUserId !== null && sessionUserId !== undefined) {
      return String(entry.id) === String(sessionUserId);
    }
    return entry.email.trim().toLowerCase() === sessionEmail;
  }

  const lastActiveAdminId = useMemo(() => {
    const admins = users.filter(
      (entry) => entry.role === "admin" && !entry.isBlocked,
    );
    return admins.length === 1 ? String(admins[0].id) : null;
  }, [users]);

  function isLastActiveAdmin(entry: UserRecord) {
    return (
      entry.role === "admin" &&
      !entry.isBlocked &&
      lastActiveAdminId !== null &&
      String(entry.id) === lastActiveAdminId
    );
  }

  function restrictionReason(entry: UserRecord, kind: "block" | "delete") {
    if (isSelf(entry)) {
      return kind === "block"
        ? "No puedes bloquear tu propia cuenta."
        : "No puedes eliminar tu propia cuenta.";
    }
    if (isLastActiveAdmin(entry)) {
      return kind === "block"
        ? "No puedes bloquear al último administrador activo."
        : "No puedes eliminar al último administrador activo.";
    }
    return null;
  }

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((entry) => {
      if (roleFilter && entry.role !== roleFilter) return false;
      if (statusFilter === "activos" && entry.isBlocked) return false;
      if (statusFilter === "bloqueados" && !entry.isBlocked) return false;
      if (!normalized) return true;
      return [entry.username, entry.name ?? "", entry.email].some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }, [query, roleFilter, statusFilter, users]);

  const filtersActive = Boolean(query.trim() || roleFilter || statusFilter);
  const blockedCount = users.filter((entry) => entry.isBlocked).length;
  const countLabel = filtersActive
    ? `Mostrando ${formatInteger(filteredUsers.length)} de ${usersLabel(users.length)}`
    : `${usersLabel(users.length)}, ${blockedLabel(blockedCount)}`;

  function isPending(entry: UserRecord) {
    return pendingUserId !== null && String(pendingUserId) === String(entry.id);
  }

  function renderUserCell(entry: UserRecord) {
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{entry.username}</span>
          <span className="font-mono text-[11px] text-muted">#{entry.id}</span>
          {isSelf(entry) && (
            <span
              className="rounded-full bg-soft-lime px-2.5 py-1 text-[10px] font-semibold text-ink"
              title="Tu cuenta"
            >
              Tú
            </span>
          )}
        </div>
        {entry.name && (
          <p className="mt-1 text-[12px] text-muted">{entry.name}</p>
        )}
      </div>
    );
  }

  function renderEmailCell(entry: UserRecord) {
    return (
      <a
        className="text-ink underline-offset-4 hover:text-brand hover:underline"
        href={`mailto:${entry.email}`}
      >
        {entry.email}
      </a>
    );
  }

  function renderRoleCell(entry: UserRecord) {
    return (
      <span className="inline-flex rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[11px] font-semibold text-ink">
        {getRoleLabel(entry.role)}
      </span>
    );
  }

  function renderStatusCell(entry: UserRecord) {
    return (
      <span aria-live="polite" className="inline-flex">
        {isPending(entry) ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted">
            <Icon name="clock" size={13} />
            Actualizando…
          </span>
        ) : entry.isBlocked ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-alert/[0.08] px-2.5 py-1 text-[11px] font-semibold text-alert-ink">
            <Icon name="eye-off" size={13} />
            Bloqueado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
            <Icon name="check" size={13} />
            Activo
          </span>
        )}
      </span>
    );
  }

  function actionButtons(entry: UserRecord) {
    return (
      <UserActionButtons
        deleteReason={restrictionReason(entry, "delete")}
        displayName={displayNameOf(entry)}
        entry={entry}
        onDelete={() => setDialog({ user: entry, kind: "delete" })}
        onToggle={() =>
          setDialog({
            user: entry,
            kind: entry.isBlocked ? "unblock" : "block",
          })
        }
        pending={isPending(entry)}
        toggleReason={entry.isBlocked ? null : restrictionReason(entry, "block")}
      />
    );
  }

  function renderRowActions(entry: UserRecord) {
    return <RecordActions>{actionButtons(entry)}</RecordActions>;
  }

  function renderCardActions(entry: UserRecord) {
    return (
      <details className="w-full">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand">
          Acciones
          <Icon name="chevron-down" size={14} />
        </summary>
        <div className="mt-2 flex flex-col gap-2">{actionButtons(entry)}</div>
      </details>
    );
  }

  function renderCard(entry: UserRecord) {
    return (
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[15px] font-semibold text-ink">{entry.username}</p>
          <span className="font-mono text-[11px] text-muted">#{entry.id}</span>
          {isSelf(entry) && (
            <span
              className="rounded-full bg-soft-lime px-2.5 py-1 text-[10px] font-semibold text-ink"
              title="Tu cuenta"
            >
              Tú
            </span>
          )}
        </div>
        {entry.name && (
          <p className="mt-1 text-[12px] text-muted">{entry.name}</p>
        )}
        <dl className="mt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Correo
            </dt>
            <dd className="min-w-0 text-right text-[13px] text-ink">
              {renderEmailCell(entry)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Rol
            </dt>
            <dd>{renderRoleCell(entry)}</dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
              Estado
            </dt>
            <dd>{renderStatusCell(entry)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  async function applyStatusChange(target: UserRecord, isBlocked: boolean) {
    setPendingUserId(target.id);
    try {
      await setUserBlocked(target.id, isBlocked);
    } finally {
      setPendingUserId(null);
    }
    setUpdates((current) => ({
      ...current,
      [String(target.id)]: { ...target, isBlocked },
    }));
    toast.success(isBlocked ? "Acceso bloqueado." : "Acceso restablecido.");
  }

  async function applyDelete(target: UserRecord) {
    setPendingUserId(target.id);
    try {
      await deleteUser(target.id);
    } finally {
      setPendingUserId(null);
    }
    setRemoved((current) => ({ ...current, [String(target.id)]: true }));
    toast.success("Usuario eliminado.");
    focusAfterDeleteRef.current = true;
  }

  function resetFilters() {
    setQuery("");
    setRoleFilter("");
    setStatusFilter("");
  }

  const columns: RecordsTableColumn<UserRecord>[] = [
    { key: "usuario", header: "Usuario", render: renderUserCell },
    { key: "correo", header: "Correo", render: renderEmailCell },
    { key: "rol", header: "Rol", render: renderRoleCell },
    { key: "estado", header: "Estado", render: renderStatusCell },
  ];

  const roleOptions = ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  const dialogTitle = !dialog
    ? ""
    : dialog.kind === "block"
      ? `¿Bloquear a ${displayNameOf(dialog.user)}?`
      : dialog.kind === "unblock"
        ? `¿Restablecer el acceso de ${displayNameOf(dialog.user)}?`
        : `¿Eliminar a ${displayNameOf(dialog.user)}?`;

  const dialogDescription = !dialog
    ? undefined
    : dialog.kind === "block"
      ? "No podrá iniciar sesión ni usar las rutas protegidas."
      : dialog.kind === "unblock"
        ? "Podrá iniciar sesión y usar las rutas protegidas de nuevo."
        : (
            <div className="space-y-2">
              <p>
                Usuario:{" "}
                <span className="font-semibold text-ink">
                  {dialog.user.username}
                </span>
              </p>
              <p>Esta acción es permanente.</p>
            </div>
          );

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={<NewUserLink />}
        description="Consulta quién tiene acceso al ERP, bloquea cuentas sin borrarlas y elimina usuarios de forma definitiva."
        eyebrow="Administración"
        title="Usuarios"
      />

      {resource.status === "loading" && <UsersListSkeleton />}

      {resource.status === "error" && (
        <>
          {resource.error?.kind === "forbidden" ? (
            <AccessState
              description="Solo un administrador puede gestionar usuarios."
              headingLevel="h2"
            />
          ) : (
            <RecordsLoadError
              description={
                resource.error
                  ? userErrorMessage(resource.error, "load")
                  : "No pudimos cargar los usuarios."
              }
              onRetry={resource.reload}
              title="No pudimos cargar los usuarios."
            />
          )}
        </>
      )}

      {resource.status !== "loading" && resource.status !== "error" && (
        <section aria-label="Listado de usuarios" className="space-y-4">
          {resource.status === "refreshing" && (
            <div aria-hidden="true" className="reload-bar" />
          )}

          <div className="rounded-[24px] border border-line bg-surface p-4 sm:p-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(170px,220px)_minmax(160px,210px)] md:items-end">
              <div>
                <label
                  className="mb-2 block text-[12px] font-semibold text-ink"
                  htmlFor="buscar-usuarios"
                >
                  Buscar
                </label>
                <div className="relative">
                  <Icon
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                    name="search"
                    size={17}
                  />
                  <input
                    className="h-12 w-full rounded-xl border border-ink/15 bg-surface pl-11 pr-4 text-[14px] text-ink transition-colors placeholder:text-muted hover:border-brand/45 focus:border-brand"
                    id="buscar-usuarios"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por usuario, nombre o correo"
                    type="search"
                    value={query}
                  />
                </div>
              </div>

              <SelectField
                id="filtro-rol"
                label="Rol"
                onChange={setRoleFilter}
                options={roleOptions}
                placeholder="Todos los roles"
                value={roleFilter}
              />

              <SelectField
                id="filtro-estado"
                label="Estado"
                onChange={setStatusFilter}
                options={[
                  { value: "activos", label: "Activos" },
                  { value: "bloqueados", label: "Bloqueados" },
                ]}
                placeholder="Todos los estados"
                value={statusFilter}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
              <p
                aria-live="polite"
                className="text-[12px] font-semibold text-muted"
                ref={countRef}
                tabIndex={-1}
              >
                {countLabel}
              </p>
              {filtersActive && (
                <button
                  className="min-h-11 text-[12px] font-semibold text-brand underline-offset-4 hover:text-ink hover:underline"
                  onClick={resetFilters}
                  type="button"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {filteredUsers.length > LARGE_LIST_THRESHOLD && (
            <NoticeBanner tone="warning">{LARGE_LIST_NOTICE}</NoticeBanner>
          )}

          {users.length === 0 ? (
            <EmptyState
              action={<NewUserLink />}
              description="Crea la primera cuenta para empezar a controlar los accesos."
              title="Todavía no hay usuarios."
            />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              action={
                <button
                  className="button-base button-secondary min-h-11 px-5"
                  onClick={resetFilters}
                  type="button"
                >
                  Limpiar filtros
                </button>
              }
              description="No hay usuarios que coincidan con la búsqueda o los filtros seleccionados."
              title="Sin resultados"
            />
          ) : (
            <RecordsTable
              caption="Usuarios registrados con su correo, rol y estado de acceso"
              cardActions={renderCardActions}
              columns={columns}
              getRowKey={(entry) => String(entry.id)}
              getRowLabel={displayNameOf}
              renderCard={renderCard}
              rowActions={renderRowActions}
              rows={filteredUsers}
            />
          )}
        </section>
      )}

      <ConfirmDialog
        confirmBusyLabel={
          dialog?.kind === "delete" ? "Eliminando…" : "Actualizando…"
        }
        confirmLabel={
          dialog?.kind === "delete"
            ? "Eliminar usuario"
            : dialog?.kind === "block"
              ? "Bloquear acceso"
              : "Restablecer acceso"
        }
        description={dialogDescription}
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          if (!dialog) return;
          if (dialog.kind === "delete") {
            await applyDelete(dialog.user);
          } else {
            await applyStatusChange(dialog.user, dialog.kind === "block");
          }
        }}
        onError={(error) =>
          toast.error(
            userErrorMessage(error, dialog?.kind === "delete" ? "delete" : "status"),
          )
        }
        open={dialog !== null}
        requireText={
          dialog?.kind === "delete"
            ? {
                value: dialog.user.username,
                label: "Escribe el nombre de usuario para confirmar",
              }
            : undefined
        }
        title={dialogTitle}
      />
    </div>
  );
}
