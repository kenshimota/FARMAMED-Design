"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { AccessState } from "@/components/erp/access-state";
import { AccountMenu } from "@/components/erp/account-menu";
import { ErpNavigation } from "@/components/erp/erp-navigation";
import { useSession } from "@/components/erp/session-context";
import {
  canReadModule,
  canWriteModule,
  getRolePresentation,
} from "@/lib/permissions";
import { sessionDisplayName } from "@/lib/session";
import {
  ERP_ROUTES,
  NAV_GROUPS,
  getBreadcrumbs,
  getRouteByPathname,
  type ErpGroup,
} from "@/lib/routes";

const GROUPS_STORAGE_KEY = "farmamed.navigation.groups";

function createInitialGroupState() {
  return Object.fromEntries(NAV_GROUPS.map((group) => [group, false]));
}

export function ErpShell({ children }: { children: ReactNode }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const route = getRouteByPathname(pathname);
  const [navigationExpanded, setNavigationExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    createInitialGroupState,
  );
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.sessionStorage.getItem(GROUPS_STORAGE_KEY);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (typeof parsed === "object" && parsed !== null) {
            setCollapsedGroups((current) => ({ ...current, ...parsed }));
          }
        }
      } catch {
        window.sessionStorage.removeItem(GROUPS_STORAGE_KEY);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    function closeOnDesktop(event: MediaQueryListEvent) {
      if (event.matches) setMobileOpen(false);
    }
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const panel = mobilePanelRef.current;
    const returnFocusTo = mobileButtonRef.current;
    document.body.style.overflow = "hidden";
    panel?.querySelector<HTMLElement>("[data-mobile-close]")?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      ).filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (returnFocusTo?.getClientRects().length) {
        returnFocusTo.focus();
      } else {
        document.getElementById("contenido")?.focus();
      }
    };
  }, [mobileOpen]);

  function toggleGroup(group: ErpGroup) {
    setCollapsedGroups((current) => {
      const next = { ...current, [group]: !current[group] };
      try {
        window.sessionStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        return next;
      }
      return next;
    });
  }

  const allowed = route ? canReadModule(user.role, route.module) : true;
  const canWrite = route ? canWriteModule(user.role, route.module) : false;
  const breadcrumbs = getBreadcrumbs(pathname);
  const accountRoute = ERP_ROUTES.find((item) => item.path === "/app/cuenta")!;

  function renderNavigation(collapsed: boolean, mobile = false) {
    return (
      <ErpNavigation
        collapsed={collapsed}
        collapsedGroups={collapsedGroups}
        onNavigate={mobile ? () => setMobileOpen(false) : undefined}
        onRequestExpand={() => setNavigationExpanded(true)}
        onToggleGroup={toggleGroup}
        role={user.role}
      />
    );
  }

  return (
    <div className="erp-motion min-h-screen bg-background">
      <a className="skip-link" href="#contenido">
        Saltar al contenido
      </a>

      <aside
        aria-label="Barra lateral del ERP"
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface md:flex ${
          navigationExpanded ? "md:w-[264px]" : "md:w-20"
        } xl:w-[264px]`}
      >
        <div className={`flex min-h-20 items-center border-b border-line px-4 ${navigationExpanded ? "justify-between" : "justify-center"} xl:justify-between`}>
          <Link aria-label="Farmamed ERP, ir al inicio" href="/app" onClick={() => setMobileOpen(false)}>
            <span className={`${navigationExpanded ? "hidden" : "block"} w-10 overflow-hidden xl:hidden`}>
              <Brand />
            </span>
            <span className={`${navigationExpanded ? "block" : "hidden"} xl:block`}>
              <Brand />
            </span>
          </Link>
          <button
            aria-expanded={navigationExpanded}
            aria-label={navigationExpanded ? "Contraer navegación" : "Expandir navegación"}
            className={`min-h-11 min-w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-background hover:text-ink xl:hidden ${
              navigationExpanded ? "flex" : "hidden"
            }`}
            onClick={() => setNavigationExpanded((current) => !current)}
            type="button"
          >
            <Icon name="close" size={19} />
          </button>
        </div>
        {!navigationExpanded && (
          <button
            aria-expanded={false}
            aria-label="Expandir navegación"
            className="mx-auto my-3 flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-background hover:text-ink xl:hidden"
            onClick={() => setNavigationExpanded(true)}
            type="button"
          >
            <Icon name="menu" size={20} />
          </button>
        )}
        <div className="flex min-h-0 flex-1 flex-col xl:hidden">
          {renderNavigation(!navigationExpanded)}
        </div>
        <div className="hidden min-h-0 flex-1 flex-col xl:flex">
          {renderNavigation(false)}
        </div>
        <div className={`border-t border-line p-4 ${navigationExpanded ? "block" : "hidden"} xl:block`}>
          <p className="truncate text-[12px] font-semibold text-ink">{sessionDisplayName(user)}</p>
          <p className="mt-1 text-[10px] text-muted">{getRolePresentation(user.role).label}</p>
          <p className="mt-2 inline-flex items-center gap-2 text-[10px] font-medium text-muted">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-olive" />
            Sesión activa
          </p>
        </div>
      </aside>

      <div className={navigationExpanded ? "md:ml-[264px]" : "md:ml-20 xl:ml-[264px]"}>
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              aria-controls="panel-navegacion-movil"
              aria-expanded={mobileOpen}
              aria-label="Abrir navegación"
              className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-ink transition-colors hover:bg-background md:hidden"
              onClick={() => setMobileOpen(true)}
              ref={mobileButtonRef}
              type="button"
            >
              <Icon name="menu" size={22} />
            </button>
            <div className="min-w-0">
              <nav aria-label="Migas de pan" className="hidden md:block">
                <ol className="flex items-center gap-2 text-[12px]">
                  {breadcrumbs.map((breadcrumb, index) => {
                    const linkedRoute = breadcrumb.href
                      ? getRouteByPathname(breadcrumb.href)
                      : undefined;
                    const canFollow =
                      breadcrumb.href &&
                      (!linkedRoute || canReadModule(user.role, linkedRoute.module));

                    return (
                      <li className="flex min-w-0 items-center gap-2" key={`${breadcrumb.label}-${index}`}>
                        {index > 0 && <Icon className="shrink-0 text-muted" name="arrow-right" size={12} />}
                        {canFollow ? (
                          <Link className="truncate text-muted underline-offset-4 hover:text-brand hover:underline" href={breadcrumb.href!}>
                            {breadcrumb.label}
                          </Link>
                        ) : (
                          <span aria-current={breadcrumb.href ? undefined : "page"} className="truncate font-semibold text-ink">
                            {breadcrumb.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
              <p className="truncate text-[14px] font-semibold text-ink md:hidden">
                {route?.title ?? "Farmamed ERP"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {route && route.path !== "/app" && route.path !== accountRoute.path && (
              <span className={`hidden rounded-full px-3 py-1.5 text-[10px] font-semibold sm:inline-flex ${canWrite ? "bg-soft-lime text-ink" : "bg-soft-blue text-brand"}`}>
                {canWrite ? "Lectura y edición" : "Modo consulta"}
              </span>
            )}
            <AccountMenu onLogout={logout} user={user} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 xl:p-8" id="contenido" tabIndex={-1}>
          {allowed ? children : <AccessState />}
        </main>
      </div>

      {mobileOpen && (
        <div
          aria-label="Navegación principal"
          aria-modal="true"
          className="erp-panel-enter fixed inset-0 z-50 bg-surface md:hidden"
          id="panel-navegacion-movil"
          ref={mobilePanelRef}
          role="dialog"
        >
          <aside className="flex h-full flex-col" aria-label="Barra lateral móvil">
            <div className="flex min-h-20 items-center justify-between border-b border-line px-4">
              <Link aria-label="Farmamed ERP, ir al inicio" href="/app" onClick={() => setMobileOpen(false)}>
                <Brand />
              </Link>
              <button
                aria-label="Cerrar navegación"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink transition-colors hover:bg-background"
                data-mobile-close
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <Icon name="close" size={22} />
              </button>
            </div>
            <div className="border-b border-line px-6 py-4">
              <p className="truncate text-[13px] font-semibold text-ink">{sessionDisplayName(user)}</p>
              <p className="mt-1 text-[11px] text-muted">{getRolePresentation(user.role).label}</p>
            </div>
            {renderNavigation(false, true)}
          </aside>
        </div>
      )}
    </div>
  );
}
