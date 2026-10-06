// ============================================================
// Tên file: src/lib/toMau.ts
// Tên tiếng Việt: Tô màu dòng/ô "đã dò" kiểu Excel — hàm thuần
// Description: Pure helpers for shared row/cell marks (row_marks, migration 0055)
// ============================================================
import type { RowMark } from "@/types";

/** Sắc màu tô — khớp `SAC_TO` ở design-system/patterns/toMauNguon.ts + token `--to-<sắc>-<mức>`. */
export const SAC_TO_LIB = ["xam", "do", "cam", "vang", "chuoi", "la", "troi", "duong", "tim", "hong"] as const;
export type SacTo = (typeof SAC_TO_LIB)[number];
/** Mã màu lưu DB: "<sắc>-<mức 1..5>" (VD "vang-5"). */
export type MaMauTo = `${SacTo}-${1 | 2 | 3 | 4 | 5}`;

/** Dấu của một dòng / ô như màn hình thấy. `mau` rỗng = chỉ in đậm. */
export interface DauDong {
  mau: MaMauTo | "";
  dam: boolean;
}

/** Đích tô: cả dòng (`cot` null) hoặc một ô. */
export interface DichTo {
  dong: string;
  cot: string | null;
}

/* Bản đầu (sáng 2026-10-06) lưu 4 mã trơn — đọc ra mức 2 của sắc tương ứng. */
const MA_CU: Record<string, MaMauTo> = {
  vang: "vang-2",
  "xanh-la": "la-2",
  "xanh-duong": "duong-2",
  do: "do-2",
};
const RE_MA = new RegExp(`^(${SAC_TO_LIB.join("|")})-[1-5]$`);

/** Mã màu lạ (bản app mới hơn ghi) ⇒ coi như không màu, không vỡ. */
export function chuanMau(v: string): MaMauTo | "" {
  if (MA_CU[v]) return MA_CU[v];
  return RE_MA.test(v) ? (v as MaMauTo) : "";
}

/**
 * id TẤT ĐỊNH của một dấu: cùng bảng + cùng dòng (+ cùng cột) ⇒ cùng id ⇒ ghi
 * lại chỉ cập nhật, hai người tô cùng chỗ không đẻ hai dấu. `*` = cả dòng.
 */
export function idDauTo(tableKey: string, rowId: string, columnKey: string | null = null): string {
  return `${tableKey}::${rowId}::${columnKey ?? "*"}`;
}

/** Khoá tra dấu ô trong `dauCuaBang().o` — khớp `khoaODau` ở design-system. */
export const khoaO = (rowId: string, columnKey: string) => `${rowId}\u0001${columnKey}`;

/** Dấu của một bảng: theo DÒNG (Map rowId) + theo Ô (Map khoaO). */
export function dauCuaBang(
  marks: RowMark[],
  tableKey: string
): { dong: Map<string, DauDong>; o: Map<string, DauDong> } {
  const dong = new Map<string, DauDong>();
  const o = new Map<string, DauDong>();
  for (const m of marks) {
    if (m.tableKey !== tableKey) continue;
    const mau = chuanMau(m.color);
    if (!mau && !m.bold) continue;
    const dau = { mau, dam: m.bold };
    if (m.columnKey == null) dong.set(m.rowId, dau);
    else o.set(khoaO(m.rowId, m.columnKey), dau);
  }
  return { dong, o };
}

/**
 * Đặt (hoặc bỏ) dấu cho NHIỀU đích của một bảng, trả danh sách MỚI để `ghi()`.
 * Chuỗi = cả dòng. `dau` null — hoặc không màu + không đậm — ⇒ xoá dấu (bỏ tô).
 * Dấu của bảng khác / đích khác giữ nguyên (repo nhận NGUYÊN danh sách — quên
 * ghép là mất dấu chỗ khác).
 */
export function datDau(
  marks: RowMark[],
  tableKey: string,
  dich: (string | DichTo)[],
  dau: DauDong | null,
  nguoi: string,
  luc: string = new Date().toISOString()
): RowMark[] {
  const ds = dich.map((d) => (typeof d === "string" ? { dong: d, cot: null } : d));
  const theoId = new Map(ds.map((d) => [idDauTo(tableKey, d.dong, d.cot), d]));
  const bo = !dau || (!dau.mau && !dau.dam);
  const conLai = marks.filter((m) => !theoId.has(m.id));
  if (bo) return conLai;
  const cu = new Map(marks.map((m) => [m.id, m]));
  const moi = [...theoId].map(([id, d]): RowMark => {
    const c = cu.get(id);
    // Giữ nguyên bản cũ khi không đổi gì ⇒ repo không đẩy cập nhật thừa.
    if (c && chuanMau(c.color) === dau.mau && c.bold === dau.dam) return c;
    return {
      id,
      tableKey,
      rowId: d.dong,
      columnKey: d.cot,
      color: dau.mau,
      bold: dau.dam,
      markedBy: nguoi,
      markedAt: luc,
    };
  });
  return [...conLai, ...moi];
}
