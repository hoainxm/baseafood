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
import { canOnRow, type EffectivePermissions, type PermissionAction, type ScopeContext } from "@/lib/permissions";

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
export const DUE_OFFSET_DAYS: Readonly<Record<FlowWarningKind, number | null>> = {
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
};

type Requirement = readonly [resource: string, action: PermissionAction];

/** Ai làm được việc này: có MỘT trong các quyền (tài nguyên × hành động) là đủ. */
export function taskRequirements(w: Pick<FlowWarning, "kind" | "path">): readonly Requirement[] {
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
  }
}

export type TaskUrgency = "overdue" | "today" | "upcoming" | "info";
export type TaskBucket = "assigned" | "mine" | "delegated";

export interface MyTaskItem {
  /** Khóa ổn định (tô màu dòng / React key): id cảnh báo hoặc id dòng giao việc. */
  id: string;
  bucket: TaskBucket;
  source: "system" | "manual";
  /** Loại cảnh báo; "manual" = việc giao tay; "system" = việc máy đã sửa xong (không còn cảnh báo). */
  kind: FlowWarningKind | "manual" | "system";
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
  /** `buildChainWarnings(d, { fromDate: TASKS_START_DATE, toDate: today }, today, …, { includeToday: true, approvalWaitDays: 0 })`. */
  warnings: readonly FlowWarning[];
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
export function defaultDueDate(w: Pick<FlowWarning, "kind" | "date">): string {
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
  w: FlowWarning,
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

function fromWarning(w: FlowWarning, bucket: TaskBucket, today: string, assignment?: TaskAssignment): MyTaskItem {
  const dueDate = assignment?.dueDate || defaultDueDate(w);
  return {
    id: bucket === "mine" ? w.id : (assignment?.id ?? w.id),
    bucket,
    source: "system",
    kind: w.kind,
    kindLabel: getWarningKindLabel(w.kind),
    title: w.title,
    detail: w.detail,
    path: w.path,
    date: w.date,
    workshop: w.workshop,
    dueDate,
    ...urgencyOf(dueDate, today),
    level: w.level,
    assignment,
  };
}

function fromAssignment(a: TaskAssignment, bucket: TaskBucket, today: string, warning?: FlowWarning): MyTaskItem {
  if (warning) return fromWarning(warning, bucket, today, a);
  const isClosed = a.status !== "open";
  const resolved = a.source === "system" && !isClosed;
  return {
    id: a.id,
    bucket,
    source: a.source,
    kind: a.source,
    kindLabel: a.source === "manual" ? "Việc giao" : "Việc máy phát hiện",
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
export function findResolvedAssignments(assignments: readonly TaskAssignment[], warnings: readonly FlowWarning[]): TaskAssignment[] {
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
