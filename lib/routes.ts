import type { IconName } from "@/components/icons";
import { canReadModule, type ModuleKey } from "@/lib/permissions";

export type ErpGroup =
  | "Inicio"
  | "Catálogo"
  | "Operación"
  | "Inventario"
  | "Finanzas"
  | "Administración"
  | "Cuenta";

export type ErpRouteDefinition = {
  path: string;
  title: string;
  label: string;
  group: ErpGroup;
  module: ModuleKey;
  icon: IconName;
  description: string;
  navigation?: boolean;
  parent?: string;
};

export const NAV_GROUPS: readonly Exclude<ErpGroup, "Cuenta">[] = [
  "Inicio",
  "Catálogo",
  "Operación",
  "Inventario",
  "Finanzas",
  "Administración",
];

export const ERP_ROUTES: readonly ErpRouteDefinition[] = [
  {
    path: "/app",
    title: "Inicio",
    label: "Inicio",
    group: "Inicio",
    module: "inicio",
    icon: "home",
    description: "Un punto de entrada claro para las áreas disponibles según tu rol.",
    navigation: true,
  },
  {
    path: "/app/productos",
    title: "Productos",
    label: "Productos",
    group: "Catálogo",
    module: "catalogo",
    icon: "package",
    description: "Consulta y administración del catálogo de productos.",
    navigation: true,
  },
  {
    path: "/app/productos/nuevo",
    title: "Nuevo producto",
    label: "Nuevo producto",
    group: "Catálogo",
    module: "catalogo",
    icon: "package",
    description: "Registra un producto con su categoría e imagen.",
    parent: "/app/productos",
  },
  {
    path: "/app/productos/[id]",
    title: "Detalle del producto",
    label: "Detalle del producto",
    group: "Catálogo",
    module: "catalogo",
    icon: "package",
    description: "Consulta los datos registrados de un producto.",
    parent: "/app/productos",
  },
  {
    path: "/app/productos/[id]/editar",
    title: "Editar producto",
    label: "Editar producto",
    group: "Catálogo",
    module: "catalogo",
    icon: "package",
    description: "Actualiza los datos registrados de un producto.",
    parent: "/app/productos",
  },
  {
    path: "/app/categorias",
    title: "Categorías",
    label: "Categorías",
    group: "Catálogo",
    module: "catalogo",
    icon: "layers",
    description: "Organización de las categorías del catálogo.",
    navigation: true,
  },
  {
    path: "/app/imagenes",
    title: "Imágenes",
    label: "Imágenes",
    group: "Catálogo",
    module: "catalogo",
    icon: "image",
    description: "Gestión de las imágenes asociadas al catálogo.",
    navigation: true,
  },
  {
    path: "/app/estados-item",
    title: "Estados de ítem",
    label: "Estados de ítem",
    group: "Catálogo",
    module: "catalogo",
    icon: "tag",
    description: "Consulta y administración de los estados de los ítems.",
    navigation: true,
  },
  {
    path: "/app/estados-item/nuevo",
    title: "Nuevo estado de ítem",
    label: "Nuevo estado de ítem",
    group: "Catálogo",
    module: "catalogo",
    icon: "tag",
    description: "Registra un estado de ítem con su clave estable y condición de venta.",
    parent: "/app/estados-item",
  },
  {
    path: "/app/estados-item/[id]/editar",
    title: "Editar estado de ítem",
    label: "Editar estado de ítem",
    group: "Catálogo",
    module: "catalogo",
    icon: "tag",
    description: "Actualiza la etiqueta, la descripción y la condición de venta de un estado de ítem.",
    parent: "/app/estados-item",
  },
  {
    path: "/app/proveedores",
    title: "Proveedores",
    label: "Proveedores",
    group: "Catálogo",
    module: "catalogo",
    icon: "users",
    description: "Información y administración de proveedores.",
    navigation: true,
  },
  {
    path: "/app/proveedores/nuevo",
    title: "Nuevo proveedor",
    label: "Nuevo proveedor",
    group: "Catálogo",
    module: "catalogo",
    icon: "users",
    description: "Registra los datos de contacto y la ubicación de un proveedor.",
    parent: "/app/proveedores",
  },
  {
    path: "/app/proveedores/[id]",
    title: "Detalle del proveedor",
    label: "Detalle del proveedor",
    group: "Catálogo",
    module: "catalogo",
    icon: "users",
    description: "Consulta los datos registrados de un proveedor.",
    parent: "/app/proveedores",
  },
  {
    path: "/app/proveedores/[id]/editar",
    title: "Editar proveedor",
    label: "Editar proveedor",
    group: "Catálogo",
    module: "catalogo",
    icon: "users",
    description: "Actualiza los datos de contacto y la ubicación de un proveedor.",
    parent: "/app/proveedores",
  },
  {
    path: "/app/ubicaciones",
    title: "Ubicaciones",
    label: "Ubicaciones",
    group: "Catálogo",
    module: "catalogo",
    icon: "map-pin",
    description: "Catálogo geográfico de estados y ciudades de Venezuela.",
    navigation: true,
  },
  {
    path: "/app/ubicaciones/estados/[id]",
    title: "Detalle del estado",
    label: "Detalle del estado",
    group: "Catálogo",
    module: "catalogo",
    icon: "map-pin",
    description: "Consulta un estado geográfico y sus ciudades.",
    parent: "/app/ubicaciones",
  },
  {
    path: "/app/ubicaciones/ciudades/[id]",
    title: "Detalle de la ciudad",
    label: "Detalle de la ciudad",
    group: "Catálogo",
    module: "catalogo",
    icon: "map-pin",
    description: "Consulta una ciudad geográfica y el estado al que pertenece.",
    parent: "/app/ubicaciones",
  },
  {
    path: "/app/clientes",
    title: "Clientes",
    label: "Clientes",
    group: "Operación",
    module: "clientes",
    icon: "users",
    description: "Consulta y administración de clientes según el rol asignado.",
    navigation: true,
  },
  {
    path: "/app/bodegas",
    title: "Bodegas",
    label: "Bodegas",
    group: "Operación",
    module: "bodegas",
    icon: "warehouse",
    description: "Consulta y administración de bodegas.",
    navigation: true,
  },
  {
    path: "/app/bodegas/[id]/estantes",
    title: "Estantes y secciones",
    label: "Estantes y secciones",
    group: "Operación",
    module: "estantes",
    icon: "layers",
    description: "Ubicación física de estantes y secciones por bodega.",
    navigation: true,
    parent: "/app/bodegas",
  },
  {
    path: "/app/asignaciones",
    title: "Clientes por vendedor",
    label: "Clientes por vendedor",
    group: "Operación",
    module: "asignaciones",
    icon: "link",
    description: "Consulta y administración de asignaciones entre clientes y vendedores.",
    navigation: true,
  },
  {
    path: "/app/existencias",
    title: "Existencias",
    label: "Existencias",
    group: "Inventario",
    module: "existencias",
    icon: "box",
    description: "Consulta de existencias agregadas por producto y estado de ítem.",
    navigation: true,
  },
  {
    path: "/app/lotes",
    title: "Lotes",
    label: "Lotes",
    group: "Inventario",
    module: "lotes",
    icon: "layers",
    description: "Detalle físico de lotes, vencimientos, estados y ubicaciones.",
    navigation: true,
  },
  {
    path: "/app/costos",
    title: "Costos",
    label: "Costos",
    group: "Inventario",
    module: "costos",
    icon: "calculator",
    description: "Consulta y administración de costos por producto y estado.",
    navigation: true,
  },
  {
    path: "/app/compras",
    title: "Compras",
    label: "Compras",
    group: "Inventario",
    module: "compras",
    icon: "clipboard",
    description: "Consulta y administración del ciclo de compras.",
    navigation: true,
  },
  {
    path: "/app/compras/[id]",
    title: "Detalle de compra",
    label: "Detalle de compra",
    group: "Inventario",
    module: "compras",
    icon: "clipboard",
    description: "Detalle y edición de una compra según el rol asignado.",
    parent: "/app/compras",
  },
  {
    path: "/app/monedas",
    title: "Monedas",
    label: "Monedas",
    group: "Finanzas",
    module: "monedas",
    icon: "coins",
    description: "Consulta de monedas y administración de tasas sin conversión automática.",
    navigation: true,
  },
  {
    path: "/app/monedas/nueva",
    title: "Nueva moneda",
    label: "Nueva moneda",
    group: "Finanzas",
    module: "monedas",
    icon: "coins",
    description: "Registra una nueva moneda y su tasa de referencia.",
    parent: "/app/monedas",
  },
  {
    path: "/app/monedas/[id]/editar",
    title: "Editar moneda",
    label: "Editar moneda",
    group: "Finanzas",
    module: "monedas",
    icon: "coins",
    description: "Actualiza nombre, símbolo, tasa y estado de una moneda.",
    parent: "/app/monedas",
  },
  {
    path: "/app/monedas/[id]/historial",
    title: "Historial de tasas",
    label: "Historial de tasas",
    group: "Finanzas",
    module: "monedas",
    icon: "chart",
    description: "Consulta del historial de tasas de una moneda.",
    parent: "/app/monedas",
  },
  {
    path: "/app/usuarios",
    title: "Usuarios",
    label: "Usuarios",
    group: "Administración",
    module: "usuarios",
    icon: "users",
    description: "Administración de usuarios y estado de acceso.",
    navigation: true,
  },
  {
    path: "/app/usuarios/nuevo",
    title: "Nuevo usuario",
    label: "Nuevo usuario",
    group: "Administración",
    module: "usuarios",
    icon: "users",
    description: "Crea una cuenta y define su rol.",
    parent: "/app/usuarios",
  },
  {
    path: "/app/roles",
    title: "Roles",
    label: "Roles",
    group: "Administración",
    module: "roles",
    icon: "shield",
    description: "Consulta el catálogo de roles y la matriz de permisos de interfaz.",
    navigation: true,
  },
  {
    path: "/app/cuenta",
    title: "Mi cuenta",
    label: "Mi cuenta",
    group: "Cuenta",
    module: "cuenta",
    icon: "user",
    description: "Información del perfil y control de la sesión actual.",
    navigation: true,
  },
];

export const FUTURE_MODULES = [
  { label: "Ventas", group: "Operación", icon: "cart" },
  { label: "Pedidos", group: "Operación", icon: "clipboard" },
  { label: "Entregas", group: "Operación", icon: "truck" },
  { label: "Reportes", group: "Finanzas", icon: "chart" },
] as const;

function normalizePathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function matchesRoute(pathname: string, routePath: string) {
  const pathSegments = normalizePathname(pathname).split("/");
  const routeSegments = routePath.split("/");
  if (pathSegments.length !== routeSegments.length) return false;

  return routeSegments.every(
    (segment, index) =>
      (segment.startsWith("[") && segment.endsWith("]") && pathSegments[index].length > 0) ||
      segment === pathSegments[index],
  );
}

export function getRouteDefinition(routePath: string) {
  return ERP_ROUTES.find((route) => route.path === routePath);
}

export function getRouteByPathname(pathname: string) {
  return ERP_ROUTES.find((route) => matchesRoute(pathname, route.path));
}

export function getNavigationHref(route: ErpRouteDefinition, role: string) {
  if (!route.path.includes("[")) return route.path;
  if (!route.parent) return null;
  const parent = getRouteDefinition(route.parent);
  return parent && canReadModule(role, parent.module) ? parent.path : null;
}

export function isNavigationRouteActive(pathname: string, href: string) {
  let route = getRouteByPathname(normalizePathname(pathname));
  if (!route) return false;

  const visited = new Set<string>();
  while (route.parent && !visited.has(route.path)) {
    visited.add(route.path);
    const parent = getRouteDefinition(route.parent);
    if (!parent) break;
    route = parent;
  }

  return route.path === href;
}

export function getBreadcrumbs(pathname: string) {
  const route = getRouteByPathname(pathname);
  if (!route) return [{ label: "Inicio", href: "/app" }];
  if (route.path === "/app") return [{ label: route.label }];

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Inicio", href: "/app" },
  ];

  if (route.parent) {
    const parent = getRouteDefinition(route.parent);
    if (parent) breadcrumbs.push({ label: parent.label, href: parent.path });
  }

  breadcrumbs.push({ label: route.label });
  return breadcrumbs;
}
