// ============================================================
// Tên file: src/design-system/patterns/dieuHuongCotSo.ts
// Tên tiếng Việt: Đi dọc cột bằng phím trong bảng số tự dựng (↑ / ↓ / Enter)
// Description: Excel-like vertical keyboard navigation for hand-built number tables
// ============================================================
import type * as React from "react";

/**
 * Điều hướng bàn phím kiểu Excel cho ô số trong BẢNG tự dựng (không qua
 * `LuoiNhap`): ↑ / ↓ / Enter nhảy DỌC trong cùng một CỘT (`navCol`), Tab để
 * trình duyệt lo đi NGANG. "Cùng cột" = mọi input mang `data-navcol` giống nhau
 * trong khung `[data-luoi-phim]` gần nhất, theo THỨ TỰ DOM (= thứ tự dòng nhìn
 * thấy) nên không cần khai toạ độ (hàng,cột) — hợp bảng dòng động, có dòng tách.
 */
export function dieuHuongCotSo(e: React.KeyboardEvent<HTMLInputElement>, col: string) {
  const k = e.key;
  if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Enter") return;
  const el = e.currentTarget;
  if (k === "Enter") e.preventDefault(); // đừng để Enter submit form khi đang nhập bảng
  const khung: ParentNode = el.closest("[data-luoi-phim]") ?? document;
  const dsO = Array.from(
    khung.querySelectorAll<HTMLInputElement>(`[data-navcol="${CSS.escape(col)}"]`)
  ).filter((o) => !o.disabled && o.offsetParent !== null); // bỏ ô ẩn (dòng tách chưa mở)
  const i = dsO.indexOf(el);
  if (i < 0) return;
  const dich = dsO[k === "ArrowUp" ? i - 1 : i + 1];
  if (dich) {
    e.preventDefault();
    dich.focus();
    dich.select();
  }
}
