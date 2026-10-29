import { describe, expect, it } from "vitest";
import type { AppRole, Role, UserProfile } from "@/types";
import { ROLES } from "@/types";
import { SYSTEM_ROLE_DEPARTMENTS } from "@/lib/documents";
import { groupOfRole, groupUsersByDepartment, roleLevel, sortRolesByRank, ungroupedDepartments } from "@/lib/userDirectory";

const user = (id: string, roles: Role[], fullName = id): UserProfile => ({ id, username: id, fullName, roles });
const custom = (id: string, name: string, department = ""): AppRole => ({
  id,
  name,
  description: "",
  homeRoute: "",
  sortOrder: 0,
  department,
});

describe("gom người dùng theo phòng ban", () => {
  it("mọi phòng ban đều có nhóm hiển thị (thêm phòng mới phải xếp nhóm)", () => {
    expect(ungroupedDepartments()).toEqual([]);
  });

  it("mọi vai trò hệ thống (trừ admin) có phòng ban ⇒ không rơi vào nhóm vai trò tự tạo", () => {
    for (const r of ROLES.map((x) => x.value).filter((v) => v !== "admin")) {
      expect(SYSTEM_ROLE_DEPARTMENTS[r], r).toBeTruthy();
      expect(groupOfRole(r), r).not.toBe("");
    }
  });

  it("phòng Kế hoạch: Trưởng → Phó → Nhân viên", () => {
    const groups = groupUsersByDepartment([
      user("an", ["planner"]),
      user("binh", ["planning-deputy"]),
      user("chi", ["planning-head"]),
      user("dung", ["planner"], "Ánh"),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Phòng Kế hoạch"]);
    expect(groups[0].users.map((u) => u.id)).toEqual(["chi", "binh", "an", "dung"]);
  });

  it("thứ tự nhóm + nhiều vai trò ⇒ nhóm xếp trước thắng", () => {
    const groups = groupUsersByDepartment([
      user("kt", ["accountant"]),
      user("pgd", ["manager-dong", "vice-director"]),
      user("ad", ["admin"]),
      user("trong", []),
    ]);
    expect(groups.map((g) => [g.id, g.users.map((u) => u.id)])).toEqual([
      ["board", ["pgd"]],
      ["accounting", ["kt"]],
      ["system-admin", ["ad"]],
      ["unassigned", ["trong"]],
    ]);
    expect(sortRolesByRank(["manager-dong", "vice-director"])).toEqual(["vice-director", "manager-dong"]);
  });

  it("vai trò tự tạo: theo phòng đã chọn, cấp suy từ tên", () => {
    const appRoles = [
      custom("role-a", "Trưởng phòng QC", "quality"),
      custom("role-b", "Phó phòng QC", "quality"),
      custom("role-c", "Nhân viên QC", "quality"),
      custom("role-d", "Thư ký"),
    ];
    expect(roleLevel("role-a", appRoles)).toBe(0);
    expect(roleLevel("role-b", appRoles)).toBe(1);
    expect(roleLevel("role-c", appRoles)).toBe(2);
    expect(roleLevel("role-e", [custom("role-e", "Kế toán trưởng chi nhánh")])).toBe(2);
    expect(roleLevel("role-f", [custom("role-f", "Tổ trưởng")])).toBe(0);
    const groups = groupUsersByDepartment(
      [user("c", ["role-c"]), user("a", ["role-a"]), user("b", ["role-b"]), user("d", ["role-d"])],
      appRoles
    );
    expect(groups.map((g) => [g.name, g.users.map((u) => u.id)])).toEqual([
      ["QC – Kỹ thuật", ["a", "b", "c"]],
      ["Vai trò tự tạo chưa chọn phòng", ["d"]],
    ]);
  });

  it("vai trò hệ thống admin đã chọn phòng khác ở /roles ⇒ theo phòng đã chọn", () => {
    expect(groupOfRole("planner", [custom("planner", "Nhân viên Kế hoạch", "accounting")])).toBe("accounting");
  });
});
