import { describe, expect, it } from "vitest";
import { allowedIds, homeFor } from "./nav-access";
import { PERMISSION_NAV_IDS, PERMISSION_RESOURCES, resolvePermissions } from "./permissions";

// Chốt tập màn của từng vai trò (Đợt 4 2026-10-15 cố ý đổi so với Đợt 1–3 — ma trận
// spec §7; tập cũ còn chốt ở permissions.test.ts › LEGACY). Đổi id màn (vd đổi route sang tiếng Anh 2026-10-13:
// nxt-nl → nxt-material, ton-kho-thang → monthly-stock) KHÔNG được làm đổi quyền —
// sửa test này chỉ khi chủ dự án đổi phân quyền thật. Đợt 1 phân quyền (2026-10-15)
// chuyển tập màn sang lib/permissions.ts: mọi ca dưới đây GIỮ NGUYÊN, trừ ca
// "chưa gán vai trò" (trước: thấy đủ; nay: không thấy màn nào — DB đã chặn từ 0057).
// 2026-10-19: thêm "Việc của tôi" (`my-tasks`) cho MỌI vai trò có quyền — màn cá nhân, chỉ đọc
// + giao việc; không đổi quyền ở màn nghiệp vụ nào.
// 2026-10-19: thêm "Tài liệu công ty" (`documents`) cho MỌI vai trò có quyền — mở màn được,
// tài liệu nào thấy do phòng ban quyết (lib/documents.ts); ô ghi để trống ⇒ chỉ admin ghi.
const sorted = (s: Set<string>) => [...s].sort();
const ADMIN_NAV = new Set(PERMISSION_RESOURCES.filter((r) => r.adminOnly && r.navId).map((r) => r.navId));
const NON_ADMIN_FULL = PERMISSION_NAV_IDS.filter((id) => !ADMIN_NAV.has(id)).sort();

describe("allowedIds — tập màn theo vai trò (Đợt 4, ma trận spec §7 — 2026-10-15)", () => {
  const ACCOUNTING = ["balancing", "monthly-stock", "nxt", "nxt-material", "nxt-warehouse", "orders", "reconciliation", "sales"];
  const PRODUCTION = ["packaging", "qc", "qr", "warehouse", "wip"];
  const REPORTS = ["dashboard", "export-report", "production-report"];
  it("ban giám đốc + kế toán trưởng thấy mọi màn nghiệp vụ (chỉ khác quyền BÊN TRONG)", () => {
    for (const r of ["director", "vice-director", "chief-accountant"] as const) expect(sorted(allowedIds([r], false))).toEqual(NON_ADMIN_FULL);
  });
  it("kế toán: mọi màn trừ QC", () => {
    expect(sorted(allowedIds(["accountant"], false))).toEqual(NON_ADMIN_FULL.filter((id) => id !== "qc"));
  });
  it("thủ kho nhập hàng: Nhập hàng + kho/tồn + QR + danh mục", () => {
    expect(sorted(allowedIds(["warehouse-keeper"], false))).toEqual(
      ["catalog", "documents", "imports", "monthly-stock", "my-tasks", "nxt", "nxt-material", "nxt-warehouse", "planning-export", "planning-import", "qr", "warehouse"]
    );
  });
  it("quản đốc: khâu sản xuất + tồn kho + báo cáo; không sổ kế toán", () => {
    for (const r of ["frozen-workshop-manager", "fish-workshop-manager", "dried-workshop-manager"] as const)
      expect(sorted(allowedIds([r], false))).toEqual([...PRODUCTION, ...REPORTS, "catalog", "documents", "my-tasks", "nxt", "nxt-material", "nxt-warehouse", "planning-export"].sort());
  });
  it("phó quản đốc: khâu sản xuất + báo cáo; tổ trưởng: chỉ khâu sản xuất", () => {
    // Người đóng hàng (thủ kho, quản đốc, phó QĐ) mở được Xuất khẩu để đính ảnh / sơ đồ đóng cont (mig 0075, A2).
    expect(sorted(allowedIds(["vice-manager"], false))).toEqual([...PRODUCTION, ...REPORTS, "catalog", "documents", "my-tasks", "planning-export"].sort());
    expect(sorted(allowedIds(["team-leader"], false))).toEqual([...PRODUCTION, "catalog", "documents", "my-tasks"].sort());
    for (const id of ACCOUNTING) expect(allowedIds(["vice-manager"], false).has(id), id).toBe(false);
  });
  it("nhân viên Kế hoạch: Xuất khẩu (trang chủ) + Nhập khẩu + Đơn đặt, báo cáo đơn xuất, kho, QR để xem + danh mục", () => {
    expect(sorted(allowedIds(["planner"], false))).toEqual(
      ["catalog", "documents", "export-report", "my-tasks", "orders", "planning-export", "planning-import", "qr", "warehouse"]
    );
    expect(homeFor(["planner"])).toBe("planning-export");
  });
  it("khu quản trị (Tổng quan quản trị · Người dùng · Vai trò & quyền · Nhật ký) chỉ admin", () => {
    expect([...ADMIN_NAV].sort()).toEqual(["admin", "audit", "roles", "users"]);
  });
  it("admin ⇒ mọi màn kể cả khu quản trị", () => {
    expect(sorted(allowedIds(["warehouse-keeper"], true))).toEqual([...PERMISSION_NAV_IDS].sort());
  });
  it("chưa gán vai trò ⇒ không thấy màn nào", () => {
    expect(allowedIds([], false).size).toBe(0);
  });
  it("Việc của tôi: ai có quyền ở đâu đó cũng thấy — kể cả vai trò đã chỉnh / tự tạo; không quyền gì thì không", () => {
    const custom = resolvePermissions({ roles: ["role-x" as never], isAdmin: false, rolePermissions: { "role-x": [{ resource: "qr", action: "view", scope: "all" }] } });
    expect(custom.grants.has("my-tasks:view")).toBe(true);
    const empty = resolvePermissions({ roles: ["role-x" as never], isAdmin: false, rolePermissions: { "role-x": [] } });
    expect(empty.grants.size).toBe(0);
    const denied = resolvePermissions({ roles: ["team-leader"], isAdmin: false, overrides: [{ resource: "my-tasks", action: "view", effect: "deny" }] });
    expect(denied.grants.has("my-tasks:view")).toBe(false);
  });
  it("giao việc: quản đốc / kế toán (trưởng) / phó QĐ được giao; thủ kho, tổ trưởng, giám đốc thì không", () => {
    const canAssign = (r: string) => resolvePermissions({ roles: [r as never], isAdmin: false }).grants.has("my-tasks:create");
    for (const r of ["frozen-workshop-manager", "chief-accountant", "accountant", "vice-manager"]) expect(canAssign(r), r).toBe(true);
    for (const r of ["warehouse-keeper", "team-leader", "director"]) expect(canAssign(r), r).toBe(false);
  });
});

describe("homeFor — trang chủ theo vai trò", () => {
  it("vai trò bộ phận / mặc định", () => {
    expect(homeFor(["warehouse-keeper"])).toBe("imports");
    expect(homeFor(["team-leader"])).toBe("wip");
    expect(homeFor(["accountant"])).toBe("dashboard");
  });
  it("có quyền thì chỉ trả trang thấy được; không thấy gì ⇒ null", () => {
    const keeper = resolvePermissions({ roles: ["warehouse-keeper"], isAdmin: false });
    expect(homeFor(["warehouse-keeper"], keeper)).toBe("imports");
    // chặn riêng màn Nhập hàng ⇒ trang chủ lùi về màn đầu tiên còn thấy
    const blocked = resolvePermissions({
      roles: ["warehouse-keeper"],
      isAdmin: false,
      overrides: [{ resource: "imports", action: "view", effect: "deny" }],
    });
    expect(homeFor(["warehouse-keeper"], blocked)).toBe("qr"); // theo thứ tự sổ đăng ký
    expect(homeFor([], resolvePermissions({ roles: [], isAdmin: false }))).toBeNull();
  });
  it("trang mở đầu admin đặt cho vai trò (app_roles.home_route) thắng mặc định — nếu thấy được", () => {
    const keeper = resolvePermissions({ roles: ["warehouse-keeper"], isAdmin: false });
    expect(homeFor(["warehouse-keeper"], keeper, { "warehouse-keeper": "monthly-stock" })).toBe("monthly-stock");
    expect(homeFor(["warehouse-keeper"], keeper, { "warehouse-keeper": "balancing" })).toBe("imports");
  });
});
