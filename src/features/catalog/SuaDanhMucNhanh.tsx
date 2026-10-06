// ============================================================
// Tên file: src/features/catalog/SuaDanhMucNhanh.tsx
// Tên tiếng Việt: Sửa nhanh một bản ghi danh mục ngay tại màn nghiệp vụ
// ============================================================
// Mở từ bút chì trong ô chọn (`Combobox.onSuaMuc`) hoặc nút cạnh ô. Dùng ĐÚNG
// bộ trường + luật kiểm tra của màn Danh mục (cauHinhDanhMuc.tsx) — một nguồn.
//
// ⚠️ Ghi qua `rows` / `onChange` CỦA MÀN GỌI (đúng instance `useBang` đang mở):
// mỗi `useBang` giữ state riêng, tự gọi useCustomers() ở đây thì màn không thấy
// thay đổi và lần ghi kế tiếp của màn sẽ đè bản cũ lên.
//
// Danh mục nối với sổ đã ghi bằng TÊN (đại lý, loại NL, khách hàng, kho lưu, bột
// tẩm): ô tên CHỈ ĐỌC ở đây — đổi tên sẽ tách các dòng đã ghi khỏi danh mục.
import { useMemo, useState, type ReactNode } from "react";
import type {
  BatterType,
  Customer,
  MaterialType,
  Product,
  StorageLocation,
  Supplier,
} from "@/types";
import { useBatterTypes, useFinishedGoods, useMaterialTypes } from "@/lib/catalogRepo";
import { HopSuaDanhMuc, notify, type LoiNhap } from "@/design-system";
import {
  taoCauHinhDanhMuc,
  taoTruongDanhMuc,
  type CauHinhDanhMuc,
  type LoaiDanhMuc,
  type NguonDanhMuc,
} from "./cauHinhDanhMuc";

export interface BanGhiDanhMuc {
  matHang: Product;
  khachHang: Customer;
  daiLy: Supplier;
  loaiNL: MaterialType;
  khoLuu: StorageLocation;
  botTam: BatterType;
}

/**
 * Danh mục bột tẩm CỦA MÀN GỌI — để ô "Bột đi kèm" trong hộp sửa mặt hàng thấy
 * ngay loại bột vừa tạo tại màn, và tạo mới qua đúng instance `useBang` của màn.
 */
export interface NguonBotTam {
  rows: BatterType[];
  them: (ten: string) => string; // trả về id loại bột (mới hoặc có sẵn)
}

/** Nguồn rỗng cho các danh mục không sửa trong hộp này (chỉ để ráp cấu hình). */
const rong = <T,>(): NguonDanhMuc<T> => ({ rows: [], onChange: () => {}, dangTai: false });

function HopSuaNhanh<K extends LoaiDanhMuc>({
  loai,
  id,
  rows,
  onChange,
  onClose,
  onDaLuu,
  moTa,
  nguonBot,
}: {
  loai: K;
  id: string;
  rows: BanGhiDanhMuc[K][];
  onChange: (next: BanGhiDanhMuc[K][]) => void;
  onClose: () => void;
  onDaLuu?: (moi: BanGhiDanhMuc[K], cu: BanGhiDanhMuc[K]) => void;
  moTa?: (r: BanGhiDanhMuc[K]) => ReactNode;
  nguonBot?: NguonBotTam;
}) {
  type T = BanGhiDanhMuc[K];
  // Chỉ ĐỌC để dựng ô chọn trong form mặt hàng — không ghi qua các instance này.
  const [loaiNL] = useMaterialTypes();
  const [thanhPham] = useFinishedGoods();
  const [botTamDoc] = useBatterTypes();
  const botTam = nguonBot?.rows ?? botTamDoc;
  const themBot = nguonBot?.them;
  const cfg = useMemo(() => {
    const truong = taoTruongDanhMuc(loaiNL, thanhPham, botTam, themBot);
    const bo = taoCauHinhDanhMuc(truong, {
      matHang: rong(),
      khachHang: rong(),
      daiLy: rong(),
      loaiNL: rong(),
      khoLuu: rong(),
      botTam: rong(),
    });
    return bo[loai] as unknown as CauHinhDanhMuc<T>;
  }, [loai, loaiNL, thanhPham, botTam, themBot]);

  const goc = rows.find((r) => r.id === id);
  const [dang, setDang] = useState<T | null>(goc ? { ...goc } : null);
  const [loi, setLoi] = useState<LoiNhap[]>([]);
  if (!goc) return null;

  const luu = () => {
    if (!dang) return;
    const ls: LoiNhap[] = [
      ...cfg.fields
        .filter((f) => f.batBuoc && !String(dang[f.key] ?? "").trim())
        .map((f) => ({ truong: f.nhan, thongBao: `Chưa nhập ${f.nhan.toLowerCase()}` })),
      ...(cfg.kiemTraThem?.(dang, rows, false) ?? []),
    ];
    setLoi(ls);
    if (ls.length) return;
    onChange(rows.map((r) => (r.id === dang.id ? dang : r)));
    notify.daLuu(`Đã lưu ${cfg.tenDonVi} "${cfg.moTaBanGhi(dang)}"`);
    onDaLuu?.(dang, goc);
    onClose();
  };

  return (
    <HopSuaDanhMuc<T>
      dang={dang}
      laThem={false}
      fields={cfg.fields}
      tenDonVi={cfg.tenDonVi}
      loi={loi}
      onDoi={setDang}
      onLuu={luu}
      onClose={onClose}
      moTa={
        moTa?.(goc) ??
        `Sửa ở đây là sửa trong Danh mục — áp cho mọi màn dùng ${cfg.tenDonVi} này.`
      }
      khoaTruong={
        cfg.noiTheoTen
          ? {
              key: cfg.truongTen,
              lyDo: "Tên là chỗ nối với sổ đã ghi nên không đổi tại chỗ được (đổi tên sẽ tách các dòng cũ khỏi danh mục). Các thông tin khác sửa bình thường.",
            }
          : undefined
      }
    />
  );
}

/**
 * Bật sửa nhanh một danh mục ở màn nghiệp vụ:
 *
 *   const sua = useSuaDanhMuc("khachHang", khach, setKhach, { theo: "ten" });
 *   <Combobox … onSuaMuc={sua.moSua} nhanSua={sua.nhanSua} />
 *   {sua.hop}
 *
 * `theo`: value trong ô chọn là `id` (mặc định) hay TÊN bản ghi.
 */
export function useSuaDanhMuc<K extends LoaiDanhMuc>(
  loai: K,
  rows: BanGhiDanhMuc[K][],
  onChange: (next: BanGhiDanhMuc[K][]) => void,
  opts: {
    theo?: "id" | "ten";
    onDaLuu?: (moi: BanGhiDanhMuc[K], cu: BanGhiDanhMuc[K]) => void;
    moTa?: (r: BanGhiDanhMuc[K]) => ReactNode;
    /** Hộp sửa MẶT HÀNG: danh mục bột của màn (thấy + tạo loại bột tại chỗ). */
    nguonBot?: NguonBotTam;
  } = {}
) {
  const [id, setId] = useState<string | null>(null);
  const TEN: Record<LoaiDanhMuc, string> = {
    matHang: "mặt hàng",
    khachHang: "khách hàng",
    daiLy: "đại lý",
    loaiNL: "loại nguyên liệu",
    khoLuu: "kho lưu trữ",
    botTam: "loại bột",
  };

  const moSua = (value: string) => {
    if (!value) return;
    const r =
      opts.theo === "ten"
        ? rows.find((x) => tenCua(loai, x).trim() === value.trim())
        : rows.find((x) => x.id === value);
    if (r) setId(r.id);
    else notify.canhBao(`Không tìm thấy ${TEN[loai]} này trong danh mục.`);
  };

  const hop = id ? (
    <HopSuaNhanh
      key={id}
      loai={loai}
      id={id}
      rows={rows}
      onChange={onChange}
      onClose={() => setId(null)}
      onDaLuu={opts.onDaLuu}
      moTa={opts.moTa}
      nguonBot={opts.nguonBot}
    />
  ) : null;

  /** Value này có bản ghi trong danh mục không — truyền vào `Combobox.suaDuoc`. */
  const suaDuoc = (value: string) =>
    opts.theo === "ten"
      ? rows.some((x) => tenCua(loai, x).trim() === value.trim())
      : rows.some((x) => x.id === value);

  return {
    moSua,
    suaDuoc,
    hop,
    nhanSua: `Sửa thông tin ${TEN[loai]} này — lưu thẳng vào Danh mục.`,
  };
}

function tenCua(loai: LoaiDanhMuc, r: BanGhiDanhMuc[LoaiDanhMuc]): string {
  return loai === "daiLy" ? (r as Supplier).shortName : (r as { name: string }).name;
}
