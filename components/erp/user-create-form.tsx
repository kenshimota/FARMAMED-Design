"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { useSession } from "@/components/erp/session-context";
import { BusyButton } from "@/components/erp/ui/action-button";
import {
  AccountFields,
  EMPTY_ACCOUNT_VALUES,
  INVALID_EMAIL_MESSAGE,
  accountSummaryItems,
  isValidEmail,
  mapAccountFieldErrors,
  type AccountFieldKey,
} from "@/components/erp/ui/account-fields";
import { NoticeBanner } from "@/components/erp/ui/banner";
import {
  FormErrorSummary,
  FormField,
  focusFirstInvalidField,
  type FormErrorItem,
} from "@/components/erp/ui/form";
import { PanelError } from "@/components/erp/ui/panel-error";
import { useToast } from "@/components/erp/ui/toast";
import { useAsyncResource } from "@/components/erp/ui/use-async-resource";
import { ApiError, apiFetch } from "@/lib/api";
import { PASSWORD_MIN_MESSAGE } from "@/lib/api-errors";
import { canWriteModule, getRoleLabel } from "@/lib/permissions";
import { getStoredToken } from "@/lib/session";

const COPY = {
  required: "Completa los campos obligatorios.",
  invalidEmail: INVALID_EMAIL_MESSAGE,
  invalidRole: "Selecciona un rol válido.",
  success: "Usuario creado. Se envió un correo de bienvenida.",
  conflict: "Ya existe un usuario con ese correo o nombre de usuario.",
  forbidden: "No tienes permisos para crear usuarios.",
  sessionExpired: "Tu sesión expiró. Inicia sesión de nuevo.",
  generic: "No pudimos crear el usuario. Intenta de nuevo.",
  validation: "Revisa los datos del formulario.",
  rolesError: "No pudimos cargar los roles.",
} as const;

const ROLE_FIELD_ID = "rol";

type RoleOption = {
  id: string;
  name: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRoles(payload: unknown): RoleOption[] {
  if (!Array.isArray(payload)) throw new Error("Respuesta inválida");

  const roles: RoleOption[] = [];
  for (const item of payload) {
    if (!isRecord(item) || typeof item.name !== "string" || !item.name.trim()) continue;
    const name = item.name.trim();
    roles.push({
      id: typeof item.id === "number" || typeof item.id === "string" ? String(item.id) : name,
      name,
    });
  }

  if (roles.length === 0) throw new Error("Respuesta inválida");
  return roles;
}

async function fetchRoles() {
  const payload = await apiFetch<unknown>("/roles", {
    token: getStoredToken() ?? undefined,
  });
  return parseRoles(payload);
}

function validate(values: typeof EMPTY_ACCOUNT_VALUES, role: string, roles: RoleOption[]) {
  const errors: Record<string, string> = {};
  if (!values.username.trim()) errors.username = COPY.required;
  if (!values.email.trim()) errors.email = COPY.required;
  else if (!isValidEmail(values.email)) errors.email = COPY.invalidEmail;
  if (!values.password) errors.password = COPY.required;
  else if (values.password.length < 8) errors.password = PASSWORD_MIN_MESSAGE;
  if (!role || !roles.some((option) => option.name === role)) {
    errors.role = COPY.invalidRole;
  }
  return errors;
}

export function UserCreateForm() {
  const { user } = useSession();
  if (!canWriteModule(user.role, "usuarios")) return <AccessState />;
  return <UserCreateFormContent />;
}

function UserCreateFormContent() {
  const router = useRouter();
  const toast = useToast();
  const loader = useCallback(() => fetchRoles(), []);
  const resource = useAsyncResource(loader);
  const [values, setValues] = useState(EMPTY_ACCOUNT_VALUES);
  const [role, setRole] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const roles = resource.data ?? [];
  const rolesLoading = resource.status === "loading" || resource.status === "refreshing";
  const rolesError = resource.status === "error";

  function clearFieldError(field: string) {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleChange(field: AccountFieldKey, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || resource.status !== "ready") return;

    const nextErrors = validate(values, role, roles);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setShowSummary(true);
      setMessage(null);
      window.requestAnimationFrame(() => focusFirstInvalidField());
      return;
    }

    setSubmitting(true);
    setErrors({});
    setShowSummary(false);
    setMessage(null);

    try {
      await apiFetch("/users", {
        method: "POST",
        token: getStoredToken() ?? undefined,
        body: JSON.stringify({
          username: values.username.trim(),
          email: values.email.trim(),
          password: values.password,
          role,
          ...(values.name.trim() ? { name: values.name.trim() } : {}),
        }),
      });
      toast.success(COPY.success);
      router.push("/app/usuarios");
    } catch (caught) {
      if (caught instanceof ApiError) {
        if (caught.status === 422) {
          const mapped = mapAccountFieldErrors(caught);
          if (caught.fieldErrors.role) mapped.role = COPY.invalidRole;
          if (Object.keys(mapped).length > 0) {
            setErrors(mapped);
            setShowSummary(true);
            window.requestAnimationFrame(() => focusFirstInvalidField());
          } else {
            setMessage(COPY.validation);
          }
        } else if (caught.status === 409) {
          setMessage(COPY.conflict);
        } else if (caught.status === 403) {
          setMessage(COPY.forbidden);
        } else if (caught.status === 400) {
          setMessage(COPY.required);
        } else if (caught.status === 401) {
          setMessage(COPY.sessionExpired);
        } else {
          setMessage(COPY.generic);
        }
      } else {
        setMessage(COPY.generic);
      }
      setSubmitting(false);
    }
  }

  const summaryItems: FormErrorItem[] = [
    ...accountSummaryItems(errors),
    ...(errors.role
      ? [{ fieldId: ROLE_FIELD_ID, label: "Rol", message: errors.role }]
      : []),
  ];

  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {rolesLoading ? "Cargando roles…" : ""}
      </p>
      {message && (
        <NoticeBanner className="mb-5" role="alert" tone="danger">
          {message}
        </NoticeBanner>
      )}
      {rolesError && (
        <div className="mb-5">
          <PanelError description={COPY.rolesError} onRetry={resource.reload} />
        </div>
      )}
      {showSummary && summaryItems.length > 0 && (
        <div className="mb-5">
          <FormErrorSummary errors={summaryItems} />
        </div>
      )}

      <form className="space-y-5" noValidate onSubmit={handleSubmit}>
        <AccountFields
          disabled={submitting}
          errors={errors}
          onChange={handleChange}
          values={values}
        />

        <div aria-busy={rolesLoading}>
          <FormField
            error={errors.role}
            help="Define qué puede hacer en el ERP."
            id={ROLE_FIELD_ID}
            label="Rol"
            required
          >
            {(aria) => (
              <select
                {...aria}
                className="h-12 w-full rounded-xl border border-ink/15 bg-surface px-4 text-[15px] text-ink transition-colors hover:border-brand/45 focus:border-brand disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitting || rolesLoading || rolesError}
                name="role"
                onChange={(event) => {
                  setRole(event.target.value);
                  clearFieldError("role");
                }}
                value={role}
              >
                <option value="">
                  {rolesLoading
                    ? "Cargando roles…"
                    : rolesError
                      ? "No pudimos cargar los roles."
                      : "Selecciona un rol"}
                </option>
                {roles.map((option) => (
                  <option key={option.id} value={option.name}>
                    {getRoleLabel(option.name)}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        <BusyButton
          busy={submitting}
          busyLabel="Creando usuario…"
          className="w-full"
          disabled={resource.status !== "ready"}
          type="submit"
        >
          Crear usuario
          <Icon name="arrow-right" size={18} />
        </BusyButton>
      </form>

      <p className="mt-4 text-[12px] leading-5 text-muted">
        El correo de bienvenida se envía como parte del alta; si falla, la cuenta igual queda creada.
      </p>
    </div>
  );
}
