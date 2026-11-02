"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { NewUserLink } from "@/components/erp/new-user-link";
import { useSession } from "@/components/erp/session-context";
import {
  RecordActionButton,
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import { SelectField, TextField } from "@/components/erp/records/form-controls";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordsLoadError } from "@/components/erp/records/record-states";
import {
  RecordsTable,
  type RecordsTableColumn,
} from "@/components/erp/records/records-table";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { EmptyState } from "@/components/erp/ui/empty-state";
import { FilterBar, type FilterChip } from "@/components/erp/ui/filter-bar";
import { PaginationControls } from "@/components/erp/ui/pagination-controls";
import { Skeleton, SkeletonTable } from "@/components/erp/ui/skeleton";
import { useToast } from "@/components/erp/ui/toast";
import { useServerList } from "@/components/erp/ui/use-server-list";
import {
  deleteUser,
  fetchUserPage,
  setUserBlocked,
  userErrorMessage,
  type UserRecord,
} from "@/components/erp/users-api";
import { formatInteger } from "@/lib/format";
import {
  canReadModule,
  getRoleLabel,
  ROLES,
  ROLE_LABELS,
} from "@/lib/permissions";

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
        <SkeletonTable columns={6} rows={6} />
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
  const list = useServerList<UserRecord>({
    loader: (request) => fetchUserPage(request),
    filterKeys: ["role", "is_active"],
  });
  const [dialog, setDialog] = useState<DialogTarget | null>(null);
  const [pendingUserId, setPendingUserId] = useState<UserRecord["id"] | null>(
    null,
  );
  const [updates, setUpdates] = useState<Record<string, UserRecord>>({});
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [focusResults, setFocusResults] = useState(false);
  const resultsRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!focusResults) return;
    const timer = window.setTimeout(() => {
      resultsRef.current?.focus();
      setFocusResults(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focusResults]);

  const roleFilter = list.filters.role ?? "";
  const statusFilter = list.filters.is_active ?? "";
  const baseUsers = list.items;
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

  const filtersActive = Boolean(list.request.q || roleFilter || statusFilter);
  const countLabel = usersLabel(list.meta.total);

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

  function renderCustomerCell(entry: UserRecord) {
    if (entry.customer?.fullName) {
      return (
        <div className="min-w-0">
          <Link
            className="font-semibold text-ink underline-offset-4 hover:text-brand hover:underline"
            href={`/app/clientes/${entry.customer.id}`}
          >
            {entry.customer.fullName}
          </Link>
          <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-soft-lime px-2 py-0.5 text-[10px] font-semibold text-ink">
            <Icon name="check" size={11} />
            Vinculado
          </span>
        </div>
      );
    }

    return (
      <span className="inline-flex rounded-lg bg-background px-2 py-1 text-[11px] font-semibold text-muted">
        Sin vincular
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

  function detailAction(entry: UserRecord) {
    return (
      <RecordActionLink
        ariaLabel={`Ver el detalle del usuario ${displayNameOf(entry)}`}
        href={`/app/usuarios/${entry.id}`}
        icon="eye"
      >
        Ver detalle
      </RecordActionLink>
    );
  }

  function renderRowActions(entry: UserRecord) {
    return (
      <RecordActions>
        {detailAction(entry)}
        {actionButtons(entry)}
      </RecordActions>
    );
  }

  function renderCardActions(entry: UserRecord) {
    return (
      <details className="w-full">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3.5 text-[12px] font-semibold text-ink transition-colors hover:border-brand/40 hover:text-brand">
          Acciones
          <Icon name="chevron-down" size={14} />
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          {detailAction(entry)}
          {actionButtons(entry)}
        </div>
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
              Cliente
            </dt>
            <dd className="min-w-0 text-right text-[13px] text-ink">
              {renderCustomerCell(entry)}
            </dd>
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
    list.reload();
    setFocusResults(true);
  }

  const columns: RecordsTableColumn<UserRecord>[] = [
    { key: "usuario", header: "Usuario", render: renderUserCell },
    { key: "correo", header: "Correo", render: renderEmailCell },
    { key: "rol", header: "Rol", render: renderRoleCell },
    { key: "cliente", header: "Cliente", render: renderCustomerCell },
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

      <FilterBar
        activeCount={
          Number(Boolean(list.request.q)) +
          Number(Boolean(roleFilter)) +
          Number(Boolean(statusFilter))
        }
        chips={[
          ...(list.request.q
            ? [
                {
                  id: "q",
                  label: `Búsqueda: ${list.request.q}`,
                  onRemove: () => {
                    list.setSearch("");
                    list.commitSearch();
                  },
                } satisfies FilterChip,
              ]
            : []),
          ...(roleFilter
            ? [
                {
                  id: "role",
                  label: `Rol: ${getRoleLabel(roleFilter)}`,
                  onRemove: () => list.setFilter("role", ""),
                } satisfies FilterChip,
              ]
            : []),
          ...(statusFilter
            ? [
                {
                  id: "is_active",
                  label:
                    statusFilter === "true"
                      ? "Estado: Activos"
                      : "Estado: Bloqueados",
                  onRemove: () => list.setFilter("is_active", ""),
                } satisfies FilterChip,
              ]
            : []),
        ]}
        id="usuarios-filtros"
        loading={list.status === "loading"}
        onClear={list.clearFilters}
        resultsRef={resultsRef}
        results={
          list.status === "loading"
            ? "Cargando usuarios…"
            : list.status === "error" && users.length === 0
              ? "No se pudieron cargar los usuarios"
              : countLabel
        }
        search={
          <TextField
            help="La búsqueda y los filtros se aplican en el servidor."
            id="buscar-usuarios"
            inputType="search"
            label="Buscar"
            onChange={list.setSearch}
            placeholder="Buscar por usuario, nombre, correo o cliente"
            value={list.searchDraft}
          />
        }
      >
        <SelectField
          id="filtro-rol"
          label="Rol"
          onChange={(value) => list.setFilter("role", value)}
          options={roleOptions}
          placeholder="Todos los roles"
          value={roleFilter}
        />

        <SelectField
          id="filtro-estado"
          label="Estado"
          onChange={(value) => list.setFilter("is_active", value)}
          options={[
            { value: "true", label: "Activos" },
            { value: "false", label: "Bloqueados" },
          ]}
          placeholder="Todos los estados"
          value={statusFilter}
        />
      </FilterBar>

      {list.status === "loading" && <UsersListSkeleton />}

      {list.status === "error" && users.length === 0 && (
        <>
          {list.error?.kind === "forbidden" ? (
            <AccessState
              description="Solo un administrador puede gestionar usuarios."
              headingLevel="h2"
            />
          ) : (
            <RecordsLoadError
              description={
                list.error
                  ? userErrorMessage(list.error, "load")
                  : "No pudimos cargar los usuarios."
              }
              onRetry={list.reload}
              title="No pudimos cargar los usuarios."
            />
          )}
        </>
      )}

      {list.status !== "loading" &&
        !(list.status === "error" && users.length === 0) && (
          <section aria-label="Listado de usuarios" className="space-y-4">
            {list.status === "refreshing" && (
              <div aria-hidden="true" className="reload-bar" />
            )}

            {list.status === "error" && users.length > 0 && (
              <NoticeBanner
                action={
                  <button
                    className="min-h-11 rounded-full border border-olive/35 px-3 text-[12px] font-semibold text-ink transition-colors hover:bg-surface"
                    onClick={list.reload}
                    type="button"
                  >
                    Reintentar
                  </button>
                }
                tone="warning"
              >
                {list.error?.message ??
                  "No pudimos actualizar los usuarios. Mostramos los datos disponibles."}
              </NoticeBanner>
            )}

            {users.length === 0 ? (
              list.meta.total === 0 && !filtersActive ? (
                <EmptyState
                  action={<NewUserLink />}
                  description="Crea la primera cuenta para empezar a controlar los accesos."
                  title="Todavía no hay usuarios."
                />
              ) : (
                <EmptyState
                  action={
                    <button
                      className="button-base button-secondary min-h-11 px-5"
                      onClick={
                        list.isPageOutOfRange
                          ? list.goToFirstPage
                          : list.clearFilters
                      }
                      type="button"
                    >
                      {list.isPageOutOfRange
                        ? "Ir a la primera página"
                        : "Limpiar filtros"}
                    </button>
                  }
                  description={
                    list.isPageOutOfRange
                      ? `Hay ${formatInteger(
                          list.meta.total,
                        )} usuarios en total, pero esta página no tiene filas.`
                      : "No hay usuarios que coincidan con la búsqueda o los filtros seleccionados."
                  }
                  title={
                    list.isPageOutOfRange
                      ? "No hay resultados en esta página"
                      : "Sin resultados con estos filtros."
                  }
                />
              )
            ) : (
              <RecordsTable
                busy={list.status === "refreshing"}
                caption="Usuarios registrados con su correo, rol, cliente vinculado y estado de acceso"
                cardActions={renderCardActions}
                columns={columns}
                getRowKey={(entry) => String(entry.id)}
                getRowLabel={displayNameOf}
                renderCard={renderCard}
                rowActions={renderRowActions}
                rows={users}
              />
            )}

            <PaginationControls
              meta={list.meta}
              onFirstPage={list.goToFirstPage}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
            />
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
