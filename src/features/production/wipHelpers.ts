// ============================================================
// Tên file: src/features/production/wipHelpers.ts
// Tên tiếng Việt: Kiểu & hàm thuần của màn Sản xuất BTP (đầu phiên, dòng SX, tách râu/bao tử)
// Description: Pure types/helpers for the WIP production screen — no React, unit-testable.
// Tách khỏi WipProductionScreen.tsx (1810 dòng) ngày 2026-09-21 — KHÔNG đổi logic.
// (KEY_WIP_* + đọc xưởng đã nhớ dùng lib/devicePrefs nên ở màn chính, giữ file này thuần.)
// ============================================================
import type { Workshop } from "@/types";
import { newId } from "@/lib/store";

export const WORKSHOPS: Workshop[] = ["Đông", "Cá", "Khô"];

/** Đầu phiên ghi — chọn một lần, đổ nhiều thành phẩm bên dưới. */
export interface SessionHeader {
  productionDate: string;
  postingDate: string;
  backdateReason: string;
  workshop: Workshop;
}

/**
 * Một dòng thành phẩm trong BẢNG nhập (nhập cả phiên rồi lưu một lần).
 *  - `groupId`: định danh NHÓM ổn định trong phiên — chỉ là state form, KHÔNG
 *    lưu xuống DB. Ổn định để sửa nhãn "kiểu chế biến × khách" ở đầu nhóm không
 *    làm React remount cả nhóm (mất focus). Dữ liệu lưu vẫn là processingType +
 *    customerName trên TỪNG dòng như cũ.
 *  - `tach`: thành phẩm cắt chần tách 2 thành phần cùng giá (râu + bao tử);
 *    khi bật, tổng khối lượng = râu + bao tử (khoá, tự cộng).
 *  - `botKg`: bột tẩm đã dùng theo loại `{ tên bột: kg }` (mig 0051) — phụ gia,
 *    KHÔNG cộng vào tổng thành phẩm. Giữ cả loại đang để 0 (ô vẫn hiện); khi lưu
 *    `sanitizeBatterKg` (lib/batter) bỏ ô ≤ 0.
 */
export interface ProductionLine {
  key: string;
  groupId: string; // nhóm ổn định (state form, không lưu DB)
  processingType: string; // KIỂU CHẾ BIẾN (luộc/chần/cắt…) — nhãn nhóm, lưu theo dòng
  customerName: string; // KHÁCH — nhãn nhóm, lưu theo dòng
  productId: string;
  expanded: boolean; // phần "Chi tiết" (quy cách, râu/bao tử) đang mở — trạng thái hiển thị
  splitOpen?: boolean; // đã bấm "Tách râu + bao tử" cho mã không đánh dấu tách — trạng thái hiển thị
  quantityKg: number; // dùng khi KHÔNG tách
  tentacleKg: number;
  stomachKg: number;
  blocksCount: number;
  blockSpecKg: number; // quy cách kg/khối — nhập ngay trên dòng, nhớ về mặt hàng
  batterKg: Record<string, number>; // bột tẩm theo loại — không cộng vào tổng TP
}

export const createEmptyProductionLine = (
  groupId: string,
  processingType = "",
  customerName = ""
): ProductionLine => ({
  key: newId(),
  groupId,
  processingType,
  customerName,
  productId: "",
  expanded: false,
  quantityKg: 0,
  tentacleKg: 0,
  stomachKg: 0,
  blocksCount: 0,
  blockSpecKg: 0,
  batterKg: {},
});

/** Dòng có tách râu/bao tử = đã nhập ít nhất một trong hai thành phần. */
export const isSplitLine = (d: ProductionLine): boolean =>
  (d.tentacleKg || 0) > 0 || (d.stomachKg || 0) > 0;

/** Tổng khối lượng một dòng (tách thì cộng 2 thành phần). */
export const getLineTotalKg = (d: ProductionLine): number =>
  isSplitLine(d) ? (d.tentacleKg || 0) + (d.stomachKg || 0) : d.quantityKg || 0;

/**
 * Kg đang là số TỰ TÍNH (block × quy cách) hoặc chưa gõ ⇒ được tính lại khi đổi block /
 * quy cách. Kg người dùng tự gõ khác block × quy cách thì GIỮ — trước 2026-10-15 gõ block
 * là đè kg không báo (VD 8,5 kg thành 8).
 */
export const isKgDerived = (d: ProductionLine): boolean =>
  !(d.quantityKg > 0) ||
  (d.blocksCount > 0 && d.blockSpecKg > 0 && Math.abs(d.quantityKg - d.blocksCount * d.blockSpecKg) < 1e-6);

/** Đổi số block: kg tính lại = block × quy cách CHỈ khi kg đang tự tính (không tách). */
export function patchBlocks(d: ProductionLine, blocks: number): Partial<ProductionLine> {
  if (isSplitLine(d) || !(d.blockSpecKg > 0) || !isKgDerived(d)) return { blocksCount: blocks };
  return { blocksCount: blocks, quantityKg: blocks * d.blockSpecKg };
}

/** Đổi quy cách kg/khối: như đổi block — chỉ tính lại kg khi kg đang tự tính. */
export function patchBlockSpec(d: ProductionLine, spec: number): Partial<ProductionLine> {
  if (isSplitLine(d) || !(d.blocksCount > 0) || !(spec > 0) || !isKgDerived(d)) return { blockSpecKg: spec };
  return { blockSpecKg: spec, quantityKg: d.blocksCount * spec };
}

/** Dòng đủ để lưu: có thành phẩm + tổng > 0. */
export const isLineComplete = (d: ProductionLine): boolean => Boolean(d.productId) && getLineTotalKg(d) > 0;

/**
 * Dòng CÒN TRỐNG = chưa nhập cả thành phẩm lẫn kg. Bỏ qua khi lưu (kể cả khi
 * đã mang nhãn nhóm chế biến/khách) — đây là "dòng trống chờ gõ" của bảng.
 */
export const isLineEmpty = (d: ProductionLine): boolean => !d.productId && getLineTotalKg(d) <= 0;

/**
 * Một dòng BÁN NỘI ĐỊA trong phiên ghi (mig 0054) — nguyên liệu bán THẲNG cho khách
 * trong nước, không chế biến. Lưu sang sổ riêng `domestic_sales` (KHÔNG phải dòng
 * thành phẩm — không cộng vào tổng sản lượng). Cân đối lấy làm dòng giảm "Bán nội địa".
 */
export interface DomesticSaleLine {
  key: string;
  materialTypeName: string; // TÊN loại NL (sổ lưu tên)
  quantityKg: number;
  unitPrice: number | null; // VND/kg
  customerName: string;
}

export const createEmptyDomesticSaleLine = (materialTypeName = ""): DomesticSaleLine => ({
  key: newId(),
  materialTypeName,
  quantityKg: 0,
  unitPrice: null,
  customerName: "",
});

/** Đủ để lưu: có loại NL + kg > 0. */
export const isDomesticSaleLineComplete = (d: DomesticSaleLine): boolean =>
  Boolean(d.materialTypeName.trim()) && (d.quantityKg || 0) > 0;

/** Còn trống hẳn (chưa chọn loại, chưa gõ kg/giá/khách) — bỏ qua khi lưu. */
export const isDomesticSaleLineEmpty = (d: DomesticSaleLine): boolean =>
  !d.materialTypeName.trim() && !(d.quantityKg > 0) && d.unitPrice == null && !d.customerName.trim();
