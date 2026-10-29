import { describe, expect, it } from "vitest";
import type { TaskAssignment } from "@/types";
import type { FlowWarning } from "./dataFlow";
import { resolvePermissions, scopeContextFor } from "./permissions";
import {
  addDays,
  buildMyTasks,
  canDoTask,
  countMyOpenAssignments,
  defaultDueDate,
  findResolvedAssignments,
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
