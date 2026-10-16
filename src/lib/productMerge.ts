// ============================================================
// Tên file: src/lib/productMerge.ts
// Tên tiếng Việt: Gộp mặt hàng trùng tên (hàm thuần)
// Description: Same-name product detection, reference remapping and blank-field fill
// ============================================================
// Danh mục mặt hàng có cặp TRÙNG TÊN (VD hai "Bạch tuộc 2 da cắt luộc 3gr", mã BT-CAT3G
// và BT-CAT3GNĐ — chốt 2026-10-16): mọi thành phẩm ghi ra đều về kho thành phẩm ⇒ gộp
// về MỘT mục. Trên máy chủ việc gộp chạy trong một giao dịch (migration 0069); ở chế độ
// localStorage app gộp qua các hook bằng chính các hàm này. Hai đường cùng luật:
// chỉ gộp mục CÙNG TÊN (không phân hoa thường / khoảng trắng), mục giữ được điền các ô
// đang trống từ mục bỏ, mã kế toán (141 mã) không bị xoá — chỉ dòng mặt hàng.
import type { Product } from "@/types";

/** Tên chuẩn để so trùng: bỏ khoảng trắng thừa, không phân hoa thường. */
export const normalizeProductName = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** Các mục KHÁC `id` cùng tên với nó (rỗng nếu không trùng). */
export function findSameNameProducts(products: Product[], id: string): Product[] {
  const p = products.find((x) => x.id === id);
  if (!p) return [];
  const key = normalizeProductName(p.name);
  return products.filter((x) => x.id !== id && normalizeProductName(x.name) === key);
}

/** Tên trùng với ít nhất một mục khác ⇒ ô chọn ghi kèm mã để phân biệt. */
export function duplicateProductNameKeys(products: Product[]): Set<string> {
  const count = new Map<string, number>();
  for (const p of products) {
    const k = normalizeProductName(p.name);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return new Set([...count].filter(([, n]) => n > 1).map(([k]) => k));
}

/**
 * Đổi tham chiếu mặt hàng `dropId` → `keepId` ở các trường `fields` của mỗi dòng. Trả về
 * mảng mới (dòng không đổi giữ nguyên đối tượng) + số dòng đã đổi.
 */
export function remapProductReferences<T>(
  rows: T[],
  fields: (keyof T)[],
  dropId: string,
  keepId: string
): { rows: T[]; changed: number } {
  let changed = 0;
  const next = rows.map((r) => {
    let out = r;
    for (const f of fields) {
      if (out[f] === (dropId as unknown)) {
        out = { ...out, [f]: keepId };
      }
    }
    if (out !== r) changed++;
    return out;
  });
  return { rows: next, changed };
}

const isBlank = (v: unknown) =>
  v == null || (typeof v === "string" && v.trim() === "") || (Array.isArray(v) && v.length === 0);

/** Mục giữ sau khi gộp: ô đang trống lấy từ mục bỏ (mã số, loài, kiểu chế biến, loại NL, bột, quy cách). */
export function fillBlankProductFields(keep: Product, drop: Product): Product {
  const out: Product = { ...keep };
  for (const f of ["code", "category", "processingType", "materialTypeId", "batterIds", "blockSpecKg"] as const) {
    if (isBlank(out[f]) && !isBlank(drop[f])) (out as unknown as Record<string, unknown>)[f] = drop[f];
  }
  return out;
}
