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
