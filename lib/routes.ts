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
    path: "/app/imagenes/nueva",
    title: "Registrar imagen",
    label: "Registrar imagen",
    group: "Catálogo",
    module: "catalogo",
    icon: "image",
    description: "Registra una imagen reutilizable por URL con su referencia y miniatura.",
    parent: "/app/imagenes",
  },
  {
    path: "/app/imagenes/[id]/editar",
    title: "Editar imagen",
    label: "Editar imagen",
    group: "Catálogo",
    module: "catalogo",
    icon: "image",
    description: "Actualiza los datos registrados de una imagen del catálogo.",
    parent: "/app/imagenes",
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
    path: "/app/clientes/nuevo",
    title: "Nuevo cliente",
    label: "Nuevo cliente",
    group: "Operación",
    module: "clientes",
    icon: "users",
    description: "Registra un cliente con su correo, dirección y ubicación.",
    parent: "/app/clientes",
  },
  {
    path: "/app/clientes/[id]",
    title: "Detalle del cliente",
    label: "Detalle del cliente",
    group: "Operación",
    module: "clientes",
    icon: "users",
    description: "Consulta los datos de contacto y la ubicación de un cliente.",
    parent: "/app/clientes",
  },
  {
    path: "/app/clientes/[id]/editar",
    title: "Editar cliente",
    label: "Editar cliente",
    group: "Operación",
    module: "clientes",
    icon: "users",
    description: "Actualiza los datos de contacto y la ubicación de un cliente.",
    parent: "/app/clientes",
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
    path: "/app/bodegas/nueva",
    title: "Nueva bodega",
    label: "Nueva bodega",
    group: "Operación",
    module: "bodegas",
    icon: "warehouse",
    description: "Registra una bodega con su nombre, dirección y observaciones opcionales.",
    parent: "/app/bodegas",
  },
  {
    path: "/app/bodegas/[id]",
    title: "Detalle de la bodega",
    label: "Detalle de la bodega",
    group: "Operación",
    module: "bodegas",
    icon: "warehouse",
    description: "Consulta los datos de una bodega y el acceso a sus estantes.",
    parent: "/app/bodegas",
  },
  {
    path: "/app/bodegas/[id]/editar",
    title: "Editar bodega",
    label: "Editar bodega",
    group: "Operación",
    module: "bodegas",
    icon: "warehouse",
    description: "Actualiza el nombre, la dirección y las observaciones de una bodega.",
    parent: "/app/bodegas",
  },
  {
    path: "/app/estantes",
    title: "Estantes",
    label: "Estantes",
    group: "Operación",
    module: "estantes",
    icon: "layers",
    description: "Jerarquía de estantes y secciones agrupada por bodega.",
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
    navigation: false,
    parent: "/app/bodegas",
  },
  {
    path: "/app/bodegas/[id]/estantes/nuevo",
    title: "Nuevo estante",
    label: "Nuevo estante",
    group: "Operación",
    module: "estantes",
    icon: "layers",
    description: "Registra un estante dentro de una bodega.",
    parent: "/app/bodegas/[id]/estantes",
  },
  {
    path: "/app/bodegas/[id]/estantes/[shelf_id]",
    title: "Detalle del estante",
    label: "Detalle del estante",
    group: "Operación",
    module: "estantes",
    icon: "layers",
    description: "Consulta un estante y administra sus secciones.",
    parent: "/app/bodegas/[id]/estantes",
  },
  {
    path: "/app/bodegas/[id]/estantes/[shelf_id]/secciones/nueva",
    title: "Nueva sección",
    label: "Nueva sección",
    group: "Operación",
    module: "estantes",
    icon: "layers",
    description: "Registra una sección dentro de un estante.",
    parent: "/app/bodegas/[id]/estantes/[shelf_id]",
  },
  {
    path: "/app/asignaciones",
    title: "Asignaciones",
    label: "Asignaciones",
    group: "Operación",
    module: "asignaciones",
    icon: "link",
    description: "Consulta y administración de asignaciones entre clientes y vendedores.",
    navigation: true,
  },
  {
    path: "/app/asignaciones/nueva",
    title: "Nueva asignación",
    label: "Nueva asignación",
    group: "Operación",
    module: "asignaciones",
    icon: "link",
    description: "Asigna un cliente sin vendedor a un vendedor activo.",
    parent: "/app/asignaciones",
  },
  {
    path: "/app/asignaciones/[id]/editar",
    title: "Reasignar vendedor",
    label: "Reasignar vendedor",
    group: "Operación",
    module: "asignaciones",
    icon: "link",
    description: "Cambia el vendedor responsable de un cliente.",
    parent: "/app/asignaciones",
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
    path: "/app/existencias/disponibles",
    title: "Existencias disponibles",
    label: "Disponibles",
    group: "Inventario",
    module: "existencias",
    icon: "box",
    description:
      "Disponibilidad vendible de un producto con su costo y moneda vigentes.",
    parent: "/app/existencias",
  },
  {
    path: "/app/existencias/[id]",
    title: "Detalle de existencia",
    label: "Detalle de existencia",
    group: "Inventario",
    module: "existencias",
    icon: "box",
    description:
      "Detalle de una existencia agregada con su producto, estado y cantidad.",
    parent: "/app/existencias",
  },
  {
    path: "/app/existencias/producto/[product_id]",
    title: "Existencias del producto",
    label: "Existencias del producto",
    group: "Inventario",
    module: "existencias",
    icon: "box",
    description:
      "Existencias de un producto por estado de ítem con enlaces a lotes y disponibilidad.",
    parent: "/app/existencias",
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
    path: "/app/lotes/nuevo",
    title: "Nuevo lote",
    label: "Nuevo lote",
    group: "Inventario",
    module: "lotes",
    icon: "layers",
    description:
      "Registra un lote con su número, vencimiento, cantidades y ubicación física coherente.",
    parent: "/app/lotes",
  },
  {
    path: "/app/lotes/[id]",
    title: "Detalle del lote",
    label: "Detalle del lote",
    group: "Inventario",
    module: "lotes",
    icon: "layers",
    description:
      "Consulta el vencimiento, las cantidades y la ubicación física de un lote.",
    parent: "/app/lotes",
  },
  {
    path: "/app/lotes/[id]/editar",
    title: "Editar lote",
    label: "Editar lote",
    group: "Inventario",
    module: "lotes",
    icon: "layers",
    description:
      "Actualiza el vencimiento, las cantidades y la ubicación física de un lote.",
    parent: "/app/lotes/[id]",
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
    path: "/app/costos/nuevo",
    title: "Nuevo costo",
    label: "Nuevo costo",
    group: "Inventario",
    module: "costos",
    icon: "calculator",
    description: "Registra el costo vigente de un producto para un estado de ítem.",
    parent: "/app/costos",
  },
  {
    path: "/app/costos/[id]/editar",
    title: "Editar costo",
    label: "Editar costo",
    group: "Inventario",
    module: "costos",
    icon: "calculator",
    description: "Actualiza el costo vigente sin convertir el monto al cambiar la moneda.",
    parent: "/app/costos",
  },
  {
    path: "/app/costos/producto/[product_id]",
    title: "Costos del producto",
    label: "Costos del producto",
    group: "Inventario",
    module: "costos",
    icon: "calculator",
    description: "Consulta una fila por estado de ítem y enlaza a existencias disponibles.",
    parent: "/app/costos",
  },
  {
    path: "/app/compras",
    title: "Compras",
    label: "Compras",
    group: "Inventario",
    module: "compras",
    icon: "clipboard",
    description:
      "Consulta y administración de compras a proveedores con su moneda, líneas y estados.",
    navigation: true,
  },
  {
    path: "/app/compras/nueva",
    title: "Nueva compra",
    label: "Nueva compra",
    group: "Inventario",
    module: "compras",
    icon: "clipboard",
    description:
      "Constructor de borradores de compra con proveedor, moneda y líneas con impuesto por monto.",
    parent: "/app/compras",
  },
  {
    path: "/app/compras/[id]",
    title: "Detalle de la compra",
    label: "Detalle de la compra",
    group: "Inventario",
    module: "compras",
    icon: "clipboard",
    description:
      "Cabecera, líneas, totales y acciones de una compra según su estado.",
    parent: "/app/compras",
  },
  {
    path: "/app/compras/[id]/editar",
    title: "Editar compra",
    label: "Editar compra",
    group: "Inventario",
    module: "compras",
    icon: "clipboard",
    description:
      "Actualiza la cabecera y las líneas de un borrador de compra sin convertir montos.",
    parent: "/app/compras/[id]",
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
    path: "/app/impuestos",
    title: "Impuestos",
    label: "Impuestos",
    group: "Finanzas",
    module: "impuestos",
    icon: "tag",
    description: "Catálogo de impuestos para uso futuro en pedidos. No se aplica a compras.",
    navigation: true,
  },
  {
    path: "/app/impuestos/nuevo",
    title: "Nuevo impuesto",
    label: "Nuevo impuesto",
    group: "Finanzas",
    module: "impuestos",
    icon: "tag",
    description: "Registra una definición de impuesto con su tasa porcentual.",
    parent: "/app/impuestos",
  },
  {
    path: "/app/impuestos/[id]/editar",
    title: "Editar impuesto",
    label: "Editar impuesto",
    group: "Finanzas",
    module: "impuestos",
    icon: "tag",
    description: "Actualiza nombre, tasa, descripción y estado de un impuesto.",
    parent: "/app/impuestos",
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

function resolveRouteHref(routePath: string, pathname: string) {
  if (!routePath.includes("[")) return routePath;

  const routeSegments = routePath.split("/");
  const pathSegments = normalizePathname(pathname).split("/");
  return routeSegments
    .map((segment, index) =>
      segment.startsWith("[") && segment.endsWith("]")
        ? pathSegments[index] ?? segment
        : segment,
    )
    .join("/");
}

export function getBreadcrumbs(pathname: string) {
  const route = getRouteByPathname(pathname);
  if (!route) return [{ label: "Inicio", href: "/app" }];
  if (route.path === "/app") return [{ label: route.label }];

  const chain: ErpRouteDefinition[] = [];
  const visited = new Set<string>();
  let current: ErpRouteDefinition | undefined = route;

  while (current && !visited.has(current.path)) {
    visited.add(current.path);
    chain.unshift(current);
    current = current.parent ? getRouteDefinition(current.parent) : undefined;
  }

  const breadcrumbs: { label: string; href?: string }[] = [
    { label: "Inicio", href: "/app" },
  ];

  chain.forEach((item, index) => {
    const isCurrent = index === chain.length - 1;
    breadcrumbs.push(
      isCurrent
        ? { label: item.label }
        : { label: item.label, href: resolveRouteHref(item.path, pathname) },
    );
  });

  return breadcrumbs;
}
