// ============================================================
// Tên file: src/features/shared/PermissionProvider.tsx
// Tên tiếng Việt: Nguồn quyền của người đang đăng nhập cho cả app
// Description: Provides effective permissions + useCan(resource) to every screen
// ============================================================
// Gắn MỘT lần ở ShellLayout (App.tsx), giống RowMarkProvider. Màn hình hỏi
// `useCan("imports").delete` — không tự tính quyền, không đọc vai trò.
// Spec: docs/spec/role-permissions.md §5 (lớp 2).
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import {
  EMPTY_SCOPE_CONTEXT,
  PERMISSION_ACTIONS,
  OFFLINE_PERMISSIONS,
  can,
  canOnRow,
  type EffectivePermissions,
  type PermissionAction,
  type ScopeContext,
  type ScopedRow,
} from "@/lib/permissions";

const PermissionContext = createContext<EffectivePermissions>(OFFLINE_PERMISSIONS);
const ScopeContextContext = createContext<ScopeContext>(EMPTY_SCOPE_CONTEXT);

export function PermissionProvider({
  permissions,
  scopeContext = EMPTY_SCOPE_CONTEXT,
  children,
}: {
  permissions: EffectivePermissions;
  /** Xưởng + tên người dùng — để kiểm phạm vi dòng (Đợt 5). */
  scopeContext?: ScopeContext;
  children: ReactNode;
}) {
  return (
    <PermissionContext.Provider value={permissions}>
      <ScopeContextContext.Provider value={scopeContext}>{children}</ScopeContextContext.Provider>
    </PermissionContext.Provider>
  );
}

/** Xưởng + tên của người đang đăng nhập — cho hàm thuần tự kiểm phạm vi (vd lib/myTasks.ts). */
export function useScopeContext(): ScopeContext {
  return useContext(ScopeContextContext);
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

/**
 * Quyền trên MỘT dòng / một xưởng cụ thể (phạm vi Đợt 5): quản đốc chỉ sửa / xóa / chốt /
 * mở lại dòng xưởng mình; tổ trưởng chỉ sửa dòng mình ghi. Dòng thiếu cột xưởng / người
 * ghi ⇒ theo quyền chung.
 *   const canRow = useCanOnRow("wip"); canRow("delete", row) && <Button …>
 *   canRow("lock", { workshop: "Đông" })  // nút Chốt ngày của xưởng đang chọn
 */
export function useCanOnRow(resource: string) {
  const perms = useContext(PermissionContext);
  const ctx = useContext(ScopeContextContext);
  return useCallback(
    (action: PermissionAction, row: ScopedRow | undefined, kind?: "create" | "update" | "delete") =>
      canOnRow(perms, ctx, resource, action, row, kind),
    [perms, ctx, resource]
  );
}
