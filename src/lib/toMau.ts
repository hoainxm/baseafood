// ============================================================
// Tên file: src/lib/toMau.ts
// Tên tiếng Việt: Tô màu dòng "đã dò" kiểu Excel — hàm thuần
// Description: Pure helpers for shared row marks (row_marks, migration 0055)
// ============================================================
import type { RowMark } from "@/types";

/** Bảng màu tô — mã lưu DB. Thêm màu: thêm mã ở đây + token `--to-<mã>` trong tokens.css. */
export const MA_MAU_TO = ["vang", "xanh-la", "xanh-duong", "do"] as const;
export type MaMauTo = (typeof MA_MAU_TO)[number];

/** Dấu của một dòng như màn hình thấy. `mau` rỗng = chỉ in đậm. */
export interface DauDong {
  mau: MaMauTo | "";
  dam: boolean;
}

/** Mã màu lạ (bản app mới hơn ghi) ⇒ coi như không màu, không vỡ. */
export function chuanMau(v: string): MaMauTo | "" {
  return (MA_MAU_TO as readonly string[]).includes(v) ? (v as MaMauTo) : "";
}

/**
 * id TẤT ĐỊNH của một dấu: cùng bảng + cùng dòng (+ cùng cột) ⇒ cùng id ⇒ ghi
 * lại chỉ cập nhật, hai người tô cùng dòng không đẻ hai dấu. `*` = cả dòng.
 */
export function idDauTo(tableKey: string, rowId: string, columnKey: string | null = null): string {
  return `${tableKey}::${rowId}::${columnKey ?? "*"}`;
}

/** Dấu CẢ DÒNG của một bảng → Map(rowId → dấu). Dấu ô lẻ (columnKey) bỏ qua. */
export function dauCuaBang(marks: RowMark[], tableKey: string): Map<string, DauDong> {
  const ra = new Map<string, DauDong>();
  for (const m of marks) {
    if (m.tableKey !== tableKey || m.columnKey != null) continue;
    const mau = chuanMau(m.color);
    if (!mau && !m.bold) continue;
    ra.set(m.rowId, { mau, dam: m.bold });
  }
  return ra;
}

/**
 * Đặt (hoặc bỏ) dấu cho NHIỀU dòng của một bảng, trả danh sách MỚI để `ghi()`.
 * `dau` null — hoặc không màu + không đậm — ⇒ xoá dấu (bỏ tô). Dòng của bảng
 * khác giữ nguyên (repo nhận NGUYÊN danh sách — quên ghép là mất dấu bảng khác).
 */
export function datDau(
  marks: RowMark[],
  tableKey: string,
  rowIds: string[],
  dau: DauDong | null,
  nguoi: string,
  luc: string = new Date().toISOString()
): RowMark[] {
  const ids = new Set(rowIds.map((r) => idDauTo(tableKey, r)));
  const bo = !dau || (!dau.mau && !dau.dam);
  const conLai = marks.filter((m) => !ids.has(m.id));
  if (bo) return conLai;
  const cu = new Map(marks.map((m) => [m.id, m]));
  const moi = [...new Set(rowIds)].map((rowId): RowMark => {
    const id = idDauTo(tableKey, rowId);
    const c = cu.get(id);
    // Giữ nguyên bản cũ khi không đổi gì ⇒ repo không đẩy cập nhật thừa.
    if (c && chuanMau(c.color) === dau.mau && c.bold === dau.dam) return c;
    return {
      id,
      tableKey,
      rowId,
      columnKey: null,
      color: dau.mau,
      bold: dau.dam,
      markedBy: nguoi,
      markedAt: luc,
    };
  });
  return [...conLai, ...moi];
}
