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
  | "usuarios"
  | "cuenta";

type ModulePermission = {
  read: readonly Role[];
  write: readonly Role[];
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
  usuarios: { read: ["admin"], write: ["admin"] },
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

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function getRoleLabel(name: string) {
  return isRole(name) ? ROLE_LABELS[name] : name;
}

export function canReadModule(role: Role, module: ModuleKey) {
  return MODULE_PERMISSIONS[module].read.includes(role);
}

export function canWriteModule(role: Role, module: ModuleKey) {
  return MODULE_PERMISSIONS[module].write.includes(role);
}
