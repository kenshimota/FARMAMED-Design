"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { UserCustomerLinkDialog } from "@/components/erp/user-customer-link-dialog";
import { NoticeBanner } from "@/components/erp/ui/banner";
import { ConfirmDialog } from "@/components/erp/ui/confirm-dialog";
import { useActivityVisible } from "@/components/erp/ui/use-activity-visible";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { RecordsPageHeader } from "@/components/erp/records/page-header";
import { RecordActionButton } from "@/components/erp/records/record-actions";
import {
  RecordsDetailSkeleton,
  RecordsLoadError,
} from "@/components/erp/records/record-states";
import { isPositiveRecordId } from "@/components/erp/records/records-api";
import {
  fetchUser,
  updateUserCustomer,
  userErrorMessage,
  type UserRecord,
} from "@/components/erp/users-api";
import { canReadModule, getRoleLabel } from "@/lib/permissions";

function displayNameOf(user: UserRecord) {
  return user.name?.trim() || user.username;
}

function AccountStatusBadge({ isBlocked }: { isBlocked: boolean }) {
  return isBlocked ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-alert/[0.08] px-2.5 py-1 text-[11px] font-semibold text-alert-ink">
      <Icon name="eye-off" size={13} />
      Bloqueado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-soft-lime px-2.5 py-1 text-[11px] font-semibold text-ink">
      <Icon name="check" size={13} />
      Activo
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex rounded-full border border-ink/10 bg-background px-2.5 py-1 text-[11px] font-semibold text-ink">
      {getRoleLabel(role)}
    </span>
  );
}

type UserDetailPageProps = {
  userId: string;
};

export function UserDetailPage({ userId }: UserDetailPageProps) {
  const { user } = useSession();
  const activityVisible = useActivityVisible();

  if (!canReadModule(user.role, "usuarios")) {
    return activityVisible ? (
      <AccessState description="No tienes permiso para administrar usuarios. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
    ) : null;
  }

  if (!isPositiveRecordId(userId)) {
    return activityVisible ? (
      <RecordsLoadError
        backHref="/app/usuarios"
        backLabel="Volver a usuarios"
        description="Puede que el enlace no sea válido o que el usuario ya no exista."
        headingLevel="h1"
        title="No encontramos ese usuario."
      />
    ) : null;
  }

  return <UserDetailContent userId={userId} />;
}

function UserDetailContent({ userId }: UserDetailPageProps) {
  const toast = useToast();
  const userLoader = useCallback(() => fetchUser(userId), [userId]);
  const resource = useAsyncResource(userLoader);
  const [override, setOverride] = useState<UserRecord | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);

  const target = override ?? resource.data;
  const isCustomer = target?.role === "customer";
  const linkedCustomer = target?.customer ?? null;

  if (!target) {
    if (resource.status === "loading") {
      return (
        <div className="space-y-5">
          <RecordsPageHeader
            actions={
              <Link
                className="button-base button-secondary min-h-11 px-5 text-[13px]"
                href="/app/usuarios"
              >
                Volver a usuarios
              </Link>
            }
            description="Consulta la cuenta, su rol y el cliente vinculado."
            eyebrow="Administración"
            title="Detalle del usuario"
          />
          <RecordsDetailSkeleton />
        </div>
      );
    }

    if (resource.error?.kind === "forbidden") {
      return (
        <AccessState description="No tienes permiso para administrar usuarios. Tu sesión sigue activa; usa la navegación para continuar en una sección disponible." />
      );
    }

    return (
      <RecordsLoadError
        backHref="/app/usuarios"
        backLabel="Volver a usuarios"
        description={
          resource.error
            ? userErrorMessage(resource.error, "load")
            : "No pudimos cargar el usuario."
        }
        headingLevel="h1"
        onRetry={
          resource.error?.kind === "not-found" ? undefined : resource.reload
        }
        title={
          resource.error?.kind === "not-found"
            ? "No encontramos ese usuario."
            : "No pudimos cargar el usuario"
        }
      />
    );
  }

  const displayName = displayNameOf(target);

  return (
    <div className="space-y-5">
      <RecordsPageHeader
        actions={
          <Link
            className="button-base button-secondary min-h-11 px-5 text-[13px]"
            href="/app/usuarios"
          >
            Volver a usuarios
          </Link>
        }
        description="Consulta la cuenta, su rol y el cliente vinculado al portal."
        eyebrow="Administración"
        title={displayName}
      >
        <p className="text-[12px] font-semibold text-muted">
          Usuario <span className="font-mono text-ink">#{target.id}</span>
        </p>
      </RecordsPageHeader>

      <div className="grid gap-5 md:grid-cols-2 md:items-start">
        <section
          aria-labelledby="cuenta-usuario-titulo"
          className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
        >
          <span className="eyebrow">Cuenta</span>
          <h2
            className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
            id="cuenta-usuario-titulo"
          >
            Datos de la cuenta
          </h2>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Nombre de usuario
              </dt>
              <dd className="mt-1.5 text-[14px] font-semibold text-ink">
                {target.username}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Nombre
              </dt>
              <dd className="mt-1.5 text-[14px] text-ink">
                {target.name || "No registrado"}
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Correo
              </dt>
              <dd className="mt-1.5 break-all text-[14px] text-ink">
                <a
                  className="underline-offset-4 hover:text-brand hover:underline"
                  href={`mailto:${target.email}`}
                >
                  {target.email}
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Rol
              </dt>
              <dd className="mt-1.5">
                <RoleBadge role={target.role} />
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Estado
              </dt>
              <dd className="mt-1.5">
                <AccountStatusBadge isBlocked={target.isBlocked} />
              </dd>
            </div>

            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                Identificador
              </dt>
              <dd className="mt-1.5 font-mono text-[13px] text-ink">
                #{target.id}
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="cliente-vinculado-titulo"
          className="rounded-[28px] border border-line bg-surface p-5 shadow-[0_18px_60px_rgba(27,12,104,0.04)] sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="eyebrow">Portal del cliente</span>
              <h2
                className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink"
                id="cliente-vinculado-titulo"
              >
                Cliente vinculado
              </h2>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                linkedCustomer
                  ? "bg-soft-lime text-ink"
                  : "border border-line bg-background text-muted"
              }`}
            >
              <Icon name={linkedCustomer ? "check" : "link"} size={13} />
              {linkedCustomer ? "Vinculado" : "Sin vincular"}
            </span>
          </div>

          {linkedCustomer ? (
            <>
              <dl className="mt-5 space-y-5">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Nombre
                  </dt>
                  <dd className="mt-1.5 text-[14px] text-ink">
                    <Link
                      className="font-semibold underline-offset-4 hover:text-brand hover:underline"
                      href={`/app/clientes/${linkedCustomer.id}`}
                    >
                      {linkedCustomer.fullName}
                    </Link>
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Correo
                  </dt>
                  <dd className="mt-1.5 break-all text-[14px] text-ink">
                    {linkedCustomer.email ? (
                      <a
                        className="underline-offset-4 hover:text-brand hover:underline"
                        href={`mailto:${linkedCustomer.email}`}
                      >
                        {linkedCustomer.email}
                      </a>
                    ) : (
                      "No registrado"
                    )}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Dirección
                  </dt>
                  <dd className="mt-1.5 whitespace-pre-line text-[14px] leading-7 text-ink">
                    {linkedCustomer.direction || "No registrada"}
                  </dd>
                </div>

                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                    Identificador del cliente
                  </dt>
                  <dd className="mt-1.5 font-mono text-[13px] text-ink">
                    #{linkedCustomer.id}
                  </dd>
                </div>
              </dl>

              {isCustomer && (
                <div className="mt-6 border-t border-line pt-5">
                  <RecordActionButton
                    aria-label={`Desvincular el cliente de la cuenta ${displayName}`}
                    danger
                    icon="close"
                    onClick={() => setUnlinkOpen(true)}
                  >
                    Desvincular
                  </RecordActionButton>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="mt-5 text-[14px] leading-7 text-ink">
                Sin cliente vinculado.
              </p>
              <p className="mt-2 text-[12px] leading-5 text-muted">
                La cuenta no podrá identificar sus pedidos ni su lista de precios
                hasta que se vincule con un cliente.
              </p>

              {isCustomer ? (
                <div className="mt-5">
                  <RecordActionButton
                    aria-label={`Vincular un cliente a la cuenta ${displayName}`}
                    icon="link"
                    onClick={() => setLinkOpen(true)}
                  >
                    Vincular cliente
                  </RecordActionButton>
                </div>
              ) : (
                <div className="mt-5">
                  <NoticeBanner tone="info">
                    Solo las cuentas con rol Cliente pueden vincularse con un
                    cliente del portal.
                  </NoticeBanner>
                </div>
              )}
            </>
          )}

          {linkedCustomer && !isCustomer && (
            <div className="mt-5">
              <NoticeBanner tone="warning">
                Esta cuenta no tiene rol Cliente. Revisa el vínculo antes de
                continuar.
              </NoticeBanner>
            </div>
          )}
        </section>
      </div>

      {isCustomer && (
        <UserCustomerLinkDialog
          onClose={() => setLinkOpen(false)}
          onLinked={(updated) => {
            setOverride(updated);
            setLinkOpen(false);
            toast.success("Vínculo guardado.");
          }}
          open={linkOpen}
          user={target}
        />
      )}

      <ConfirmDialog
        confirmBusyLabel="Desvinculando…"
        confirmLabel="Desvincular"
        description={
          <div className="space-y-2">
            <p>
              La cuenta de{" "}
              <span className="font-semibold text-ink">{displayName}</span>{" "}
              quedará sin cliente vinculado.
            </p>
            <p>
              Desvincular la cuenta impedirá que el cliente compre hasta que se
              vincule de nuevo.
            </p>
          </div>
        }
        onClose={() => setUnlinkOpen(false)}
        onConfirm={async () => {
          const updated = await updateUserCustomer(target.id, null);
          setOverride(updated);
          toast.success("Cuenta desvinculada.");
        }}
        onError={(error) => toast.error(userErrorMessage(error, "link"))}
        open={unlinkOpen}
        title={`¿Desvincular el cliente de ${displayName}?`}
      />
    </div>
  );
}
