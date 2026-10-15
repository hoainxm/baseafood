import { describe, expect, it } from "vitest";
import { allowedIds, homeFor } from "./nav-access";
import { PERMISSION_NAV_IDS, PERMISSION_RESOURCES, resolvePermissions } from "./permissions";

// Chốt tập màn của từng vai trò. Đổi id màn (vd đổi route sang tiếng Anh 2026-10-13:
// nxt-nl → nxt-material, ton-kho-thang → monthly-stock) KHÔNG được làm đổi quyền —
// sửa test này chỉ khi chủ dự án đổi phân quyền thật. Đợt 1 phân quyền (2026-10-15)
// chuyển tập màn sang lib/permissions.ts: mọi ca dưới đây GIỮ NGUYÊN, trừ ca
// "chưa gán vai trò" (trước: thấy đủ; nay: không thấy màn nào — DB đã chặn từ 0057).
const sorted = (s: Set<string>) => [...s].sort();
const ADMIN_NAV = new Set(PERMISSION_RESOURCES.filter((r) => r.adminOnly && r.navId).map((r) => r.navId));
const NON_ADMIN_FULL = PERMISSION_NAV_IDS.filter((id) => !ADMIN_NAV.has(id)).sort();

describe("allowedIds — tập màn theo vai trò", () => {
  it("thủ kho nhập hàng", () => {
    expect(sorted(allowedIds(["warehouse-keeper"], false))).toEqual(
      ["catalog", "imports", "monthly-stock", "nxt-material", "qr", "warehouse"].sort()
    );
  });
  it("tổ trưởng / quản đốc sản xuất", () => {
    for (const r of ["team-leader", "manager-dong", "manager-ca", "manager-kho", "vice-manager"] as const)
      expect(sorted(allowedIds([r], false))).toEqual(["catalog", "packaging", "qc", "qr", "warehouse", "wip"]);
  });
  it("vai trò không giới hạn ⇒ mọi màn trừ màn admin", () => {
    for (const r of ["director", "vice-director", "chief-accountant", "accountant"] as const)
      expect(sorted(allowedIds([r], false))).toEqual(NON_ADMIN_FULL);
    // bộ phận + vai trò không giới hạn (VD phó GĐ kiêm quản đốc Đông) ⇒ hợp = đầy đủ
    expect(sorted(allowedIds(["warehouse-keeper", "director"], false))).toEqual(NON_ADMIN_FULL);
    expect(sorted(allowedIds(["vice-director", "manager-dong"], false))).toEqual(NON_ADMIN_FULL);
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
