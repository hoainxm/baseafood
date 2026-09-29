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

/**
 * Các kỳ KHÁC cùng họ nguyên liệu có khoảng ngày CHỒNG lên kỳ này. Tạo trùng kỳ là
 * đường chính dẫn tới hút nhầm: kỳ trước đã giữ hết chuyến đúng loại, kỳ trùng chỉ
 * còn thấy chuyến khác loại (VD 1 da khi kỳ là 2 da) trong hộp "Chọn dòng nhập".
 */
export function kyTrungNgayCungHo(
  ky: Pick<BalancingPeriod, "id" | "materialTypeName" | "startDate" | "endDate">,
  tatCa: Pick<BalancingPeriod, "id" | "materialTypeName" | "startDate" | "endDate">[]
): typeof tatCa {
  const tu = ky.startDate;
  const den = ky.endDate || ky.startDate;
  if (!tu || !den) return [];
  return tatCa.filter((k) => {
    if (k.id === ky.id || !cungHoNguyenLieu(k.materialTypeName, ky.materialTypeName)) return false;
    const kTu = k.startDate;
    const kDen = k.endDate || k.startDate;
    if (!kTu || !kDen) return false;
    return kTu <= den && tu <= kDen;
  });
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
  /* GỘP theo HỌ nguyên liệu: "Bạch tuộc 2 da lớn (80↑)" + "… nhỏ (80↓)" gom về
     MỘT dòng "Bạch tuộc 2 da" — chốt với chủ dự án: cân đối KHÔNG tách size, gộp
     chung. Sổ Nhập hàng vẫn ghi tên có size (truy nguyên); chỉ khi ĐƯA VÀO cân
     đối mới gộp. Tên không có mốc 80↑/↓ giữ nguyên (hoNguyenLieu không cắt). */
  const ra = new Map<
    string,
    { theoNgay: DailyQuantities; ids: string[]; donGia: number | null; tenNguon: Set<string> }
  >();
  for (const r of rows) {
    const k = hoNguyenLieu(r.materialTypeName || "") || "(chưa ghi loại)";
    const o = ra.get(k) ?? { theoNgay: {}, ids: [], donGia: null, tenNguon: new Set<string>() };
    o.theoNgay[r.deliveryDate] = (o.theoNgay[r.deliveryDate] ?? 0) + r.quantityKg;
    o.ids.push(r.id);
    o.tenNguon.add(r.materialTypeName || "");
    if (r.unitPrice != null) o.donGia = r.unitPrice;
    ra.set(k, o);
  }
  /* Gộp NHIỀU size giá khác nhau (lớn vs nhỏ) ⇒ ĐỂ TRỐNG đơn giá cho kế toán gõ
     MỘT giá chung (chốt) — không gợi ý bừa giá của một size. Một nguồn ⇒ giữ giá
     gợi ý như cũ. */
  const out = new Map<string, { theoNgay: DailyQuantities; ids: string[]; donGia: number | null }>();
  for (const [k, o] of ra) {
    out.set(k, { theoNgay: o.theoNgay, ids: o.ids, donGia: o.tenNguon.size > 1 ? null : o.donGia });
  }
  return out;
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
    // Tra theo HỌ: gom nhập keyed theo họ, dòng lưới có thể mang tên họ (hút mới)
    // hoặc tên size cũ ⇒ chuẩn hoá r.name về họ khi tra.
    const nguon = tuSoNhap ? theoLoai.get(hoNguyenLieu(r.name)) : undefined;
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

/* ---------- Dòng mẫu khối 2 (bán thành phẩm) ---------- */

/**
 * Một dòng MẪU của khối 2: mặt hàng × quy cách × khách × kênh × giá, chép từ kỳ gần
 * nhất cùng họ nguyên liệu. Bảng cân đối giấy in sẵn cả danh sách này (kể cả dòng
 * không ra hàng) — người dùng chỉ điền số, không phải thêm từng dòng.
 */
export interface DongMauTP {
  /** Định danh DUY NHẤT của dòng mẫu (khoa + thứ tự) — cùng mặt hàng + khách có thể có
      nhiều dòng khác giá (bảng giấy: "2 da tẩm bột 9-12 · Seachemot" 7,95 và 9,2). */
  id: string;
  /** productId|spec|customerId */
  khoa: string;
  productId: string;
  spec: string;
  customerId: string;
  channel: BalancingOutputItem["channel"];
  unitPrice: number | null;
}

export const khoaDongTP = (productId: string, spec: string, customerId: string): string =>
  `${productId}|${spec || ""}|${customerId || ""}`;

type KyTomTat = Pick<BalancingPeriod, "id" | "materialTypeName" | "startDate" | "endDate">;
const cuoiKy = (k: Pick<BalancingPeriod, "startDate" | "endDate">) => k.endDate || k.startDate || "";

/**
 * Kỳ làm MẪU cho khối 2: kỳ khác cùng họ NL có ít nhất một dòng bán thành phẩm.
 * Ưu tiên kỳ KẾT THÚC TRƯỚC kỳ này (mới nhất trước); không có thì lấy kỳ mới nhất
 * còn lại (VD kỳ đầu năm nhưng đã nhập kỳ sau trước).
 */
export function kyMauTP<K extends KyTomTat>(
  ky: KyTomTat,
  tatCaKy: K[],
  tatCaTP: Pick<BalancingOutputItem, "periodId" | "productId">[]
): K | null {
  const coDong = new Set(tatCaTP.filter((r) => r.productId).map((r) => r.periodId));
  const ung = tatCaKy
    .filter((k) => k.id !== ky.id && coDong.has(k.id) && cungHoNguyenLieu(k.materialTypeName, ky.materialTypeName))
    .sort((a, b) => cuoiKy(b).localeCompare(cuoiKy(a)));
  const batDau = ky.startDate || "";
  return ung.find((k) => batDau && cuoiKy(k) && cuoiKy(k) < batDau) ?? ung[0] ?? null;
}

/**
 * Dòng mẫu từ các dòng khối 2 của kỳ mẫu, giữ thứ tự gốc. Cùng (mặt hàng, quy cách,
 * khách) mà KHÁC giá ⇒ vẫn là hai dòng (như bảng giấy); trùng cả giá ⇒ một dòng.
 */
export function dungDongMauTP(dongKyMau: BalancingOutputItem[]): DongMauTP[] {
  const ra = new Map<string, DongMauTP>();
  const dem = new Map<string, number>();
  for (const r of dongKyMau) {
    if (!r.productId) continue;
    const khoa = khoaDongTP(r.productId, r.spec ?? "", r.customerId);
    const trungGia = `${khoa}|${r.unitPrice ?? ""}`;
    if (ra.has(trungGia)) continue;
    const thu = dem.get(khoa) ?? 0;
    dem.set(khoa, thu + 1);
    ra.set(trungGia, {
      id: `${khoa}#${thu}`,
      khoa,
      productId: r.productId,
      spec: r.spec ?? "",
      customerId: r.customerId,
      channel: r.channel,
      unitPrice: r.unitPrice,
    });
  }
  return [...ra.values()];
}

/**
 * Dòng mẫu CHƯA có trong kỳ — đếm theo SỐ DÒNG: kỳ đã có m dòng cùng (mặt hàng, quy
 * cách, khách) thì bỏ m dòng mẫu đầu của khoá đó (gõ vào dòng mẫu thứ nhất không làm
 * dòng thứ hai biến mất). Kỳ có dòng cùng mặt hàng + quy cách mà CHƯA chọn khách (dòng
 * hút từ sổ sản xuất cũ) ⇒ ẩn mọi dòng mẫu của mặt hàng đó: hiện thêm cạnh nó dễ khiến
 * người dùng gõ số hai lần cho cùng một mặt hàng.
 */
export function dongMauConThieu(
  mau: DongMauTP[],
  tp: Pick<BalancingOutputItem, "productId" | "spec" | "customerId">[]
): DongMauTP[] {
  const daCo = new Map<string, number>();
  for (const r of tp) {
    const k = khoaDongTP(r.productId, r.spec ?? "", r.customerId);
    daCo.set(k, (daCo.get(k) ?? 0) + 1);
  }
  const coChuaKhach = new Set(tp.filter((r) => !r.customerId).map((r) => khoaMatHang(r.productId, r.spec ?? "")));
  const daBo = new Map<string, number>();
  return mau.filter((m) => {
    if (coChuaKhach.has(khoaMatHang(m.productId, m.spec))) return false;
    const bo = daBo.get(m.khoa) ?? 0;
    if (bo < (daCo.get(m.khoa) ?? 0)) {
      daBo.set(m.khoa, bo + 1);
      return false;
    }
    return true;
  });
}

/**
 * Gợi ý khách · kênh · đơn giá cho một mặt hàng (+ quy cách) mới vào kỳ:
 * 1) dòng mẫu cùng mặt hàng + quy cách; 2) dòng mẫu cùng mặt hàng;
 * 3) dòng GẦN NHẤT ở các kỳ khác (theo ngày cuối kỳ) cùng mặt hàng có đơn giá.
 * Không có gì ⇒ null (để trống, không bịa).
 */
export function goiYKhachGia(
  productId: string,
  spec: string,
  mau: DongMauTP[],
  tatCaTP: BalancingOutputItem[],
  tatCaKy: Pick<BalancingPeriod, "id" | "startDate" | "endDate">[],
  kyHienTai: string
): Pick<DongMauTP, "customerId" | "channel" | "unitPrice"> | null {
  const m =
    mau.find((x) => x.productId === productId && x.spec === (spec || "")) ??
    mau.find((x) => x.productId === productId);
  if (m) return { customerId: m.customerId, channel: m.channel, unitPrice: m.unitPrice };
  const cuoi = new Map(tatCaKy.map((k) => [k.id, cuoiKy(k)]));
  const ung = tatCaTP
    .filter((r) => r.periodId !== kyHienTai && r.productId === productId && r.unitPrice != null)
    .sort(
      (a, b) =>
        Number((b.spec ?? "") === (spec || "")) - Number((a.spec ?? "") === (spec || "")) ||
        (cuoi.get(b.periodId) ?? "").localeCompare(cuoi.get(a.periodId) ?? "")
    )[0];
  return ung ? { customerId: ung.customerId, channel: ung.channel, unitPrice: ung.unitPrice } : null;
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
