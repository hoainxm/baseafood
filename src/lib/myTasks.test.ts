import { describe, expect, it } from "vitest";
import type { TaskAssignment } from "@/types";
import type { FlowWarning } from "./dataFlow";
import { resolvePermissions, scopeContextFor } from "./permissions";
import {
  addDays,
  buildMyTasks,
  canDoTask,
  canReopenAssignment,
  countMyOpenAssignments,
  defaultDueDate,
  findResolvedAssignments,
  reopenAssignment,
  urgencyOf,
} from "./myTasks";

const TODAY = "2026-10-19";

const warning = (p: Partial<FlowWarning> & Pick<FlowWarning, "id" | "kind">): FlowWarning => ({
  level: "reminder",
  title: p.id,
  detail: "",
  date: "2026-10-18",
  workshop: "Đông",
  path: "/imports",
  ...p,
});

const assignment = (p: Partial<TaskAssignment> & Pick<TaskAssignment, "id">): TaskAssignment => ({
  source: "system",
  taskKey: "",
  title: "Việc",
  detail: "",
  path: "/imports",
  workshop: "",
  taskDate: "2026-10-18",
  dueDate: "",
  assigneeId: "u-keeper",
  assigneeName: "Thủy",
  assignedById: "u-boss",
  assignedByName: "Quản đốc",
  status: "open",
  note: "",
  doneAt: "",
  createdAt: "2026-10-18T08:00:00.000Z",
  ...p,
});

const perms = (role: string) => resolvePermissions({ roles: [role as never], isAdmin: false });
const ctx = (role: string, name = "") => scopeContextFor([role], name, "");

describe("hạn + quá hạn", () => {
  it("cộng ngày theo lịch UTC, qua tháng", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
  });

  it("hạn mặc định theo loại việc (chốt 2026-10-19)", () => {
    expect(defaultDueDate({ kind: "imports-unlocked", date: "2026-10-18" })).toBe("2026-10-18");
    expect(defaultDueDate({ kind: "approval-overdue", date: "2026-10-18" })).toBe("2026-10-21");
    expect(defaultDueDate({ kind: "period-unlocked", date: "2026-10-15" })).toBe("2026-10-17");
    expect(defaultDueDate({ kind: "backdated", date: "2026-10-18" })).toBe(""); // để biết — không hạn
  });

  it("đúng ngày hạn = hôm nay; qua ngày hạn = quá hạn (đếm số ngày); không hạn = để biết", () => {
    expect(urgencyOf("2026-10-19", TODAY)).toEqual({ urgency: "today", overdueDays: 0 });
    expect(urgencyOf("2026-10-16", TODAY)).toEqual({ urgency: "overdue", overdueDays: 3 });
    expect(urgencyOf("2026-10-25", TODAY).urgency).toBe("upcoming");
    expect(urgencyOf("", TODAY).urgency).toBe("info");
  });
});

describe("việc theo quyền + phạm vi", () => {
  const unlockedImport = warning({ id: "ccn|2026-10-18|Đông", kind: "imports-unlocked" });
  const unlockedWipCa = warning({ id: "ccs|2026-10-18|Cá", kind: "production-unlocked", workshop: "Cá", path: "/wip" });
  const pending = warning({ id: "cd|w1", kind: "approval-overdue", path: "/warehouse?approve=W:w1" });
  const lotOfLeader = warning({ id: "lo|W|w9", kind: "lot-unassigned", path: "/wip" });

  it("thủ kho: chốt ngày nhập; không chốt ngày SX, không duyệt kho", () => {
    expect(canDoTask(unlockedImport, perms("warehouse-keeper"), ctx("warehouse-keeper"))).toBe(true);
    expect(canDoTask(unlockedWipCa, perms("warehouse-keeper"), ctx("warehouse-keeper"))).toBe(false);
    expect(canDoTask(pending, perms("warehouse-keeper"), ctx("warehouse-keeper"))).toBe(false);
  });

  it("quản đốc xưởng Đông: chốt ngày SX xưởng mình, không xưởng Cá", () => {
    const ok = warning({ id: "ccs|2026-10-18|Đông", kind: "production-unlocked", path: "/wip" });
    expect(canDoTask(ok, perms("frozen-workshop-manager"), ctx("frozen-workshop-manager"))).toBe(true);
    expect(canDoTask(unlockedWipCa, perms("frozen-workshop-manager"), ctx("frozen-workshop-manager"))).toBe(false);
  });

  it("tổ trưởng: chỉ mẻ chưa gắn lô do CHÍNH MÌNH ghi", () => {
    const operators = new Map([["w9", "Lan"]]);
    expect(canDoTask(lotOfLeader, perms("team-leader"), ctx("team-leader", "Lan"), operators)).toBe(true);
    expect(canDoTask(lotOfLeader, perms("team-leader"), ctx("team-leader", "Hoa"), operators)).toBe(false);
  });
});

describe("buildMyTasks", () => {
  const w1 = warning({ id: "ccn|2026-10-16|Đông", kind: "imports-unlocked", date: "2026-10-16" });
  const w2 = warning({ id: "ccn|2026-10-19|Đông", kind: "imports-unlocked", date: "2026-10-19" });
  const base = { permissions: perms("warehouse-keeper"), scopeContext: ctx("warehouse-keeper"), today: TODAY };

  it("việc theo quyền: quá hạn đứng trước hôm nay, đếm đúng", () => {
    const r = buildMyTasks({ ...base, warnings: [w2, w1], assignments: [], userId: "u-keeper" });
    expect(r.mine.map((x) => [x.id, x.urgency, x.overdueDays])).toEqual([
      ["ccn|2026-10-16|Đông", "overdue", 3],
      ["ccn|2026-10-19|Đông", "today", 0],
    ]);
    expect([r.overdueCount, r.todayCount]).toEqual([1, 1]);
  });

  it("việc đã giao cho người khác: không còn ở 'theo quyền' của tôi (khỏi làm trùng)", () => {
    const a = assignment({ id: "a1", taskKey: w1.id, assigneeId: "u-other" });
    const r = buildMyTasks({ ...base, warnings: [w1, w2], assignments: [a], userId: "u-keeper" });
    expect(r.mine.map((x) => x.id)).toEqual([w2.id]);
  });

  it("được giao cho tôi: theo hạn người giao đặt; sổ sửa xong thì tự hết", () => {
    const a = assignment({ id: "a1", taskKey: w2.id, dueDate: "2026-10-18" });
    const gone = assignment({ id: "a2", taskKey: "ccn|2026-10-01|Đông" });
    const r = buildMyTasks({ ...base, warnings: [w2], assignments: [a, gone], userId: "u-keeper" });
    expect(r.assigned.map((x) => [x.id, x.urgency])).toEqual([["a1", "overdue"]]);
    expect(r.mine).toEqual([]); // không hiện 2 lần
    expect(findResolvedAssignments([a, gone], [w2]).map((x) => x.id)).toEqual(["a2"]);
  });

  it("việc giao tay: hiện cho người nhận tới khi bấm Xong", () => {
    const m = assignment({ id: "m1", source: "manual", title: "Cân lại phế liệu", dueDate: "2026-10-20" });
    const done = assignment({ id: "m2", source: "manual", status: "done", doneAt: "2026-10-19T09:00:00.000Z" });
    const r = buildMyTasks({ ...base, warnings: [], assignments: [m, done], userId: "u-keeper" });
    expect(r.assigned.map((x) => [x.id, x.kind, x.urgency])).toEqual([["m1", "manual", "upcoming"]]);
    // Đã bấm Xong ⇒ rời "cần làm", sang danh sách đã xong gần đây (để mở lại nếu nhầm), không đếm quá hạn.
    expect(r.assignedDone.map((x) => [x.id, x.urgency])).toEqual([["m2", "info"]]);
  });

  it("mở lại việc bấm Xong nhầm: chỉ người nhận, chỉ việc giao tay đã xong; về lại danh sách cần làm", () => {
    const done = assignment({ id: "m2", source: "manual", status: "done", doneAt: "2026-10-19T09:00:00.000Z", dueDate: "2026-10-17", note: "gấp" });
    expect(canReopenAssignment(done, "u-keeper")).toBe(true);
    expect(canReopenAssignment(done, "u-boss")).toBe(false); // người giao không bấm Xong ⇒ không mở lại thay
    expect(canReopenAssignment({ ...done, source: "system" }, "u-keeper")).toBe(false);
    expect(canReopenAssignment({ ...done, status: "cancelled" }, "u-keeper")).toBe(false);
    expect(canReopenAssignment(done, "")).toBe(false);

    const reopened = reopenAssignment(done);
    expect(reopened).toEqual({ ...done, status: "open", doneAt: "" });
    const r = buildMyTasks({ ...base, warnings: [], assignments: [reopened], userId: "u-keeper" });
    expect(r.assigned.map((x) => [x.id, x.urgency])).toEqual([["m2", "overdue"]]);
    expect(r.assignedDone).toEqual([]);
    expect(r.overdueCount).toBe(1);
  });

  it("việc xong quá 7 ngày không còn trong danh sách đã xong gần đây", () => {
    const old = assignment({ id: "m3", source: "manual", status: "done", doneAt: "2026-10-01T09:00:00.000Z" });
    const r = buildMyTasks({ ...base, warnings: [], assignments: [old], userId: "u-keeper" });
    expect(r.assignedDone).toEqual([]);
  });

  it("tôi đã giao: việc mở + việc xong trong 7 ngày; việc máy đã sửa thì đánh dấu đã xong", () => {
    const open = assignment({ id: "a1", taskKey: w1.id });
    const resolved = assignment({ id: "a2", taskKey: "ccn|2026-10-01|Đông" });
    const oldDone = assignment({ id: "a3", source: "manual", status: "done", doneAt: "2026-10-01T00:00:00.000Z" });
    const r = buildMyTasks({ ...base, warnings: [w1], assignments: [open, resolved, oldDone], userId: "u-boss" });
    expect(r.delegated.map((x) => x.id).sort()).toEqual(["a1", "a2"]);
    expect(r.delegated.find((x) => x.id === "a2")?.isResolved).toBe(true);
    expect(r.overdueCount).toBe(0); // việc đã giao đi không tính là việc của tôi
  });

  it("chuông header chỉ đếm việc được giao cho tôi đang mở", () => {
    const xs = [
      assignment({ id: "a", dueDate: "2026-10-17" }),
      assignment({ id: "b", dueDate: "2026-10-25" }),
      assignment({ id: "c", status: "done" }),
      assignment({ id: "d", assigneeId: "u-other" }),
    ];
    expect(countMyOpenAssignments(xs, "u-keeper", TODAY)).toEqual({ open: 2, overdue: 1 });
  });
});

// ---------- ba-spec 59 — Việc của tôi theo nhóm trang + admin xem như (AC-1…AC-10) ----------
import { groupTasks, parseViewAs, planningTaskWarnings, taskGroupOf, viewAsContext, type TaskWarning } from "./myTasks";
import type { PlanningAttention } from "./dashboardAttention";
import type { AppRole, RolePermission, UserPermission } from "@/types";

const T59 = "2026-11-02";
const plan = (p: Partial<PlanningAttention> & Pick<PlanningAttention, "id" | "kind" | "module">): PlanningAttention => ({
  level: "reminder",
  title: p.id,
  detail: "",
  date: "2026-10-28",
  workshop: "",
  path: "/planning-import",
  ...p,
});
const rp = (roleId: string, resource: string, action: string, scope = "all"): RolePermission => ({ id: `${roleId}|${resource}|${action}`, roleId, resource, action, scope });
const ROLES59: AppRole[] = [
  { id: "planner", name: "Nhân viên Kế hoạch" },
  { id: "warehouse-keeper", name: "Thủ kho nhập hàng" },
  { id: "frozen-workshop-manager", name: "Quản đốc xưởng Đông" },
].map((r, i) => ({ ...r, sortOrder: i }) as unknown as AppRole);
const ROWS59: RolePermission[] = [
  rp("planner", "import-plans", "update"),
  rp("planner", "export-plans", "update"),
  rp("planner", "production-orders", "update"),
  rp("warehouse-keeper", "import-plans.receiving", "update"),
  rp("frozen-workshop-manager", "imports", "lock", "workshop"),
  rp("frozen-workshop-manager", "wip", "lock", "workshop"),
];
const PLAN_ROWS = planningTaskWarnings([
  plan({ id: "p1", module: "import", kind: "import-missing-docs" }),
  plan({ id: "p2", module: "import", kind: "import-awaiting-quantity" }),
  plan({ id: "p3", module: "production-order", kind: "order-draft-overdue", path: "/planning-production" }),
]);
const asRole = (roleId: string) => viewAsContext({ kind: "role", roleId }, { appRoles: ROLES59, rolePermissionRows: ROWS59, userPermissionRows: [], profiles: [] })!;
const mineOf = (warnings: readonly TaskWarning[], ctx: ReturnType<typeof asRole>) =>
  buildMyTasks({ warnings, assignments: [], userId: ctx.userId || "x", permissions: ctx.permissions, scopeContext: ctx.scopeContext, today: T59 }).mine;

describe("ba-spec 59 AC-1 — việc Kế hoạch theo quyền từng mục", () => {
  it("planner (import-plans.update): Thiếu chứng từ + Chờ thực nhập; thủ kho (receiving): chỉ Chờ thực nhập; Nháp quá ngày SX cần production-orders", () => {
    const planner = mineOf(PLAN_ROWS, asRole("planner"));
    const keeper = mineOf(PLAN_ROWS, asRole("warehouse-keeper"));
    expect(planner.map((k) => k.kind).sort()).toEqual(["import-awaiting-quantity", "import-missing-docs", "order-draft-overdue"]);
    expect(keeper.map((k) => k.kind)).toEqual(["import-awaiting-quantity"]);
  });
});

describe("ba-spec 59 AC-2 — hạn việc Kế hoạch", () => {
  it("Chờ thực nhập về 28/10 ⇒ hạn 31/10, quá hạn 2 ngày ngày 02/11", () => {
    const k = mineOf(PLAN_ROWS, asRole("warehouse-keeper"))[0];
    expect(k.dueDate).toBe("2026-10-31");
    expect(k.urgency).toBe("overdue");
    expect(k.overdueDays).toBe(2);
  });
  it("Còn tiền chưa về: không hạn nhưng vẫn ở Cần làm (không phải Để biết)", () => {
    const rows = planningTaskWarnings([plan({ id: "u", module: "export", kind: "export-unpaid", date: "", path: "/planning-export" })]);
    const ctx = viewAsContext({ kind: "role", roleId: "x" }, { appRoles: [{ id: "x", name: "x", sortOrder: 0 } as unknown as AppRole], rolePermissionRows: [rp("x", "export-plans.payments", "update")], userPermissionRows: [], profiles: [] })!;
    const k = mineOf(rows, ctx)[0];
    expect(k.dueDate).toBe("");
    expect(k.urgency).toBe("upcoming");
  });
});

describe("ba-spec 59 AC-3 — nhóm theo tài nguyên quyền", () => {
  it("Nhập hàng · Kho · Kế hoạch/Xuất khẩu · Kế hoạch/Lệnh sản xuất", () => {
    const ks = [
      taskGroupOf({ kind: "imports-unlocked", path: "/imports" }),
      taskGroupOf({ kind: "oversold", path: "/warehouse" }),
      taskGroupOf({ kind: "export-overdue", path: "/planning-export" }),
      taskGroupOf({ kind: "order-unlinked", path: "/planning-production" }),
    ];
    expect(ks.map((k) => k.group)).toEqual(["imports", "warehouse", "planning", "planning"]);
    expect(ks.map((k) => k.page)).toEqual(["", "", "export", "production-order"]);
  });
  it("việc giao tay theo màn của đường mở", () => {
    expect(taskGroupOf({ kind: "manual", path: "/planning-import?contract=c1" })).toEqual({ group: "planning", page: "import" });
    expect(taskGroupOf({ kind: "manual", path: "" })).toEqual({ group: "other", page: "" });
  });
});

describe("ba-spec 59 AC-4 — vai chỉ thấy nhóm được phân", () => {
  it("planner ⇒ chỉ nhóm Kế hoạch dù có việc mọi nhóm", () => {
    const all: TaskWarning[] = [...PLAN_ROWS, warning({ id: "c1", kind: "imports-unlocked" }), warning({ id: "c2", kind: "production-unlocked", path: "/wip" })];
    expect([...new Set(groupTasks(mineOf(all, asRole("planner"))).map((g) => g.group))]).toEqual(["planning"]);
  });
});

describe("ba-spec 59 AC-5 — xem như vai = người chỉ có vai đó", () => {
  it("quản đốc xưởng Đông: cùng id việc", () => {
    const all: TaskWarning[] = [warning({ id: "d", kind: "imports-unlocked", workshop: "Đông" }), warning({ id: "c", kind: "imports-unlocked", workshop: "Cá" }), ...PLAN_ROWS];
    const src = { appRoles: ROLES59, rolePermissionRows: ROWS59, userPermissionRows: [], profiles: [{ id: "u1", fullName: "Người P", username: "p", roles: ["frozen-workshop-manager" as const] }] };
    const role = viewAsContext({ kind: "role", roleId: "frozen-workshop-manager" }, src)!;
    const user = viewAsContext({ kind: "user", userId: "u1" }, src)!;
    expect(mineOf(all, role).map((k) => k.id)).toEqual(["d"]);
    expect(mineOf(all, user).map((k) => k.id)).toEqual(mineOf(all, role).map((k) => k.id));
  });
});

describe("ba-spec 59 AC-6 — xem như người gồm chỉnh riêng + việc được giao", () => {
  it("planner bị chặn riêng production-orders.update ⇒ không việc Lệnh SX; có 1 việc giao cho người đó", () => {
    const deny: UserPermission = { id: "q|production-orders|update", userId: "q", resource: "production-orders", action: "update", effect: "deny", scope: "all" };
    const ctx = viewAsContext({ kind: "user", userId: "q" }, { appRoles: ROLES59, rolePermissionRows: ROWS59, userPermissionRows: [deny], profiles: [{ id: "q", fullName: "Q", username: "q", roles: ["planner"] }] })!;
    const r = buildMyTasks({ warnings: PLAN_ROWS, assignments: [assignment({ id: "a1", source: "manual", assigneeId: "q" })], userId: ctx.userId, permissions: ctx.permissions, scopeContext: ctx.scopeContext, today: T59 });
    expect(r.mine.filter((k) => k.group.page === "production-order")).toHaveLength(0);
    expect(r.assigned).toHaveLength(1);
  });
});

describe("ba-spec 59 AC-9 — tổng hợp theo nhóm cho admin", () => {
  it("2 nhóm, đếm quá hạn đúng, thứ tự nhóm hệ thống", () => {
    const admin = resolvePermissions({ roles: ["admin"], isAdmin: true });
    const all: TaskWarning[] = [
      ...PLAN_ROWS.slice(0, 2),
      warning({ id: "i1", kind: "imports-unlocked", date: "2026-10-30" }),
      warning({ id: "i2", kind: "imports-unlocked", date: T59 }),
      warning({ id: "i3", kind: "changed-after-lock", date: T59 }),
    ];
    const mine = buildMyTasks({ warnings: all, assignments: [], userId: "admin", permissions: admin, scopeContext: scopeContextFor(["admin"]), today: T59 }).mine;
    expect(groupTasks(mine).map((g) => ({ group: g.group, page: g.page, count: g.items.length, overdue: g.overdue }))).toEqual([
      { group: "imports", page: "", count: 3, overdue: 1 },
      // Thiếu chứng từ + Chờ thực nhập về 28/10 ⇒ hạn 31/10 ⇒ cả hai quá hạn ngày 02/11.
      { group: "planning", page: "import", count: 2, overdue: 2 },
    ]);
  });
});

describe("ba-spec 59 AC-10 — chỉ admin có Xem như", () => {
  it("người thường ⇒ null; admin đọc đúng vai / người; tham số hỏng ⇒ null", () => {
    expect(parseViewAs("role:planner", false)).toBeNull();
    expect(parseViewAs("role:planner", true)).toEqual({ kind: "role", roleId: "planner" });
    expect(parseViewAs("user:u1", true)).toEqual({ kind: "user", userId: "u1" });
    expect(parseViewAs("abc", true)).toBeNull();
  });
});
