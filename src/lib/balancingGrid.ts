// ============================================================
// Tên file: src/lib/balancingGrid.ts
// Tên tiếng Việt: Logic lưới cân đối theo ngày
// Description: Pure helpers for the day-grid balancing screen
// ============================================================
import type {
  BalancingPeriod,
  BalancingInputItem,
  BalancingOutputItem,
  MaterialImportItem,
  WipProductionItem,
  DailyQuantities,
} from "@/types";
import { sumGridRow } from "@/types";

/* ---------- Ngày trong kỳ ---------- */

/**
 * Danh sách ngày (ISO) của kỳ, dùng làm CỘT của lưới.
 * Kỳ chưa khai ngày ⇒ lưới không có cột ngày, chỉ còn cột Tổng — vẫn nhập được.
 * Chặn ở 62 ngày: quá mốc đó lưới không còn đọc được trên tablet, và một "kỳ"
 * dài vậy là dấu hiệu chọn nhầm khoảng ngày.
 */
export const SO_NGAY_TOI_DA = 62;

export function ngayTrongKy(ky: Pick<BalancingPeriod, "startDate" | "endDate">): string[] {
  const tu = ky.startDate;
  const den = ky.endDate || ky.startDate;
  if (!tu || !den || den < tu) return [];
  const ra: string[] = [];
  /* Dựng ngày ở giờ UTC và đọc lại bằng UTC. Dùng `new Date("...T00:00:00")`
     rồi `toISOString()` là bẫy kinh điển: giờ Việt Nam +07 ⇒ nửa đêm địa phương
     thành 17:00 UTC HÔM TRƯỚC, kỳ 21–25/7 biến thành 20–24/7 và ngày cuối rơi
     ra ngoài kỳ (dòng nhập hàng ngày 25 không hút được). */
  const d = new Date(`${tu}T00:00:00Z`);
  const cuoi = new Date(`${den}T00:00:00Z`);
  while (d.getTime() <= cuoi.getTime() && ra.length < SO_NGAY_TOI_DA) {
    ra.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return ra;
}

/** Nhãn cột ngày: "22/7" — ngắn để lưới 5–8 cột vẫn vừa màn tablet. */
export function nhanNgay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/* ---------- Họ nguyên liệu (gom 2 size về một kỳ) ---------- */

/**
 * Bỏ hậu tố size để biết hai tên có cùng một họ nguyên liệu không.
 * "Bạch tuộc 2 da lớn (80↑)" và "Bạch tuộc 2 da nhỏ (80↓)" cùng họ
 * "Bạch tuộc 2 da" ⇒ một kỳ cân đối gom được cả hai, đúng bảng giấy.
 */
export function hoNguyenLieu(ten: string): string {
  return ten
    .replace(/\s*(lớn|nhỏ)\s*\(\s*80\s*[↑↓]\s*\)\s*$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cungHoNguyenLieu(a: string, b: string): boolean {
  const x = hoNguyenLieu(a).toLowerCase();
  const y = hoNguyenLieu(b).toLowerCase();
  return Boolean(x) && x === y;
}

/* ---------- Hút số liệu vào kỳ ---------- */

/**
 * Dòng sổ nhập hàng đủ điều kiện vào kỳ: cùng họ nguyên liệu, ngày hàng về nằm
 * trong kỳ, và chưa bị kỳ nào khác giữ. Kỳ chưa khai ngày ⇒ không hút gì (tránh
 * kéo nhầm cả sổ vào một kỳ trống).
 */
export function nhapHangHopLe(
  ky: BalancingPeriod,
  imports: MaterialImportItem[]
): MaterialImportItem[] {
  const ngay = new Set(ngayTrongKy(ky));
  if (ngay.size === 0) return [];
  return imports.filter(
    (r) =>
      ngay.has(r.deliveryDate) &&
      cungHoNguyenLieu(r.materialTypeName, ky.materialTypeName) &&
      (!r.balancingPeriodId || r.balancingPeriodId === ky.id)
  );
}

/**
 * Dòng sổ sản xuất đủ điều kiện vào kỳ: ngày sản xuất trong kỳ, chưa gắn kỳ khác.
 * KHÔNG lọc theo loại nguyên liệu — một lô nguyên liệu ra nhiều mặt hàng, và
 * mặt hàng không mang thông tin nguyên liệu nguồn.
 */
export function sanXuatHopLe(
  ky: BalancingPeriod,
  wips: WipProductionItem[]
): WipProductionItem[] {
  const ngay = new Set(ngayTrongKy(ky));
  if (ngay.size === 0) return [];
  return wips.filter(
    (r) =>
      ngay.has(r.productionDate) &&
      (!r.balancingPeriodId || r.balancingPeriodId === ky.id)
  );
}

/* ---------- Dựng dòng lưới ---------- */

export interface HangLuoiNL {
  /** id của dòng balancing_inputs */
  id: string;
  ten: string;
  nhom: BalancingInputItem["groupName"];
  theoNgay: DailyQuantities;
  chuyenKy: number;
  tong: number;
  donGia: number | null;
  tyLe: number | null;
  laGiam: boolean;
  khoGiam: string;
  /** Dòng dựng từ sổ nhập hàng ⇒ ô ngày khoá, sửa ở sổ gốc. */
  tuSoNhap: boolean;
  nguonIds: string[];
}

/**
 * Gom sản lượng theo ngày của các dòng sổ nhập đã gắn kỳ, khoá theo TÊN loại
 * nguyên liệu (sổ nhập lưu theo tên, không phải khoá ngoại — xem 30-nhap-hang).
 */
export function gomNhapTheoLoai(
  rows: MaterialImportItem[]
): Map<string, { theoNgay: DailyQuantities; ids: string[]; donGia: number | null }> {
  const ra = new Map<string, { theoNgay: DailyQuantities; ids: string[]; donGia: number | null }>();
  for (const r of rows) {
    const k = r.materialTypeName || "(chưa ghi loại)";
    const o = ra.get(k) ?? { theoNgay: {}, ids: [], donGia: null };
    o.theoNgay[r.deliveryDate] = (o.theoNgay[r.deliveryDate] ?? 0) + r.quantityKg;
    o.ids.push(r.id);
    /* Đơn giá gợi ý = giá của dòng gần nhất có giá; kế toán vẫn sửa tay được. */
    if (r.unitPrice != null) o.donGia = r.unitPrice;
    ra.set(k, o);
  }
  return ra;
}

export interface HangLuoiTP {
  /** id của dòng balancing_outputs */
  id: string;
  matHangId: string;
  khachId: string;
  quyCach: string;
  kenh: BalancingOutputItem["channel"];
  donGia: number | null;
  theoNgay: DailyQuantities;
  chuyenKy: number;
  tong: number;
  tuSoSanXuat: boolean;
  nguonIds: string[];
}

/** Khoá gom dòng bán thành phẩm: một mặt hàng × một quy cách = một dòng lưới. */
export function khoaMatHang(productId: string, spec: string): string {
  return `${productId}|${spec || ""}`;
}

export function gomSanXuatTheoMatHang(
  rows: WipProductionItem[]
): Map<string, { theoNgay: DailyQuantities; ids: string[] }> {
  const ra = new Map<string, { theoNgay: DailyQuantities; ids: string[] }>();
  for (const r of rows) {
    const k = khoaMatHang(r.productId, r.spec);
    const o = ra.get(k) ?? { theoNgay: {}, ids: [] };
    o.theoNgay[r.productionDate] = (o.theoNgay[r.productionDate] ?? 0) + r.quantityKg;
    o.ids.push(r.id);
    ra.set(k, o);
  }
  return ra;
}

/**
 * Dòng lưới nguyên liệu = dòng `balancing_inputs` của kỳ. Dòng có
 * `autoSource = "imports"` lấy sản lượng ngày THẲNG từ sổ nhập (không chép
 * sang bảng cân đối) nên hai nơi không bao giờ lệch nhau.
 */
export function dungHangNL(
  inputs: BalancingInputItem[],
  nhapDaGan: MaterialImportItem[]
): HangLuoiNL[] {
  const theoLoai = gomNhapTheoLoai(nhapDaGan);
  return inputs.map((r) => {
    const tuSoNhap = r.autoSource === "imports";
    const nguon = tuSoNhap ? theoLoai.get(r.name) : undefined;
    const theoNgay = nguon ? nguon.theoNgay : (r.dailyQuantities ?? {});
    const chuyenKy = r.carryOverKg ?? 0;
    return {
      id: r.id,
      ten: r.name,
      nhom: r.groupName,
      theoNgay,
      chuyenKy,
      tong: sumGridRow(theoNgay, chuyenKy),
      donGia: r.unitPrice,
      tyLe: r.ratioPercentage,
      laGiam: Boolean(r.isReduction),
      khoGiam: r.reductionWarehouseId ?? "",
      tuSoNhap,
      nguonIds: nguon?.ids ?? [],
    };
  });
}

export function dungHangTP(
  outputs: BalancingOutputItem[],
  sanXuatDaGan: WipProductionItem[]
): HangLuoiTP[] {
  const theoMatHang = gomSanXuatTheoMatHang(sanXuatDaGan);
  return outputs.map((r) => {
    const tuSoSanXuat = r.autoSource === "production";
    const nguon = tuSoSanXuat ? theoMatHang.get(khoaMatHang(r.productId, r.spec ?? "")) : undefined;
    const theoNgay = nguon ? nguon.theoNgay : (r.dailyQuantities ?? {});
    const chuyenKy = r.carryOverKg ?? 0;
    return {
      id: r.id,
      matHangId: r.productId,
      khachId: r.customerId,
      quyCach: r.spec ?? "",
      kenh: r.channel,
      donGia: r.unitPrice,
      theoNgay,
      chuyenKy,
      tong: sumGridRow(theoNgay, chuyenKy),
      tuSoSanXuat,
      nguonIds: nguon?.ids ?? [],
    };
  });
}

/* ---------- Ghi ngược ô ngày về sổ nguồn ---------- */

export type KetQuaGhiNguoc =
  | { loai: "sua"; id: string; kg: number }
  | { loai: "them"; kg: number }
  | { loai: "tuChoi"; lyDo: string };

/**
 * Sửa một ô ngày của dòng bán thành phẩm ⇒ ghi ngược về sổ Sản xuất.
 *
 * - Không có dòng nguồn nào trong ngày ⇒ tạo dòng mới (nhập nhanh trong lưới).
 * - Đúng một dòng ⇒ sửa dòng đó.
 * - Nhiều dòng (nhiều ca, nhiều kho) ⇒ chỉnh dòng CUỐI để tổng ngày khớp số
 *   vừa gõ, giữ nguyên các dòng trước. Nếu phải làm dòng cuối âm thì từ chối —
 *   thà bắt người dùng vào sổ Sản xuất sửa đúng dòng còn hơn bịa số.
 */
export function ghiNguocSanLuongNgay(
  nguonTrongNgay: WipProductionItem[],
  kgMoi: number
): KetQuaGhiNguoc {
  if (nguonTrongNgay.length === 0) return { loai: "them", kg: kgMoi };
  if (nguonTrongNgay.length === 1) {
    return { loai: "sua", id: nguonTrongNgay[0].id, kg: kgMoi };
  }
  const cuoi = nguonTrongNgay[nguonTrongNgay.length - 1];
  const tongKhac = nguonTrongNgay.slice(0, -1).reduce((s, r) => s + r.quantityKg, 0);
  const conLai = kgMoi - tongKhac;
  if (conLai < 0) {
    return {
      loai: "tuChoi",
      lyDo: `Ngày này có ${nguonTrongNgay.length} dòng sản xuất, các dòng khác đã ${tongKhac} kg. Sửa trực tiếp ở màn Sản xuất bán thành phẩm.`,
    };
  }
  return { loai: "sua", id: cuoi.id, kg: conLai };
}

/**
 * Mọi dòng sổ nhập rơi trong khoảng ngày của kỳ và CHƯA kỳ nào giữ — bất kể
 * loại nguyên liệu.
 *
 * Vì sao cần: `nhapHangHopLe` lọc theo họ nguyên liệu, mà sổ nhập ghi loại NL
 * theo TÊN tự do (xem 30-nhap-hang). Xưởng gõ "2 da nguyên liệu" trong khi kỳ
 * tên "Bạch tuộc 2 da" ⇒ khớp tên thất bại và màn hình báo "không có gì để
 * lấy" dù sổ đầy số. Danh sách này là đường lui: cho người dùng tự tick dòng.
 */
export function nhapTrongKhoangNgay(
  ky: BalancingPeriod,
  imports: MaterialImportItem[]
): MaterialImportItem[] {
  const ngay = new Set(ngayTrongKy(ky));
  if (ngay.size === 0) return [];
  return imports.filter((r) => ngay.has(r.deliveryDate) && !r.balancingPeriodId);
}

/**
 * MỌI chuyến nhập rơi trong khoảng ngày của kỳ, kể cả dòng đang thuộc kỳ khác.
 *
 * Dùng để màn hình GIẢI THÍCH được vì sao trống. Ba lý do làm kỳ không thấy số
 * mà nhìn màn không đoán ra: tên loại NL lệch · dòng đã bị kỳ khác giữ · kỳ
 * khai nhầm ngày (sổ lọc theo ngày HÀNG VỀ, không phải ngày ghi sổ). Không đếm
 * được ba con số này thì màn chỉ biết nói "chưa có nguyên liệu".
 */
export function chuyenNhapTheoNgay(
  ky: BalancingPeriod,
  imports: MaterialImportItem[]
): MaterialImportItem[] {
  const ngay = new Set(ngayTrongKy(ky));
  if (ngay.size === 0) return [];
  return imports.filter((r) => ngay.has(r.deliveryDate));
}

/**
 * Sửa một ô ngày của dòng nguyên liệu ⇒ ghi ngược về sổ Nhập hàng.
 * Cùng luật với `ghiNguocSanLuongNgay`: một dòng thì sửa thẳng, nhiều dòng thì
 * chỉnh dòng CUỐI cho tổng ngày khớp, phải làm âm thì từ chối.
 */
export function ghiNguocNhapNgay(
  nguonTrongNgay: MaterialImportItem[],
  kgMoi: number
): KetQuaGhiNguoc {
  if (nguonTrongNgay.length === 0) return { loai: "them", kg: kgMoi };
  if (nguonTrongNgay.length === 1) {
    return { loai: "sua", id: nguonTrongNgay[0].id, kg: kgMoi };
  }
  const cuoi = nguonTrongNgay[nguonTrongNgay.length - 1];
  const tongKhac = nguonTrongNgay.slice(0, -1).reduce((s, r) => s + r.quantityKg, 0);
  const conLai = kgMoi - tongKhac;
  if (conLai < 0) {
    return {
      loai: "tuChoi",
      lyDo: `Ngày này có ${nguonTrongNgay.length} chuyến nhập, các chuyến khác đã ${tongKhac} kg. Sửa trực tiếp ở màn Nhập hàng.`,
    };
  }
  return { loai: "sua", id: cuoi.id, kg: conLai };
}

/* ---------- Chuyển kỳ: nối kỳ trước sang kỳ sau ---------- */

/**
 * Kỳ liền trước của cùng một họ nguyên liệu: kết thúc TRƯỚC ngày bắt đầu kỳ này,
 * gần nhất. Dùng để lấy phần "chuyển kỳ âm" (hàng làm ra nhưng đẩy sang kỳ sau)
 * mà kỳ trước đã khai.
 */
export function kyLienTruoc(
  ky: BalancingPeriod,
  tatCaKy: BalancingPeriod[]
): BalancingPeriod | null {
  const batDau = ky.startDate;
  if (!batDau) return null;
  const truoc = tatCaKy
    .filter(
      (k) =>
        k.id !== ky.id &&
        cungHoNguyenLieu(k.materialTypeName, ky.materialTypeName) &&
        (k.endDate || k.startDate || "") < batDau
    )
    .sort((a, b) => (b.endDate || b.startDate || "").localeCompare(a.endDate || a.startDate || ""));
  return truoc[0] ?? null;
}

export interface DongChuyenKy {
  /** id dòng ở kỳ TRƯỚC — đánh dấu đã nhận để không lấy hai lần. */
  nguonId: string;
  ten: string;
  kg: number;
}

/**
 * Phần chuyển kỳ ÂM của kỳ trước mà chưa kỳ nào nhận.
 *
 * Quy ước dấu (xem 31-can-doi-ky.md): âm = đẩy sang kỳ sau. Kỳ này nhận thì
 * dựng dòng có chuyển kỳ DƯƠNG bằng đúng trị tuyệt đối — vòng gối đầu khép lại
 * mà không ai phải mở file kỳ cũ ra chép tay.
 */
export function chuyenKyChoNhan<
  T extends { id: string; carryOverKg?: number; carryOverPeriodId?: string },
>(dongKyTruoc: T[], ten: (r: T) => string): DongChuyenKy[] {
  return dongKyTruoc
    .filter((r) => (r.carryOverKg ?? 0) < 0 && !r.carryOverPeriodId)
    .map((r) => ({ nguonId: r.id, ten: ten(r), kg: Math.abs(r.carryOverKg ?? 0) }));
}
