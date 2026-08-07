import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, hasSupabase, SITE_ID } from "@/lib/supabase";
import { ketNoi } from "@/lib/ketNoi";
import { load, save } from "@/lib/db";
import type {
  ChotNgay,
  ChuyenNhap,
  DaiLy,
  DongBan,
  DongNLVao,
  DongNhapNL,
  DongPheLieu,
  DongTP,
  KhachHang,
  Kenh,
  KyCanDoi,
  Loai,
  LoaiNguyenLieu,
  MatHang,
  NguonPheLieu,
  NguoiDung,
  NhomNL,
  PhanXuong,
  PhieuBan,
  ThanhPham,
  DongSanXuat,
  TrangThaiKho,
  DonDat,
  TrangThaiDon,
  DongDon,
  LenhXuat,
  DongLenh,
} from "@/types";
import { vaiTroTuChuoi, vaiTroThanhChuoi } from "@/types";

/**
 * Tầng dữ liệu dùng chung.
 *
 * Một API duy nhất cho cả hai chế độ:
 *   - Chưa cấu hình Supabase → đọc/ghi localStorage.
 *   - Đã cấu hình            → đọc/ghi Supabase, ĐỒNG THỜI ghi bản sao xuống
 *                              localStorage làm bộ đệm: mất mạng giữa ca vẫn
 *                              còn số liệu để đối chiếu, không trắng màn hình.
 *
 * Màn hình vẫn dùng `const [rows, ghi] = useNhapNL()` và truyền NGUYÊN danh
 * sách mới; tầng này tự so danh sách cũ/mới để biết dòng nào thêm, dòng nào
 * sửa, dòng nào xóa rồi mới gọi Supabase.
 *
 * Tên bảng/cột trong DB: tiếng Việt không dấu, snake_case
 * (xem supabase/migrations/0001_baseafood_mes.sql).
 */

export interface AnhXaBang<T> {
  /** Tên bảng trong Supabase */
  table: string;
  /** Khóa chính trong DB — mặc định "id", danh mục thành phẩm dùng "ma" */
  khoaChinh?: string;
  /** Khóa localStorage (giữ nguyên khóa cũ để dữ liệu đang có không mất) */
  localKey: string;
  /** Lấy khóa của một bản ghi ở phía app */
  layKhoa: (x: T) => string;
  toRow: (x: T) => Record<string, unknown>;
  fromRow: (r: Record<string, unknown>) => T;
  /**
   * Vá dòng cũ còn thiếu trường mới thêm về sau. Bản sao dưới localStorage được
   * đọc thẳng bằng JSON.parse (không qua `fromRow`), nên dữ liệu ghi từ bản
   * trước sẽ thiếu trường — vá ở một chỗ này thay vì rải `?? ""` khắp màn hình.
   */
  vaDongCu?: (x: T) => T;
}

const s = (v: unknown) => (v == null ? "" : String(v));
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));
const theoId = <T extends { id: string }>(x: T) => x.id;

/* ---------- Ánh xạ camelCase (app) ↔ snake_case (Postgres) ---------- */

export const BANG_DAI_LY: AnhXaBang<DaiLy> = {
  table: "dai_ly",
  localKey: "bsf.daily.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ma: x.ma,
    ten: x.ten,
    dien_thoai: x.dienThoai,
    ghi_chu: x.ghiChu,
    // Cột mới (migration 0009) — chỉ gửi khi có giá trị ⇒ đại lý vẫn ghi được
    // kể cả khi chưa chạy 0009.
    ...(x.tenGhiPhieu ? { ten_ghi_phieu: x.tenGhiPhieu } : {}),
    ...(x.diaChi ? { dia_chi: x.diaChi } : {}),
    ...(x.cmnd ? { cmnd: x.cmnd } : {}),
    ...(x.ngayCap ? { ngay_cap: x.ngayCap } : {}),
    ...(x.noiCap ? { noi_cap: x.noiCap } : {}),
  }),
  fromRow: (r) => ({
    id: s(r.id),
    ma: s(r.ma),
    ten: s(r.ten),
    tenGhiPhieu: r.ten_ghi_phieu == null ? "" : s(r.ten_ghi_phieu),
    diaChi: r.dia_chi == null ? "" : s(r.dia_chi),
    cmnd: r.cmnd == null ? "" : s(r.cmnd),
    ngayCap: r.ngay_cap == null ? "" : s(r.ngay_cap),
    noiCap: r.noi_cap == null ? "" : s(r.noi_cap),
    dienThoai: s(r.dien_thoai),
    ghiChu: s(r.ghi_chu),
  }),
};

export const BANG_LOAI_NL: AnhXaBang<LoaiNguyenLieu> = {
  table: "loai_nguyen_lieu",
  localKey: "bsf.loainl.v1",
  layKhoa: theoId,
  toRow: (x) => ({ id: x.id, ten: x.ten, loai: x.loai, ghi_chu: x.ghiChu }),
  fromRow: (r) => ({
    id: s(r.id),
    ten: s(r.ten),
    loai: s(r.loai),
    ghiChu: s(r.ghi_chu),
  }),
};

/** Danh mục 141 mã kế toán — khóa chính là MÃ, không phải id sinh tự động. */
export const BANG_THANH_PHAM: AnhXaBang<ThanhPham> = {
  table: "thanh_pham",
  khoaChinh: "ma",
  localKey: "bsf.thanhpham.v1",
  layKhoa: (x) => x.ma,
  toRow: (x) => ({
    ma: x.ma,
    ten: x.ten,
    dvt: x.dvt,
    ma_tai_khoan: x.maTk,
    nhom: x.nhom,
  }),
  fromRow: (r) => ({
    ma: s(r.ma),
    ten: s(r.ten),
    dvt: s(r.dvt),
    maTk: s(r.ma_tai_khoan),
    nhom: s(r.nhom),
  }),
};

export const BANG_MAT_HANG: AnhXaBang<MatHang> = {
  table: "mat_hang",
  localKey: "bsf.mathang.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ma: x.ma,
    ten: x.ten,
    ma_thanh_pham: x.maTP,
    // Cột mới (migration 0014) — chỉ gửi khi có giá trị ⇒ mặt hàng vẫn ghi được
    // kể cả khi chưa chạy 0014.
    ...(x.loai ? { loai: x.loai } : {}),
  }),
  fromRow: (r) => ({
    id: s(r.id),
    ma: s(r.ma),
    ten: s(r.ten),
    maTP: s(r.ma_thanh_pham),
    loai: r.loai == null ? "" : s(r.loai),
  }),
};

export const BANG_KHACH_HANG: AnhXaBang<KhachHang> = {
  table: "khach_hang",
  localKey: "bsf.khachhang.v1",
  layKhoa: theoId,
  toRow: (x) => ({ id: x.id, ma: x.ma, ten: x.ten, thi_truong: x.thiTruong }),
  fromRow: (r) => ({
    id: s(r.id),
    ma: s(r.ma),
    ten: s(r.ten),
    thiTruong: s(r.thi_truong),
  }),
};

/** Chuyến hàng — một đại lý, một lượt giao, nhiều dòng loại hàng. */
export const BANG_CHUYEN_NHAP: AnhXaBang<ChuyenNhap> = {
  table: "chuyen_nhap",
  localKey: "bsf.chuyen.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ngay_giao: x.ngayGiao,
    ngay_ghi_so: x.ngayGhiSo,
    ly_do_ghi_bu: x.lyDoGhiBu,
    phan_xuong: x.phanXuong,
    ten_dai_ly: x.daiLy,
    tai_xe: x.taiXe,
    bien_so_xe: x.bienSoXe,
    ghi_chu: x.ghiChu,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    ngayGiao: s(r.ngay_giao).slice(0, 10),
    ngayGhiSo: s(r.ngay_ghi_so).slice(0, 10),
    lyDoGhiBu: s(r.ly_do_ghi_bu),
    phanXuong: s(r.phan_xuong) as PhanXuong,
    daiLy: s(r.ten_dai_ly),
    taiXe: s(r.tai_xe),
    bienSoXe: s(r.bien_so_xe),
    ghiChu: s(r.ghi_chu),
  }),
};

/** Chốt số liệu một ngày của một phân xưởng. */
export const BANG_CHOT_NGAY: AnhXaBang<ChotNgay> = {
  table: "chot_ngay",
  localKey: "bsf.chot-ngay.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ngay: x.ngay,
    phan_xuong: x.phanXuong,
    da_chot: x.daChot,
    chot_luc: x.chotLuc,
    tong_kg_luc_chot: x.tongKgLucChot,
    ly_do_mo_lai: x.lyDoMoLai,
    ghi_chu: x.ghiChu,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    ngay: s(r.ngay).slice(0, 10),
    phanXuong: s(r.phan_xuong) as PhanXuong,
    daChot: Boolean(r.da_chot),
    chotLuc: s(r.chot_luc),
    tongKgLucChot: Number(r.tong_kg_luc_chot ?? 0),
    lyDoMoLai: s(r.ly_do_mo_lai),
    ghiChu: s(r.ghi_chu),
  }),
};

export const BANG_NHAP_NL: AnhXaBang<DongNhapNL> = {
  table: "nhap_nguyen_lieu",
  localKey: "bsf.nhap-nl.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    chuyen_id: x.chuyenId,
    ngay: x.ngay,
    phan_xuong: x.phanXuong,
    loai: x.loai,
    ten_dai_ly: x.daiLy,
    ten_loai_nguyen_lieu: x.loaiNL,
    so_luong_kg: x.soLuongKg,
    don_gia: x.donGia,
    tai_xe: x.taiXe,
    bien_so_xe: x.bienSoXe,
    ghi_chu: x.ghiChu,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    chuyenId: s(r.chuyen_id),
    ngay: s(r.ngay).slice(0, 10),
    phanXuong: s(r.phan_xuong) as PhanXuong,
    loai: s(r.loai) as Loai,
    daiLy: s(r.ten_dai_ly),
    loaiNL: s(r.ten_loai_nguyen_lieu),
    soLuongKg: Number(r.so_luong_kg ?? 0),
    donGia: n(r.don_gia),
    taiXe: s(r.tai_xe),
    bienSoXe: s(r.bien_so_xe),
    ghiChu: s(r.ghi_chu),
  }),
  // Dòng ghi trước khi có "chuyến thật" → chưa gắn chuyến, app gom ngầm.
  vaDongCu: (x) => (x.chuyenId == null ? { ...x, chuyenId: "" } : x),
};

export const BANG_KY: AnhXaBang<KyCanDoi> = {
  table: "ky_can_doi",
  localKey: "bsf.ky.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ten_loai_nguyen_lieu: x.loaiNL,
    mo_ta_ngay: x.ngayList,
    tu_ngay: x.tuNgay || null,
    den_ngay: x.denNgay || null,
    tong_nl_nhan_kg: x.tongNLNhan,
    ti_gia: x.tiGia,
    chi_phi_che_bien: x.chiPhiCB,
    created_at: x.createdAt,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    loaiNL: s(r.ten_loai_nguyen_lieu),
    ngayList: s(r.mo_ta_ngay),
    tuNgay: r.tu_ngay ? s(r.tu_ngay).slice(0, 10) : undefined,
    denNgay: r.den_ngay ? s(r.den_ngay).slice(0, 10) : undefined,
    tongNLNhan: n(r.tong_nl_nhan_kg),
    tiGia: n(r.ti_gia),
    chiPhiCB: n(r.chi_phi_che_bien),
    createdAt: s(r.created_at),
  }),
};

export const BANG_NL_VAO: AnhXaBang<DongNLVao> = {
  table: "nguyen_lieu_vao",
  localKey: "bsf.nlvao.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ky_id: x.kyId,
    nhom: x.nhom,
    ten: x.ten,
    so_luong_kg: x.soLuongKg,
    don_gia: x.donGia,
    ty_le_phan_tram: x.tyLe,
    // Chỉ gửi khi có giá trị — cột `nguon_kho` (migration 0008) có thể chưa tồn
    // tại trên DB; bỏ trống ⇒ ghi NL vào chạy bình thường không cần migration.
    ...(x.nguonKho ? { nguon_kho: x.nguonKho } : {}),
  }),
  fromRow: (r) => ({
    id: s(r.id),
    kyId: s(r.ky_id),
    nhom: s(r.nhom) as NhomNL,
    ten: s(r.ten),
    soLuongKg: Number(r.so_luong_kg ?? 0),
    donGia: n(r.don_gia),
    tyLe: n(r.ty_le_phan_tram),
    nguonKho: r.nguon_kho == null ? "" : s(r.nguon_kho),
  }),
};

export const BANG_PHE_LIEU: AnhXaBang<DongPheLieu> = {
  table: "phe_lieu",
  localKey: "bsf.phelieu.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    // Chưa gắn kỳ thì phải là NULL — chuỗi rỗng vi phạm khóa ngoại ky_can_doi.
    ky_id: x.kyId || null,
    loai: x.loai,
    so_luong_kg: x.soLuongKg,
    don_gia_ban: x.donGiaBan,
    ngay: x.ngay || null,
    phan_xuong: x.phanXuong,
    nguon: x.nguon,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    kyId: s(r.ky_id),
    loai: s(r.loai),
    soLuongKg: Number(r.so_luong_kg ?? 0),
    donGiaBan: n(r.don_gia_ban),
    ngay: s(r.ngay).slice(0, 10),
    phanXuong: s(r.phan_xuong) as PhanXuong | "",
    // Dòng cũ (trước 0004) không có cột nguồn → là dòng nhập tay trong kỳ.
    nguon: (s(r.nguon) || "Cân đối") as NguonPheLieu,
  }),
  vaDongCu: (x) =>
    x.nguon == null
      ? { ...x, ngay: x.ngay ?? "", phanXuong: x.phanXuong ?? "", nguon: "Cân đối" }
      : x,
};

export const BANG_TP_RA: AnhXaBang<DongTP> = {
  table: "thanh_pham_ra",
  localKey: "bsf.tp.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ky_id: x.kyId,
    mat_hang_id: x.matHangId,
    khach_hang_id: x.khachId,
    kenh: x.kenh,
    luong_kg: x.luongKg,
    don_gia: x.donGia,
    quy_cach: x.quyCach ?? "",
    ban_hang_id: x.banHangId ?? "",
  }),
  fromRow: (r) => ({
    id: s(r.id),
    kyId: s(r.ky_id),
    matHangId: s(r.mat_hang_id),
    khachId: s(r.khach_hang_id),
    kenh: s(r.kenh) as Kenh,
    luongKg: Number(r.luong_kg ?? 0),
    donGia: n(r.don_gia),
    quyCach: s(r.quy_cach),
    banHangId: s(r.ban_hang_id),
  }),
  // Dòng ghi trước 0005 không có quy cách / nguồn bán → coi là dòng nhập tay.
  vaDongCu: (x) => ({
    ...x,
    quyCach: x.quyCach ?? "",
    banHangId: x.banHangId ?? "",
  }),
};

/** Hồ sơ người dùng — khóa `id` = auth user id (uuid). */
export const BANG_NGUOI_DUNG: AnhXaBang<NguoiDung> = {
  table: "nguoi_dung",
  localKey: "bsf.nguoi-dung.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ho_ten: x.hoTen,
    username: x.username,
    vai_tro: vaiTroThanhChuoi(x.vaiTro), // mảng → CSV (cột text)
  }),
  fromRow: (r) => ({
    id: s(r.id),
    hoTen: s(r.ho_ten),
    username: s(r.username),
    vaiTro: vaiTroTuChuoi(s(r.vai_tro)), // CSV → mảng
  }),
};

/** Phiếu bán — một khách, một lượt, nhiều dòng mặt hàng. */
export const BANG_PHIEU_BAN: AnhXaBang<PhieuBan> = {
  table: "phieu_ban",
  localKey: "bsf.phieu-ban.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ngay_giao: x.ngayGiao,
    ngay_ghi_so: x.ngayGhiSo,
    ly_do_ghi_bu: x.lyDoGhiBu,
    phan_xuong: x.phanXuong,
    khach_hang_id: x.khachId,
    kenh: x.kenh,
    ghi_chu: x.ghiChu,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    ngayGiao: s(r.ngay_giao).slice(0, 10),
    ngayGhiSo: s(r.ngay_ghi_so).slice(0, 10),
    lyDoGhiBu: s(r.ly_do_ghi_bu),
    phanXuong: s(r.phan_xuong) as PhanXuong,
    khachId: s(r.khach_hang_id),
    kenh: s(r.kenh) as Kenh,
    ghiChu: s(r.ghi_chu),
  }),
};

/** Dòng bán trong phiếu. */
export const BANG_BAN_HANG: AnhXaBang<DongBan> = {
  table: "ban_hang",
  localKey: "bsf.ban-hang.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    phieu_id: x.phieuId,
    ngay: x.ngay || null,
    mat_hang_id: x.matHangId,
    quy_cach: x.quyCach,
    luong_kg: x.luongKg,
    don_gia: x.donGia,
    kho_nguon: x.khoNguon,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    phieuId: s(r.phieu_id),
    ngay: s(r.ngay).slice(0, 10),
    matHangId: s(r.mat_hang_id),
    quyCach: s(r.quy_cach),
    luongKg: Number(r.luong_kg ?? 0),
    donGia: n(r.don_gia),
    khoNguon: s(r.kho_nguon),
  }),
};

/* ---------- Module WIP ---------- */

/** Dòng BTP sản xuất ngày. */
export const BANG_SAN_XUAT: AnhXaBang<DongSanXuat> = {
  table: "san_xuat_btp",
  localKey: "bsf.san-xuat.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ngay: x.ngay,
    ngay_ghi_so: x.ngayGhiSo || null,
    ly_do_ghi_bu: x.lyDoGhiBu,
    phan_xuong: x.phanXuong,
    mat_hang_id: x.matHangId,
    quy_cach: x.quyCach,
    luong_kg: x.luongKg,
    so_block: x.soBlock,
    kho: x.kho,
    trang_thai: x.trangThai,
    ghi_chu: x.ghiChu,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    ngay: s(r.ngay).slice(0, 10),
    ngayGhiSo: s(r.ngay_ghi_so).slice(0, 10),
    lyDoGhiBu: s(r.ly_do_ghi_bu),
    phanXuong: s(r.phan_xuong) as PhanXuong,
    matHangId: s(r.mat_hang_id),
    quyCach: s(r.quy_cach),
    luongKg: Number(r.luong_kg ?? 0),
    soBlock: Number(r.so_block ?? 0),
    kho: s(r.kho),
    trangThai: (s(r.trang_thai) || "cho-nhap") as TrangThaiKho,
    ghiChu: s(r.ghi_chu),
  }),
};

/** Chốt ngày sản xuất (bảng riêng, cùng hình dạng ChotNgay). */
export const BANG_CHOT_SX: AnhXaBang<ChotNgay> = {
  table: "chot_san_xuat",
  localKey: "bsf.chot-san-xuat.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ngay: x.ngay,
    phan_xuong: x.phanXuong,
    da_chot: x.daChot,
    chot_luc: x.chotLuc,
    tong_kg_luc_chot: x.tongKgLucChot,
    ly_do_mo_lai: x.lyDoMoLai,
    ghi_chu: x.ghiChu,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    ngay: s(r.ngay).slice(0, 10),
    phanXuong: s(r.phan_xuong) as PhanXuong,
    daChot: Boolean(r.da_chot),
    chotLuc: s(r.chot_luc),
    tongKgLucChot: Number(r.tong_kg_luc_chot ?? 0),
    lyDoMoLai: s(r.ly_do_mo_lai),
    ghiChu: s(r.ghi_chu),
  }),
};

/** Đơn đặt. */
export const BANG_DON_DAT: AnhXaBang<DonDat> = {
  table: "don_dat",
  localKey: "bsf.don-dat.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    khach_id: x.khachId,
    ngay_dat: x.ngayDat,
    trang_thai: x.trangThai,
    ghi_chu: x.ghiChu,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    khachId: s(r.khach_id),
    ngayDat: s(r.ngay_dat).slice(0, 10),
    trangThai: (s(r.trang_thai) || "dang-gom") as TrangThaiDon,
    ghiChu: s(r.ghi_chu),
  }),
};

/** Dòng cần của đơn. */
export const BANG_DONG_DON: AnhXaBang<DongDon> = {
  table: "dong_don",
  localKey: "bsf.dong-don.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    don_id: x.donId,
    mat_hang_id: x.matHangId,
    quy_cach: x.quyCach,
    luong_kg_can: x.luongKgCan,
    so_block_can: x.soBlockCan,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    donId: s(r.don_id),
    matHangId: s(r.mat_hang_id),
    quyCach: s(r.quy_cach),
    luongKgCan: Number(r.luong_kg_can ?? 0),
    soBlockCan: Number(r.so_block_can ?? 0),
  }),
};

/** Lệnh xuất. */
export const BANG_LENH_XUAT: AnhXaBang<LenhXuat> = {
  table: "lenh_xuat",
  localKey: "bsf.lenh-xuat.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    don_id: x.donId,
    ngay: x.ngay,
    trang_thai: x.trangThai,
    ghi_chu: x.ghiChu,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    donId: s(r.don_id),
    ngay: s(r.ngay).slice(0, 10),
    trangThai: (s(r.trang_thai) || "mo") as "mo" | "dong",
    ghiChu: s(r.ghi_chu),
  }),
};

/** Dòng thực xuất (trừ tồn theo lô). */
export const BANG_DONG_LENH: AnhXaBang<DongLenh> = {
  table: "dong_lenh",
  localKey: "bsf.dong-lenh.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    lenh_id: x.lenhId,
    san_xuat_id: x.sanXuatId,
    mat_hang_id: x.matHangId,
    quy_cach: x.quyCach,
    luong_kg: x.luongKg,
    so_block: x.soBlock,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    lenhId: s(r.lenh_id),
    sanXuatId: s(r.san_xuat_id),
    matHangId: s(r.mat_hang_id),
    quyCach: s(r.quy_cach),
    luongKg: Number(r.luong_kg ?? 0),
    soBlock: Number(r.so_block ?? 0),
  }),
};

/* ---------- Hàng chờ đồng bộ (chống mất số liệu khi ghi hụt) ----------
   Ghi lên máy chủ có thể hụt giữa ca (wifi rớt, tablet ngủ, server nghẽn).
   Mỗi bảng giữ một "hàng chờ" khóa các dòng chưa đẩy được:
     - them: dòng thêm/sửa chưa lên server
     - xoa : dòng đã xóa dưới máy nhưng chưa xóa được trên server (tombstone)
   Mọi lần ghi HAY mở app đều thử đẩy lại hàng chờ. Lúc mở, HOÀ server với dòng
   local chưa đẩy thay vì đè mù — nên reload không nuốt chuyến hàng ghi hụt. */

interface ChoDongBo {
  them: string[];
  xoa: string[];
}

function layMsg(e: unknown): string {
  // Lỗi Supabase là object thường (có .message), không phải Error →
  // String(e) ra "[object Object]". Rút .message cho người dùng đọc được.
  return e instanceof Error
    ? e.message
    : e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message)
      : String(e);
}

function napCho(localKey: string): ChoDongBo {
  try {
    const raw = localStorage.getItem(`${localKey}.cho`);
    if (!raw) return { them: [], xoa: [] };
    const p = JSON.parse(raw) as Partial<ChoDongBo>;
    return {
      them: Array.isArray(p.them) ? p.them : [],
      xoa: Array.isArray(p.xoa) ? p.xoa : [],
    };
  } catch {
    return { them: [], xoa: [] };
  }
}

function luuCho(localKey: string, cho: ChoDongBo) {
  try {
    if (cho.them.length === 0 && cho.xoa.length === 0)
      localStorage.removeItem(`${localKey}.cho`);
    else localStorage.setItem(`${localKey}.cho`, JSON.stringify(cho));
  } catch {
    // Hết dung lượng: bỏ qua, lần ghi sau thử lại.
  }
}

/** Đẩy toàn bộ hàng chờ của một bảng lên máy chủ. Sạch chờ nếu thành công. */
async function dongBoCho<T>(
  bang: AnhXaBang<T>,
  khoa: string,
  rows: T[],
): Promise<{ ok: boolean; msg?: string }> {
  if (!supabase) return { ok: true };
  const cho = napCho(bang.localKey);
  if (cho.them.length === 0 && cho.xoa.length === 0) return { ok: true };

  const theoKhoa = new Map(rows.map((x) => [bang.layKhoa(x), x]));
  const capNhat = cho.them
    .map((k) => theoKhoa.get(k))
    .filter((x): x is T => x !== undefined)
    .map((x) => ({ ...bang.toRow(x), xi_nghiep_id: SITE_ID }));

  try {
    if (capNhat.length > 0) {
      const { error } = await supabase
        .from(bang.table)
        .upsert(capNhat, { onConflict: khoa });
      if (error) throw error;
    }
    if (cho.xoa.length > 0) {
      const { error } = await supabase
        .from(bang.table)
        .delete()
        .in(khoa, cho.xoa);
      if (error) throw error;
    }
    luuCho(bang.localKey, { them: [], xoa: [] });
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: layMsg(e) };
  }
}

/* ---------- Hook ---------- */

export type TrangThai = "dang-tai" | "san-sang" | "loi";

export function useBang<T>(bang: AnhXaBang<T>, seed: () => T[] = () => []) {
  const khoa = bang.khoaChinh ?? "id";
  const va = bang.vaDongCu;
  const napLocal = (key: string) => {
    const xs = load<T>(key);
    return va ? xs.map(va) : xs;
  };

  const [rows, setRows] = useState<T[]>(() => {
    const co = napLocal(bang.localKey);
    if (co.length > 0) return co;
    const s0 = seed();
    if (s0.length > 0 && !hasSupabase) save(bang.localKey, s0);
    return s0;
  });
  const [trangThai, setTrangThai] = useState<TrangThai>(
    hasSupabase ? "dang-tai" : "san-sang"
  );
  const [loi, setLoi] = useState<string | null>(null);
  const truoc = useRef<T[]>(rows);
  truoc.current = rows;

  /* Nạp từ máy chủ */
  useEffect(() => {
    if (!supabase) return;
    let huy = false;
    (async () => {
      const { data, error } = await supabase
        .from(bang.table)
        .select("*")
        .eq("xi_nghiep_id", SITE_ID);
      if (huy) return;
      if (error) {
        setTrangThai("loi");
        setLoi(error.message);
        ketNoi.baoLoi(error.message);
        return;
      }
      const may = (data ?? []).map((r) =>
        bang.fromRow(r as Record<string, unknown>)
      );

      // Bảng rỗng lần đầu + máy này cũng chưa có gì → đẩy seed lên danh mục.
      if (may.length === 0) {
        const cho0 = napCho(bang.localKey);
        const localCu = napLocal(bang.localKey);
        const chuaCoGi =
          localCu.length === 0 && cho0.them.length === 0 && cho0.xoa.length === 0;
        if (chuaCoGi) {
          const s0 = seed();
          if (s0.length > 0) {
            const { error: e2 } = await supabase
              .from(bang.table)
              .upsert(
                s0.map((x) => ({ ...bang.toRow(x), xi_nghiep_id: SITE_ID })),
                { onConflict: khoa }
              );
            if (huy) return;
            if (e2) {
              setTrangThai("loi");
              setLoi(e2.message);
              ketNoi.baoLoi(e2.message);
              return;
            }
            setRows(s0);
            save(bang.localKey, s0);
            setTrangThai("san-sang");
            ketNoi.baoOK();
            return;
          }
        }
      }

      /* HOÀ server với dòng local CHƯA đồng bộ — KHÔNG đè mù, nếu không reload
         sẽ nuốt chuyến hàng ghi hụt (dòng chỉ có dưới máy, chưa lên server). */
      const cho = napCho(bang.localKey);
      const local = napLocal(bang.localKey);
      const localTheoKhoa = new Map(local.map((x) => [bang.layKhoa(x), x]));
      const hoa = new Map(may.map((x) => [bang.layKhoa(x), x])); // nền = server
      for (const k of cho.them) {
        const r = localTheoKhoa.get(k); // bản local chưa đẩy → thắng server
        if (r !== undefined) hoa.set(k, r);
      }
      for (const k of cho.xoa) hoa.delete(k); // đã xóa dưới máy → đừng hồi sinh
      const ketQua = [...hoa.values()];
      setRows(ketQua);
      save(bang.localKey, ketQua);

      // Thử đẩy hàng chờ lên server ngay khi vừa nối được.
      const kq = await dongBoCho(bang, khoa, ketQua);
      if (huy) return;
      if (kq.ok) {
        setLoi(null);
        setTrangThai("san-sang");
        ketNoi.baoOK();
      } else {
        setTrangThai("loi");
        setLoi(kq.msg ?? "Lỗi đồng bộ máy chủ");
        ketNoi.baoLoi(kq.msg ?? "Lỗi đồng bộ máy chủ");
      }
    })();
    return () => {
      huy = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bang.table]);

  const ghi = useCallback(
    (next: T[]) => {
      const cu = truoc.current;
      setRows(next);
      save(bang.localKey, next); // luôn có bản sao dưới máy

      if (!supabase) return;

      const cuTheoKhoa = new Map(cu.map((x) => [bang.layKhoa(x), x]));
      const khoaMoi = new Set(next.map((x) => bang.layKhoa(x)));

      const themKeys = next
        .filter((x) => {
          const c = cuTheoKhoa.get(bang.layKhoa(x));
          return !c || JSON.stringify(c) !== JSON.stringify(x);
        })
        .map((x) => bang.layKhoa(x));
      const xoaKeys = cu
        .filter((x) => !khoaMoi.has(bang.layKhoa(x)))
        .map((x) => bang.layKhoa(x));

      /* Ghi vào hàng chờ TRƯỚC khi gọi server: hụt thì vẫn còn dấu để đẩy lại
         lần sau. Gộp với hàng chờ cũ nên các dòng hụt trước cũng được đẩy kèm. */
      const cho = napCho(bang.localKey);
      const them = new Set([...cho.them, ...themKeys]);
      const xoa = new Set([...cho.xoa, ...xoaKeys]);
      xoaKeys.forEach((k) => them.delete(k)); // vừa xóa thì thôi thêm
      themKeys.forEach((k) => xoa.delete(k)); // thêm/sửa lại thì thôi xóa
      luuCho(bang.localKey, { them: [...them], xoa: [...xoa] });

      (async () => {
        const kq = await dongBoCho(bang, khoa, next);
        if (kq.ok) {
          setLoi(null);
          setTrangThai("san-sang");
          ketNoi.baoOK();
        } else {
          const msg = kq.msg ?? "Lỗi ghi máy chủ";
          setTrangThai("loi");
          setLoi(msg);
          ketNoi.baoLoi(msg);
        }
      })();
    },
    [bang, khoa]
  );

  return [rows, ghi, { trangThai, loi }] as const;
}
