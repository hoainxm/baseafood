// ============================================================
// Tên file: src/lib/productUsage.ts
// Tên tiếng Việt: Mặt hàng (thành phẩm) đã được dùng ở sổ nào chưa — kiểm trước khi xóa
// Description: Counts where a product id is referenced across the business ledgers; pure
// ============================================================
// Danh mục mặt hàng phình tới 263 mục (2026-10-15) vì nút "Đồng bộ danh mục" của Sổ kho
// tháng từng đẩy cả tên quy cách nguyên liệu (VD "2 DA <80GR") sang làm thành phẩm.
// Người dùng dọn ngay trong ô chọn ⇒ trước khi xóa phải biết mặt hàng có nằm trong sổ
// nào không: sổ nối mặt hàng theo `productId`, xóa mục đang dùng là dòng sổ mất tên.
//
// Chỉ đếm các sổ LƯU `productId`. Sổ kho tháng lưu theo TÊN hàng (không nối id) nên
// không chặn. Mặt hàng gắn 1 trong 141 mã kế toán (`finishedGoodCode`) cũng chặn — mã
// kế toán là của kế toán, không dọn ở đây.
import type {
  BalancingOutputItem,
  ExportItem,
  FinishedGoodsOpeningStock,
  OrderItem,
  Packaging,
  Product,
  SalesItem,
  WipProductionItem,
} from "@/types";

export interface ProductUsageSources {
  wips: Pick<WipProductionItem, "productId">[];
  packagings: Pick<Packaging, "fromProductId" | "toProductId">[];
  salesItems: Pick<SalesItem, "productId">[];
  orderItems: Pick<OrderItem, "productId">[];
  exportItems: Pick<ExportItem, "productId">[];
  balancingOutputs: Pick<BalancingOutputItem, "productId">[];
  finishedOpeningStock: Pick<FinishedGoodsOpeningStock, "productId">[];
}

export interface ProductUsage {
  /** Tên sổ người dùng đọc được. */
  ledger: string;
  count: number;
}

/** Các sổ đang dùng mặt hàng `productId` (chỉ sổ có ≥ 1 dòng), theo thứ tự luồng nghiệp vụ. */
export function findProductUsage(productId: string, s: ProductUsageSources): ProductUsage[] {
  const count = <T>(rows: T[], hit: (r: T) => boolean) => rows.reduce((n, r) => n + (hit(r) ? 1 : 0), 0);
  const usages: ProductUsage[] = [
    { ledger: "sản xuất (/wip)", count: count(s.wips, (r) => r.productId === productId) },
    {
      ledger: "đóng gói",
      count: count(s.packagings, (r) => r.fromProductId === productId || r.toProductId === productId),
    },
    { ledger: "bán hàng", count: count(s.salesItems, (r) => r.productId === productId) },
    { ledger: "đơn đặt", count: count(s.orderItems, (r) => r.productId === productId) },
    { ledger: "lệnh xuất", count: count(s.exportItems, (r) => r.productId === productId) },
    { ledger: "cân đối", count: count(s.balancingOutputs, (r) => r.productId === productId) },
    { ledger: "tồn đầu thành phẩm", count: count(s.finishedOpeningStock, (r) => r.productId === productId) },
  ];
  return usages.filter((u) => u.count > 0);
}

/** "12 dòng sản xuất (/wip) · 3 dòng bán hàng" */
export const describeProductUsage = (usages: ProductUsage[]): string =>
  usages.map((u) => `${u.count} dòng ${u.ledger}`).join(" · ");

/** Lý do KHÔNG cho xóa (rỗng = xóa được). */
export function productDeleteBlocker(product: Product, usages: ProductUsage[]): string {
  if (product.finishedGoodCode?.trim())
    return `"${product.name}" đang gắn mã kế toán ${product.finishedGoodCode} (141 mã TK 1551) — không xóa ở đây.`;
  if (usages.length > 0)
    return `"${product.name}" đã có trong sổ: ${describeProductUsage(usages)}. Không xóa được — muốn bỏ thì sửa các dòng đó sang mặt hàng khác trước.`;
  return "";
}
