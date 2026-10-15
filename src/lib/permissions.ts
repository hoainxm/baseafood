// ============================================================
// Tên file: src/lib/permissions.ts
// Tên tiếng Việt: Phân quyền theo chức năng (xem · thêm · sửa · xóa · chốt · mở lại …)
// Description: Permission resource registry, default role matrix and the pure resolver
// ============================================================
// Spec: docs/spec/role-permissions.md. Thuần (không React, không localStorage):
// mọi nơi khác chỉ hỏi `can(perms, resource, action)`.
//
// Đợt 1: ma trận mặc định nằm trong code và GIỮ ĐÚNG hành vi trước đây
// (nav-access 2 bộ phận). Đợt 2 đọc thêm bảng `role_permissions` /
// `user_permissions` — bảng rỗng hay lỗi thì quay về ma trận này.
import type { AppRole, Role, RolePermission, UserPermission } from "@/types";
import { ROLES } from "@/types";

/** 10 hành động cố định (spec §3b). */
export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "lock",
  "unlock",
  "approve",
  "import",
  "export",
  "view-price",
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** Nhãn tiếng Việt cho màn quản lý quyền. */
export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Xem",
  create: "Thêm",
  update: "Sửa",
  delete: "Xóa",
  lock: "Chốt",
  unlock: "Mở lại",
  approve: "Duyệt",
  import: "Nạp file",
  export: "Xuất / In",
  "view-price": "Xem giá",
};

/** Phạm vi dòng (spec §3c). Đợt 1 mọi ô là `all`. Thứ tự = rộng → hẹp. */
export const PERMISSION_SCOPES = ["all", "workshop", "own"] as const;
export type PermissionScope = (typeof PERMISSION_SCOPES)[number];

export type ResourceGroup =
  | "overview"
  | "imports"
  | "production"
  | "warehouse"
  | "sales"
  | "accounting"
  | "reports"
  | "catalog"
  | "system";

export const RESOURCE_GROUP_LABELS: Record<ResourceGroup, string> = {
  overview: "Tổng quan",
  imports: "Nhập hàng",
  production: "Sản xuất",
  warehouse: "Kho",
  sales: "Bán hàng",
  accounting: "Kế toán",
  reports: "Báo cáo",
  catalog: "Danh mục",
  system: "Hệ thống",
};

export interface PermissionResource {
  /** Khóa ổn định — đổi là mất quyền đã lưu (Đợt 2). */
  id: string;
  label: string;
  group: ResourceGroup;
  /** Mục nav / route mà quyền `view` mở ra; `null` = không phải một màn. */
  navId: string | null;
  /** Chỉ các hành động áp dụng được — ô khác không hiện trên ma trận. */
  actions: readonly PermissionAction[];
  /** Chỉ admin; không vai trò / chỉnh riêng nào cấp được (chống tự khóa, chống leo quyền). */
  adminOnly?: boolean;
}

const CRUD = ["view", "create", "update", "delete"] as const;

/** Sổ đăng ký tài nguyên (spec §3a). Thêm màn mới ⇒ thêm ở đây (test bắt). */
export const PERMISSION_RESOURCES: readonly PermissionResource[] = [
  { id: "dashboard", label: "Tổng quan", group: "overview", navId: "dashboard", actions: ["view", "export"] },

  { id: "imports", label: "Nhập hàng", group: "imports", navId: "imports", actions: [...CRUD, "lock", "unlock", "export", "view-price"] },

  { id: "wip", label: "Sản xuất thành phẩm", group: "production", navId: "wip", actions: [...CRUD, "lock", "unlock", "export"] },
  { id: "packaging", label: "Đóng gói", group: "production", navId: "packaging", actions: CRUD },
  { id: "qc", label: "Kiểm tra QC", group: "production", navId: "qc", actions: [...CRUD, "lock", "unlock"] },
  { id: "qr", label: "Mã lô QR", group: "production", navId: "qr", actions: [...CRUD, "export"] },

  { id: "warehouse", label: "Kho dự trữ", group: "warehouse", navId: "warehouse", actions: ["view", "approve", "update"] },
  { id: "orders", label: "Đơn đặt", group: "warehouse", navId: "orders", actions: CRUD },

  { id: "sales", label: "Bán hàng", group: "sales", navId: "sales", actions: [...CRUD, "lock", "unlock", "view-price"] },

  { id: "balancing", label: "Cân đối kỳ", group: "accounting", navId: "balancing", actions: [...CRUD, "lock", "unlock", "export", "view-price"] },
  { id: "monthly-stock", label: "Sổ kho theo tháng", group: "accounting", navId: "monthly-stock", actions: [...CRUD, "import", "export"] },
  { id: "reconciliation", label: "Đối soát hóa đơn điện tử", group: "accounting", navId: "reconciliation", actions: [...CRUD, "export"] },
  // Thêm/sửa/xóa = tồn đầu khai tay (material_opening_stock / finished_goods_opening_stock).
  { id: "nxt-material", label: "Tồn kho nguyên liệu", group: "accounting", navId: "nxt-material", actions: [...CRUD, "export"] },
  { id: "nxt", label: "Tồn kho thành phẩm", group: "accounting", navId: "nxt", actions: [...CRUD, "export"] },
  { id: "nxt-warehouse", label: "Nhập xuất tồn kho", group: "accounting", navId: "nxt-warehouse", actions: ["view", "import", "export"] },

  { id: "production-report", label: "Báo cáo thành phẩm", group: "reports", navId: "production-report", actions: ["view", "export"] },
  { id: "export-report", label: "Báo cáo đơn xuất", group: "reports", navId: "export-report", actions: ["view", "export"] },

  { id: "catalog.suppliers", label: "Danh mục · Đại lý", group: "catalog", navId: "catalog", actions: CRUD },
  { id: "catalog.customers", label: "Danh mục · Khách hàng", group: "catalog", navId: "catalog", actions: CRUD },
  { id: "catalog.material-types", label: "Danh mục · Loại nguyên liệu", group: "catalog", navId: "catalog", actions: CRUD },
  { id: "catalog.products", label: "Danh mục · Mặt hàng", group: "catalog", navId: "catalog", actions: CRUD },
  { id: "catalog.batters", label: "Danh mục · Bột tẩm", group: "catalog", navId: "catalog", actions: CRUD },
  { id: "catalog.storage-locations", label: "Danh mục · Kho lưu", group: "catalog", navId: "catalog", actions: CRUD },
  { id: "catalog.finished-goods", label: "Danh mục · Thành phẩm (141 mã)", group: "catalog", navId: "catalog", actions: ["view", "update"] },

  { id: "admin", label: "Quản trị hệ thống", group: "system", navId: "admin", actions: ["view"], adminOnly: true },
  { id: "users", label: "Người dùng", group: "system", navId: "users", actions: ["view", "update"], adminOnly: true },
  { id: "roles", label: "Vai trò & quyền", group: "system", navId: "roles", actions: ["view", "update"], adminOnly: true },
  { id: "audit", label: "Nhật ký thao tác", group: "system", navId: "audit", actions: ["view", "export"], adminOnly: true },
  { id: "demo-mode", label: "Chế độ demo", group: "system", navId: null, actions: ["view", "update"], adminOnly: true },
];

const RESOURCE_BY_ID = new Map(PERMISSION_RESOURCES.map((r) => [r.id, r]));

export function getResource(id: string): PermissionResource | undefined {
  return RESOURCE_BY_ID.get(id);
}

/** Mọi mục nav có trong sổ đăng ký, theo thứ tự khai. */
export const PERMISSION_NAV_IDS: readonly string[] = [
  ...new Set(PERMISSION_RESOURCES.map((r) => r.navId).filter((x): x is string => !!x)),
];

/* ---------- Ma trận ---------- */

export interface PermissionGrant {
  resource: string;
  action: PermissionAction;
  scope: PermissionScope;
}

/** Chỉnh riêng một người (Đợt 2, bảng `user_permissions`). */
export interface UserPermissionOverride {
  resource: string;
  action: PermissionAction;
  effect: "allow" | "deny";
  scope?: PermissionScope;
}

/** Cấp trọn mọi hành động áp dụng được của các tài nguyên khớp `match`. */
function grantAll(match: (r: PermissionResource) => boolean): PermissionGrant[] {
  return PERMISSION_RESOURCES.filter((r) => !r.adminOnly && match(r)).flatMap((r) =>
    r.actions.map((action) => ({ resource: r.id, action, scope: "all" as const }))
  );
}

const byNav = (navIds: readonly string[]) => (r: PermissionResource) =>
  r.navId !== null && navIds.includes(r.navId);

// Hai bộ phận vận hành đầu chuỗi (họp 2026-08-22) — đúng tập màn của nav-access cũ.
const IMPORT_DEPARTMENT_NAV = ["imports", "warehouse", "nxt-material", "monthly-stock", "qr", "catalog"];
const PRODUCTION_DEPARTMENT_NAV = ["wip", "packaging", "warehouse", "qc", "qr", "catalog"];

const FULL = grantAll(() => true);
const IMPORT_DEPARTMENT = grantAll(byNav(IMPORT_DEPARTMENT_NAV));
const PRODUCTION_DEPARTMENT = grantAll(byNav(PRODUCTION_DEPARTMENT_NAV));

/**
 * Ma trận mặc định Đợt 1 = HÀNH VI TRƯỚC ĐÂY: vai trò không giới hạn (giám đốc,
 * phó GĐ, kế toán, kế toán trưởng) làm được mọi thứ trừ màn của admin; hai bộ
 * phận làm được mọi thứ trong tập màn của mình. Siết thật là Đợt 4 (spec §7).
 * `admin` không có dòng — admin luôn toàn quyền, không đọc ma trận.
 */
/** Ma trận theo slug vai trò (vai trò tự tạo không nằm trong kiểu `Role`). */
export type RolePermissionMatrix = Readonly<Record<string, readonly PermissionGrant[]>>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = {
  director: FULL,
  "vice-director": FULL,
  "chief-accountant": FULL,
  accountant: FULL,
  "warehouse-keeper": IMPORT_DEPARTMENT,
  "team-leader": PRODUCTION_DEPARTMENT,
  "manager-dong": PRODUCTION_DEPARTMENT,
  "manager-ca": PRODUCTION_DEPARTMENT,
  "manager-kho": PRODUCTION_DEPARTMENT,
  "vice-manager": PRODUCTION_DEPARTMENT,
};

/* ---------- Tính quyền thực ---------- */

export interface EffectivePermissions {
  isAdmin: boolean;
  /** Có ít nhất một vai trò. Không có ⇒ màn "Chưa được cấp quyền". */
  hasRoles: boolean;
  /** Khóa `resource:action` → phạm vi. Admin để trống (luôn được). */
  grants: ReadonlyMap<string, PermissionScope>;
}

const keyOf = (resource: string, action: PermissionAction) => `${resource}:${action}`;

const widerScope = (a: PermissionScope, b: PermissionScope): PermissionScope =>
  PERMISSION_SCOPES.indexOf(a) <= PERMISSION_SCOPES.indexOf(b) ? a : b;

/** Ô hợp lệ: tài nguyên có thật, hành động áp dụng được, không phải màn của admin. */
function isGrantable(resource: string, action: PermissionAction): boolean {
  const r = RESOURCE_BY_ID.get(resource);
  return !!r && !r.adminOnly && r.actions.includes(action);
}

export interface ResolveInput {
  roles: readonly Role[];
  isAdmin: boolean;
  /** Mặc định = DEFAULT_ROLE_PERMISSIONS. Đợt 2: `buildRolePermissions(…)` từ DB. */
  rolePermissions?: RolePermissionMatrix;
  overrides?: readonly UserPermissionOverride[];
}

/**
 * Quyền thực của một người (spec §3d):
 * 1. admin ⇒ toàn quyền; 2. không vai trò ⇒ không quyền nào;
 * 3. HỢP quyền các vai trò, phạm vi lấy rộng nhất; vai trò lạ không có quyền;
 * 4. chỉnh riêng: chặn > cho > vai trò; 5. có hành động bất kỳ ⇒ có `view`.
 */
export function resolvePermissions({
  roles,
  isAdmin,
  rolePermissions = DEFAULT_ROLE_PERMISSIONS,
  overrides = [],
}: ResolveInput): EffectivePermissions {
  const hasRoles = roles.length > 0;
  if (isAdmin) return { isAdmin: true, hasRoles, grants: new Map() };
  const grants = new Map<string, PermissionScope>();
  if (!hasRoles) return { isAdmin: false, hasRoles, grants };

  const add = (resource: string, action: PermissionAction, scope: PermissionScope) => {
    if (!isGrantable(resource, action)) return;
    const k = keyOf(resource, action);
    const cur = grants.get(k);
    grants.set(k, cur ? widerScope(cur, scope) : scope);
  };

  for (const role of roles) for (const g of rolePermissions[role] ?? []) add(g.resource, g.action, g.scope);

  for (const o of overrides) if (o.effect === "allow") add(o.resource, o.action, o.scope ?? "all");
  for (const o of overrides) if (o.effect === "deny") grants.delete(keyOf(o.resource, o.action));

  // Bất biến: làm được gì đó ⇒ xem được (tick Sửa mà không Xem là vô nghĩa).
  // Chặn riêng `view` thì gỡ luôn mọi hành động của tài nguyên đó.
  const deniedView = new Set(overrides.filter((o) => o.effect === "deny" && o.action === "view").map((o) => o.resource));
  for (const k of [...grants.keys()]) {
    const resource = k.slice(0, k.lastIndexOf(":"));
    if (deniedView.has(resource)) {
      grants.delete(k);
      continue;
    }
    const v = keyOf(resource, "view");
    if (!grants.has(v)) grants.set(v, grants.get(k)!);
  }
  return { isAdmin: false, hasRoles, grants };
}

/** Câu hỏi duy nhất mọi nơi dùng. */
export function can(perms: EffectivePermissions, resource: string, action: PermissionAction): boolean {
  const r = RESOURCE_BY_ID.get(resource);
  if (!r || !r.actions.includes(action)) return false;
  if (perms.isAdmin) return true;
  return perms.grants.has(keyOf(resource, action));
}

/** Phạm vi của một ô (null = không có quyền). */
export function scopeOf(
  perms: EffectivePermissions,
  resource: string,
  action: PermissionAction
): PermissionScope | null {
  if (!can(perms, resource, action)) return null;
  return perms.isAdmin ? "all" : (perms.grants.get(keyOf(resource, action)) ?? null);
}

/** Mục nav thấy được: có `view` ở ít nhất một tài nguyên của mục đó. */
export function visibleNavIds(perms: EffectivePermissions): Set<string> {
  const ids = new Set<string>();
  for (const r of PERMISSION_RESOURCES) if (r.navId && can(perms, r.id, "view")) ids.add(r.navId);
  return ids;
}

/** Quyền toàn bộ (chạy localStorage không đăng nhập — giữ hành vi offline cũ: mọi màn trừ màn admin). */
export const OFFLINE_PERMISSIONS: EffectivePermissions = {
  isAdmin: false,
  hasRoles: true,
  grants: new Map(FULL.map((g) => [keyOf(g.resource, g.action), g.scope])),
};

/* ---------- Đợt 2: ma trận + chỉnh riêng đọc từ DB (mig 0062) ---------- */

const isAction = (x: string): x is PermissionAction => (PERMISSION_ACTIONS as readonly string[]).includes(x);
const toScope = (x: string): PermissionScope =>
  (PERMISSION_SCOPES as readonly string[]).includes(x) ? (x as PermissionScope) : "all";

export const rolePermissionId = (roleId: string, resource: string, action: string) => `${roleId}|${resource}|${action}`;
export const userPermissionId = (userId: string, resource: string, action: string) => `${userId}|${resource}|${action}`;

/**
 * Ma trận dùng thật: vai trò CÓ dòng `app_roles` (đã chỉnh / tự tạo) lấy đúng các ô
 * ở `role_permissions` (kể cả rỗng = không quyền gì); vai trò chưa chỉnh giữ mặc
 * định. Bảng rỗng ⇒ y như Đợt 1. Dòng hỏng (hành động lạ) bị bỏ qua.
 */
export function buildRolePermissions(
  appRoles: readonly AppRole[],
  rows: readonly RolePermission[],
  defaults: RolePermissionMatrix = DEFAULT_ROLE_PERMISSIONS
): RolePermissionMatrix {
  if (!appRoles.length) return defaults;
  const matrix: Record<string, PermissionGrant[]> = { ...defaults } as Record<string, PermissionGrant[]>;
  for (const r of appRoles) matrix[r.id] = [];
  for (const row of rows) {
    const grants = matrix[row.roleId];
    if (!grants || !appRoles.some((r) => r.id === row.roleId) || !isAction(row.action)) continue;
    grants.push({ resource: row.resource, action: row.action, scope: toScope(row.scope) });
  }
  return matrix;
}

/** Chỉnh riêng của một người. */
export function buildUserOverrides(userId: string, rows: readonly UserPermission[]): UserPermissionOverride[] {
  return rows
    .filter((r) => r.userId === userId && isAction(r.action))
    .map((r) => ({ resource: r.resource, action: r.action as PermissionAction, effect: r.effect, scope: toScope(r.scope) }));
}

/** Ô của một vai trò trong ma trận (để dựng lưới tick). */
export function roleGrantSet(matrix: RolePermissionMatrix, roleId: string): Set<string> {
  return new Set((matrix[roleId] ?? []).map((g) => keyOf(g.resource, g.action)));
}

export const permissionKey = keyOf;

/** Nguồn của một ô quyền thực — cho màn "Quyền của người này". */
export type PermissionSource = "admin" | "role" | "allow" | "deny" | "none";

export function explainPermission(
  roles: readonly string[],
  isAdmin: boolean,
  matrix: RolePermissionMatrix,
  overrides: readonly UserPermissionOverride[],
  resource: string,
  action: PermissionAction
): { granted: boolean; source: PermissionSource; fromRoles: string[] } {
  const perms = resolvePermissions({ roles: roles as Role[], isAdmin, rolePermissions: matrix, overrides });
  const granted = can(perms, resource, action);
  if (isAdmin) return { granted, source: "admin", fromRoles: [] };
  const own = overrides.find((o) => o.resource === resource && o.action === action);
  const fromRoles = roles.filter((r) => (matrix[r] ?? []).some((g) => g.resource === resource && g.action === action));
  if (own?.effect === "deny") return { granted, source: "deny", fromRoles };
  if (own?.effect === "allow") return { granted, source: "allow", fromRoles };
  return { granted, source: granted ? "role" : "none", fromRoles };
}

/* ---------- Vai trò: nhãn + danh sách chọn (hệ thống + tự tạo) ---------- */

export interface RoleOption {
  value: string;
  label: string;
  isSystem: boolean;
}

/** 11 vai trò hệ thống (nhãn trong code) + vai trò admin tự tạo (nhãn ở `app_roles`). */
export function listRoleOptions(appRoles: readonly AppRole[]): RoleOption[] {
  const system = ROLES.map((r) => ({ value: r.value as string, label: r.label, isSystem: true }));
  const known = new Set(system.map((r) => r.value));
  const custom = [...appRoles]
    .filter((r) => !known.has(r.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"))
    .map((r) => ({ value: r.id, label: r.name || r.id, isSystem: false }));
  return [...system, ...custom];
}

/** "Kế toán, Quản đốc xưởng Đông" — kể cả vai trò tự tạo; rỗng ⇒ "Chưa gán". */
export function roleNames(roles: readonly string[], appRoles: readonly AppRole[]): string {
  if (!roles.length) return "Chưa gán";
  const options = listRoleOptions(appRoles);
  return roles.map((r) => options.find((o) => o.value === r)?.label ?? r).join(", ");
}

/** Trang chủ riêng của vai trò đã chỉnh (cột `home_route`), bỏ ô trống. */
export function homeRoutesFromAppRoles(appRoles: readonly AppRole[]): Record<string, string> {
  return Object.fromEntries(appRoles.filter((r) => r.homeRoute).map((r) => [r.id, r.homeRoute]));
}
