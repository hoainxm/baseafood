/**
 * Tiện ích dùng chung cho cụm đối soát HĐĐT (engine + các lớp xuất + màn).
 * Thuần, không phụ thuộc thư viện Excel — gom về đây để không viết lại mỗi file một bản.
 */
import { boDau } from "./username";

/** Chuẩn hóa chữ để so: bỏ dấu, thường, coi "_" như khoảng trắng, gộp khoảng trắng. */
export const chuanChu = (s: unknown): string =>
  boDau(String(s ?? "")).toLowerCase().trim().replace(/[_\s]+/g, " ");

/** Chỉ số cột 0-based → chữ cột Excel (0 → A, 26 → AA). Âm ⇒ "". */
export function chuCotExcel(c: number): string {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** Chữ cột Excel → số cột 1-based ("A" → 1, "AB" → 28). */
export function soCotExcel(s: string): number {
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Bảng màu nền chuẩn Excel (ARGB) — một nguồn cho mọi lớp xuất. */
export const MAU_NEN = {
  xanh: "FFC6EFCE",
  vang: "FFFFEB9C",
  do: "FFFFC7CE",
  tieuDe: "FFD9E1F2",
  sua: "FFFFD966",
  title: "FF17529C",
} as const;

/** Nền đặc kiểu exceljs. */
export const nenDac = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

/** Khóa ô người dùng bấm Sửa: `sheet#soDong#cot` (tên sheet có thể chứa "#"). */
export const khoaSua = (sheet: string, rowNo: number, columns: number): string => `${sheet}#${rowNo}#${columns}`;

/** Tách khóa ô Sửa ngược lại. */
export function tachKhoaSua(k: string): { sheet: string; soDong: number; cot: number } {
  const parts = k.split("#");
  const columns = Number(parts.pop());
  const rowNo = Number(parts.pop());
  return { sheet: parts.join("#"), soDong: rowNo, cot: columns };
}
