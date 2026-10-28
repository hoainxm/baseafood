// ============================================================
// Tên file: src/lib/customerProductNames.ts
// Tên tiếng Việt: Tên hàng theo khách — tên in trên chứng từ xuất khẩu của từng khách
// Description: Pure rules for per-customer product names (ba-spec 41 v6 R23 · R26): lookup, fill
//              a contract line after picking a product, duplicate checks, extracting names from
//              mapped contract lines (create only, never overwrite).
// ============================================================
// Vì sao (họp 2026-10-22): cùng một mặt hàng mỗi khách gọi một tên (Matsuda "Frozen boiled
// octopus", Seachemot "Iwadako…"), theo size; ~15–20 tên / khách. Mỗi (khách, mặt hàng) một dòng.
import type { CustomerProductName, ExportContractLine, Product } from "@/types";

/** So tên / size: không phân hoa thường, gộp khoảng trắng (A11). */
export const nameKey = (v: string | undefined | null) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function namesOfCustomer<N extends Pick<CustomerProductName, "customerId">>(names: readonly N[], customerId: string): N[] {
  return customerId ? names.filter((n) => n.customerId === customerId) : [];
}

export function findCustomerName<N extends Pick<CustomerProductName, "customerId" | "productId">>(names: readonly N[], customerId: string, productId: string): N | undefined {
  if (!customerId || !productId) return undefined;
  return names.find((n) => n.customerId === customerId && n.productId === productId);
}

type LineText = Pick<ExportContractLine, "description" | "size" | "packing" | "hsCode">;

/**
 * Ô chữ của dòng hàng sau khi chọn mặt hàng (R23): ô nào đang TRỐNG thì lấy theo tên của khách;
 * khách chưa có tên ⇒ chỉ ô tên lấy tên tiếng Anh mặc định (`products.trade_name`). Ô đã có chữ giữ nguyên.
 */
export function lineTextAfterPick(
  line: LineText,
  product: Pick<Product, "tradeName"> | undefined,
  customerName: Pick<CustomerProductName, "tradeName" | "sizeText" | "packing" | "hsCode"> | undefined,
): LineText {
  const keep = (current: string, next: string | undefined) => (current.trim() ? current : (next ?? "").trim() || current);
  if (customerName) {
    return {
      description: keep(line.description, customerName.tradeName),
      size: keep(line.size, customerName.sizeText),
      packing: keep(line.packing, customerName.packing),
      hsCode: keep(line.hsCode, customerName.hsCode),
    };
  }
  return { ...line, description: keep(line.description, product?.tradeName) };
}

/**
 * Mặt hàng mà tên của khách khớp dòng HĐ (bậc 1–2 của R23): bậc 1 khớp tên + size (size có chữ),
 * bậc 2 khớp tên. Trả mọi mặt hàng khớp của bậc đầu tiên có kết quả.
 */
export function productsByCustomerName(
  names: readonly Pick<CustomerProductName, "customerId" | "productId" | "tradeName" | "sizeText">[],
  customerId: string,
  description: string,
  size = "",
): { tier: 1 | 2 | null; productIds: string[] } {
  const key = nameKey(description);
  if (!key || !customerId) return { tier: null, productIds: [] };
  const mine = namesOfCustomer(names, customerId).filter((n) => nameKey(n.tradeName) === key);
  const sizeKey = nameKey(size);
  if (sizeKey) {
    const bySize = [...new Set(mine.filter((n) => nameKey(n.sizeText) === sizeKey).map((n) => n.productId))];
    if (bySize.length) return { tier: 1, productIds: bySize };
  }
  // Bậc 2 (khớp tên): dòng có size mà dòng tên của khách ghi size KHÁC ⇒ không phải mặt hàng đó
  // (VD tên chỉ có size 5-5.5 gr, dòng HĐ size 6-7 gr) — chỉ nhận dòng tên không ghi size.
  const byName = [...new Set(mine.filter((n) => !sizeKey || !nameKey(n.sizeText)).map((n) => n.productId))];
  return byName.length ? { tier: 2, productIds: byName } : { tier: null, productIds: [] };
}

export interface NameIssue {
  field: string;
  message: string;
}

/**
 * Kiểm một dòng tên trước khi lưu (AC-47): tên bắt buộc; mỗi (khách, mặt hàng) một dòng; trong
 * cùng khách không hai mặt hàng trùng CẢ tên lẫn size (không biết nối về mặt hàng nào).
 */
export function validateCustomerProductName(
  row: Pick<CustomerProductName, "id" | "customerId" | "productId" | "tradeName" | "sizeText">,
  all: readonly Pick<CustomerProductName, "id" | "customerId" | "productId" | "tradeName" | "sizeText">[],
): NameIssue[] {
  const out: NameIssue[] = [];
  if (!row.productId) out.push({ field: "Mặt hàng", message: "Chọn mặt hàng của xưởng" });
  if (!row.tradeName.trim()) out.push({ field: "Tên trên chứng từ", message: "Ghi tên khách dùng trên hợp đồng / invoice" });
  const others = all.filter((x) => x.id !== row.id && x.customerId === row.customerId);
  if (row.productId && others.some((x) => x.productId === row.productId)) {
    out.push({ field: "Mặt hàng", message: "Mặt hàng này đã có tên của khách — sửa dòng đang có" });
  }
  if (
    row.tradeName.trim() &&
    others.some((x) => x.productId !== row.productId && nameKey(x.tradeName) === nameKey(row.tradeName) && nameKey(x.sizeText) === nameKey(row.sizeText))
  ) {
    out.push({ field: "Size", message: "Trùng tên + size với một mặt hàng khác của khách — ghi size để phân biệt" });
  }
  return out;
}

/**
 * Trích xuất từ chứng từ (NV16 · R26 · R27): từ các dòng hàng (HĐ hoặc invoice) đã nối mặt hàng, TẠO dòng tên cho cặp (khách, mặt hàng)
 * chưa có. Không sửa dòng đã có; dòng không có mặt hàng / tên rỗng bỏ qua; cùng mặt hàng lấy dòng
 * đầu; trùng tên + size với mặt hàng khác của khách thì bỏ qua (giữ R23).
 */
export function extractCustomerNames(
  existing: readonly CustomerProductName[],
  customerId: string,
  lines: readonly Pick<ExportContractLine, "productId" | "description" | "size" | "packing" | "hsCode">[],
  docNo: string,
  newId: () => string,
  /** Loại chứng từ nguồn cho ghi chú: "HĐ" (hợp đồng) hoặc "Invoice" (Commercial Invoice — R27). */
  docKind: "HĐ" | "Invoice" = "HĐ",
): CustomerProductName[] {
  if (!customerId) return [];
  const created: CustomerProductName[] = [];
  for (const l of lines) {
    if (!l.productId || !l.description.trim()) continue;
    const pool = [...existing, ...created];
    if (findCustomerName(pool, customerId, l.productId)) continue;
    const row: CustomerProductName = {
      id: newId(),
      customerId,
      productId: l.productId,
      tradeName: l.description.trim(),
      sizeText: l.size.trim(),
      packing: l.packing.trim(),
      hsCode: l.hsCode.trim(),
      note: docNo ? `Trích xuất từ ${docKind} ${docNo}` : docKind === "HĐ" ? "Trích xuất từ hợp đồng" : "Trích xuất từ invoice",
    };
    if (validateCustomerProductName(row, pool).length) continue;
    created.push(row);
  }
  return created;
}
