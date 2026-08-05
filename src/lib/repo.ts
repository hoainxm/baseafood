import { useCallback, useEffect, useRef, useState } from "react";
import { supabase, hasSupabase, SITE_ID } from "@/lib/supabase";
import { load, save } from "@/lib/db";
import type {
  DaiLy,
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
  NhomNL,
  PhanXuong,
  ThanhPham,
} from "@/types";

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
  }),
  fromRow: (r) => ({
    id: s(r.id),
    ma: s(r.ma),
    ten: s(r.ten),
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
  toRow: (x) => ({ id: x.id, ma: x.ma, ten: x.ten, ma_thanh_pham: x.maTP }),
  fromRow: (r) => ({
    id: s(r.id),
    ma: s(r.ma),
    ten: s(r.ten),
    maTP: s(r.ma_thanh_pham),
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

export const BANG_NHAP_NL: AnhXaBang<DongNhapNL> = {
  table: "nhap_nguyen_lieu",
  localKey: "bsf.nhap-nl.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
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
  }),
  fromRow: (r) => ({
    id: s(r.id),
    kyId: s(r.ky_id),
    nhom: s(r.nhom) as NhomNL,
    ten: s(r.ten),
    soLuongKg: Number(r.so_luong_kg ?? 0),
    donGia: n(r.don_gia),
    tyLe: n(r.ty_le_phan_tram),
  }),
};

export const BANG_PHE_LIEU: AnhXaBang<DongPheLieu> = {
  table: "phe_lieu",
  localKey: "bsf.phelieu.v1",
  layKhoa: theoId,
  toRow: (x) => ({
    id: x.id,
    ky_id: x.kyId,
    loai: x.loai,
    so_luong_kg: x.soLuongKg,
    don_gia_ban: x.donGiaBan,
  }),
  fromRow: (r) => ({
    id: s(r.id),
    kyId: s(r.ky_id),
    loai: s(r.loai),
    soLuongKg: Number(r.so_luong_kg ?? 0),
    donGiaBan: n(r.don_gia_ban),
  }),
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
  }),
  fromRow: (r) => ({
    id: s(r.id),
    kyId: s(r.ky_id),
    matHangId: s(r.mat_hang_id),
    khachId: s(r.khach_hang_id),
    kenh: s(r.kenh) as Kenh,
    luongKg: Number(r.luong_kg ?? 0),
    donGia: n(r.don_gia),
  }),
};

/* ---------- Hook ---------- */

export type TrangThai = "dang-tai" | "san-sang" | "loi";

export function useBang<T>(bang: AnhXaBang<T>, seed: () => T[] = () => []) {
  const khoa = bang.khoaChinh ?? "id";

  const [rows, setRows] = useState<T[]>(() => {
    const co = load<T>(bang.localKey);
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
        return;
      }
      const map = (data ?? []).map((r) =>
        bang.fromRow(r as Record<string, unknown>)
      );
      // Bảng rỗng lần đầu → đẩy seed lên để mọi máy có cùng danh mục.
      if (map.length === 0) {
        const s0 = seed();
        if (s0.length > 0) {
          const { error: e2 } = await supabase
            .from(bang.table)
            .upsert(
              s0.map((x) => ({ ...bang.toRow(x), xi_nghiep_id: SITE_ID })),
              { onConflict: khoa }
            );
          if (!e2) {
            setRows(s0);
            save(bang.localKey, s0);
            setTrangThai("san-sang");
            return;
          }
        }
      }
      setRows(map);
      save(bang.localKey, map);
      setTrangThai("san-sang");
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

      const themHoacSua = next.filter((x) => {
        const c = cuTheoKhoa.get(bang.layKhoa(x));
        return !c || JSON.stringify(c) !== JSON.stringify(x);
      });
      const xoa = cu
        .filter((x) => !khoaMoi.has(bang.layKhoa(x)))
        .map((x) => bang.layKhoa(x));

      (async () => {
        try {
          if (themHoacSua.length > 0) {
            const { error } = await supabase
              .from(bang.table)
              .upsert(
                themHoacSua.map((x) => ({
                  ...bang.toRow(x),
                  xi_nghiep_id: SITE_ID,
                })),
                { onConflict: khoa }
              );
            if (error) throw error;
          }
          if (xoa.length > 0) {
            const { error } = await supabase
              .from(bang.table)
              .delete()
              .in(khoa, xoa);
            if (error) throw error;
          }
          setLoi(null);
          setTrangThai("san-sang");
        } catch (e) {
          setTrangThai("loi");
          setLoi(e instanceof Error ? e.message : String(e));
        }
      })();
    },
    [bang, khoa]
  );

  return [rows, ghi, { trangThai, loi }] as const;
}
