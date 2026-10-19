// ============================================================
// Tên file: src/lib/nav-access.ts
// Điều hướng theo QUYỀN — màn nào thấy được, trang chủ của từng vai trò.
// Thuần (pure) — không phụ thuộc React.
// ============================================================
// Tập màn từng vai trò KHÔNG khai ở đây nữa: lấy từ quyền `view` của
// lib/permissions.ts (spec docs/spec/role-permissions.md, Đợt 1 2026-10-15).
import type { Role } from "@/types";
import {
  PERMISSION_NAV_IDS,
  resolvePermissions,
  visibleNavIds,
  type EffectivePermissions,
} from "@/lib/permissions";

/** Vai trò bộ phận → trang chủ (màn mở đầu khi đăng nhập vào). */
export const HOME_BY_ROLE: Partial<Record<Role, string>> = {
  "warehouse-keeper": "imports",
  "team-leader": "wip",
  "manager-dong": "wip",
  "manager-ca": "wip",
  "manager-kho": "wip",
  "vice-manager": "wip",
};

/**
 * Trang chủ: vai trò bộ phận đầu tiên khớp, mặc định "dashboard". Có `perms` thì
 * chỉ nhận trang thấy được (chống vòng chuyển hướng khi quyền bị chỉnh riêng);
 * không trang nào thấy được ⇒ `null`.
 */
export function homeFor(
  roles: readonly Role[],
  perms?: EffectivePermissions,
  /** Trang chủ admin đặt cho vai trò đã chỉnh (`app_roles.home_route`) — thắng mặc định. */
  homeOverrides: Readonly<Record<string, string>> = {}
): string | null {
  const visible = perms ? visibleNavIds(perms) : null;
  const ok = (id: string) => !visible || visible.has(id);
  for (const r of roles) {
    const h = homeOverrides[r] || HOME_BY_ROLE[r];
    if (h && ok(h)) return h;
  }
  if (ok("dashboard")) return "dashboard";
  // "Việc của tôi" ai cũng thấy ⇒ chỉ làm trang chủ khi không còn màn nghiệp vụ nào.
  return PERMISSION_NAV_IDS.find((id) => id !== "my-tasks" && visible!.has(id)) ?? (visible!.has("my-tasks") ? "my-tasks" : null);
}

/** Tập mục nav thấy được của một người theo ma trận mặc định. */
export function allowedIds(roles: readonly Role[], isAdmin: boolean): Set<string> {
  return visibleNavIds(resolvePermissions({ roles, isAdmin }));
}
