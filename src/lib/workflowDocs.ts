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
  { id: "imports", title: "Nhập hàng", pages: ["imports", "nxt-material"], doc: null, resources: [], labels: [] },
  { id: "production", title: "Sản xuất", pages: ["wip", "packaging", "qc"], doc: null, resources: [], labels: [] },
  { id: "warehouse", title: "Kho", pages: ["warehouse", "monthly-stock", "qr", "nxt-warehouse"], doc: null, resources: [], labels: [] },
  { id: "sales", title: "Kinh doanh", pages: ["sales", "orders"], doc: null, resources: [], labels: [] },
  {
    id: "balancing",
    title: "Báo cáo & Cân đối",
    pages: ["balancing", "production-report", "export-report", "nxt", "reconciliation"],
    doc: null,
    resources: [],
    labels: [],
  },
  { id: "import-planning", title: "Nhập khẩu", pages: ["planning-import"], doc: null, resources: [], labels: [] },
  { id: "production-orders", title: "Lệnh sản xuất", pages: ["planning-production"], doc: null, resources: [], labels: [] },
  { id: "overview", title: "Việc của tôi · Tổng quan · Tài liệu", pages: ["my-tasks", "dashboard", "documents"], doc: null, resources: [], labels: [] },
  { id: "system", title: "Danh mục · Quản trị", pages: ["catalog", "admin", "users", "roles", "audit"], doc: null, resources: [], labels: [] },
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
