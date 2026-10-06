// ============================================================
// Tên file: src/features/production/wipHelpers.ts
// Tên tiếng Việt: Kiểu & hàm thuần của màn Sản xuất BTP (đầu phiên, dòng SX, tách râu/bao tử)
// Description: Pure types/helpers for the WIP production screen — no React, unit-testable.
// Tách khỏi WipProductionScreen.tsx (1810 dòng) ngày 2026-09-21 — KHÔNG đổi logic.
// (KEY_WIP_* + docXuongNho đọc localStorage nên vẫn ở màn chính — luật §4.)
// ============================================================
import type { Workshop } from "@/types";
import { newId } from "@/lib/store";

export const PHAN_XUONG: Workshop[] = ["Đông", "Cá", "Khô"];

/** Đầu phiên ghi — chọn một lần, đổ nhiều thành phẩm bên dưới. */
export interface DauPhien {
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
 *    `lamSachBot` (lib/botTam) bỏ ô ≤ 0.
 */
export interface DongSX {
  key: string;
  groupId: string; // nhóm ổn định (state form, không lưu DB)
  processingType: string; // KIỂU CHẾ BIẾN (luộc/chần/cắt…) — nhãn nhóm, lưu theo dòng
  customerName: string; // KHÁCH — nhãn nhóm, lưu theo dòng
  productId: string;
  moRong: boolean; // dòng con (râu/bao tử) đang mở — trạng thái hiển thị
  quantityKg: number; // dùng khi KHÔNG tách
  rauKg: number;
  baoTuKg: number;
  blocksCount: number;
  blockSpecKg: number; // quy cách kg/khối — nhập ngay trên dòng, nhớ về mặt hàng
  botKg: Record<string, number>; // bột tẩm theo loại — không cộng vào tổng TP
}

export const dongSXRong = (
  groupId: string,
  processingType = "",
  customerName = ""
): DongSX => ({
  key: newId(),
  groupId,
  processingType,
  customerName,
  productId: "",
  moRong: false,
  quantityKg: 0,
  rauKg: 0,
  baoTuKg: 0,
  blocksCount: 0,
  blockSpecKg: 0,
  botKg: {},
});

/** Dòng có tách râu/bao tử = đã nhập ít nhất một trong hai thành phần. */
export const laTach = (d: DongSX): boolean =>
  (d.rauKg || 0) > 0 || (d.baoTuKg || 0) > 0;

/** Tổng khối lượng một dòng (tách thì cộng 2 thành phần). */
export const tongDong = (d: DongSX): number =>
  laTach(d) ? (d.rauKg || 0) + (d.baoTuKg || 0) : d.quantityKg || 0;

/** Dòng đủ để lưu: có thành phẩm + tổng > 0. */
export const dongDayDu = (d: DongSX): boolean => Boolean(d.productId) && tongDong(d) > 0;

/**
 * Dòng CÒN TRỐNG = chưa nhập cả thành phẩm lẫn kg. Bỏ qua khi lưu (kể cả khi
 * đã mang nhãn nhóm chế biến/khách) — đây là "dòng trống chờ gõ" của bảng.
 */
export const dongTrong = (d: DongSX): boolean => !d.productId && tongDong(d) <= 0;

/**
 * Một dòng BÁN NỘI ĐỊA trong phiên ghi (mig 0054) — nguyên liệu bán THẲNG cho khách
 * trong nước, không chế biến. Lưu sang sổ riêng `domestic_sales` (KHÔNG phải dòng
 * thành phẩm — không cộng vào tổng sản lượng). Cân đối lấy làm dòng giảm "Bán nội địa".
 */
export interface DongBanNoiDia {
  key: string;
  materialTypeName: string; // TÊN loại NL (sổ lưu tên)
  quantityKg: number;
  unitPrice: number | null; // VND/kg
  customerName: string;
}

export const dongBanNoiDiaRong = (materialTypeName = ""): DongBanNoiDia => ({
  key: newId(),
  materialTypeName,
  quantityKg: 0,
  unitPrice: null,
  customerName: "",
});

/** Đủ để lưu: có loại NL + kg > 0. */
export const banNoiDiaDayDu = (d: DongBanNoiDia): boolean =>
  Boolean(d.materialTypeName.trim()) && (d.quantityKg || 0) > 0;

/** Còn trống hẳn (chưa chọn loại, chưa gõ kg/giá/khách) — bỏ qua khi lưu. */
export const banNoiDiaTrong = (d: DongBanNoiDia): boolean =>
  !d.materialTypeName.trim() && !(d.quantityKg > 0) && d.unitPrice == null && !d.customerName.trim();
