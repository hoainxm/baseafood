// ============================================================
// Tên file: src/design-system/patterns/gridFitWidth.ts
// Tên tiếng Việt: Bề rộng cột số VỪA giá trị dài nhất (lưới gọn)
// Description: Fit-to-content width for numeric columns of a compact EditableGrid
// ============================================================
// Người dùng chốt 2026-11-02: cột số "chỉ hiển thị chiều ngang bằng hoặc nhiều hơn một chút so
// với giá trị trong cột" — không giãn theo khung, không cho kéo. Ô nhập không tự đo được bề rộng
// chữ (min-content của <input> chỉ là cỡ tối thiểu) ⇒ tính sẵn theo SỐ KÝ TỰ của chuỗi hiển thị.
// Đơn vị `ch` (= bề rộng chữ số "0"): chữ số tabular-nums đúng 1ch; dấu chấm / phẩy ~0,3ch và
// dấu trừ ~0,6ch nhưng tính 0,5 / 0,75 cho DƯ một chút. `ch` lấy theo chữ ĐẬM của ô tên cột (rộng
// hơn chữ thường của ô số) và theo cỡ chữ ⇒ phóng to 130% vẫn vừa.
import { formatNumber } from "./numberExpression";

/** Đệm ngang của ô số (px-2 hai bên = 1rem) + viền trái 1px + 1px dư cho con trỏ gõ. */
const CELL_PADDING = "1rem + 2px";

/** Bề rộng (đơn vị ch) của một chuỗi số đã định dạng: chữ số 1 · dấu chấm/phẩy 0,5 · dấu trừ 0,75. */
export function formattedWidthCh(text: string): number {
  let width = 0;
  for (const ch of text) width += ch === "." || ch === "," ? 0.5 : ch === "-" ? 0.75 : 1;
  return width;
}

/** Bề rộng (ch) của giá trị DÀI NHẤT khi hiển thị (bỏ ô trống / 0 — ô đó hiện "—"). */
export function longestFormattedWidthCh(values: Iterable<number | null | undefined>): number {
  let longest = 0;
  for (const v of values) {
    if (v == null || v === 0 || !Number.isFinite(v)) continue;
    longest = Math.max(longest, formattedWidthCh(formatNumber(v)));
  }
  return longest;
}

/** Bề rộng CSS của cột: vừa giá trị dài nhất; cột trống vẫn chừa chỗ cho 1 ký tự ("—"). */
export function fitColumnWidth(values: Iterable<number | null | undefined>): string {
  return `calc(${Math.max(1, longestFormattedWidthCh(values))}ch + ${CELL_PADDING})`;
}

/* ---------- Cột ô ĐIỀU KHIỂN có chữ (VD ô chọn khách) ---------- */

/** Chữ hẹp (≈ nửa chữ số) — dấu câu, khoảng trắng, i l j t f r I. */
const NARROW_CHARS = new Set([..." .,;:'|!()[]-/iljtfrI"]);
/** Chữ rộng (≈ 1,3 chữ số). */
const WIDE_CHARS = new Set([..."MWmw"]);

/**
 * Bề rộng (ch) ƯỚC LƯỢNG của chữ font tỷ lệ — tính DƯ một chút (thường 0,95 · hoa 1,05 · rộng 1,35
 * · hẹp 0,45; đo Be Vietnam Pro 2026-11-02: "SEACHEMOT CO., LTD" thật 15,8ch → tính 16,35; "Chọn
 * khách" 8,5 → 9,1) để chữ dài nhất không bị cắt "…". Dấu tiếng Việt bỏ trước khi đếm.
 */
export function textWidthCh(text: string): number {
  let width = 0;
  for (const raw of text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")) {
    if (NARROW_CHARS.has(raw)) width += 0.45;
    else if (WIDE_CHARS.has(raw)) width += 1.35;
    else if (raw !== raw.toLowerCase()) width += 1.05;
    else width += 0.95;
  }
  return Math.round(width * 100) / 100;
}

/**
 * Bề rộng CSS của cột ô điều khiển: vừa chữ dài nhất đang hiện + `chrome` (đệm nút, mũi tên…
 * — CSS length) + đệm ô. Không có chữ ⇒ chỉ khung.
 */
export function fitTextColumnWidth(texts: Iterable<string | null | undefined>, chrome: string): string {
  let longest = 0;
  for (const t of texts) if (t) longest = Math.max(longest, textWidthCh(t));
  return `calc(${longest}ch + ${chrome} + ${CELL_PADDING})`;
}
