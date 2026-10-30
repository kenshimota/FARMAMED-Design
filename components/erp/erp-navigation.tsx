"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId } from "react";
import { Icon } from "@/components/icons";
import { canReadModule } from "@/lib/permissions";
import {
  ERP_ROUTES,
  FUTURE_MODULES,
  NAV_GROUPS,
  getNavigationHref,
  isNavigationRouteActive,
  type ErpGroup,
} from "@/lib/routes";

type ErpNavigationProps = {
  role: string;
  collapsed: boolean;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (group: ErpGroup) => void;
  onNavigate?: () => void;
  onRequestExpand: () => void;
};

export function ErpNavigation({
  role,
  collapsed,
  collapsedGroups,
  onToggleGroup,
  onNavigate,
  onRequestExpand,
}: ErpNavigationProps) {
  const pathname = usePathname();
  const navigationId = useId();
  const accountRoute = ERP_ROUTES.find((route) => route.path === "/app/cuenta")!;

  return (
    <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 pb-5">
      <ul className="space-y-2">
        {NAV_GROUPS.map((group) => {
          const routes = ERP_ROUTES.filter(
            (route) =>
              route.navigation &&
              route.group === group &&
              canReadModule(role, route.module),
          );
          const futureModules = FUTURE_MODULES.filter((module) => module.group === group);
          if (routes.length === 0 && futureModules.length === 0) return null;

          const isCollapsed = collapsedGroups[group] ?? false;
          const listId = `${navigationId}-grupo-${group.toLowerCase().replaceAll("ó", "o")}`;

          return (
            <li key={group}>
              {!collapsed && (
                <button
                  aria-controls={listId}
                  aria-expanded={!isCollapsed}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[11px] font-bold uppercase tracking-[0.13em] text-muted transition-colors hover:bg-background hover:text-ink"
                  onClick={() => onToggleGroup(group)}
                  type="button"
                >
                  {group}
                  <Icon
                    className={`transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`}
                    name="chevron-down"
                    size={15}
                  />
                </button>
              )}
              {(collapsed || !isCollapsed) && (
                <ul
                  className={`space-y-1 ${collapsed ? "border-t border-line py-2" : "mt-1"}`}
                  id={listId}
                >
                  {routes.map((route) => {
                    const active = isNavigationRouteActive(pathname, route.path);
                    const href = getNavigationHref(route, role);
                    const itemClass = `relative flex min-h-11 items-center rounded-xl text-[13px] font-medium transition-colors ${
                      collapsed ? "justify-center px-2" : "gap-3 px-3"
                    } ${
                      active
                        ? "bg-soft-blue text-brand"
                        : href
                          ? "text-ink/75 hover:bg-background hover:text-ink"
                          : "text-muted"
                    }`;
                    const content = (
                      <>
                        {active && (
                          <span
                            aria-hidden="true"
                            className={`absolute h-5 w-1 rounded-full bg-brand ${
                              collapsed ? "left-0" : "-left-3"
                            }`}
                          />
                        )}
                        <Icon className="shrink-0" name={route.icon} size={19} />
                        {!collapsed && <span>{route.label}</span>}
                        {!collapsed && !href && (
                          <span className="ml-auto rounded-full bg-background px-2 py-1 text-[9px] font-semibold text-muted">
                            Requiere bodega
                          </span>
                        )}
                      </>
                    );

                    return (
                      <li key={route.path}>
                        {href ? (
                          <Link
                            aria-current={active ? "page" : undefined}
                            aria-label={collapsed ? route.label : undefined}
                            className={itemClass}
                            href={href}
                            onClick={onNavigate}
                            onFocus={collapsed ? onRequestExpand : undefined}
                            title={collapsed ? route.label : undefined}
                          >
                            {content}
                          </Link>
                        ) : (
                          <span
                            aria-current={active ? "page" : undefined}
                            aria-disabled="true"
                            aria-label={collapsed ? `${route.label}, requiere bodega` : undefined}
                            className={itemClass}
                            onFocus={collapsed ? onRequestExpand : undefined}
                            tabIndex={0}
                            title={collapsed ? `${route.label}: requiere bodega` : undefined}
                          >
                            {content}
                          </span>
                        )}
                      </li>
                    );
                  })}
                  {futureModules.map((module) => (
                    <li key={module.label}>
                      <span
                        aria-disabled="true"
                        aria-label={`${module.label}, próximamente`}
                        className={`flex min-h-11 items-center rounded-xl text-[13px] font-medium text-muted/70 ${
                          collapsed ? "justify-center px-2" : "gap-3 px-3"
                        }`}
                        onFocus={collapsed ? onRequestExpand : undefined}
                        tabIndex={0}
                        title={collapsed ? `${module.label}: próximamente` : undefined}
                      >
                        <Icon className="shrink-0" name={module.icon} size={19} />
                        {!collapsed && (
                          <>
                            <span>{module.label}</span>
                            <span className="ml-auto rounded-full bg-background px-2 py-1 text-[9px] font-semibold normal-case tracking-normal text-muted">
                              Próximamente
                            </span>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 border-t border-line pt-3">
        <Link
          aria-current={pathname === accountRoute.path ? "page" : undefined}
          aria-label={collapsed ? accountRoute.label : undefined}
          className={`relative flex min-h-11 items-center rounded-xl text-[13px] font-medium transition-colors ${
            collapsed ? "justify-center px-2" : "gap-3 px-3"
          } ${
            pathname === accountRoute.path
              ? "bg-soft-blue text-brand"
              : "text-ink/75 hover:bg-background hover:text-ink"
          }`}
          title={collapsed ? accountRoute.label : undefined}
          href={accountRoute.path}
          onClick={onNavigate}
          onFocus={collapsed ? onRequestExpand : undefined}
        >
          <Icon name={accountRoute.icon} size={19} />
          {!collapsed && accountRoute.label}
        </Link>
      </div>
    </nav>
  );
}
