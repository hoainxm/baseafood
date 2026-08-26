// ============================================================
// Tên file: src/lib/nav-access.ts
// Phân quyền điều hướng theo VAI TRÒ — 2 giao diện bộ phận (họp 2026-08-22).
// Thuần (pure) — không phụ thuộc React, dễ đổi bảng map ở một chỗ.
// ============================================================
import type { Role } from "@/types";

/**
 * Hai bộ phận vận hành đầu chuỗi, mỗi bộ phận một tập màn + một trang chủ.
 * Vai trò KHÔNG nằm trong bảng này (giám đốc, phó GĐ, kế toán, admin) = xem
 * đầy đủ — chỉ 2 bộ phận thao tác theo bước bị giới hạn nav cho gọn.
 */
const DEPT_NHAP_HANG = ["imports", "warehouse", "nxt-nl", "catalog"];
const DEPT_SAN_XUAT = ["wip", "packaging", "warehouse", "quality", "catalog"];

/** Vai trò bị giới hạn → tập nav id được phép thấy. */
export const ALLOWED_NAV: Partial<Record<Role, string[]>> = {
  "warehouse-keeper": DEPT_NHAP_HANG, // thủ kho / nhập hàng
  "team-leader": DEPT_SAN_XUAT, // tổ trưởng sản xuất
  "manager-dong": DEPT_SAN_XUAT, // quản đốc xưởng Đông
  "manager-ca": DEPT_SAN_XUAT, // quản đốc xưởng Cá
  "manager-kho": DEPT_SAN_XUAT, // quản đốc xưởng Khô
  "vice-manager": DEPT_SAN_XUAT, // phó quản đốc — ghi thành phẩm hằng ngày
};

/** Vai trò bị giới hạn → trang chủ (màn mở đầu khi đăng nhập vào). */
export const HOME_BY_ROLE: Partial<Record<Role, string>> = {
  "warehouse-keeper": "imports",
  "team-leader": "wip",
  "manager-dong": "wip",
  "manager-ca": "wip",
  "manager-kho": "wip",
  "vice-manager": "wip",
};

/** Trang chủ theo vai trò: vai trò bộ phận đầu tiên khớp, mặc định "dashboard". */
export function homeFor(roles: Role[]): string {
  for (const r of roles) {
    const h = HOME_BY_ROLE[r];
    if (h) return h;
  }
  return "dashboard";
}

/**
 * Tập nav id được phép, hoặc `null` = xem đầy đủ.
 * - Admin: luôn đầy đủ (kể cả /users).
 * - Chưa gán vai trò: đầy đủ (tránh kẹt; /users vẫn chặn riêng ở App).
 * - Có BẤT KỲ vai trò không-giới-hạn (giám đốc/kế toán…): đầy đủ.
 * - CHỈ khi mọi vai trò đều là bộ phận giới hạn → trả về đúng tập của bộ phận.
 */
export function allowedIds(roles: Role[], laAdmin: boolean): Set<string> | null {
  if (laAdmin) return null;
  if (!roles.length) return null;
  const hasUnrestricted = roles.some((r) => !ALLOWED_NAV[r]);
  if (hasUnrestricted) return null;
  const ids = new Set<string>();
  for (const r of roles) for (const id of ALLOWED_NAV[r] ?? []) ids.add(id);
  return ids;
}
