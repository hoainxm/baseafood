export interface ThanhPham {
  ma: string;
  ten: string;
  dvt: string;
  maTk: string;
  nhom: string;
}

export type PhanXuong = "Đông" | "Cá" | "Khô";

/** Loài nguyên liệu — ghi rõ, không để mặc định ngầm "bạch tuộc". */
export const LOAI = [
  "Bạch tuộc",
  "Mực",
  "Cá",
  "Tôm",
  "Ghẹ",
  "Khác",
] as const;
export type Loai = (typeof LOAI)[number];

/** Một dòng nhập nguyên liệu hàng ngày — theo sổ "Báo cáo tổng hợp nguyên liệu hàng ngày". */
export interface DongNhapNL {
  id: string;
  ngay: string; // yyyy-mm-dd
  phanXuong: PhanXuong;
  loai: Loai; // loài: bạch tuộc / mực / cá… — ghi rõ
  daiLy: string;
  loaiNL: string; // quy cách/size, VD "2 da nl 80 trên"
  soLuongKg: number;
  donGia: number | null;
  taiXe: string;
  bienSoXe: string;
  ghiChu: string;
}

/** Thành tiền = số lượng × đơn giá. */
export function thanhTien(r: Pick<DongNhapNL, "soLuongKg" | "donGia">): number {
  return r.soLuongKg * (r.donGia ?? 0);
}

/* ---------- Cân đối 5 ngày (xưởng Đông) ---------- */

/** Danh mục mặt hàng cân đối — mở, người dùng thêm khi thiếu; ánh xạ mã TP 141 nếu có. */
export interface MatHang {
  id: string;
  ma: string;
  ten: string;
  maTP: string; // mã trong danh mục 141 (nếu có)
}

/** Khách hàng (đầu ra) — tách riêng đại lý (đầu vào). */
export interface KhachHang {
  id: string;
  ma: string;
  ten: string;
  thiTruong: string; // VD Nhật, EU, Nội địa
}

/** Đại lý cung cấp nguyên liệu (đầu vào). */
export interface DaiLy {
  id: string;
  ma: string;
  ten: string;
  dienThoai: string;
  ghiChu: string;
}

/**
 * Loại nguyên liệu (quy cách/size) — VD "2 da nguyên liệu", "Mực ống 7cm".
 * Có danh mục để chống gõ tự do mỗi lần một kiểu → tổng hợp cuối kỳ mới đúng.
 */
export interface LoaiNguyenLieu {
  id: string;
  ten: string;
  loai: string; // thuộc loài nào: Bạch tuộc / Mực / Cá…
  ghiChu: string;
}

export type NhomNL = "Thủy sản" | "Xả đông" | "Bột phụ gia";
export const NHOM_NL: NhomNL[] = ["Thủy sản", "Xả đông", "Bột phụ gia"];

export type Kenh = "Xuất khẩu" | "Nội địa";
export const KENH: Kenh[] = ["Xuất khẩu", "Nội địa"];

/** Một kỳ cân đối = một lô nguyên liệu theo loại, theo tập ngày tiếp nhận. */
export interface KyCanDoi {
  id: string;
  loaiNL: string; // VD "Bạch tuộc 2 da", "Mực ống khay"
  ngayList: string; // chuỗi hiển thị/in, sinh từ tuNgay–denNgay hoặc gõ tay (bản cũ)
  tuNgay?: string; // ISO yyyy-mm-dd — chọn bằng lịch
  denNgay?: string; // ISO yyyy-mm-dd
  tongNLNhan: number | null; // tổng NL nhận cả kỳ (bảng phụ) — để tính tỉ lệ thu hồi
  tiGia: number | null; // VND/USD (VD 26.000)
  chiPhiCB: number | null; // chi phí chế biến / kg TP (VND)
  createdAt: string;
}

export interface DongNLVao {
  id: string;
  kyId: string;
  nhom: NhomNL;
  ten: string;
  soLuongKg: number;
  donGia: number | null; // VND
  tyLe: number | null; // % (dùng cho bột phụ gia)
}

export interface DongPheLieu {
  id: string;
  kyId: string;
  loai: string; // nội tạng / dạt…
  soLuongKg: number;
  donGiaBan: number | null; // VND
}

export interface DongTP {
  id: string;
  kyId: string;
  matHangId: string;
  khachId: string;
  kenh: Kenh;
  luongKg: number;
  donGia: number | null; // USD nếu Xuất khẩu, VND nếu Nội địa
}
