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
  | "planning"
  | "documents"
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
  planning: "Kế hoạch",
  documents: "Tài liệu",
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
  // Thêm = giao việc cho người khác; Sửa / Xóa = đổi hạn, thu hồi việc đã giao. Xem: ai có
  // vai trò cũng có (màn cá nhân — resolvePermissions tự cấp), kể cả vai trò đã chỉnh ở /roles.
  { id: "my-tasks", label: "Việc của tôi", group: "overview", navId: "my-tasks", actions: CRUD },

  { id: "imports", label: "Nhập hàng", group: "imports", navId: "imports", actions: [...CRUD, "lock", "unlock", "export", "view-price"] },
  // Hóa đơn đại lý gắn vào chuyến (mig 0090, ba-spec docs/app-map/51-supplier-invoice-matching.ba-spec.md R12):
  // nạp sổ chi tiết NL + PDF, ánh xạ mã kế toán, xử lệch, xếp "Không thuộc chuyến". Xem = mở tab Hóa đơn,
  // file + tiền HĐ. Không có ⇒ chỉ thấy nhãn trạng thái HĐ trên chuyến. RLS riêng của 0090.
  { id: "imports.invoices", label: "Nhập hàng · Hóa đơn đại lý", group: "imports", navId: "imports", actions: CRUD },

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

  // Tài liệu công ty (mig 0072, spec docs/spec/quan-ly-tai-lieu.md). Xem: ai có vai trò cũng
  // có (resolvePermissions tự cấp) nhưng CHỈ thấy tài liệu của phòng mình (lib/documents.ts +
  // RLS 0072). Thêm = tạo tài liệu, ghi lần ban hành · Sửa = sửa thông tin, thu hồi ·
  // Xóa = xóa tài liệu chưa từng hiệu lực · Duyệt = xem xét / phê duyệt (đợt 2). Ma trận
  // mặc định KHÔNG cấp ô ghi nào ⇒ trước mắt chỉ admin làm (chủ dự án 2026-10-19).
  { id: "documents", label: "Tài liệu công ty", group: "documents", navId: "documents", actions: [...CRUD, "approve", "export"] },

  // Phòng Kế hoạch · Xuất khẩu (mig 0075, ba-spec docs/app-map/41-export-planning.ba-spec.md R11).
  // `export-plans` = hợp đồng, bản sửa, duyệt giấy, gia hạn, chuyến, bước, file. `.loading` = người
  // đóng hàng chỉ THÊM ảnh / sơ đồ cont (không thấy giá). `.payments` = bước 6: gửi bộ chứng từ, tiền về.
  // Máy chủ chặn bằng RLS riêng của 0075 (has_export_permission) — không qua trigger 0065.
  // `approve` (mig 0079): duyệt cuối đóng HĐ + mở lại HĐ — Trưởng / Phó phòng Kế hoạch (bỏ bước duyệt HĐ lúc lập 2026-10-29).
  { id: "export-plans", label: "Kế hoạch · Xuất khẩu", group: "planning", navId: "planning-export", actions: [...CRUD, "approve", "export", "view-price"] },
  { id: "export-plans.loading", label: "Xuất khẩu · Ảnh & sơ đồ đóng cont", group: "planning", navId: "planning-export", actions: ["view", "create"] },
  { id: "export-plans.payments", label: "Xuất khẩu · Chứng từ gửi khách & tiền về", group: "planning", navId: "planning-export", actions: CRUD },
  // Phòng Kế hoạch · Nhập khẩu (mig 0082, ba-spec docs/app-map/45-import-planning.ba-spec.md R9).
  // `import-plans` = hợp đồng nhập (có giá), lần nhập, chứng từ, file. `.receiving` = thủ kho ghi số
  // lượng thực nhập (đọc dòng hàng + lần nhập, KHÔNG thấy giá / chứng từ). RLS riêng của 0082.
  { id: "import-plans", label: "Kế hoạch · Nhập khẩu", group: "planning", navId: "planning-import", actions: [...CRUD, "export", "view-price"] },
  { id: "import-plans.receiving", label: "Nhập khẩu · Số lượng thực nhập", group: "planning", navId: "planning-import", actions: ["view", "create", "update"] },
  // Phòng Kế hoạch · Lệnh sản xuất (mig 0088, ba-spec docs/app-map/48-production-order.ba-spec.md R9).
  // Ghi = lập / phát hành / sửa / hủy lệnh. Chỉ `view` (quản đốc, thủ kho, BGĐ, kế toán) ⇒ chỉ đọc lệnh
  // ĐÃ phát hành (RLS 0088). Lệnh không chứa giá.
  { id: "production-orders", label: "Kế hoạch · Lệnh sản xuất", group: "planning", navId: "planning-production", actions: CRUD },

  { id: "catalog.suppliers", label: "Danh mục · Đại lý", group: "catalog", navId: "catalog", actions: CRUD },
  // NCC nhập khẩu (mig 0083, ba-spec 45 v2) — danh mục RIÊNG của Phòng Kế hoạch, khác Đại lý. Không nằm
  // trong CATALOG_TABS (catalogAll) ⇒ thủ kho / xưởng không thấy; cấp tay cho planner, BGĐ, kế toán.
  { id: "catalog.import-suppliers", label: "Danh mục · NCC nhập khẩu", group: "catalog", navId: "catalog", actions: CRUD },
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

/** Ma trận theo slug vai trò (vai trò tự tạo không nằm trong kiểu `Role`). */
export type RolePermissionMatrix = Readonly<Record<string, readonly PermissionGrant[]>>;

/**
 * Ma trận Đợt 1–3 = HÀNH VI TRƯỚC 2026-10-15: giám đốc / phó GĐ / kế toán / kế toán
 * trưởng làm được mọi thứ trừ màn admin; hai bộ phận mọi thứ trong tập màn của mình.
 * GIỮ LẠI làm đường lùi khẩn: đổi `DEFAULT_ROLE_PERMISSIONS = LEGACY_ROLE_PERMISSIONS`
 * rồi deploy là mọi người về quyền cũ (bảng quyền DB rỗng thì không cần gì thêm).
 */
export const LEGACY_ROLE_PERMISSIONS: RolePermissionMatrix = {
  director: FULL,
  "vice-director": FULL,
  "chief-accountant": FULL,
  accountant: FULL,
  "warehouse-keeper": grantAll(byNav(IMPORT_DEPARTMENT_NAV)),
  "team-leader": grantAll(byNav(PRODUCTION_DEPARTMENT_NAV)),
  "frozen-workshop-manager": grantAll(byNav(PRODUCTION_DEPARTMENT_NAV)),
  "fish-workshop-manager": grantAll(byNav(PRODUCTION_DEPARTMENT_NAV)),
  "dried-workshop-manager": grantAll(byNav(PRODUCTION_DEPARTMENT_NAV)),
  "vice-manager": grantAll(byNav(PRODUCTION_DEPARTMENT_NAV)),
  // Vai trò mới (0075) — đường lùi khẩn vẫn giữ đúng module của Phòng Kế hoạch.
  planner: grantAll(byNav(["planning-export", "planning-import", "planning-production", "catalog"])),
  "planning-head": grantAll(byNav(["planning-export", "planning-import", "planning-production", "catalog"])),
  "planning-deputy": grantAll(byNav(["planning-export", "planning-import", "planning-production", "catalog"])),
};

type RoleSpec = Readonly<Record<string, readonly PermissionAction[]>>;

/** Hành động ĐỌC — luôn phạm vi `all` (quản đốc xem cả 3 xưởng — spec §10 câu 2). */
const READ_ACTIONS: readonly PermissionAction[] = ["view", "export", "view-price"];

/**
 * Dựng ô quyền từ bảng "tài nguyên → hành động" (bỏ hành động tài nguyên không có).
 * `scopes`: phạm vi cho hành động GHI của từng tài nguyên (Đợt 5); đọc luôn `all`.
 */
function grantsOf(spec: RoleSpec, scopes: Readonly<Partial<Record<string, PermissionScope>>> = {}): PermissionGrant[] {
  return Object.entries(spec).flatMap(([resource, actions]) => {
    const r = PERMISSION_RESOURCES.find((x) => x.id === resource);
    if (!r || r.adminOnly) return [];
    return actions
      .filter((a) => r.actions.includes(a))
      .map((action) => ({ resource, action, scope: READ_ACTIONS.includes(action) ? "all" : (scopes[resource] ?? "all") }));
  });
}

/* ---------- Phạm vi dữ liệu (Đợt 5) ---------- */

/** Quản đốc ⇄ xưởng. Vai trò khác không gắn xưởng (phó QĐ, tổ trưởng là vai trò chung). */
export const WORKSHOP_BY_ROLE: Readonly<Partial<Record<Role, string>>> = {
  "frozen-workshop-manager": "Đông",
  "fish-workshop-manager": "Cá",
  "dried-workshop-manager": "Khô",
};

/** Người đang thao tác — để kiểm phạm vi `workshop` / `own` trên từng dòng. */
export interface ScopeContext {
  /** Xưởng của người dùng (suy từ vai trò quản đốc). */
  workshops: readonly string[];
  /** Tên có thể nằm ở cột "người ghi" (`operator`): họ tên, tên đăng nhập. */
  identities: readonly string[];
}

export const EMPTY_SCOPE_CONTEXT: ScopeContext = { workshops: [], identities: [] };

export function scopeContextFor(roles: readonly string[], fullName = "", username = ""): ScopeContext {
  return {
    workshops: [...new Set(roles.map((r) => WORKSHOP_BY_ROLE[r as Role]).filter((x): x is string => !!x))],
    identities: [fullName, username].map((x) => x.trim()).filter(Boolean),
  };
}

/** Một dòng (bản app) mang các cột phạm vi — thiếu cột thì phạm vi không áp. */
export interface ScopedRow {
  workshop?: unknown;
  operator?: unknown;
}

/**
 * Dòng có nằm trong phạm vi không. Dòng KHÔNG có cột tương ứng (bảng không lưu xưởng /
 * người ghi) hoặc cột rỗng (dữ liệu cũ) ⇒ cho qua — không chặn nhầm sổ cũ; spec §3c.
 * `own` khi THÊM dòng mới luôn được (dòng của chính mình).
 */
export function rowInScope(
  scope: PermissionScope,
  ctx: ScopeContext,
  row: ScopedRow | undefined,
  kind: "create" | "update" | "delete" = "update"
): boolean {
  if (scope === "all" || !row) return true;
  if (scope === "workshop") {
    const w = typeof row.workshop === "string" ? row.workshop.trim() : "";
    return !w || ctx.workshops.includes(w);
  }
  if (kind === "create") return true;
  const op = typeof row.operator === "string" ? row.operator.trim() : "";
  return !op || ctx.identities.some((id) => id.toLowerCase() === op.toLowerCase());
}

/** `can` + phạm vi trên một dòng cụ thể (lớp 2 dùng để ẩn nút ở dòng ngoài phạm vi). */
export function canOnRow(
  perms: EffectivePermissions,
  ctx: ScopeContext,
  resource: string,
  action: PermissionAction,
  row: ScopedRow | undefined,
  kind?: "create" | "update" | "delete"
): boolean {
  const scope = scopeOf(perms, resource, action);
  return scope !== null && rowInScope(scope, ctx, row, kind);
}

const VIEW: readonly PermissionAction[] = ["view"];
const VIEW_EXPORT: readonly PermissionAction[] = ["view", "export"];
const ALL_ACTIONS: readonly PermissionAction[] = PERMISSION_ACTIONS;
const CATALOG_TABS = [
  "catalog.products",
  "catalog.customers",
  "catalog.suppliers",
  "catalog.material-types",
  "catalog.batters",
  "catalog.storage-locations",
] as const;
const catalogAll = (actions: readonly PermissionAction[]) =>
  Object.fromEntries([...CATALOG_TABS.map((t) => [t, actions]), ["catalog.finished-goods", VIEW]]);

/** Ban giám đốc: CHỈ xem + xuất, thấy giá (spec §7). */
const DIRECTOR: RoleSpec = {
  dashboard: VIEW_EXPORT,
  imports: ["view", "export", "view-price"],
  "imports.invoices": VIEW,
  wip: VIEW_EXPORT,
  packaging: VIEW,
  qc: VIEW,
  qr: VIEW_EXPORT,
  warehouse: VIEW,
  orders: VIEW,
  sales: ["view", "view-price"],
  balancing: ["view", "export", "view-price"],
  "monthly-stock": VIEW_EXPORT,
  reconciliation: VIEW_EXPORT,
  "nxt-material": VIEW_EXPORT,
  nxt: VIEW_EXPORT,
  "nxt-warehouse": VIEW_EXPORT,
  "production-report": VIEW_EXPORT,
  "export-report": VIEW_EXPORT,
  "export-plans": ["view", "export", "view-price"],
  "export-plans.loading": VIEW,
  "export-plans.payments": VIEW,
  "import-plans": ["view", "export", "view-price"],
  "import-plans.receiving": VIEW,
  "production-orders": VIEW,
  "catalog.import-suppliers": VIEW,
  ...catalogAll(VIEW),
};

/** Kế toán trưởng: toàn quyền sổ kế toán, là người MỞ LẠI / XÓA sổ đã ghi. */
const CHIEF_ACCOUNTANT: RoleSpec = {
  dashboard: VIEW_EXPORT,
  "my-tasks": ["view", "create", "update", "delete"],
  imports: ["view", "update", "delete", "lock", "unlock", "export", "view-price"],
  "imports.invoices": ["view", "create", "update", "delete"],
  wip: ["view", "unlock", "export"],
  packaging: VIEW,
  qc: VIEW,
  qr: VIEW_EXPORT,
  warehouse: VIEW,
  orders: ["view", "create", "update", "delete"],
  sales: ["view", "create", "update", "delete", "lock", "unlock", "view-price"],
  balancing: ALL_ACTIONS,
  "monthly-stock": ["view", "create", "update", "delete", "import", "export"],
  reconciliation: ["view", "create", "update", "delete", "export"],
  "nxt-material": ["view", "create", "update", "delete", "export"],
  nxt: ["view", "create", "update", "delete", "export"],
  "nxt-warehouse": ["view", "import", "export"],
  "production-report": VIEW_EXPORT,
  "export-report": VIEW_EXPORT,
  // Tài liệu công ty: thêm / sửa / ghi lần ban hành / đính file / xóa tài liệu chưa ban hành
  // (chủ dự án cấp 2026-10-20, mig 0073). Duyệt (approve, đợt 2) để Ban giám đốc.
  documents: ["view", "create", "update", "delete", "export"],
  // Xuất khẩu: xem hợp đồng + giá; ghi bước 6 (gửi bộ chứng từ, tiền về — Q5).
  "export-plans": ["view", "export", "view-price"],
  "export-plans.loading": VIEW,
  "export-plans.payments": ["view", "create", "update", "delete"],
  "import-plans": ["view", "export", "view-price"],
  "import-plans.receiving": VIEW,
  "production-orders": VIEW,
  "catalog.import-suppliers": VIEW,
  ...catalogAll(["view", "create", "update", "delete"]),
};

/**
 * Kế toán: ghi sổ, KHÔNG xóa, KHÔNG mở lại. Chủ dự án nới 2026-10-15: kế toán (Trúc)
 * đang là người nhập liệu chính ⇒ có Thêm / Sửa / Chốt ở Nhập hàng + Sản xuất TP.
 */
const ACCOUNTANT: RoleSpec = {
  dashboard: VIEW_EXPORT,
  "my-tasks": ["view", "create", "update"],
  imports: ["view", "create", "update", "lock", "export", "view-price"],
  "imports.invoices": ["view", "create", "update"],
  wip: ["view", "create", "update", "lock", "export"],
  packaging: VIEW,
  qr: VIEW_EXPORT,
  warehouse: VIEW,
  orders: ["view", "create", "update"],
  sales: ["view", "create", "update", "view-price"],
  balancing: ["view", "create", "update", "export", "view-price"],
  "monthly-stock": ["view", "create", "update", "import", "export"],
  reconciliation: ["view", "create", "update", "export"],
  "nxt-material": ["view", "create", "update", "export"],
  nxt: ["view", "create", "update", "export"],
  "nxt-warehouse": ["view", "import", "export"],
  "production-report": VIEW_EXPORT,
  "export-report": VIEW_EXPORT,
  "export-plans": ["view", "export", "view-price"],
  "export-plans.loading": VIEW,
  // Kế toán không xóa (luật chung của vai trò) — ghi sai tiền về thì KTT / phòng KH xóa.
  "export-plans.payments": ["view", "create", "update"],
  "import-plans": ["view", "export", "view-price"],
  "import-plans.receiving": VIEW,
  "production-orders": VIEW,
  "catalog.import-suppliers": VIEW,
  ...catalogAll(["view", "create", "update"]),
};

/** Thủ kho nhập hàng: toàn quyền Nhập hàng (thấy giá nhập vì chính họ ghi giá). */
const WAREHOUSE_KEEPER: RoleSpec = {
  imports: ["view", "create", "update", "delete", "lock", "export", "view-price"],
  qr: ["view", "create", "export"],
  warehouse: VIEW,
  "monthly-stock": VIEW,
  "nxt-material": VIEW,
  nxt: VIEW,
  "nxt-warehouse": VIEW,
  ...catalogAll(VIEW),
  "catalog.suppliers": ["view", "create", "update"],
  "catalog.material-types": ["view", "create", "update"],
  // Đóng cont: chỉ THÊM ảnh lớp hàng / seal / sơ đồ (A2) — không thấy giá, không sửa bước khác.
  "export-plans.loading": ["view", "create"],
  // Nhập khẩu: ghi số lượng thực nhập theo invoice (ba-spec 45 NI6) — không thấy giá / chứng từ.
  "import-plans.receiving": ["view", "create", "update"],
  // Lệnh sản xuất: nơi nhận — đọc lệnh đã phát hành, NL nhập khẩu dự kiến (ba-spec 48 LS4).
  "production-orders": VIEW,
};

/** Quản đốc xưởng: toàn quyền khâu sản xuất, MỞ LẠI ngày SX (xưởng mình — phạm vi là Đợt 5). Không thấy giá. */
const MANAGER: RoleSpec = {
  dashboard: VIEW,
  "my-tasks": ["view", "create", "update", "delete"],
  wip: ["view", "create", "update", "delete", "lock", "unlock", "export"],
  packaging: ["view", "create", "update", "delete"],
  qc: ["view", "create", "update", "lock", "unlock"],
  qr: ["view", "create", "update", "export"],
  warehouse: ["view", "approve"],
  "nxt-material": VIEW,
  nxt: VIEW,
  "nxt-warehouse": VIEW,
  "production-report": VIEW_EXPORT,
  "export-report": VIEW_EXPORT,
  ...catalogAll(VIEW),
  "catalog.products": ["view", "create", "update"],
  "catalog.batters": ["view", "create", "update"],
  "export-plans.loading": ["view", "create"],
  "production-orders": VIEW,
};

/** Phó quản đốc: ghi thành phẩm hằng ngày; được XÓA dòng ghi nhầm (chủ dự án 2026-10-15), không chốt / mở lại. */
const VICE_MANAGER: RoleSpec = {
  dashboard: VIEW,
  "my-tasks": ["view", "create", "update"],
  wip: ["view", "create", "update", "delete"],
  packaging: ["view", "create", "update"],
  qc: ["view", "create", "update"],
  qr: ["view", "create"],
  warehouse: ["view", "approve"],
  "production-report": VIEW_EXPORT,
  "export-report": VIEW_EXPORT,
  "export-plans.loading": ["view", "create"],
  "production-orders": VIEW,
  ...catalogAll(VIEW),
};

/** Tổ trưởng: ghi sản lượng / đóng gói / QC (dòng của mình — phạm vi là Đợt 5). */
const TEAM_LEADER: RoleSpec = {
  wip: ["view", "create", "update"],
  packaging: ["view", "create", "update"],
  qc: ["view", "create", "update"],
  qr: ["view", "create"],
  warehouse: VIEW,
  ...catalogAll(VIEW),
};

/**
 * Nhân viên Kế hoạch (mig 0075, Q11 chủ dự án đồng ý 2026-10-20): toàn quyền module Xuất khẩu,
 * ghi bước 6 cùng kế toán (A1), thêm / sửa khách hàng (thông tin xuất khẩu). Thấy giá.
 * Xem Đơn đặt + báo cáo đơn xuất để đối chiếu; không ghi sổ kho / sản xuất / kế toán.
 */
const PLANNER: RoleSpec = {
  "my-tasks": ["view", "create", "update", "delete"],
  "export-plans": ["view", "create", "update", "delete", "export", "view-price"],
  "export-plans.loading": ["view", "create"],
  "export-plans.payments": ["view", "create", "update", "delete"],
  "import-plans": ["view", "create", "update", "delete", "export", "view-price"],
  "import-plans.receiving": ["view", "create", "update"],
  "production-orders": ["view", "create", "update", "delete"],
  orders: VIEW,
  "export-report": VIEW_EXPORT,
  qr: VIEW,
  warehouse: VIEW,
  ...catalogAll(VIEW),
  "catalog.customers": ["view", "create", "update"],
  // Đối tác nhập khẩu = danh mục NCC nhập khẩu RIÊNG (ba-spec 45 v2 R15) — thêm / sửa ngay trong ô chọn.
  "catalog.import-suppliers": ["view", "create", "update", "delete"],
};

/**
 * Trưởng / Phó phòng Kế hoạch (mig 0079, chủ dự án chốt 2026-10-28): mọi việc của Nhân viên Kế
 * hoạch + DUYỆT — duyệt bản hợp đồng, duyệt cuối đóng HĐ, mở lại HĐ đã đóng. Nhân viên Kế hoạch
 * không có `approve`: lập HĐ, đính kèm, ghi chuyến (RLS 0079 chặn ở máy chủ).
 */
const PLANNING_HEAD: RoleSpec = {
  ...PLANNER,
  "export-plans": [...(PLANNER["export-plans"] ?? []), "approve"],
};

/**
 * Phạm vi Đợt 5 (2026-10-15): quản đốc chỉ GHI / chốt / mở lại / duyệt dòng XƯỞNG MÌNH ở
 * các khâu có lưu xưởng; tổ trưởng chỉ sửa dòng MÌNH GHI ở /wip (bảng có cột người ghi).
 * Đóng gói / QC không lưu người ghi ⇒ tổ trưởng ở đó vẫn `all`. Phó QĐ, tổ trưởng không gắn
 * xưởng nên chưa giới hạn theo xưởng (cần gán xưởng cho từng người — để sau).
 */
const MANAGER_SCOPES: Readonly<Partial<Record<string, PermissionScope>>> = {
  wip: "workshop",
  packaging: "workshop",
  qc: "workshop",
  warehouse: "workshop",
};
const TEAM_LEADER_SCOPES: Readonly<Partial<Record<string, PermissionScope>>> = { wip: "own" };

/**
 * Ma trận ĐANG ÁP — Đợt 4 (2026-10-15): ma trận mục tiêu spec §7 + 2 điều chỉnh chủ dự
 * án chốt (kế toán có Thêm/Sửa/Chốt ở Nhập hàng + SX TP; phó QĐ có Xóa ở SX TP).
 * `admin` không có dòng — admin luôn toàn quyền, không đọc ma trận. Vai trò đã chỉnh ở
 * /roles (bảng app_roles) thắng ma trận này.
 */
export const DEFAULT_ROLE_PERMISSIONS: RolePermissionMatrix = {
  director: grantsOf(DIRECTOR),
  "vice-director": grantsOf(DIRECTOR),
  "chief-accountant": grantsOf(CHIEF_ACCOUNTANT),
  accountant: grantsOf(ACCOUNTANT),
  "warehouse-keeper": grantsOf(WAREHOUSE_KEEPER),
  "team-leader": grantsOf(TEAM_LEADER, TEAM_LEADER_SCOPES),
  "frozen-workshop-manager": grantsOf(MANAGER, MANAGER_SCOPES),
  "fish-workshop-manager": grantsOf(MANAGER, MANAGER_SCOPES),
  "dried-workshop-manager": grantsOf(MANAGER, MANAGER_SCOPES),
  "vice-manager": grantsOf(VICE_MANAGER),
  planner: grantsOf(PLANNER),
  "planning-head": grantsOf(PLANNING_HEAD),
  "planning-deputy": grantsOf(PLANNING_HEAD),
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

/** Tài nguyên màn "Việc của tôi" — mọi người có vai trò đều xem được. */
export const MY_TASKS_RESOURCE = "my-tasks";
/** Tài nguyên "Tài liệu công ty" — mọi người có vai trò đều mở được màn; tài liệu nào thấy do phòng ban quyết. */
export const DOCUMENTS_RESOURCE = "documents";

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
 * 4. chỉnh riêng: chặn > cho > vai trò; 5. có hành động bất kỳ ⇒ có `view`;
 * 6. có quyền bất kỳ ⇒ xem được "Việc của tôi" và mở được "Tài liệu công ty".
 */
/**
 * Quyền còn đang nạp ⇒ CHƯA vẽ khung / sidebar (lỗi 2026-10-28: nạp dở mà vẽ thì dùng tạm ma trận
 * mặc định, vai trò đã chỉnh ở /roles hoặc người bị chặn riêng thấy mục nav thừa chớp lên rồi ẩn).
 * Không đăng nhập máy chủ / chưa có hồ sơ / admin ⇒ không chờ. Bảng lỗi ("error") ⇒ hết chờ
 * (dùng bản sao dưới máy).
 */
export function isPermissionLoading(input: {
  requiresLogin: boolean;
  hasProfile: boolean;
  isAdmin: boolean;
  tableStatuses: readonly ("loading" | "ready" | "error")[];
}): boolean {
  if (!input.requiresLogin || !input.hasProfile || input.isAdmin) return false;
  return input.tableStatuses.some((st) => st === "loading");
}

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
  // "Việc của tôi" là màn cá nhân: ai đã có quyền ở đâu đó cũng xem được — kể cả vai trò
  // đã chỉnh ở /roles (ma trận DB không có ô này). Không quyền gì ⇒ vẫn "Chưa được cấp
  // quyền" (không mở app chỉ để xem một màn trống). Chặn riêng `view` ở dưới vẫn gỡ được.
  for (const o of overrides) if (o.effect === "allow") add(o.resource, o.action, o.scope ?? "all");
  if (grants.size > 0) {
    add(MY_TASKS_RESOURCE, "view", "all");
    add(DOCUMENTS_RESOURCE, "view", "all");
  }

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
