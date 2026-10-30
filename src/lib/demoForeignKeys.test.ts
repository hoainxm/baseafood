// Chế độ demo thêm tiền tố `demo:` cho khóa chính ở ranh giới máy chủ (lib/demoMode.ts).
// Cột KHÓA NGOẠI trỏ tới khóa chính bảng nghiệp vụ khác cũng phải mang tiền tố —
// khai ở `TableMapping.refColumns`. Test này quét mọi migration: thêm khóa ngoại mới
// giữa hai bảng nghiệp vụ mà quên khai ⇒ đỏ (đã lọt một lần: 2026-10-12, period_id).
// Khóa ngoại MỀM (không có `references`) quét ở repo.ts: mọi cột `*_id` / `*_ids` của toRow
// phải khai refColumns hoặc nằm trong danh sách MIỄN kèm lý do (lọt 2026-10-21: customer_id).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as repo from "./repo";
import type { TableMapping } from "./repo";

const MIGRATIONS_DIR = join(__dirname, "../../supabase/migrations");
const REPO_SOURCE = readFileSync(join(__dirname, "repo.ts"), "utf8");

/** Cột `*_id` KHÔNG phải id bản ghi nghiệp vụ (không mang tiền tố demo) — `bảng.cột` → lý do. */
const SOFT_REF_EXEMPT: Record<string, string> = {
  "balancing_inputs.reduction_warehouse_id": "mã kho hệ thống (WORKSHOP_WAREHOUSES), hằng số",
  "import_suppliers.tax_id": "mã số thuế / số đăng ký của NCC nước ngoài (chữ), không trỏ bản ghi nào",
  "supplier_invoices.seller_tax_id": "mã số thuế người bán đọc từ PDF hóa đơn (chữ số), không trỏ bản ghi nào",
  "import_sample_checks.batch_id": "mã nhóm của một đợt đọc báo cáo kiểm mẫu (gom mẫu nạp cùng lần), không trỏ bảng nào",
  "production_order_lines.contract_line_id": "id dòng trong JSON `lines` của bản HĐ xuất (export_contract_revisions.lines), không phải khóa bảng",
  "row_marks.row_id": "khóa dòng đa hình — có khi là khóa ghép kỳ/bộ lọc của báo cáo, không phải id bản ghi",
  "reconciliation_runs.user_id": "id người dùng (auth.users)",
  "user_permissions.user_id": "id người dùng (auth.users)",
  "task_assignments.assignee_id": "id người dùng (auth.users)",
  "task_assignments.assigned_by_id": "id người dùng (auth.users)",
  "document_versions.reviewer_id": "id người dùng (auth.users)",
  "document_versions.approver_id": "id người dùng (auth.users)",
  "suppliers.national_id": "số CCCD, không phải khóa",
};

/** Bảng → các cột `*_id` / `*_ids` toRow ghi lên (quét mã nguồn repo.ts theo khối `table: "…"`). */
function softRefColumnsByTable(): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const blocks = REPO_SOURCE.split(/\n(?=export const [A-Z_]+: TableMapping)/);
  for (const b of blocks) {
    const table = /\n  table: "([a-z_]+)"/.exec(b)?.[1];
    const toRow = b.indexOf("toRow:");
    if (!table || toRow < 0) continue;
    const fromRow = b.indexOf("fromRow:", toRow);
    const body = b.slice(toRow, fromRow < 0 ? undefined : fromRow);
    const cols = result.get(table) ?? new Set<string>();
    for (const m of body.matchAll(/^\s+([a-z_]+_ids?):/gm)) if (m[1] !== "site_id") cols.add(m[1]);
    result.set(table, cols);
  }
  return result;
}

function refColumnsByTable(): Map<string, readonly string[]> {
  const result = new Map<string, readonly string[]>();
  for (const v of Object.values(repo)) {
    const m = v as Partial<TableMapping<{ id: string }>>;
    if (m && typeof m === "object" && typeof m.table === "string" && typeof m.toRow === "function") result.set(m.table, m.refColumns ?? []);
  }
  return result;
}
/** Bảng đích được phép không khai (site chung — không mang tiền tố). */
const SKIPPED_TABLES = new Set(["sites", "xi_nghiep"]);

function businessForeignKeys(): string[] {
  const result: string[] = [];
  for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
    for (const m of sql.matchAll(/references\s+(?:public\.)?([a-z_]+)\s*\(/gi)) if (!SKIPPED_TABLES.has(m[1])) result.push(`${f}:${m[1]}`);
  }
  return result;
}

describe("khóa ngoại giữa bảng nghiệp vụ ⇄ refColumns", () => {
  it("migration chỉ có đúng 3 khóa ngoại (period_id → kỳ cân đối) — thêm mới thì khai refColumns rồi sửa test này", () => {
    // 0001 tạo bằng tên cũ ky_can_doi; 0016 đổi thành balancing_periods.
    expect(businessForeignKeys()).toEqual([
      "0001_baseafood_mes.sql:ky_can_doi",
      "0001_baseafood_mes.sql:ky_can_doi",
      "0001_baseafood_mes.sql:ky_can_doi",
    ]);
  });

  it("ba bảng trỏ tới balancing_periods đã khai period_id", () => {
    for (const b of [repo.BALANCING_INPUT_TABLE, repo.BALANCING_OUTPUT_TABLE, repo.SCRAP_TABLE]) expect(b.refColumns?.[0], b.table).toBe("period_id");
  });

  it("mọi cột *_id / *_ids của toRow đã khai refColumns hoặc nằm trong danh sách MIỄN (khóa ngoại mềm)", () => {
    const refs = refColumnsByTable();
    // Bộ quét phải thấy đúng cột của ca đã lọt — regex hỏng thì đỏ thay vì xanh suông.
    expect([...(softRefColumnsByTable().get("balancing_outputs") ?? [])]).toContain("customer_id");
    const missing: string[] = [];
    for (const [table, cols] of softRefColumnsByTable()) {
      for (const c of cols) if (!SOFT_REF_EXEMPT[`${table}.${c}`] && !(refs.get(table) ?? []).includes(c)) missing.push(`${table}.${c}`);
    }
    expect(missing, "khai refColumns cho cột trỏ tới id bản ghi khác, hoặc thêm vào SOFT_REF_EXEMPT kèm lý do").toEqual([]);
  });

  it("danh sách MIỄN không còn mục thừa (cột đã bỏ / đã khai refColumns)", () => {
    const refs = refColumnsByTable();
    const cols = softRefColumnsByTable();
    const stale = Object.keys(SOFT_REF_EXEMPT).filter((k) => {
      const [table, c] = k.split(".");
      return !cols.get(table)?.has(c) || (refs.get(table) ?? []).includes(c);
    });
    expect(stale).toEqual([]);
  });

  it("bắt đúng ca đã lọt: customer_id ở balancing_outputs / sales_orders / sales_invoices / export_contracts", () => {
    for (const b of [repo.BALANCING_OUTPUT_TABLE, repo.SALES_ORDER_TABLE, repo.SALES_INVOICE_TABLE, repo.EXPORT_CONTRACT_TABLE]) expect(b.refColumns, b.table).toContain("customer_id");
  });
});
