// Oracle: docs/app-map/43-guided-tour.ba-spec.md v5 — AC-17 (ai làm khớp ma trận quyền),
// AC-18 (phủ nhãn trạng thái), AC-19 (việc của bạn theo quyền thật), AC-20 (ít chữ).
import { describe, expect, test } from "vitest";
import { CONTRACT_STATE_LABELS, ITEM_STATE_LABELS } from "@/lib/exportPlanning";
import { CONTRACT_STATE_LABELS as IMPORT_CONTRACT_LABELS, RECEIPT_STATE_LABELS } from "@/lib/importPlanning";
import { can, resolvePermissions } from "@/lib/permissions";
import { ORDER_STATUS_LABELS } from "@/lib/productionOrder";
import { ROLES, type Role } from "@/types";
import {
  EXPORT_GUIDE_ACTORS,
  EXPORT_GUIDE_CONTRACT_STATES,
  EXPORT_GUIDE_ITEM_SIDE,
  EXPORT_GUIDE_ITEM_STATES,
  EXPORT_GUIDE_SIDE_STATES,
  EXPORT_GUIDE_STEPS,
} from "./exportPlanningGuide";
import {
  IMPORT_GUIDE_ACTORS,
  IMPORT_GUIDE_CONTRACT_SIDE,
  IMPORT_GUIDE_CONTRACT_STATES,
  IMPORT_GUIDE_RECEIPT_SIDE,
  IMPORT_GUIDE_RECEIPT_STATES,
  IMPORT_GUIDE_STEPS,
} from "./importPlanningGuide";
import { ORDER_GUIDE_ACTORS, ORDER_GUIDE_SIDE, ORDER_GUIDE_STATES, ORDER_GUIDE_STEPS } from "./productionOrderGuide";
import { stepsForViewer, stepsOfActor, type GuideActor, type GuideFlowStep } from "./flowGuide";

const SYSTEM_ROLES = ROLES.map((r) => r.value).filter((r): r is Role => r !== "admin");
const permsOf = (role: Role) => resolvePermissions({ roles: [role], isAdmin: false });

/** Vai trò hệ thống (trừ admin) làm được bước — theo ma trận quyền mặc định. */
const rolesWith = (s: GuideFlowStep) => SYSTEM_ROLES.filter((r) => can(permsOf(r), s.needs[0], s.needs[1])).sort();
const rolesOfActors = (actors: readonly GuideActor[], ids: readonly string[]) =>
  [...new Set(ids.flatMap((id) => actors.find((a) => a.id === id)?.roles ?? []))].sort();

function checkFlow(name: string, steps: readonly GuideFlowStep[], actors: readonly GuideActor[], pageResource: string) {
  describe(`${name}: ai làm khớp ma trận quyền (AC-17)`, () => {
    test.each(steps.map((s) => [s.id, s] as const))("bước %s", (_id, s) => {
      expect(rolesOfActors(actors, s.actors)).toEqual(rolesWith(s));
    });
    test("mọi id nhóm ở bước đều có trong danh sách nhóm", () => {
      const ids = new Set(actors.map((a) => a.id));
      expect(steps.flatMap((s) => s.actors).filter((id) => !ids.has(id))).toEqual([]);
    });
    test("nhóm chỉ xem không làm bước nào, nhóm còn lại làm ít nhất một bước", () => {
      for (const a of actors) expect(stepsOfActor(steps, a.id).length > 0).toBe(!a.viewOnly);
    });
    test("mọi vai trò xem được trang đều nằm trong đúng một nhóm", () => {
      const viewers = SYSTEM_ROLES.filter((r) => can(permsOf(r), pageResource, "view"));
      const listed = actors.flatMap((a) => a.roles);
      expect(new Set(listed).size).toBe(listed.length);
      for (const r of viewers) expect(listed).toContain(r);
    });
  });
  describe(`${name}: ít chữ (AC-20)`, () => {
    test("3–8 bước, mỗi bước tối đa 2 câu", () => {
      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps.length).toBeLessThanOrEqual(8);
      for (const s of steps) expect(s.text.split(/[.!?](\s|$)/).filter((x) => x.trim().length > 1).length).toBeLessThanOrEqual(2);
    });
  });
}

checkFlow("Xuất khẩu", EXPORT_GUIDE_STEPS, EXPORT_GUIDE_ACTORS, "export-plans");

describe("Xuất khẩu: phủ nhãn trạng thái (AC-18)", () => {
  test("đủ mọi trạng thái hợp đồng", () => {
    const shown = [...EXPORT_GUIDE_CONTRACT_STATES, ...EXPORT_GUIDE_SIDE_STATES].map((s) => s.label).sort();
    expect(shown).toEqual(Object.values(CONTRACT_STATE_LABELS).sort());
  });
  test("đủ mọi trạng thái mục trong bước", () => {
    const shown = [...EXPORT_GUIDE_ITEM_STATES, ...EXPORT_GUIDE_ITEM_SIDE].map((s) => s.label).sort();
    expect(shown).toEqual(Object.values(ITEM_STATE_LABELS).sort());
  });
});

checkFlow("Nhập khẩu", IMPORT_GUIDE_STEPS, IMPORT_GUIDE_ACTORS, "import-plans");

describe("Nhập khẩu: phủ nhãn trạng thái (AC-18)", () => {
  test("đủ mọi trạng thái lần nhập", () => {
    const shown = [...IMPORT_GUIDE_RECEIPT_STATES, ...IMPORT_GUIDE_RECEIPT_SIDE].map((s) => s.label).sort();
    expect(shown).toEqual(Object.values(RECEIPT_STATE_LABELS).sort());
  });
  test("đủ mọi trạng thái hợp đồng", () => {
    const shown = [...IMPORT_GUIDE_CONTRACT_STATES, ...IMPORT_GUIDE_CONTRACT_SIDE].map((s) => s.label).sort();
    expect(shown).toEqual(Object.values(IMPORT_CONTRACT_LABELS).sort());
  });
});

checkFlow("Lệnh sản xuất", ORDER_GUIDE_STEPS, ORDER_GUIDE_ACTORS, "production-orders");

describe("Lệnh sản xuất: phủ nhãn trạng thái (AC-18) + việc của bạn", () => {
  test("đủ mọi trạng thái lệnh", () => {
    const shown = [...ORDER_GUIDE_STATES, ...ORDER_GUIDE_SIDE].map((s) => s.label).sort();
    expect(shown).toEqual(Object.values(ORDER_STATUS_LABELS).sort());
  });
  test("Nhân viên Kế hoạch: cả 4 bước; quản đốc, thủ kho, kế toán: không bước nào", () => {
    const of = (role: Role) => stepsForViewer(ORDER_GUIDE_STEPS, (r, a) => can(permsOf(role), r, a));
    expect(of("planner")).toEqual(ORDER_GUIDE_STEPS.map((s) => s.id));
    for (const r of ["frozen-workshop-manager", "warehouse-keeper", "accountant"] as const) expect(of(r)).toEqual([]);
  });
});

describe("Việc của bạn theo quyền thật (AC-19)", () => {
  const mine = (role: Role) => stepsForViewer(EXPORT_GUIDE_STEPS, (r, a) => can(permsOf(role), r, a));
  test("Nhân viên Kế hoạch: mọi bước trừ duyệt cuối", () => {
    expect(mine("planner")).toEqual(EXPORT_GUIDE_STEPS.map((s) => s.id).filter((id) => id !== "final"));
  });
  test("Trưởng phòng Kế hoạch: đủ 7 bước", () => {
    expect(mine("planning-head")).toHaveLength(EXPORT_GUIDE_STEPS.length);
  });
  test("Thủ kho: chỉ ảnh và sơ đồ đóng cont", () => {
    expect(mine("warehouse-keeper")).toEqual(["loading"]);
  });
  test("Kế toán: chỉ gửi chứng từ · tiền về", () => {
    expect(mine("accountant")).toEqual(["payments"]);
  });
  test("Giám đốc: không bước nào", () => {
    expect(mine("director")).toEqual([]);
  });
  test("Nhập khẩu — Thủ kho: chỉ ghi thực nhập; Kế toán: không bước nào", () => {
    const of = (role: Role) => stepsForViewer(IMPORT_GUIDE_STEPS, (r, a) => can(permsOf(role), r, a));
    expect(of("warehouse-keeper")).toEqual(["quantity"]);
    expect(of("accountant")).toEqual([]);
    expect(of("planner")).toEqual(IMPORT_GUIDE_STEPS.map((s) => s.id));
  });
});
