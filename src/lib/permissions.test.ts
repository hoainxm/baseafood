import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canOnRow,
  isPermissionLoading,
  rowInScope,
  scopeContextFor,
  LEGACY_ROLE_PERMISSIONS,
  buildRolePermissions,
  buildUserOverrides,
  explainPermission,
  listRoleOptions,
  roleNames,
  DEFAULT_ROLE_PERMISSIONS,
  OFFLINE_PERMISSIONS,
  PERMISSION_NAV_IDS,
  PERMISSION_RESOURCES,
  can,
  resolvePermissions,
  scopeOf,
  visibleNavIds,
  type PermissionGrant,
} from "./permissions";
import { ROLES, type AppRole, type Role, type RolePermission, type UserPermission } from "@/types";

const resolveFor = (roles: Role[], extra: Partial<Parameters<typeof resolvePermissions>[0]> = {}) =>
  resolvePermissions({ roles, isAdmin: false, ...extra });

describe("resolvePermissions", () => {
  it("admin ⇒ toàn quyền, kể cả màn admin và mọi hành động áp dụng được", () => {
    const p = resolvePermissions({ roles: ["admin"], isAdmin: true });
    for (const r of PERMISSION_RESOURCES) for (const a of r.actions) expect(can(p, r.id, a)).toBe(true);
    expect(scopeOf(p, "imports", "delete")).toBe("all");
  });

  it("không vai trò ⇒ không quyền nào", () => {
    const p = resolveFor([]);
    expect(p.hasRoles).toBe(false);
    expect(p.grants.size).toBe(0);
    expect(visibleNavIds(p).size).toBe(0);
  });

  it("vai trò lạ (không có trong ma trận) ⇒ không quyền nào, không leo thành đầy đủ", () => {
    const p = resolveFor(["unknown-role" as Role]);
    expect(p.hasRoles).toBe(true);
    expect(p.grants.size).toBe(0);
  });

  it("hành động không áp dụng cho tài nguyên ⇒ luôn false", () => {
    const p = resolvePermissions({ roles: [], isAdmin: true });
    expect(can(p, "packaging", "lock")).toBe(false);
    expect(can(p, "no-such-screen", "view")).toBe(false);
  });

  it("nhiều vai trò ⇒ HỢP quyền, phạm vi lấy rộng nhất", () => {
    const matrix: Partial<Record<Role, PermissionGrant[]>> = {
      "team-leader": [{ resource: "wip", action: "update", scope: "own" }],
      "manager-dong": [
        { resource: "wip", action: "update", scope: "workshop" },
        { resource: "wip", action: "lock", scope: "workshop" },
      ],
      accountant: [{ resource: "balancing", action: "create", scope: "all" }],
    };
    const p = resolveFor(["team-leader", "manager-dong", "accountant"], { rolePermissions: matrix });
    expect(scopeOf(p, "wip", "update")).toBe("workshop");
    expect(can(p, "wip", "lock")).toBe(true);
    expect(can(p, "balancing", "create")).toBe(true);
    expect(can(p, "wip", "delete")).toBe(false);
  });

  it("có hành động bất kỳ ⇒ tự có view (cùng phạm vi)", () => {
    const p = resolveFor(["accountant"], {
      rolePermissions: { accountant: [{ resource: "sales", action: "update", scope: "own" }] },
    });
    expect(can(p, "sales", "view")).toBe(true);
    expect(scopeOf(p, "sales", "view")).toBe("own");
  });

  it("chỉnh riêng: chặn > cho > vai trò", () => {
    const p = resolveFor(["accountant"], {
      overrides: [
        { resource: "balancing", action: "delete", effect: "deny" },
        { resource: "balancing", action: "delete", effect: "allow" },
        { resource: "imports", action: "unlock", effect: "deny" },
      ],
    });
    expect(can(p, "balancing", "delete")).toBe(false);
    expect(can(p, "balancing", "update")).toBe(true);
    expect(can(p, "imports", "unlock")).toBe(false);
    expect(can(p, "imports", "lock")).toBe(true);
  });

  it("cho riêng ngoài vai trò ⇒ có, kèm view", () => {
    const p = resolveFor(["warehouse-keeper"], {
      overrides: [{ resource: "sales", action: "create", effect: "allow" }],
    });
    expect(can(p, "sales", "create")).toBe(true);
    expect(can(p, "sales", "view")).toBe(true);
    expect(can(p, "sales", "delete")).toBe(false);
  });

  it("chặn riêng view ⇒ gỡ mọi hành động của tài nguyên đó", () => {
    const p = resolveFor(["warehouse-keeper"], {
      overrides: [{ resource: "imports", action: "view", effect: "deny" }],
    });
    for (const a of ["view", "create", "delete", "lock"] as const) expect(can(p, "imports", a)).toBe(false);
    expect(visibleNavIds(p).has("imports")).toBe(false);
  });

  it("màn của admin không cấp được cho người thường (ma trận hay chỉnh riêng)", () => {
    const p = resolveFor(["accountant"], {
      rolePermissions: { accountant: [{ resource: "users", action: "view", scope: "all" }] },
      overrides: [{ resource: "audit", action: "view", effect: "allow" }],
    });
    expect(can(p, "users", "view")).toBe(false);
    expect(can(p, "audit", "view")).toBe(false);
  });
});

describe("ma trận LEGACY (Đợt 1–3) = hành vi trước 2026-10-15 — giữ làm đường lùi khẩn", () => {
  const legacy = (roles: Role[]) => resolvePermissions({ roles, isAdmin: false, rolePermissions: LEGACY_ROLE_PERMISSIONS });
  it("vai trò không giới hạn làm được MỌI hành động ở mọi màn trừ màn admin", () => {
    for (const role of ["director", "vice-director", "chief-accountant", "accountant"] as const) {
      const p = legacy([role]);
      for (const r of PERMISSION_RESOURCES)
        for (const a of r.actions) expect(can(p, r.id, a), `${role} ${r.id}:${a}`).toBe(!r.adminOnly);
    }
  });
  it("bộ phận làm được mọi hành động trong màn của mình, không gì ngoài", () => {
    expect(can(legacy(["warehouse-keeper"]), "imports", "unlock")).toBe(true);
    expect(can(legacy(["warehouse-keeper"]), "balancing", "view")).toBe(false);
    expect(can(legacy(["team-leader"]), "wip", "delete")).toBe(true);
  });
});

describe("ma trận ĐANG ÁP — Đợt 4 (spec §7 + 2 điều chỉnh chủ dự án 2026-10-15)", () => {
  const writeActions = ["create", "update", "delete", "lock", "unlock", "approve", "import"] as const;

  it("ban giám đốc CHỈ xem + xuất (không thêm/sửa/xóa/chốt/mở lại/duyệt/nạp ở đâu cả), thấy giá", () => {
    for (const role of ["director", "vice-director"] as const) {
      const p = resolveFor([role]);
      for (const r of PERMISSION_RESOURCES) for (const a of writeActions) expect(can(p, r.id, a), `${role} ${r.id}:${a}`).toBe(false);
      for (const r of ["imports", "sales", "balancing"]) expect(can(p, r, "view-price"), r).toBe(true);
    }
  });

  it("MỞ LẠI chỉ ở kế toán trưởng (sổ kế toán) + quản đốc (SX, QC); không vai trò nào khác", () => {
    const unlockers = new Set<string>();
    for (const [role, grants] of Object.entries(DEFAULT_ROLE_PERMISSIONS))
      for (const g of grants) if (g.action === "unlock") unlockers.add(role);
    expect([...unlockers].sort()).toEqual(["chief-accountant", "manager-ca", "manager-dong", "manager-kho"]);
  });

  it("kế toán KHÔNG xóa, KHÔNG mở lại; có Thêm/Sửa/Chốt ở Nhập hàng + SX TP (người nhập liệu)", () => {
    const p = resolveFor(["accountant"]);
    for (const r of PERMISSION_RESOURCES) {
      expect(can(p, r.id, "delete"), `${r.id}:delete`).toBe(false);
      expect(can(p, r.id, "unlock"), `${r.id}:unlock`).toBe(false);
    }
    for (const r of ["imports", "wip"]) for (const a of ["create", "update", "lock"] as const) expect(can(p, r, a), `${r}:${a}`).toBe(true);
  });

  it("bộ phận xưởng KHÔNG thấy giá ở đâu; thủ kho thấy giá nhập", () => {
    for (const role of ["manager-dong", "manager-ca", "manager-kho", "vice-manager", "team-leader"] as const) {
      const p = resolveFor([role]);
      for (const r of PERMISSION_RESOURCES) expect(can(p, r.id, "view-price"), `${role} ${r.id}`).toBe(false);
    }
    expect(can(resolveFor(["warehouse-keeper"]), "imports", "view-price")).toBe(true);
    expect(can(resolveFor(["warehouse-keeper"]), "sales", "view")).toBe(false);
  });

  it("phó quản đốc xóa được dòng SX (chủ dự án chốt) nhưng không chốt / mở lại; tổ trưởng không xóa", () => {
    const vm = resolveFor(["vice-manager"]);
    expect(can(vm, "wip", "delete")).toBe(true);
    expect(can(vm, "wip", "lock")).toBe(false);
    expect(can(vm, "wip", "unlock")).toBe(false);
    expect(can(resolveFor(["team-leader"]), "wip", "delete")).toBe(false);
  });

  it("phó GĐ kiêm quản đốc Đông (người thật) ⇒ HỢP: ghi được SX, chỉ xem sổ kế toán", () => {
    const p = resolveFor(["vice-director", "manager-dong"]);
    expect(can(p, "wip", "unlock")).toBe(true);
    expect(can(p, "balancing", "update")).toBe(false);
    expect(can(p, "balancing", "view-price")).toBe(true);
  });
});

describe("ma trận nào cũng hợp lệ", () => {
  it("mọi vai trò (trừ admin) có dòng; mọi ô trỏ tới tài nguyên + hành động có thật", () => {
    for (const matrix of [DEFAULT_ROLE_PERMISSIONS, LEGACY_ROLE_PERMISSIONS]) {
      for (const { value } of ROLES) if (value !== "admin") expect(matrix[value], value).toBeDefined();
      for (const grants of Object.values(matrix))
        for (const g of grants ?? []) {
          const r = PERMISSION_RESOURCES.find((x) => x.id === g.resource);
          expect(r && r.actions.includes(g.action), `${g.resource}:${g.action}`).toBe(true);
        }
    }
  });

  it("chạy không đăng nhập (localStorage) ⇒ mọi màn trừ màn admin", () => {
    const adminNav = new Set(PERMISSION_RESOURCES.filter((r) => r.adminOnly).map((r) => r.navId));
    expect([...visibleNavIds(OFFLINE_PERMISSIONS)].sort()).toEqual(
      PERMISSION_NAV_IDS.filter((id) => !adminNav.has(id)).sort()
    );
  });
});

describe("sổ đăng ký tài nguyên khớp code", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

  it("id tài nguyên không trùng, tiếng Anh kebab-case", () => {
    const ids = PERMISSION_RESOURCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*(\.[a-z]+(-[a-z]+)*)?$/);
  });

  it("mọi mục nav (KIT_NAV) có tài nguyên và ngược lại — thêm màn mà quên khai quyền thì đỏ", () => {
    const shell = read("features/shared/AppShell.tsx");
    const block = shell.slice(shell.indexOf("export const KIT_NAV"), shell.indexOf("];", shell.indexOf("export const KIT_NAV")));
    const navIds = [...block.matchAll(/\{\s*id:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(navIds.length).toBeGreaterThan(10);
    expect([...navIds].sort()).toEqual([...PERMISSION_NAV_IDS].sort());
  });

  it("mọi route màn thật trong App.tsx có tài nguyên", () => {
    const app = read("App.tsx");
    const segs = new Set(
      [...app.matchAll(/<Route\s+path="\/([a-z-]+)[^"]*"\s+element=\{<(?!Navigate)/g)].map((m) => m[1])
    );
    segs.delete("kit"); // trang bộ giao diện cho dev, không phải màn nghiệp vụ
    for (const seg of segs) expect(PERMISSION_NAV_IDS, seg).toContain(seg);
    expect(segs.size).toBeGreaterThan(10);
  });
});

describe("Đợt 2 — ma trận đọc từ DB (mig 0062)", () => {
  const role = (id: string, name = id): AppRole => ({ id, name, description: "", homeRoute: "", sortOrder: 0 });
  const grant = (roleId: string, resource: string, action: string, scope = "all"): RolePermission => ({
    id: `${roleId}|${resource}|${action}`,
    roleId,
    resource,
    action,
    scope,
  });

  it("bảng rỗng ⇒ đúng ma trận mặc định (hành vi Đợt 1)", () => {
    expect(buildRolePermissions([], [])).toBe(DEFAULT_ROLE_PERMISSIONS);
  });

  it("vai trò đã chỉnh dùng ĐÚNG ô trong DB; vai trò chưa chỉnh giữ mặc định", () => {
    const m = buildRolePermissions([role("accountant")], [grant("accountant", "balancing", "view"), grant("accountant", "balancing", "update")]);
    const acc = resolveFor(["accountant"], { rolePermissions: m });
    expect(can(acc, "balancing", "update")).toBe(true);
    expect(can(acc, "balancing", "delete")).toBe(false);
    expect(can(acc, "imports", "view")).toBe(false);
    const dir = resolveFor(["director"], { rolePermissions: m });
    expect(can(dir, "imports", "view")).toBe(true); // vai trò chưa chỉnh ⇒ ma trận mặc định
    expect(can(dir, "imports", "delete")).toBe(false);
  });

  it("vai trò đã chỉnh mà bỏ hết ô ⇒ không quyền (KHÔNG rơi về mặc định)", () => {
    const m = buildRolePermissions([role("accountant")], []);
    expect(visibleNavIds(resolveFor(["accountant"], { rolePermissions: m })).size).toBe(0);
  });

  it("vai trò tự tạo có quyền; ô hỏng / của vai trò không có dòng bị bỏ qua", () => {
    const m = buildRolePermissions(
      [role("role-plan", "Phòng kế hoạch")],
      [grant("role-plan", "orders", "create"), grant("role-plan", "orders", "fly"), grant("role-ghost", "sales", "view")]
    );
    const p = resolveFor(["role-plan" as Role], { rolePermissions: m });
    expect(can(p, "orders", "create")).toBe(true);
    expect(can(p, "orders", "view")).toBe(true);
    expect(resolveFor(["role-ghost" as Role], { rolePermissions: m }).grants.size).toBe(0);
  });

  it("phạm vi lạ ⇒ all; phạm vi hợp lệ giữ nguyên", () => {
    const m = buildRolePermissions([role("team-leader")], [grant("team-leader", "wip", "update", "own"), grant("team-leader", "wip", "view", "weird")]);
    const p = resolveFor(["team-leader"], { rolePermissions: m });
    expect(scopeOf(p, "wip", "update")).toBe("own");
    expect(scopeOf(p, "wip", "view")).toBe("all");
  });

  it("chỉnh riêng chỉ lấy dòng của đúng người", () => {
    const rows: UserPermission[] = [
      { id: "u1|sales|view", userId: "u1", resource: "sales", action: "view", effect: "allow", scope: "all" },
      { id: "u2|imports|view", userId: "u2", resource: "imports", action: "view", effect: "deny", scope: "all" },
    ];
    expect(buildUserOverrides("u1", rows)).toEqual([{ resource: "sales", action: "view", effect: "allow", scope: "all" }]);
  });

  it("giải thích nguồn từng ô: vai trò · cho riêng · chặn riêng · admin", () => {
    const m = DEFAULT_ROLE_PERMISSIONS;
    expect(explainPermission(["warehouse-keeper"], false, m, [], "imports", "lock")).toEqual({ granted: true, source: "role", fromRoles: ["warehouse-keeper"] });
    expect(explainPermission(["warehouse-keeper"], false, m, [], "sales", "view").source).toBe("none");
    expect(explainPermission(["warehouse-keeper"], false, m, [{ resource: "sales", action: "view", effect: "allow" }], "sales", "view")).toMatchObject({ granted: true, source: "allow" });
    expect(explainPermission(["warehouse-keeper"], false, m, [{ resource: "imports", action: "lock", effect: "deny" }], "imports", "lock")).toMatchObject({ granted: false, source: "deny" });
    expect(explainPermission(["admin"], true, m, [], "users", "view")).toMatchObject({ granted: true, source: "admin" });
  });

  it("danh sách vai trò = 11 hệ thống + vai trò tự tạo; tên hiển thị dùng nhãn tự tạo", () => {
    const opts = listRoleOptions([role("accountant", "Đổi tên không áp"), role("role-plan", "Phòng kế hoạch")]);
    expect(opts).toHaveLength(ROLES.length + 1);
    expect(opts.find((o) => o.value === "accountant")?.label).toBe("Kế toán");
    expect(roleNames(["accountant", "role-plan"], [role("role-plan", "Phòng kế hoạch")])).toBe("Kế toán, Phòng kế hoạch");
    expect(roleNames([], [])).toBe("Chưa gán");
  });
});

describe("phạm vi dữ liệu — Đợt 5", () => {
  it("ma trận: quản đốc GHI theo xưởng ở SX/Đóng gói/QC/Kho, XEM cả 3 xưởng; tổ trưởng ghi SX theo dòng mình", () => {
    const m = resolveFor(["manager-ca"]);
    for (const r of ["wip", "packaging", "qc"]) {
      expect(scopeOf(m, r, "view"), r).toBe("all");
      expect(scopeOf(m, r, "update"), r).toBe("workshop");
    }
    expect(scopeOf(m, "wip", "unlock")).toBe("workshop");
    expect(scopeOf(m, "warehouse", "approve")).toBe("workshop");
    expect(scopeOf(m, "wip", "export")).toBe("all");
    const tl = resolveFor(["team-leader"]);
    expect(scopeOf(tl, "wip", "update")).toBe("own");
    expect(scopeOf(tl, "packaging", "update")).toBe("all"); // đóng gói không lưu người ghi
  });

  it("scopeContextFor: xưởng suy từ vai trò quản đốc; tên từ họ tên + tên đăng nhập", () => {
    expect(scopeContextFor(["vice-director", "manager-dong"], " Hạnh ", "ttmhanh")).toEqual({ workshops: ["Đông"], identities: ["Hạnh", "ttmhanh"] });
    expect(scopeContextFor(["accountant"]).workshops).toEqual([]);
  });

  it("rowInScope / canOnRow: ngoài phạm vi ⇒ false; thiếu cột ⇒ theo quyền chung; own khi thêm luôn được", () => {
    const ctx = scopeContextFor(["manager-kho"], "A", "a");
    expect(rowInScope("workshop", ctx, { workshop: "Khô" })).toBe(true);
    expect(rowInScope("workshop", ctx, { workshop: "Đông" })).toBe(false);
    expect(rowInScope("workshop", ctx, {})).toBe(true);
    expect(rowInScope("own", ctx, { operator: "B" })).toBe(false);
    expect(rowInScope("own", ctx, { operator: "B" }, "create")).toBe(true);
    const p = resolveFor(["manager-kho"]);
    expect(canOnRow(p, ctx, "wip", "delete", { workshop: "Khô" })).toBe(true);
    expect(canOnRow(p, ctx, "wip", "delete", { workshop: "Cá" })).toBe(false);
    expect(canOnRow(p, ctx, "imports", "view", {})).toBe(false); // không có quyền thì phạm vi không cứu
  });
});

describe("isPermissionLoading — chờ quyền chốt rồi mới vẽ sidebar (lỗi nav chớp 2026-10-28)", () => {
  const base = { requiresLogin: true, hasProfile: true, isAdmin: false };
  it("còn một bảng quyền đang nạp ⇒ chờ (không vẽ nav theo ma trận mặc định)", () => {
    expect(isPermissionLoading({ ...base, tableStatuses: ["loading", "ready", "ready"] })).toBe(true);
    expect(isPermissionLoading({ ...base, tableStatuses: ["ready", "ready", "loading"] })).toBe(true);
  });
  it("mọi bảng xong hoặc lỗi mạng (dùng bản sao dưới máy) ⇒ hết chờ", () => {
    expect(isPermissionLoading({ ...base, tableStatuses: ["ready", "ready", "ready"] })).toBe(false);
    expect(isPermissionLoading({ ...base, tableStatuses: ["error", "ready", "error"] })).toBe(false);
  });
  it("admin / chạy không đăng nhập / chưa có hồ sơ ⇒ không chờ", () => {
    expect(isPermissionLoading({ ...base, isAdmin: true, tableStatuses: ["loading"] })).toBe(false);
    expect(isPermissionLoading({ ...base, requiresLogin: false, tableStatuses: ["loading"] })).toBe(false);
    expect(isPermissionLoading({ ...base, hasProfile: false, tableStatuses: ["loading"] })).toBe(false);
  });
});
