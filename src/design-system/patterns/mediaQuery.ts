import { useSyncExternalStore } from "react";

/**
 * Màn hẹp cho thanh bên đầy đủ (w-72): iPhone xoay ngang (812–932px), iPad dọc
 * (744–834px), cửa sổ laptop nhỏ. Ở dải này `AppShell` tự thu thanh bên về
 * dải icon để nhường chỗ cho tiêu đề + bảng — KHÔNG phải mốc bố cục thứ ba:
 * bố cục trang vẫn do `md:` quyết (README design-system § Quy chuẩn mobile).
 */
export const MEDIA_NARROW_SIDEBAR = "(min-width: 768px) and (max-width: 1023.98px)";

/** `true` khi media query đang khớp; tự cập nhật khi xoay máy / đổi cỡ cửa sổ. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia?.(query);
      if (!mq) return () => {};
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(query).matches ?? false,
    () => false
  );
}
