// ============================================================
// Tên file: src/design-system/patterns/navigateNumberColumn.ts
// Tên tiếng Việt: Đi dọc cột bằng phím trong bảng số tự dựng (↑ / ↓ / Enter)
// Description: Excel-like vertical keyboard navigation for hand-built number tables
// ============================================================
import type * as React from "react";

/**
 * Điều hướng bàn phím kiểu Excel cho ô số trong BẢNG tự dựng (không qua
 * `EditableGrid`): ↑ / ↓ / Enter nhảy DỌC trong cùng một CỘT (`navCol`), Tab để
 * trình duyệt lo đi NGANG. "Cùng cột" = mọi input mang `data-navcol` giống nhau
 * trong khung `[data-grid-nav]` gần nhất, theo THỨ TỰ DOM (= thứ tự dòng nhìn
 * thấy) nên không cần khai toạ độ (hàng,cột) — hợp bảng dòng động, có dòng tách.
 */
export function navigateNumberColumn(e: React.KeyboardEvent<HTMLInputElement>, col: string) {
  const k = e.key;
  if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Enter") return;
  const el = e.currentTarget;
  if (k === "Enter") e.preventDefault(); // đừng để Enter submit form khi đang nhập bảng
  const scope: ParentNode = el.closest("[data-grid-nav]") ?? document;
  const cells = Array.from(
    scope.querySelectorAll<HTMLInputElement>(`[data-navcol="${CSS.escape(col)}"]`)
  ).filter((o) => !o.disabled && o.offsetParent !== null); // bỏ ô ẩn (dòng tách chưa mở)
  const i = cells.indexOf(el);
  if (i < 0) return;
  const target = cells[k === "ArrowUp" ? i - 1 : i + 1];
  if (target) {
    e.preventDefault();
    target.focus();
    target.select();
  }
}
