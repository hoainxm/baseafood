// ============================================================
// Tên file: src/features/shared/PermissionProvider.tsx
// Tên tiếng Việt: Nguồn quyền của người đang đăng nhập cho cả app
// Description: Provides effective permissions + useCan(resource) to every screen
// ============================================================
// Gắn MỘT lần ở ShellLayout (App.tsx), giống RowMarkProvider. Màn hình hỏi
// `useCan("imports").delete` — không tự tính quyền, không đọc vai trò.
// Spec: docs/spec/role-permissions.md §5 (lớp 2).
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  PERMISSION_ACTIONS,
  OFFLINE_PERMISSIONS,
  can,
  type EffectivePermissions,
  type PermissionAction,
} from "@/lib/permissions";

const PermissionContext = createContext<EffectivePermissions>(OFFLINE_PERMISSIONS);

export function PermissionProvider({
  permissions,
  children,
}: {
  permissions: EffectivePermissions;
  children: ReactNode;
}) {
  return <PermissionContext.Provider value={permissions}>{children}</PermissionContext.Provider>;
}

/** Quyền thực của người đang đăng nhập (ít dùng — ưu tiên `useCan`). */
export function usePermissions(): EffectivePermissions {
  return useContext(PermissionContext);
}

/** Cờ từng hành động trên một tài nguyên. Hành động không áp dụng cho tài nguyên ⇒ false. */
export type CanFlags = Record<PermissionAction, boolean>;

/** `const allowed = useCan("imports"); allowed.delete && <Button …>` */
export function useCan(resource: string): CanFlags {
  const perms = useContext(PermissionContext);
  return useMemo(
    () =>
      Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, can(perms, resource, a)])) as CanFlags,
    [perms, resource]
  );
}
