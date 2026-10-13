import { describe, expect, it } from "vitest";
import { allowedIds, homeFor } from "./nav-access";

// Chốt tập màn của 2 bộ phận. Đổi id màn (vd đổi route sang tiếng Anh 2026-10-13:
// nxt-nl → nxt-material, ton-kho-thang → monthly-stock) KHÔNG được làm đổi quyền —
// sửa test này chỉ khi chủ dự án đổi phân quyền thật.
describe("allowedIds — 2 giao diện bộ phận", () => {
  it("thủ kho nhập hàng", () => {
    expect([...allowedIds(["warehouse-keeper"], false)!].sort()).toEqual(
      ["catalog", "imports", "monthly-stock", "nxt-material", "qr", "warehouse"].sort()
    );
  });
  it("tổ trưởng / quản đốc sản xuất", () => {
    for (const r of ["team-leader", "manager-dong", "manager-ca", "manager-kho", "vice-manager"] as const)
      expect([...allowedIds([r], false)!].sort()).toEqual(["catalog", "packaging", "qc", "qr", "warehouse", "wip"]);
  });
  it("admin / vai trò không giới hạn / chưa gán vai trò ⇒ xem đầy đủ", () => {
    expect(allowedIds(["warehouse-keeper"], true)).toBeNull();
    expect(allowedIds(["accountant"], false)).toBeNull();
    expect(allowedIds(["warehouse-keeper", "director"], false)).toBeNull();
    expect(allowedIds([], false)).toBeNull();
  });
  it("trang chủ theo vai trò", () => {
    expect(homeFor(["warehouse-keeper"])).toBe("imports");
    expect(homeFor(["team-leader"])).toBe("wip");
    expect(homeFor(["accountant"])).toBe("dashboard");
  });
});
