// ============================================================
// Tên file: src/lib/goodsTypes.ts
// Tên tiếng Việt tương đương: Danh mục Loại hàng
// Description: Pure helpers for the goods-type catalog (mig 0089) used by export / import contract lines
// ============================================================
// Loại hàng (1 da, 2 da, mada, cá khô…) gắn vào từng dòng hàng hợp đồng để lọc Excel. Dòng lưu `id`
// ⇒ đổi tên ở Danh mục không tách sổ; Excel ghi TÊN để người dùng lọc.
import type { GoodsType } from "@/types";

const key = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();

/** Thứ tự hiện ở ô chọn / Danh mục: `sortOrder` rồi tên. */
export function sortGoodsTypes(rows: readonly GoodsType[]): GoodsType[] {
  return [...rows].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"));
}

/** Tên loại hàng theo id; không thấy (đã xóa / chưa chọn) ⇒ "". */
export function goodsTypeName(rows: readonly GoodsType[], id: string | undefined): string {
  if (!id) return "";
  return rows.find((r) => r.id === id)?.name ?? "";
}

/**
 * Thêm ngay trong ô chọn: trùng tên (không phân hoa thường, gộp khoảng trắng) ⇒ dùng lại loại có sẵn;
 * mới ⇒ xếp cuối danh sách.
 */
export function findOrCreateGoodsType(
  name: string,
  rows: readonly GoodsType[],
  newId: () => string,
): { id: string; rows: GoodsType[]; created: boolean } {
  const existing = rows.find((r) => key(r.name) === key(name));
  if (existing) return { id: existing.id, rows: [...rows], created: false };
  const sortOrder = Math.max(0, ...rows.map((r) => r.sortOrder)) + 10;
  const created: GoodsType = { id: newId(), name: name.trim().replace(/\s+/g, " "), sortOrder, note: "" };
  return { id: created.id, rows: [...rows, created], created: true };
}
