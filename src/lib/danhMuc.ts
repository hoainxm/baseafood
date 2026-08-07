import { uid } from "@/lib/db";
import {
  BANG_BAN_HANG,
  BANG_CHOT_NGAY,
  BANG_CHOT_SX,
  BANG_CHUYEN_NHAP,
  BANG_DAI_LY,
  BANG_DON_DAT,
  BANG_DONG_DON,
  BANG_DONG_LENH,
  BANG_KHACH_HANG,
  BANG_KY,
  BANG_LENH_XUAT,
  BANG_LOAI_NL,
  BANG_MAT_HANG,
  BANG_NGUOI_DUNG,
  BANG_NHAP_NL,
  BANG_NL_VAO,
  BANG_PHE_LIEU,
  BANG_PHIEU_BAN,
  BANG_SAN_XUAT,
  BANG_THANH_PHAM,
  BANG_TP_RA,
  useBang,
} from "@/lib/repo";
import type { LoaiNguyenLieu, ThanhPham } from "@/types";
import tp141 from "@/data/thanh-pham.json";

/**
 * Các bảng dữ liệu của hệ thống, gói sẵn để màn hình gọi một dòng.
 * Chạy Supabase hay localStorage là do env quyết định — màn hình không cần biết.
 */

const LOAI_NL_SEED: { ten: string; loai: string }[] = [
  { ten: "1 da nguyên liệu", loai: "Bạch tuộc" },
  { ten: "2 da nguyên liệu", loai: "Bạch tuộc" },
  { ten: "Bạch tuộc 1 da", loai: "Bạch tuộc" },
  { ten: "Bạch tuộc 2 da", loai: "Bạch tuộc" },
  { ten: "Mực ống 7cm", loai: "Mực" },
  { ten: "Mực nang", loai: "Mực" },
  { ten: "Đầu ống", loai: "Mực" },
  { ten: "Bao tử", loai: "Mực" },
  { ten: "Ghẹ lột", loai: "Ghẹ" },
  { ten: "Cá nục", loai: "Cá" },
  { ten: "Cá saba", loai: "Cá" },
  { ten: "Cá sòng", loai: "Cá" },
];

/** Nạp sẵn các loại thường gặp trong sổ, để lần đầu mở đã có cái mà chọn. */
export const seedLoaiNL = (): LoaiNguyenLieu[] =>
  LOAI_NL_SEED.map((x) => ({ id: uid(), ten: x.ten, loai: x.loai, ghiChu: "" }));

/** 141 mã kế toán — file JSON chỉ còn là SEED, nguồn thật là bảng thanh_pham. */
export const seedThanhPham = (): ThanhPham[] => tp141 as ThanhPham[];

/* --- Danh mục --- */
export const useMatHang = () => useBang(BANG_MAT_HANG);
export const useKhachHang = () => useBang(BANG_KHACH_HANG);
export const useDaiLy = () => useBang(BANG_DAI_LY);
export const useLoaiNL = () => useBang(BANG_LOAI_NL, seedLoaiNL);
export const useThanhPham = () => useBang(BANG_THANH_PHAM, seedThanhPham);

/* --- Nghiệp vụ --- */
export const useNhapNL = () => useBang(BANG_NHAP_NL);
export const useChuyenNhap = () => useBang(BANG_CHUYEN_NHAP);
export const useChotNgay = () => useBang(BANG_CHOT_NGAY);
export const useKyCanDoi = () => useBang(BANG_KY);
export const useNLVao = () => useBang(BANG_NL_VAO);
export const usePheLieu = () => useBang(BANG_PHE_LIEU);
export const useTPRa = () => useBang(BANG_TP_RA);
export const usePhieuBan = () => useBang(BANG_PHIEU_BAN);
export const useBanHang = () => useBang(BANG_BAN_HANG);
export const useNguoiDung = () => useBang(BANG_NGUOI_DUNG);

/* --- Module WIP: sản xuất BTP · kho · đơn đặt --- */
export const useSanXuat = () => useBang(BANG_SAN_XUAT);
export const useChotSX = () => useBang(BANG_CHOT_SX);
export const useDonDat = () => useBang(BANG_DON_DAT);
export const useDongDon = () => useBang(BANG_DONG_DON);
export const useLenhXuat = () => useBang(BANG_LENH_XUAT);
export const useDongLenh = () => useBang(BANG_DONG_LENH);
