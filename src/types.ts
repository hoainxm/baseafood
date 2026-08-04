export interface ThanhPham {
  ma: string;
  ten: string;
  dvt: string;
  maTk: string;
  nhom: string;
}

export type PhanXuong = "Đông" | "Cá" | "Khô";

/** Một dòng nhập nguyên liệu hàng ngày — theo sổ "Báo cáo tổng hợp nguyên liệu hàng ngày". */
export interface DongNhapNL {
  id: string;
  ngay: string; // yyyy-mm-dd
  phanXuong: PhanXuong;
  daiLy: string;
  loaiNL: string;
  soLuongKg: number;
  donGia: number | null;
  taiXe: string;
  bienSoXe: string;
  ghiChu: string;
}
