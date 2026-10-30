export const ROLES = [
  "admin",
  "customer",
  "seller",
  "dispatcher",
  "manager_warehouse",
  "support",
] as const;

export type Role = (typeof ROLES)[number];

export type ModuleKey =
  | "inicio"
  | "catalogo"
  | "clientes"
  | "bodegas"
  | "estantes"
  | "asignaciones"
  | "existencias"
  | "lotes"
  | "costos"
  | "compras"
  | "monedas"
  | "impuestos"
  | "tipos_metodos_pago"
  | "metodos_pago"
  | "usuarios"
  | "roles"
  | "cuenta";

type ModulePermission = {
  read: readonly Role[];
  write: readonly Role[];
  own?: readonly Role[];
};

const ALL_ROLES: readonly Role[] = ROLES;
const CATALOG_WRITE: readonly Role[] = ["admin", "seller"];

export const MODULE_PERMISSIONS: Record<ModuleKey, ModulePermission> = {
  inicio: { read: ALL_ROLES, write: [] },
  catalogo: { read: ALL_ROLES, write: CATALOG_WRITE },
  clientes: {
    read: ["admin", "seller", "dispatcher"],
    write: ["admin", "seller"],
  },
  bodegas: {
    read: ["admin", "dispatcher", "manager_warehouse"],
    write: ["admin", "manager_warehouse"],
  },
  estantes: {
    read: ["admin", "seller", "manager_warehouse", "dispatcher"],
    write: ["admin", "manager_warehouse"],
  },
  asignaciones: {
    read: ["admin", "dispatcher", "seller"],
    write: ["admin", "seller"],
    own: ["seller"],
  },
  existencias: {
    read: ["admin", "seller", "manager_warehouse"],
    write: [],
  },
  lotes: {
    read: ["admin", "seller", "manager_warehouse", "dispatcher"],
    write: ["admin", "seller", "manager_warehouse"],
  },
  costos: {
    read: ["admin", "seller", "manager_warehouse"],
    write: CATALOG_WRITE,
  },
  compras: {
    read: ["admin", "seller", "manager_warehouse"],
    write: CATALOG_WRITE,
  },
  monedas: {
    read: ["admin", "seller", "manager_warehouse", "dispatcher"],
    write: ["admin"],
  },
  impuestos: {
    read: ["admin", "seller", "dispatcher", "manager_warehouse"],
    write: ["admin"],
  },
  tipos_metodos_pago: {
    read: ["admin", "seller", "dispatcher"],
    write: ["admin"],
  },
  metodos_pago: {
    read: ["admin", "seller", "dispatcher"],
    write: ["admin"],
  },
  usuarios: { read: ["admin"], write: ["admin"] },
  roles: { read: ["admin"], write: [] },
  cuenta: { read: ALL_ROLES, write: [] },
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  customer: "Cliente",
  seller: "Vendedor",
  dispatcher: "Despachador",
  manager_warehouse: "Gerente de bodega",
  support: "Soporte",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Administra usuarios, roles, catálogos, operación, inventario, compras, monedas, impuestos y métodos de pago.",
  customer:
    "Consulta el catálogo en modo lectura. No tiene pedidos ni checkout en esta versión.",
  seller:
    "Gestiona catálogo, clientes, costos y compras; consulta existencias, lotes, monedas, estantes, impuestos y métodos de pago.",
  dispatcher:
    "Consulta clientes, bodegas, estantes, lotes, asignaciones, monedas, impuestos y métodos de pago.",
  manager_warehouse:
    "Gestiona bodegas, estantes, lotes, existencias, costos y compras; consulta monedas e impuestos.",
  support:
    "Consulta catálogo. No accede a operación, inventario, compras, finanzas ni administración.",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function getRoleLabel(name: string) {
  return isRole(name) ? ROLE_LABELS[name] : name;
}

export type RolePresentation = {
  label: string;
  description: string | null;
  recognized: boolean;
};

export function getRolePresentation(name: string): RolePresentation {
  if (isRole(name)) {
    return {
      label: ROLE_LABELS[name],
      description: ROLE_DESCRIPTIONS[name],
      recognized: true,
    };
  }
  return { label: name, description: null, recognized: false };
}

export function canReadModule(role: string, module: ModuleKey) {
  if (module === "inicio" || module === "cuenta") return true;
  return MODULE_PERMISSIONS[module].read.includes(role as Role);
}

export function canWriteModule(role: string, module: ModuleKey) {
  return MODULE_PERMISSIONS[module].write.includes(role as Role);
}

const OPERATIONAL_MODULES: readonly ModuleKey[] = [
  "clientes",
  "bodegas",
  "estantes",
  "asignaciones",
  "existencias",
  "lotes",
  "costos",
  "compras",
  "monedas",
  "impuestos",
  "tipos_metodos_pago",
  "metodos_pago",
  "usuarios",
  "roles",
];

export function hasOperationalModules(role: string) {
  return OPERATIONAL_MODULES.some((module) => canReadModule(role, module));
}

export type PermissionLevel = "read" | "write" | "own";

export const PERMISSION_MATRIX_ROWS: readonly {
  label: string;
  module: ModuleKey;
}[] = [
  { label: "Inicio", module: "inicio" },
  { label: "Productos", module: "catalogo" },
  { label: "Categorías", module: "catalogo" },
  { label: "Imágenes", module: "catalogo" },
  { label: "Estados de ítem", module: "catalogo" },
  { label: "Proveedores", module: "catalogo" },
  { label: "Estados y ciudades", module: "catalogo" },
  { label: "Clientes", module: "clientes" },
  { label: "Bodegas", module: "bodegas" },
  { label: "Estantes y secciones", module: "estantes" },
  { label: "Asignaciones", module: "asignaciones" },
  { label: "Existencias", module: "existencias" },
  { label: "Lotes", module: "lotes" },
  { label: "Costos", module: "costos" },
  { label: "Compras", module: "compras" },
  { label: "Monedas", module: "monedas" },
  { label: "Impuestos", module: "impuestos" },
  { label: "Tipos de métodos de pago", module: "tipos_metodos_pago" },
  { label: "Métodos de pago", module: "metodos_pago" },
  { label: "Usuarios", module: "usuarios" },
  { label: "Roles", module: "roles" },
  { label: "Cuenta", module: "cuenta" },
];

export function getModulePermissionLevels(
  role: Role,
  module: ModuleKey,
): PermissionLevel[] {
  const permission = MODULE_PERMISSIONS[module];
  const levels: PermissionLevel[] = [];
  if (permission.read.includes(role)) levels.push("read");
  if (permission.write.includes(role)) levels.push("write");
  if (permission.own?.includes(role)) levels.push("own");
  return levels;
}

const LEVEL_CODES: Record<PermissionLevel, string> = {
  read: "L",
  write: "E",
  own: "P",
};

export function formatPermissionCode(levels: readonly PermissionLevel[]) {
  return levels.length > 0
    ? levels.map((level) => LEVEL_CODES[level]).join("/")
    : "—";
}
