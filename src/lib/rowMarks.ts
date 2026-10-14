// ============================================================
// Tên file: src/lib/rowMarks.ts
// Tên tiếng Việt: Tô màu dòng/ô "đã dò" kiểu Excel — hàm thuần
// Description: Pure helpers for shared row/cell marks (row_marks, migration 0055)
// ============================================================
import type { RowMark } from "@/types";

/** Sắc màu tô — khớp `MARK_COLORS` ở design-system/patterns/rowMarkSource.ts + token `--to-<sắc>-<mức>`. */
export const SAC_TO_LIB = ["xam", "do", "cam", "vang", "chuoi", "la", "troi", "duong", "tim", "hong"] as const;
export type SacTo = (typeof SAC_TO_LIB)[number];
/** Mã màu lưu DB: "<sắc>-<mức 1..5>" (VD "vang-5"). */
export type RowMarkColor = `${SacTo}-${1 | 2 | 3 | 4 | 5}`;

/** Dấu của một dòng / ô như màn hình thấy. `mau` rỗng = chỉ in đậm. */
export interface RowMarkStyle {
  color: RowMarkColor | "";
  bold: boolean;
}

/** Đích tô: cả dòng (`cot` null) hoặc một ô. */
export interface RowMarkTarget {
  row: string;
  columns: string | null;
}

/* Bản đầu (sáng 2026-10-06) lưu 4 mã trơn — đọc ra mức 2 của sắc tương ứng. */
const LEGACY_CODES: Record<string, RowMarkColor> = {
  vang: "vang-2",
  "xanh-la": "la-2",
  "xanh-duong": "duong-2",
  do: "do-2",
};
const RE_MA = new RegExp(`^(${SAC_TO_LIB.join("|")})-[1-5]$`);

/** Mã màu lạ (bản app mới hơn ghi) ⇒ coi như không màu, không vỡ. */
export function normalizeRowMarkColor(v: string): RowMarkColor | "" {
  if (LEGACY_CODES[v]) return LEGACY_CODES[v];
  return RE_MA.test(v) ? (v as RowMarkColor) : "";
}

/**
 * id TẤT ĐỊNH của một dấu: cùng bảng + cùng dòng (+ cùng cột) ⇒ cùng id ⇒ ghi
 * lại chỉ cập nhật, hai người tô cùng chỗ không đẻ hai dấu. `*` = cả dòng.
 */
export function idDauTo(tableKey: string, rowId: string, columnKey: string | null = null): string {
  return `${tableKey}::${rowId}::${columnKey ?? "*"}`;
}

/** Khoá tra dấu ô trong `dauCuaBang().o` — khớp `khoaODau` ở design-system. */
export const cellKey = (rowId: string, columnKey: string) => `${rowId}\u0001${columnKey}`;

/** Dấu của một bảng: theo DÒNG (Map rowId) + theo Ô (Map khoaO). */
export function getTableRowMarks(
  marks: RowMark[],
  tableKey: string
): { row: Map<string, RowMarkStyle>; o: Map<string, RowMarkStyle> } {
  const dong = new Map<string, RowMarkStyle>();
  const o = new Map<string, RowMarkStyle>();
  for (const m of marks) {
    if (m.tableKey !== tableKey) continue;
    const color = normalizeRowMarkColor(m.color);
    if (!color && !m.bold) continue;
    const dau = { color, bold: m.bold };
    if (m.columnKey == null) dong.set(m.rowId, dau);
    else o.set(cellKey(m.rowId, m.columnKey), dau);
  }
  return { row: dong, o };
}

/**
 * Đặt (hoặc bỏ) dấu cho NHIỀU đích của một bảng, trả danh sách MỚI để `ghi()`.
 * Chuỗi = cả dòng. `dau` null — hoặc không màu + không đậm — ⇒ xoá dấu (bỏ tô).
 * Dấu của bảng khác / đích khác giữ nguyên (repo nhận NGUYÊN danh sách — quên
 * ghép là mất dấu chỗ khác).
 */
export function setRowMarks(
  marks: RowMark[],
  tableKey: string,
  target: (string | RowMarkTarget)[],
  dau: RowMarkStyle | null,
  user: string,
  luc: string = new Date().toISOString()
): RowMark[] {
  const items = target.map((d) => (typeof d === "string" ? { row: d, columns: null } : d));
  const theoId = new Map(items.map((d) => [idDauTo(tableKey, d.row, d.columns), d]));
  const bo = !dau || (!dau.color && !dau.bold);
  const remaining = marks.filter((m) => !theoId.has(m.id));
  if (bo) return remaining;
  const prev = new Map(marks.map((m) => [m.id, m]));
  const nextMarks = [...theoId].map(([id, d]): RowMark => {
    const c = prev.get(id);
    // Giữ nguyên bản cũ khi không đổi gì ⇒ repo không đẩy cập nhật thừa.
    if (c && normalizeRowMarkColor(c.color) === dau.color && c.bold === dau.bold) return c;
    return {
      id,
      tableKey,
      rowId: d.row,
      columnKey: d.columns,
      color: dau.color,
      bold: dau.bold,
      markedBy: user,
      markedAt: luc,
    };
  });
  return [...remaining, ...nextMarks];
}
