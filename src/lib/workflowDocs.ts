// ============================================================
// Tên file: src/lib/workflowDocs.ts
// Tên tiếng Việt: Sổ đăng ký sơ đồ workflow theo module + phần sinh tự động (ba-spec 65)
// Description: Registry of per-module workflow docs (docs/workflows/*.md) and generated sections kept in sync by tests
// ============================================================
// Mỗi module một file `docs/workflows/<id>.md` (Mermaid + bảng trạng thái / luật). Phần "ai được làm gì" SINH từ
// ma trận quyền mặc định ⇒ không ai phải chép tay; `workflowDocs.test.ts` bắt lệch (đổi quyền mà quên doc ⇒ đỏ),
// `UPDATE_WORKFLOW_DOCS=1 npx vitest run src/lib/workflowDocs.test.ts` ghi lại phần sinh.
import {
  ATTACHMENT_STATUS_LABELS,
  CONTRACT_STATE_LABELS,
  FINAL_REVIEW_LABELS,
  ITEM_STATE_LABELS,
  STEP_TITLES,
  SUB_STEP_LABELS,
} from "@/lib/exportPlanning";
import { DOCUMENT_STATE_LABELS } from "@/lib/documents";
import { PLANNING_ATTENTION_LABELS, PLANNING_MODULE_LABELS } from "@/lib/dashboardAttention";
import { COMPOSED_STATUS_LABELS } from "@/lib/documentComposer";
import { SUM_MISMATCH_LABELS } from "@/lib/einvoiceReconciliation";
import { CONTRACT_STATE_LABELS as IMPORT_CONTRACT_STATE_LABELS, RECEIPT_STATE_LABELS } from "@/lib/importPlanning";
import { IMPORT_ATTENTION_LABELS } from "@/lib/importReports";
import { TRACE_KIND_LABELS } from "@/lib/lotTraceability";
import { ORDER_STATUS_LABELS, STALE_REVISION_LABEL } from "@/lib/productionOrder";
import { ORDER_ATTENTION_LABELS } from "@/lib/productionOrderReports";
import {
  IMPORT_CHANGE_LABELS,
  PDF_WARNING_LABELS,
  SUPPLIER_INVOICE_LINE_STATE_LABELS,
  TRIP_INVOICE_STATUS_LABELS,
} from "@/lib/supplierInvoice";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_ACTION_LABELS,
  PERMISSION_RESOURCES,
  listRoleOptions,
  type RolePermissionMatrix,
} from "@/lib/permissions";

export interface WorkflowModule {
  id: string;
  title: string;
  /** Mục nav (navId) thuộc module — mọi navId của tài nguyên quyền phải nằm trong ĐÚNG một module. */
  pages: readonly string[];
  /** File sơ đồ; `null` = chưa làm (đợt sau). */
  doc: string | null;
  /** Tài nguyên quyền vẽ ở bảng "Ai được làm gì" (sinh tự động). */
  resources: readonly string[];
  /** Nhãn trạng thái / bước trong code — mỗi nhãn phải có mặt trong file sơ đồ (đổi nhãn mà quên doc ⇒ test đỏ). */
  labels: readonly string[];
}

const values = (r: Record<string, string>) => Object.values(r);

export const WORKFLOW_MODULES: readonly WorkflowModule[] = [
  {
    id: "export-planning",
    title: "Xuất khẩu",
    pages: ["planning-export"],
    doc: "docs/workflows/export-planning.md",
    resources: ["export-plans", "export-plans.loading", "export-plans.payments"],
    labels: [
      ...STEP_TITLES,
      ...values(SUB_STEP_LABELS),
      ...values(ITEM_STATE_LABELS),
      ...values(CONTRACT_STATE_LABELS),
      ...values(FINAL_REVIEW_LABELS),
      ...values(ATTACHMENT_STATUS_LABELS),
    ],
  },
  {
    id: "imports",
    title: "Nhập hàng",
    pages: ["imports", "nxt-material"],
    doc: "docs/workflows/imports.md",
    resources: ["imports", "imports.invoices", "nxt-material"],
    labels: [
      ...values(TRIP_INVOICE_STATUS_LABELS),
      ...values(SUPPLIER_INVOICE_LINE_STATE_LABELS),
      ...values(IMPORT_CHANGE_LABELS),
      ...values(PDF_WARNING_LABELS),
    ],
  },
  { id: "production", title: "Sản xuất", pages: ["wip", "packaging", "qc"], doc: "docs/workflows/production.md", resources: ["wip", "packaging", "qc"], labels: [] },
  {
    id: "warehouse",
    title: "Kho",
    pages: ["warehouse", "monthly-stock", "qr", "nxt-warehouse"],
    doc: "docs/workflows/warehouse.md",
    resources: ["warehouse", "monthly-stock", "qr", "nxt-warehouse"],
    labels: values(TRACE_KIND_LABELS),
  },
  { id: "sales", title: "Kinh doanh", pages: ["sales", "orders"], doc: "docs/workflows/sales.md", resources: ["sales", "orders"], labels: [] },
  {
    id: "balancing",
    title: "Báo cáo & Cân đối",
    pages: ["balancing", "production-report", "export-report", "nxt", "reconciliation"],
    doc: "docs/workflows/balancing.md",
    resources: ["balancing", "production-report", "export-report", "nxt", "reconciliation"],
    labels: values(SUM_MISMATCH_LABELS),
  },
  {
    id: "import-planning",
    title: "Nhập khẩu",
    pages: ["planning-import"],
    doc: "docs/workflows/import-planning.md",
    resources: ["import-plans", "import-plans.receiving"],
    labels: [...values(IMPORT_CONTRACT_STATE_LABELS), ...values(RECEIPT_STATE_LABELS), ...values(IMPORT_ATTENTION_LABELS)],
  },
  {
    id: "production-orders",
    title: "Lệnh sản xuất",
    pages: ["planning-production"],
    doc: "docs/workflows/production-orders.md",
    resources: ["production-orders"],
    labels: [...values(ORDER_STATUS_LABELS), ...values(ORDER_ATTENTION_LABELS), ...values(COMPOSED_STATUS_LABELS), STALE_REVISION_LABEL],
  },
  {
    id: "overview",
    title: "Việc của tôi · Tổng quan · Tài liệu",
    pages: ["my-tasks", "dashboard", "documents"],
    doc: "docs/workflows/overview.md",
    resources: ["dashboard", "my-tasks", "documents"],
    labels: [...values(DOCUMENT_STATE_LABELS), ...values(PLANNING_ATTENTION_LABELS), ...values(PLANNING_MODULE_LABELS)],
  },
  {
    id: "system",
    title: "Danh mục · Quản trị",
    pages: ["catalog", "admin", "users", "roles", "audit"],
    doc: "docs/workflows/system.md",
    resources: [
      "catalog.suppliers",
      "catalog.import-suppliers",
      "catalog.customers",
      "catalog.material-types",
      "catalog.products",
      "catalog.batters",
      "catalog.storage-locations",
      "catalog.finished-goods",
    ],
    labels: values(PERMISSION_ACTION_LABELS),
  },
];

/** Dấu mở / đóng của một phần sinh trong file sơ đồ. */
export const generatedMarkers = (key: string) => ({
  start: `<!-- gen:${key} — sinh tự động từ src/lib/permissions.ts, đừng sửa tay -->`,
  end: `<!-- /gen:${key} -->`,
});

/**
 * Bảng "Ai được làm gì": mỗi tài nguyên một bảng, dòng = vai có ít nhất một quyền, cột = hành động của tài nguyên.
 * Phạm vi khác "Tất cả" ghi kèm (vd "Thêm (của mình)"). Admin luôn đủ quyền ⇒ không vẽ.
 */
export function roleMatrixMarkdown(resources: readonly string[], matrix: RolePermissionMatrix = DEFAULT_ROLE_PERMISSIONS): string {
  const roles = listRoleOptions([]);
  const parts: string[] = [];
  for (const id of resources) {
    const res = PERMISSION_RESOURCES.find((r) => r.id === id);
    if (!res) continue;
    const rows: string[] = [];
    for (const role of roles) {
      const grants = (matrix[role.value] ?? []).filter((g) => g.resource === id);
      if (!grants.length) continue;
      const cells = res.actions.map((a) => {
        const g = grants.find((x) => x.action === a);
        if (!g) return "";
        return g.scope === "all" ? "✓" : `✓ (${g.scope})`;
      });
      rows.push(`| ${role.label} | ${cells.join(" | ")} |`);
    }
    parts.push(
      [
        `**${res.label}** (\`${id}\`)`,
        "",
        `| Vai | ${res.actions.map((a) => PERMISSION_ACTION_LABELS[a]).join(" | ")} |`,
        `|---|${res.actions.map(() => "---").join("|")}|`,
        ...(rows.length ? rows : [`| (chưa vai nào) | ${res.actions.map(() => "").join(" | ")} |`]),
      ].join("\n"),
    );
  }
  return parts.join("\n\n");
}

/** Lấy phần sinh đang có trong file (giữa hai dấu); `null` = chưa có dấu. */
export function readGenerated(doc: string, key: string): string | null {
  const { start, end } = generatedMarkers(key);
  const a = doc.indexOf(start);
  const b = doc.indexOf(end);
  if (a < 0 || b < a) return null;
  return doc.slice(a + start.length, b).trim();
}

/** Thay phần sinh trong file (giữ nguyên phần viết tay). */
export function writeGenerated(doc: string, key: string, body: string): string {
  const { start, end } = generatedMarkers(key);
  const a = doc.indexOf(start);
  const b = doc.indexOf(end);
  if (a < 0 || b < a) return doc;
  return `${doc.slice(0, a + start.length)}\n${body}\n${doc.slice(b)}`;
}
