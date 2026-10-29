// ============================================================
// Tên file: src/lib/writePermissions.ts
// Tên tiếng Việt: Chốt quyền khi GHI dữ liệu (lớp 3 — lưới an toàn)
// Description: Maps every synced table to the permissions a row change needs; pure
// ============================================================
// Spec docs/spec/role-permissions.md §4c + §5 lớp 3 (Đợt 3, 2026-10-15). Mọi lần ghi
// đều qua `useTable.write` (lib/repo.ts) — đây là chốt duy nhất: màn nào quên ẩn nút
// (lớp 2) thì số vẫn không lọt vào sổ. Thuần, không React.
//
// Luật mỗi bảng = danh sách màn THẬT SỰ ghi bảng đó (rà code 2026-10-15). Có quyền
// ở MỘT trong các màn đó là đủ (VD Cân đối ghi lại `production_wips`, Đơn đặt ghi
// `sales_items`). Đợt 4 siết ma trận thì luật này vẫn đúng; muốn mịn hơn (theo cột)
// thì sửa ở đây.
import {
  EMPTY_SCOPE_CONTEXT,
  PERMISSION_ACTION_LABELS,
  getResource,
  rowInScope,
  scopeOf,
  type EffectivePermissions,
  type PermissionAction,
  type ScopeContext,
} from "@/lib/permissions";

type Row = Record<string, unknown>;

/** Một dòng đổi: thêm (chỉ `next`), sửa (`prev` + `next`), xóa (chỉ `prev`). */
export interface RowChange {
  kind: "create" | "update" | "delete";
  prev?: Row;
  next?: Row;
}

/** Cặp [tài nguyên, hành động] — đủ MỘT cặp là được ghi dòng đó. */
type Requirement = readonly [resource: string, action: PermissionAction];
type TableRule = (c: RowChange) => readonly Requirement[];

const crudOf = (c: RowChange): PermissionAction => c.kind;

/** Bảng ghi bình thường: thêm/sửa/xóa ↔ create/update/delete ở một trong các màn. */
const owners =
  (...resources: string[]): TableRule =>
  (c) =>
    resources.map((r) => [r, crudOf(c)] as const);

/** Bảng chốt ngày/kỳ (`isLocked`): chuyển sang chốt ⇒ Chốt; mở ra / xóa ⇒ Mở lại. */
const lockOwners =
  (...resources: string[]): TableRule =>
  (c) => {
    const wasLocked = Boolean(c.prev?.isLocked);
    const isLocked = Boolean(c.next?.isLocked);
    const action: PermissionAction =
      c.kind === "delete" || (wasLocked && !isLocked) ? "unlock" : isLocked && !wasLocked ? "lock" : c.kind;
    return resources.map((r) => [r, action] as const);
  };

/** Kỳ cân đối: dòng kỳ vừa là bản ghi (tạo/xóa kỳ) vừa mang cờ chốt kỳ. */
const balancingPeriodRule: TableRule = (c) => {
  if (c.kind === "update" && Boolean(c.prev?.isLocked) !== Boolean(c.next?.isLocked))
    return [["balancing", c.next?.isLocked ? "lock" : "unlock"]];
  return [["balancing", crudOf(c)]];
};

/** Sản lượng SX: Kho dự trữ DUYỆT (chờ → đã nhập) hoặc sửa vị trí; /wip ghi sản lượng; Cân đối hút số. */
const productionWipRule: TableRule = (c) => {
  const isApprove = c.kind === "update" && c.prev?.status !== c.next?.status && c.next?.status === "stocked";
  return [
    ["wip", crudOf(c)],
    ["balancing", crudOf(c)],
    ["warehouse", isApprove ? "approve" : "update"],
  ];
};

/**
 * Bảng (tên DB) → luật. `null` = KHÔNG chốt có chủ đích (thao tác trình bày, hoặc chỉ
 * admin ghi mà admin luôn toàn quyền). Test `writePermissions.test.ts` bắt mọi
 * `TableMapping` trong repo.ts phải có mặt ở đây — thêm bảng mà quên ⇒ đỏ.
 */
export const TABLE_WRITE_RULES: Readonly<Record<string, TableRule | null>> = {
  // Nhập hàng
  import_shipments: owners("imports"),
  // Bỏ một dòng loại NL khi SỬA chuyến = Sửa chuyến (không cần quyền Xóa — kế toán nhập
  // liệu không có Xóa vẫn sửa được chuyến ghi sai); xóa CẢ chuyến cần Xóa ở import_shipments.
  material_imports: (c) =>
    c.kind === "delete"
      ? [["imports", "update"], ["balancing", "delete"]]
      : [["imports", crudOf(c)], ["balancing", crudOf(c)]],
  daily_locks: lockOwners("imports"),
  scraps: owners("imports", "balancing"), // phế liệu ngày (nhập) + hút vào kỳ (cân đối)
  // Sản xuất
  production_wips: productionWipRule,
  production_locks: lockOwners("wip"),
  domestic_sales: owners("wip"),
  packagings: owners("packaging"),
  qc_checklists: owners("qc"),
  qc_locks: lockOwners("qc"),
  // Lô / QR — gắn lô ở /wip, /packaging, /qr; kiểm lô xuất ở Đơn đặt / Bán; in tem ở nhiều màn
  lot_inputs: owners("wip", "packaging", "qr"),
  lot_waivers: owners("wip", "qr"),
  lot_dispatches: owners("orders", "sales", "wip", "qr"),
  label_prints: owners("qr", "imports", "wip", "packaging", "sales", "orders"),
  // Bán · đơn đặt
  sales_invoices: owners("sales", "orders"),
  sales_items: owners("sales", "orders"),
  sales_orders: owners("orders"),
  order_items: owners("orders"),
  export_orders: owners("orders"),
  export_items: owners("orders"),
  // Kế toán
  balancing_periods: balancingPeriodRule,
  balancing_inputs: owners("balancing"),
  balancing_outputs: owners("balancing"),
  monthly_stock_ledger: owners("monthly-stock", "balancing", "wip"), // Cân đối ghi 2 dòng kho · /wip ghi hàng đông lạnh → Hàng tạm (0066)
  reconciliation_runs: owners("reconciliation"),
  material_opening_stock: owners("nxt-material"),
  finished_goods_opening_stock: owners("nxt"),
  nxt_snapshots: () => [["nxt-warehouse", "import"]], // chỉ có nạp báo cáo
  // Danh mục — thêm nhanh / bút chì ở MỌI màn cũng cần quyền của tab danh mục (quy tắc 7)
  suppliers: owners("catalog.suppliers"),
  customers: owners("catalog.customers"),
  material_types: owners("catalog.material-types"),
  products: owners("catalog.products"),
  batter_types: owners("catalog.batters"),
  storage_locations: owners("catalog.storage-locations"),
  finished_goods: () => [["catalog.finished-goods", "update"]],
  // Hệ thống — chỉ admin ghi (tài nguyên adminOnly ⇒ người thường luôn bị chặn)
  user_profiles: () => [["users", "update"]],
  app_roles: () => [["roles", "update"]],
  role_permissions: () => [["roles", "update"]],
  user_permissions: () => [["roles", "update"]],
  // Không chốt: tô màu dòng là thao tác trình bày (quy tắc 12–13)
  row_marks: null,
  // Không chốt ở lớp ghi: giao việc là ghi chú điều phối, không phải sổ sách — người nhận
  // phải tự bấm "Xong" được dù không có quyền giao. Ai được GIAO (my-tasks.create) /
  // sửa / thu hồi do màn /my-tasks kiểm; máy chủ vẫn chặn người không vai trò (RLS 0070).
  task_assignments: null,
  // Tài liệu công ty (mig 0072): máy chủ chốt bằng RLS RIÊNG của hai bảng (đọc theo phòng
  // ban, ghi theo ô documents.* qua current_permission_context()) — không qua trigger 0065.
  // App kiểm ở màn /documents bằng useCan("documents").
  company_documents: null,
  document_versions: null,
  // Xuất khẩu (mig 0075): máy chủ chốt bằng RLS RIÊNG (has_export_permission — đọc theo 3 tài
  // nguyên export-plans*, người đóng hàng chỉ thêm file 4a/4b) — không qua trigger 0065.
  // App kiểm ở màn /planning-export bằng useCan("export-plans" | ".loading" | ".payments").
  export_contracts: null,
  export_contract_revisions: null,
  export_contract_approvals: null,
  export_deadline_extensions: null,
  export_shipments: null,
  export_step_items: null,
  export_files: null,
  export_payments: null,
  export_activity_log: null,
  // Tên hàng theo khách (mig 0077) — RLS riêng: danh mục khách HOẶC Xuất khẩu (trích xuất khi lưu HĐ).
  customer_product_names: null,
  export_document_kinds: null,
  // Nhập khẩu (mig 0082): RLS RIÊNG theo import-plans / import-plans.receiving (thủ kho chỉ ghi
  // số lượng thực nhập) — không qua trigger 0065. App kiểm ở /planning-import bằng useCan.
  import_contracts: null,
  import_contract_lines: null,
  import_receipts: null,
  import_receipt_lines: null,
  import_documents: null,
  import_files: null,
};

export interface WriteDenial {
  table: string;
  resource: string;
  action: PermissionAction;
  /** Câu báo cho người dùng. */
  message: string;
}

/**
 * Kiểm một lượt ghi. Admin luôn được; bảng không chốt (`null`) hoặc lạ ⇒ cho qua (bảng lạ
 * đã bị test chặn từ CI). Trả lỗi ĐẦU TIÊN gặp — cả lượt ghi bị từ chối (không ghi nửa vời).
 */
export function checkTableWrite(
  perms: EffectivePermissions,
  table: string,
  changes: readonly RowChange[],
  ctx: ScopeContext = EMPTY_SCOPE_CONTEXT
): WriteDenial | null {
  if (perms.isAdmin || !changes.length) return null;
  const rule = TABLE_WRITE_RULES[table];
  if (!rule) return null;
  for (const c of changes) {
    const reqs = rule(c);
    // Phạm vi (Đợt 5): dòng TRƯỚC và SAU đều phải trong phạm vi — không "dời" dòng xưởng
    // khác về xưởng mình, không sửa dòng người khác ghi.
    const ok = reqs.some(([r, a]) => {
      const scope = scopeOf(perms, r, a);
      return scope !== null && rowInScope(scope, ctx, c.prev, c.kind) && rowInScope(scope, ctx, c.next, c.kind);
    });
    if (ok) continue;
    const [resource, action] = reqs[0];
    const label = getResource(resource)?.label ?? resource;
    const hasActionSomewhere = reqs.some(([r, a]) => scopeOf(perms, r, a) !== null);
    const row = (c.next ?? c.prev) as { workshop?: unknown } | undefined;
    return {
      table,
      resource,
      action,
      message: hasActionSomewhere
        ? `Dòng này ngoài phạm vi của bạn${typeof row?.workshop === "string" && row.workshop ? ` (xưởng ${row.workshop})` : ""} — bạn chỉ ${PERMISSION_ACTION_LABELS[action].toLowerCase()} được dòng của xưởng mình / do mình ghi. Thao tác chưa được lưu.`
        : `Bạn không có quyền ${PERMISSION_ACTION_LABELS[action].toLowerCase()} ở ${label} — thao tác chưa được lưu. Cần quyền thì báo quản trị viên.`,
    };
  }
  return null;
}
