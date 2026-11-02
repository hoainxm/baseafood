// ============================================================
// Tên file: src/lib/myTasks.ts
// Tên tiếng Việt: Việc của tôi — gom việc cần làm của MỘT người, hạn + quá hạn
// Description: Pure. Turns chain warnings (lib/dataFlow.ts) + task assignments into
//              the personal to-do list: what I must do, by when, and what I delegated.
// ============================================================
/**
 * Màn "Việc của tôi" (`/my-tasks`, doc docs/app-map/39-my-tasks.md). Hàm THUẦN, ngày
 * "hôm nay" truyền vào để test được.
 *
 * Ba nguồn việc, một danh sách:
 * 1. **Được giao cho tôi** — dòng `task_assignments` có `assigneeId` = tôi (việc máy phát
 *    hiện đã giao, hoặc việc giao tay).
 * 2. **Việc theo quyền của tôi** — cảnh báo chuỗi (`buildChainWarnings`) mà tôi CÓ QUYỀN
 *    làm, trên dòng thuộc PHẠM VI của tôi (xưởng / dòng mình ghi — lib/permissions.ts),
 *    và CHƯA giao cho người khác (giao rồi thì người kia lo, mình khỏi làm trùng).
 * 3. **Tôi đã giao** — việc tôi giao cho người khác, để đốc.
 *
 * Việc máy phát hiện TỰ HẾT khi sổ đã sửa (cảnh báo biến mất) — không cần bấm "Xong".
 */
import type { TaskAssignment, Workshop } from "@/types";
import {
  APPROVAL_WAIT_DAYS,
  PERIOD_LOCK_GRACE_DAYS,
  getWarningKindLabel,
  type FlowWarning,
  type FlowWarningKind,
} from "@/lib/dataFlow";
import {
  RESOURCE_GROUP_LABELS,
  buildRolePermissions,
  buildUserOverrides,
  canOnRow,
  getResource,
  resolvePermissions,
  scopeContextFor,
  type EffectivePermissions,
  type PermissionAction,
  type ResourceGroup,
  type ScopeContext,
} from "@/lib/permissions";
import { DOCUMENT_EXPIRY_NOTICE_DAYS } from "@/lib/documents";
import { PLANNING_ATTENTION_LABELS, PLANNING_MODULE_LABELS, type PlanningAttention, type PlanningAttentionKind } from "@/lib/dashboardAttention";
import type { AppRole, Role, RolePermission, UserPermission, UserProfile } from "@/types";

/**
 * Loại việc của màn: việc chuỗi xưởng (lib/dataFlow) + tài liệu + việc Kế hoạch / HĐ đại lý (lib/dashboardAttention,
 * ba-spec 59 NV1). Kiểu riêng — KHÔNG thêm vào `FlowWarningKind` (Tổng quan dựa vào union đó).
 */
export type TaskKind = FlowWarningKind | PlanningAttentionKind;
/** Một việc máy phát hiện — cùng dạng `FlowWarning`, `kind` rộng hơn. */
export type TaskWarning = Omit<FlowWarning, "kind"> & { kind: TaskKind };

/** Việc Kế hoạch / HĐ đại lý (ba-spec 55) thành việc của màn — giữ nguyên id, mức, đường mở. */
export function planningTaskWarnings(rows: readonly PlanningAttention[]): TaskWarning[] {
  return rows.map(({ module: _module, ...w }) => w);
}

const isPlanningKind = (k: string): k is PlanningAttentionKind => k in PLANNING_ATTENTION_LABELS;

/** Nhãn loại việc: việc Kế hoạch ghi kèm tên màn ("Xuất khẩu · Quá hạn giao"). */
export function taskKindLabel(kind: TaskKind): string {
  if (!isPlanningKind(kind)) return getWarningKindLabel(kind);
  const module = kind.startsWith("export-") ? "export" : kind.startsWith("import-") ? "import" : kind.startsWith("order-") ? "production-order" : "supplier-invoice";
  return `${PLANNING_MODULE_LABELS[module]} · ${PLANNING_ATTENTION_LABELS[kind]}`;
}

/** Việc Kế hoạch "chưa làm" mà không có hạn (ba-spec 59 R3) — vẫn ở "Cần làm", không đếm quá hạn. */
const NO_DUE_TODO: ReadonlySet<TaskKind> = new Set<TaskKind>(["export-unpaid", "export-deferred-attachment"]);

/**
 * Mốc bắt đầu tính việc: ngày chạy số thật (cutover 01/09/2026). Số T7–T8 nạp bù lúc
 * cutover chưa từng chốt theo nhịp ngày ⇒ tính cả vào thì báo quá hạn hàng loạt, giả.
 */
export const TASKS_START_DATE = "2026-09-01";
/** Việc đã xong / thu hồi còn hiện ở mục "Tôi đã giao" bao nhiêu ngày. */
export const DONE_VISIBLE_DAYS = 7;

/**
 * Hạn của từng loại việc = ngày của việc + số ngày (chủ dự án chốt 2026-10-19). `null` =
 * việc "để biết", không có hạn, không tính quá hạn.
 * - Chốt ngày nhập / SX: chốt trong ngày ⇒ quá hạn từ hôm sau.
 * - Gắn lô: phải xong khi chốt ngày SX ⇒ cùng hạn chốt ngày.
 * - Duyệt BTP vào kho: trong APPROVAL_WAIT_DAYS ngày.
 * - Chốt kỳ cân đối: PERIOD_LOCK_GRACE_DAYS ngày sau ngày cuối kỳ.
 * - Sổ sai (đổi sau chốt, bán vượt tồn): sửa ngay.
 */
export const DUE_OFFSET_DAYS: Readonly<Record<TaskKind, number | null>> = {
  "imports-unlocked": 0,
  "production-unlocked": 0,
  "lot-unassigned": 0,
  "changed-after-lock": 0,
  oversold: 0,
  "approval-overdue": APPROVAL_WAIT_DAYS,
  "period-unlocked": PERIOD_LOCK_GRACE_DAYS,
  backdated: null,
  "yield-deviation": null,
  "period-yield-deviation": null,
  // Ngày của việc = ngày bắt đầu báo (hết hạn − 60) ⇒ hạn rơi đúng ngày hết hạn (lib/documents.ts).
  "document-expiring": DOCUMENT_EXPIRY_NOTICE_DAYS,
  // Việc Kế hoạch / HĐ đại lý (ba-spec 59 R3). Ngày của việc: hạn giao · ngày về · ngày SX đầu · ngày về chuyến.
  "export-overdue": 0,
  "export-over-tolerance": null,
  "export-under-tolerance": null,
  "export-unpaid": null,
  "export-deferred-attachment": null,
  "import-missing-docs": 3,
  "import-awaiting-quantity": 3,
  "order-draft-overdue": 0,
  "order-stale-revision": 0,
  "order-unlinked": 0,
  "invoice-awaiting": 10,
  "invoice-mismatch": 0,
};

type Requirement = readonly [resource: string, action: PermissionAction];

/** Ai làm được việc này: có MỘT trong các quyền (tài nguyên × hành động) là đủ. */
export function taskRequirements(w: Pick<TaskWarning, "kind" | "path">): readonly Requirement[] {
  const onImports = w.path.startsWith("/imports");
  switch (w.kind) {
    case "imports-unlocked":
      return [["imports", "lock"]];
    case "production-unlocked":
      return [["wip", "lock"]];
    case "changed-after-lock":
      return [["imports", "update"]];
    case "lot-unassigned":
      return w.path.startsWith("/packaging") ? [["packaging", "update"]] : [["wip", "update"]];
    case "approval-overdue":
      return [["warehouse", "approve"]];
    case "oversold":
      return [["warehouse", "approve"], ["sales", "update"]];
    case "period-unlocked":
      return [["balancing", "lock"]];
    case "backdated":
      return [[onImports ? "imports" : "wip", "unlock"]];
    case "yield-deviation":
      return [["wip", "unlock"], ["balancing", "update"]];
    case "period-yield-deviation":
      return [["balancing", "update"]];
    case "document-expiring":
      return [["documents", "update"]];
    // Kế hoạch (ba-spec 59 R2) — ai sửa được phần đó thì được nhắc.
    case "export-overdue":
    case "export-over-tolerance":
    case "export-under-tolerance":
    case "export-deferred-attachment":
      return [["export-plans", "update"]];
    case "export-unpaid":
      return [["export-plans.payments", "update"]];
    case "import-missing-docs":
      return [["import-plans", "update"]];
    case "import-awaiting-quantity":
      return [["import-plans.receiving", "update"], ["import-plans", "update"]];
    case "order-draft-overdue":
    case "order-stale-revision":
    case "order-unlinked":
      return [["production-orders", "update"]];
    case "invoice-awaiting":
    case "invoice-mismatch":
      return [["imports.invoices", "update"]];
  }
}

/* ---------- Nhóm trang (ba-spec 59 R4) ---------- */

/** Màn con trong nhóm Kế hoạch; "" ở các nhóm khác. */
export type TaskPage = "" | "import" | "production-order" | "export";

export interface TaskGroupKey {
  group: ResourceGroup | "other";
  page: TaskPage;
}

const PAGE_OF_RESOURCE: Record<string, TaskPage> = {
  "import-plans": "import",
  "import-plans.receiving": "import",
  "production-orders": "production-order",
  "export-plans": "export",
  "export-plans.loading": "export",
  "export-plans.payments": "export",
};

const keyOfResource = (resourceId: string): TaskGroupKey => {
  const r = getResource(resourceId);
  return r ? { group: r.group, page: PAGE_OF_RESOURCE[resourceId] ?? "" } : { group: "other", page: "" };
};

/** Nhóm của việc = nhóm của tài nguyên quyền ĐẦU TIÊN nó cần; việc giao tay ⇒ theo màn của đường mở. */
export function taskGroupOf(item: { kind: TaskKind | "manual" | "system"; path: string }): TaskGroupKey {
  if (item.kind !== "manual" && item.kind !== "system") return keyOfResource(taskRequirements({ kind: item.kind, path: item.path })[0][0]);
  const navId = item.path.replace(/^\//, "").split(/[?/]/)[0];
  const r = navId ? findResourceByNav(navId) : undefined;
  return r ? keyOfResource(r) : { group: "other", page: "" };
}

const NAV_RESOURCE: Record<string, string> = {
  "planning-export": "export-plans",
  "planning-import": "import-plans",
  "planning-production": "production-orders",
};
function findResourceByNav(navId: string): string | undefined {
  return NAV_RESOURCE[navId] ?? (getResource(navId) ? navId : undefined);
}

const GROUP_ORDER = [...Object.keys(RESOURCE_GROUP_LABELS), "other"];
const PAGE_ORDER: TaskPage[] = ["", "import", "production-order", "export"];
const PAGE_LABELS: Record<Exclude<TaskPage, "">, string> = {
  import: PLANNING_MODULE_LABELS.import,
  "production-order": PLANNING_MODULE_LABELS["production-order"],
  export: PLANNING_MODULE_LABELS.export,
};

/** "Kế hoạch · Xuất khẩu" / "Nhập hàng" / "Khác". */
export function taskGroupLabel(k: TaskGroupKey): string {
  const g = k.group === "other" ? "Khác" : RESOURCE_GROUP_LABELS[k.group];
  return k.page ? `${g} · ${PAGE_LABELS[k.page]}` : g;
}

export interface TaskGroup extends TaskGroupKey {
  key: string;
  label: string;
  items: MyTaskItem[];
  overdue: number;
  today: number;
}

/** Gom việc theo nhóm trang (thứ tự nhóm hệ thống), trong nhóm giữ thứ tự `compareTasks`. */
export function groupTasks(items: readonly MyTaskItem[]): TaskGroup[] {
  const map = new Map<string, TaskGroup>();
  for (const it of items) {
    const key = `${it.group.group}|${it.group.page}`;
    const g = map.get(key) ?? { ...it.group, key, label: taskGroupLabel(it.group), items: [], overdue: 0, today: 0 };
    g.items.push(it);
    if (it.urgency === "overdue") g.overdue++;
    if (it.urgency === "today") g.today++;
    map.set(key, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, items: [...g.items].sort(compareTasks) }))
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || PAGE_ORDER.indexOf(a.page) - PAGE_ORDER.indexOf(b.page));
}

/* ---------- Admin xem như (ba-spec 59 NV4, NV5, R5–R10) ---------- */

export type ViewAs = { kind: "role"; roleId: string } | { kind: "user"; userId: string };

/** Tham số link `viewAs=role:<id>` / `viewAs=user:<id>`; người không phải admin ⇒ null (R9). */
export function parseViewAs(param: string | null | undefined, isAdmin: boolean): ViewAs | null {
  if (!isAdmin || !param) return null;
  const m = /^(role|user):(.+)$/.exec(param.trim());
  if (!m) return null;
  return m[1] === "role" ? { kind: "role", roleId: m[2] } : { kind: "user", userId: m[2] };
}
export const viewAsParam = (v: ViewAs): string => (v.kind === "role" ? `role:${v.roleId}` : `user:${v.userId}`);

export interface ViewAsSources {
  appRoles: readonly AppRole[];
  rolePermissionRows: readonly RolePermission[];
  userPermissionRows: readonly UserPermission[];
  profiles: readonly Pick<UserProfile, "id" | "fullName" | "username" | "roles">[];
}

export interface ViewAsContext {
  permissions: EffectivePermissions;
  scopeContext: ScopeContext;
  /** Người được xem như (để lấy việc giao cho / do người đó giao); vai trò ⇒ "". */
  userId: string;
  /** Vai có phạm vi "dòng mình ghi" mà xem như VAI (không có người) — màn nhắc chọn người (NV4 edge). */
  needsPerson: boolean;
}

/**
 * Quyền + phạm vi khi admin xem như vai / người — TÍNH THUẦN ở máy, không đổi vai / quyền thật (R5),
 * dùng ma trận ĐANG LƯU ở /roles (R7). Không tìm thấy vai / người ⇒ null.
 */
export function viewAsContext(v: ViewAs, src: ViewAsSources): ViewAsContext | null {
  const rolePermissions = buildRolePermissions(src.appRoles, src.rolePermissionRows);
  if (v.kind === "role") {
    if (!(v.roleId in rolePermissions) && !src.appRoles.some((r) => r.id === v.roleId)) return null;
    const permissions = resolvePermissions({ roles: [v.roleId as Role], isAdmin: v.roleId === "admin", rolePermissions });
    const needsPerson = (rolePermissions[v.roleId] ?? []).some((g) => g.scope === "own");
    return { permissions, scopeContext: scopeContextFor([v.roleId]), userId: "", needsPerson };
  }
  const p = src.profiles.find((x) => x.id === v.userId);
  if (!p) return null;
  const permissions = resolvePermissions({
    roles: p.roles,
    isAdmin: p.roles.includes("admin"),
    rolePermissions,
    overrides: buildUserOverrides(p.id, src.userPermissionRows),
  });
  return { permissions, scopeContext: scopeContextFor(p.roles, p.fullName, p.username), userId: p.id, needsPerson: false };
}

export type TaskUrgency = "overdue" | "today" | "upcoming" | "info";
export type TaskBucket = "assigned" | "mine" | "delegated";

export interface MyTaskItem {
  /** Khóa ổn định (tô màu dòng / React key): id cảnh báo hoặc id dòng giao việc. */
  id: string;
  bucket: TaskBucket;
  source: "system" | "manual";
  /** Loại cảnh báo; "manual" = việc giao tay; "system" = việc máy đã sửa xong (không còn cảnh báo). */
  kind: TaskKind | "manual" | "system";
  /** Nhóm trang của việc (ba-spec 59 R4). */
  group: TaskGroupKey;
  kindLabel: string;
  title: string;
  detail: string;
  path: string;
  /** Ngày nghiệp vụ của việc. */
  date: string;
  workshop: Workshop | "";
  /** "" = không có hạn (việc để biết). */
  dueDate: string;
  urgency: TaskUrgency;
  /** Số ngày đã quá hạn (0 nếu chưa quá). */
  overdueDays: number;
  /** Mức của cảnh báo gốc (việc giao tay = "reminder"). */
  level: FlowWarning["level"];
  /** Dòng giao việc (nếu đã giao). */
  assignment?: TaskAssignment;
  /** Việc máy đã giao mà sổ đã sửa xong (cảnh báo biến mất) — chỉ ở "Tôi đã giao". */
  isResolved?: boolean;
}

export interface MyTasksInput {
  /**
   * `buildChainWarnings(d, { fromDate: TASKS_START_DATE, toDate: today }, today, …, { includeToday: true, approvalWaitDays: 0 })`
   * + `buildDocumentWarnings` + `planningTaskWarnings(...)` (ba-spec 59).
   */
  warnings: readonly TaskWarning[];
  assignments: readonly TaskAssignment[];
  /** `user_profiles.id` người đang xem. */
  userId: string;
  permissions: EffectivePermissions;
  scopeContext: ScopeContext;
  /** Người ghi của mẻ SX (id mẻ → operator) — phạm vi "dòng mình ghi" của tổ trưởng. */
  wipOperators?: ReadonlyMap<string, string>;
  today: string;
}

export interface MyTasksResult {
  assigned: MyTaskItem[];
  mine: MyTaskItem[];
  delegated: MyTaskItem[];
  /** Đếm trên "được giao" + "theo quyền" (việc của chính tôi). */
  overdueCount: number;
  todayCount: number;
}

/** yyyy-mm-dd + n ngày (lịch UTC cho khỏi lệch múi giờ). */
export function addDays(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t)) return date;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Hạn mặc định của một việc máy phát hiện; "" = không có hạn. */
export function defaultDueDate(w: Pick<TaskWarning, "kind" | "date">): string {
  const offset = DUE_OFFSET_DAYS[w.kind];
  return offset === null || !w.date ? "" : addDays(w.date, offset);
}

/** Quá hạn khi hôm nay đã QUA ngày hạn; đúng ngày hạn = "hôm nay". */
export function urgencyOf(dueDate: string, today: string): { urgency: TaskUrgency; overdueDays: number } {
  if (!dueDate) return { urgency: "info", overdueDays: 0 };
  if (today > dueDate) return { urgency: "overdue", overdueDays: daysBetween(dueDate, today) };
  return { urgency: today === dueDate ? "today" : "upcoming", overdueDays: 0 };
}

/** Id mẻ SX trong id cảnh báo gắn lô (`lo|W|<id>`), để tra người ghi. */
const wipIdOf = (warningId: string) => (warningId.startsWith("lo|W|") ? warningId.slice(5) : "");

/** Tôi làm được việc này không (quyền + phạm vi trên dòng). */
export function canDoTask(
  w: TaskWarning,
  perms: EffectivePermissions,
  ctx: ScopeContext,
  wipOperators: ReadonlyMap<string, string> = new Map(),
): boolean {
  const row = { workshop: w.workshop || undefined, operator: wipOperators.get(wipIdOf(w.id)) || undefined };
  return taskRequirements(w).some(([resource, action]) => canOnRow(perms, ctx, resource, action, row));
}

const URGENCY_ORDER: Record<TaskUrgency, number> = { overdue: 0, today: 1, upcoming: 2, info: 3 };

/** Quá hạn lâu nhất → hôm nay → sắp tới → để biết; cùng nhóm thì hạn sớm trước. */
export function compareTasks(a: MyTaskItem, b: MyTaskItem): number {
  return (
    URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] ||
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
    b.date.localeCompare(a.date) ||
    a.id.localeCompare(b.id)
  );
}

function fromWarning(w: TaskWarning, bucket: TaskBucket, today: string, assignment?: TaskAssignment): MyTaskItem {
  const dueDate = assignment?.dueDate || defaultDueDate(w);
  const urgency = !dueDate && NO_DUE_TODO.has(w.kind) ? { urgency: "upcoming" as const, overdueDays: 0 } : urgencyOf(dueDate, today);
  return {
    id: bucket === "mine" ? w.id : (assignment?.id ?? w.id),
    bucket,
    source: "system",
    kind: w.kind,
    kindLabel: taskKindLabel(w.kind),
    group: taskGroupOf(w),
    title: w.title,
    detail: w.detail,
    path: w.path,
    date: w.date,
    workshop: w.workshop,
    dueDate,
    ...urgency,
    level: w.level,
    assignment,
  };
}

function fromAssignment(a: TaskAssignment, bucket: TaskBucket, today: string, warning?: TaskWarning): MyTaskItem {
  if (warning) return fromWarning(warning, bucket, today, a);
  const isClosed = a.status !== "open";
  const resolved = a.source === "system" && !isClosed;
  return {
    id: a.id,
    bucket,
    source: a.source,
    kind: a.source,
    kindLabel: a.source === "manual" ? "Việc giao" : "Việc máy phát hiện",
    group: taskGroupOf({ kind: a.source, path: a.path }),
    title: a.title,
    detail: a.detail,
    path: a.path,
    date: a.taskDate,
    workshop: a.workshop,
    dueDate: a.dueDate,
    ...(isClosed || resolved ? { urgency: "info" as const, overdueDays: 0 } : urgencyOf(a.dueDate, today)),
    level: "reminder",
    assignment: a,
    isResolved: resolved,
  };
}

/** Việc máy đã giao mà sổ đã sửa xong — cảnh báo không còn trong danh sách hiện tại. */
export function findResolvedAssignments(assignments: readonly TaskAssignment[], warnings: readonly TaskWarning[]): TaskAssignment[] {
  const live = new Set(warnings.map((w) => w.id));
  return assignments.filter((a) => a.source === "system" && a.status === "open" && !live.has(a.taskKey));
}

export function buildMyTasks({ warnings, assignments, userId, permissions, scopeContext, wipOperators, today }: MyTasksInput): MyTasksResult {
  const byKey = new Map(warnings.map((w) => [w.id, w]));
  const open = assignments.filter((a) => a.status === "open");
  /** Việc máy đã giao cho ai đó (đang mở) — người khác khỏi làm trùng. */
  const assignedKeys = new Set(open.filter((a) => a.source === "system" && a.taskKey).map((a) => a.taskKey));

  const assigned = open
    .filter((a) => a.assigneeId === userId)
    // Việc máy đã sửa xong thì thôi hiện cho người nhận (tự hết).
    .filter((a) => a.source === "manual" || byKey.has(a.taskKey))
    .map((a) => fromAssignment(a, "assigned", today, a.source === "system" ? byKey.get(a.taskKey) : undefined));

  const mine = warnings
    .filter((w) => !assignedKeys.has(w.id))
    .filter((w) => canDoTask(w, permissions, scopeContext, wipOperators))
    .map((w) => fromWarning(w, "mine", today));

  const recent = addDays(today, -DONE_VISIBLE_DAYS);
  const delegated = assignments
    .filter((a) => a.assignedById === userId && a.assigneeId !== userId)
    .filter((a) => a.status === "open" || (a.doneAt || a.createdAt).slice(0, 10) >= recent)
    .map((a) => fromAssignment(a, "delegated", today, a.source === "system" && a.status === "open" ? byKey.get(a.taskKey) : undefined));

  const own = [...assigned, ...mine];
  return {
    assigned: assigned.sort(compareTasks),
    mine: mine.sort(compareTasks),
    delegated: delegated.sort(compareTasks),
    overdueCount: own.filter((x) => x.urgency === "overdue").length,
    todayCount: own.filter((x) => x.urgency === "today").length,
  };
}

/**
 * Số trên chuông header — CHỈ đọc bảng giao việc (khung app không nạp ~20 sổ chỉ để đếm).
 * Việc máy đã sửa xong mà chưa ai mở màn thì vẫn đếm tới khi màn "Việc của tôi" đóng nó.
 */
export function countMyOpenAssignments(assignments: readonly TaskAssignment[], userId: string, today: string): { open: number; overdue: number } {
  const mine = assignments.filter((a) => a.status === "open" && a.assigneeId === userId);
  return { open: mine.length, overdue: mine.filter((a) => urgencyOf(a.dueDate, today).urgency === "overdue").length };
}
