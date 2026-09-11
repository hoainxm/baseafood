// ============================================================
// Tên file: src/lib/inventoryMaterial.ts
// Tên tiếng Việt: Sổ Nhập–Xuất–Tồn kho nguyên liệu (kho đông dự trữ)
// Description: Raw-material inventory (frozen reserve) NXT ledger — pure, no React
// ============================================================
import type {
  BalancingPeriod,
  BalancingInputItem,
  MaterialImportItem,
  MaterialOpeningStock,
  DailyLock,
  DailyQuantities,
  Workshop,
} from "@/types";
import { hoNguyenLieu, cungHoNguyenLieu, ngayTrongKy } from "@/lib/balancingGrid";

/**
 * VÌ SAO CÓ FILE NÀY — điểm đau số 1: "tồn nguyên liệu cuối kỳ sai do ghi chép
 * tay". Sổ này suy TỒN NGUYÊN LIỆU hoàn toàn từ dữ liệu đã có, KHÔNG bắt tổ
 * trưởng ghi tay lần hai (quyết định nghiệp vụ: "xuất tự suy từ cân đối", "kg
 * thuần"), nên số không thể lệch sổ gốc.
 *
 * MÔ HÌNH — tồn kho nguyên liệu CHÍNH LÀ kho đông dự trữ của vòng gối đầu:
 *
 *   Tồn cuối = Tồn đầu + Đông gửi (nhập kho tồn) − Xả đông (xuất kho tồn)
 *
 * ánh xạ thẳng sang cột "Chuyển kỳ" của Cân đối (xem 31-can-doi-ky.md):
 *   - carryOverKg < 0  = ĐÔNG GỬI  → phần đẩy sang kỳ sau, +vào kho tồn.
 *   - carryOverKg > 0  = XẢ ĐÔNG   → phần lấy từ kỳ trước ra dùng, −khỏi kho tồn.
 * Nên tồn cuối kỳ này = phần "nhận chuyển kỳ" mà kỳ sau lấy về — khép vòng mà
 * không ai phải mở file kỳ cũ chép tay.
 *
 * CÒN DỞ SẢN XUẤT (khép vòng G1, migration 0038): khi chốt ngày SX, tổ trưởng
 * ghi NL chưa chế biến hết đem lưu kho, TÁCH THEO loại NL (production_locks
 * .leftover_by_material). HƯỚNG 1 (chốt 2026-09-06 với chủ dự án): "ghi ở SẢN
 * XUẤT là chính" ⇒ ĐÔNG GỬI = còn dở SX của kỳ (cùng họ NL + ngày chốt trong
 * kỳ) NẾU có; chưa có (dữ liệu cũ / kỳ chưa dùng SX còn dở) mới lấy Chuyển kỳ
 * âm khai tay ở Cân đối. KHÔNG cộng cả hai ⇒ HẾT cộng đôi. Kế toán khỏi khai
 * Chuyển kỳ âm cho đông gửi; xả đông (Chuyển kỳ dương) vẫn khai bình thường.
 *
 * "Nhập tươi" (material_imports) đi kèm làm bối cảnh để sổ phủ TOÀN BỘ nguyên
 * liệu mỗi ngày; phần lớn NL tươi chế biến ngay trong kỳ nên không đọng thành
 * tồn — chỉ phần cấp đông (đông gửi) mới ở lại kho tồn.
 *
 * BỘ DÒ LỖI THẬT: tồn cuối < 0 nghĩa là xả đông nhiều hơn số đang trữ — chắc
 * chắn sai ghi chép. Màn hình phải gọi tên, không được giấu (luật "màn tự giải
 * thích" của 31-can-doi-ky.md).
 *
 * ⚠️ v1 — quy tắc chính xác nằm DUY NHẤT ở file này; phải đối chiếu tay với một
 * kỳ có số thật (bạch tuộc 2 da 21–25/07) trước khi tin con số.
 */

/** Một dòng sổ NXT nguyên liệu cho MỘT kỳ cân đối của MỘT họ nguyên liệu. */
export interface SoTonNLKy {
  periodId: string;
  hoNL: string; // họ nguyên liệu (gom 2 size)
  tenKy: string; // materialTypeName của kỳ (để hiện)
  startDate: string;
  endDate: string;
  tonDau: number; // kho đông đầu kỳ (kế thừa kỳ trước / tồn đầu khai tay)
  dongGui: number; // + vào kho tồn: ĐÔNG GỬI hoà giải (SX là chính, fallback Chuyển kỳ âm)
  conDoSX: number; // còn dở khai ở SX (0038); >0 nghĩa dongGui lấy từ SX (nguồn chính hướng 1)
  xaDong: number; // − khỏi kho tồn (Σ carryOverKg>0)
  tonCuoi: number; // tonDau + dongGui − xaDong
  nhapTuoi: number; // Σ nhập tươi trong kỳ (bối cảnh, không vào kho tồn)
  theoNgayNhap: DailyQuantities; // nhập tươi theo ngày (cho báo cáo theo ngày)
  canhBaoAm: boolean; // tonCuoi < 0 → lỗi ghi chép
  seedTonDau: boolean; // tonDau lấy từ tồn đầu khai tay (kỳ đầu tiên của họ)
}

function tongCarryDuong(inputs: BalancingInputItem[], periodId: string): number {
  return inputs
    .filter((r) => r.periodId === periodId && (r.carryOverKg ?? 0) > 0)
    .reduce((s, r) => s + (r.carryOverKg ?? 0), 0);
}

function tongCarryAm(inputs: BalancingInputItem[], periodId: string): number {
  return inputs
    .filter((r) => r.periodId === periodId && (r.carryOverKg ?? 0) < 0)
    .reduce((s, r) => s + Math.abs(r.carryOverKg ?? 0), 0);
}

/** Tồn đầu khai tay áp cho một họ NL: cộng mọi dòng cùng họ (+ xưởng) có mốc ≤ ngày. */
function tonDauKhaiTay(
  opening: MaterialOpeningStock[],
  hoNL: string,
  denNgay: string,
  workshop?: Workshop,
): number {
  return opening
    .filter(
      (o) =>
        cungHoNguyenLieu(o.materialTypeName, hoNL) &&
        (!workshop || o.workshop === workshop) &&
        (!o.asOfDate || o.asOfDate <= denNgay),
    )
    .reduce((s, o) => s + (o.quantityKg || 0), 0);
}

/**
 * Còn dở SX (0038) rơi vào một kỳ: các lần chốt ngày SX có ngày chốt trong kỳ,
 * cộng phần leftover của loại NL cùng họ với kỳ. Xưởng lọc như nhập tươi.
 */
function conDoTrongKy(
  locks: DailyLock[],
  ky: BalancingPeriod,
  workshop?: Workshop,
): number {
  const ngay = new Set(ngayTrongKy(ky));
  if (ngay.size === 0) return 0;
  let tong = 0;
  for (const lk of locks) {
    if (workshop && lk.workshop !== workshop) continue;
    if (!ngay.has(lk.lockDate)) continue;
    const lb = lk.leftoverByMaterial;
    if (!lb) continue;
    for (const [ten, v] of Object.entries(lb)) {
      if (cungHoNguyenLieu(ten, ky.materialTypeName)) tong += Number(v) || 0;
    }
  }
  return tong;
}

/**
 * Còn dở SX (0038) KHÔNG khớp kỳ nào: leftover ghi ở ngày chốt mà không có kỳ cân
 * đối nào (cùng họ NL) phủ ngày đó → sẽ KHÔNG vào tồn (rơi ra ngoài). Trả tổng kg
 * bị rớt trong khoảng ngày/xưởng đang xem để màn gọi tên (không giấu số như tồn âm).
 */
export function conDoChuaKhopKy(
  periods: BalancingPeriod[],
  locks: DailyLock[],
  range?: { tuNgay?: string; denNgay?: string; workshop?: Workshop },
): number {
  const workshop = range?.workshop;
  const ngayCuaKy = periods.map((ky) => ({
    ky,
    ngay: new Set(ngayTrongKy(ky)),
  }));
  let chuaKhop = 0;
  for (const lk of locks) {
    if (workshop && lk.workshop !== workshop) continue;
    if (range?.tuNgay && lk.lockDate < range.tuNgay) continue;
    if (range?.denNgay && lk.lockDate > range.denNgay) continue;
    const lb = lk.leftoverByMaterial;
    if (!lb) continue;
    for (const [ten, v] of Object.entries(lb)) {
      const kgv = Number(v) || 0;
      if (kgv <= 0) continue;
      const khop = ngayCuaKy.some(
        (p) => p.ngay.has(lk.lockDate) && cungHoNguyenLieu(ten, p.ky.materialTypeName),
      );
      if (!khop) chuaKhop += kgv;
    }
  }
  return chuaKhop;
}

/** Nhập tươi theo ngày của một kỳ: gom material_imports cùng họ NL, ngày trong kỳ. */
function nhapTuoiTheoNgay(
  ky: BalancingPeriod,
  imports: MaterialImportItem[],
  workshop?: Workshop,
): DailyQuantities {
  const ngay = new Set(ngayTrongKy(ky));
  const ra: DailyQuantities = {};
  if (ngay.size === 0) return ra;
  for (const r of imports) {
    if (workshop && r.workshop !== workshop) continue;
    if (!ngay.has(r.deliveryDate)) continue;
    if (!cungHoNguyenLieu(r.materialTypeName, ky.materialTypeName)) continue;
    ra[r.deliveryDate] = (ra[r.deliveryDate] ?? 0) + (r.quantityKg || 0);
  }
  return ra;
}

/**
 * Dựng sổ NXT nguyên liệu theo kỳ, có KẾ THỪA tồn đầu giữa các kỳ cùng họ.
 *
 * Xử lý MỌI kỳ theo thứ tự ngày bắt đầu để chuỗi tồn đúng, rồi trả về những kỳ
 * rơi trong [tuNgay, denNgay] (lọc theo startDate). `workshop` để lọc nhập tươi
 * + tồn đầu khai tay; kỳ cân đối hiện chỉ có ở xưởng Đông.
 */
export function tinhSoTonNL(
  periods: BalancingPeriod[],
  inputs: BalancingInputItem[],
  imports: MaterialImportItem[],
  opening: MaterialOpeningStock[],
  locks: DailyLock[],
  range?: { tuNgay?: string; denNgay?: string; workshop?: Workshop },
): SoTonNLKy[] {
  const workshop = range?.workshop;
  const sapXep = [...periods].sort((a, b) =>
    (a.startDate || "").localeCompare(b.startDate || ""),
  );

  const tonChay = new Map<string, number>(); // hoNL(lowercase) → tồn cuối gần nhất
  const tatCa: SoTonNLKy[] = [];

  for (const ky of sapXep) {
    const hoNL = hoNguyenLieu(ky.materialTypeName);
    const khoa = hoNL.toLowerCase();

    let tonDau: number;
    let seedTonDau = false;
    if (tonChay.has(khoa)) {
      tonDau = tonChay.get(khoa)!;
    } else {
      tonDau = tonDauKhaiTay(opening, ky.materialTypeName, ky.startDate || "9999-99-99", workshop);
      seedTonDau = tonDau !== 0;
    }

    // Đông gửi có 2 nguồn: (a) còn dở khai ở SẢN XUẤT (production_locks), (b)
    // Chuyển kỳ âm khai tay ở Cân đối. HƯỚNG 1 (chốt 2026-09-06): "ghi ở Sản
    // xuất là CHÍNH" ⇒ đông gửi = còn dở SX nếu có; chưa có (dữ liệu cũ / kỳ
    // chưa dùng SX còn dở) thì mới dùng Chuyển kỳ âm. KHÔNG cộng cả hai → hết
    // cộng đôi. (Kế toán khỏi khai Chuyển kỳ âm nữa; xả đông vẫn khai bình thường.)
    const conDoSX = conDoTrongKy(locks, ky, workshop);
    const dongGuiKhaiTay = tongCarryAm(inputs, ky.id);
    const dongGui = conDoSX > 0 ? conDoSX : dongGuiKhaiTay;
    const xaDong = tongCarryDuong(inputs, ky.id);
    const tonCuoi = tonDau + dongGui - xaDong;
    tonChay.set(khoa, tonCuoi);

    const theoNgayNhap = nhapTuoiTheoNgay(ky, imports, workshop);
    const nhapTuoi = Object.values(theoNgayNhap).reduce((s, v) => s + v, 0);

    tatCa.push({
      periodId: ky.id,
      hoNL,
      tenKy: ky.materialTypeName,
      startDate: ky.startDate || "",
      endDate: ky.endDate || ky.startDate || "",
      tonDau,
      dongGui,
      conDoSX,
      xaDong,
      tonCuoi,
      nhapTuoi,
      theoNgayNhap,
      canhBaoAm: tonCuoi < 0,
      seedTonDau,
    });
  }

  // Trả kỳ GIAO NHAU với khoảng ngày (không chỉ khớp ngày bắt đầu): kỳ kéo dài
  // nhiều ngày, lọc theo startDate thôi sẽ rụng kỳ đang chạy vắt qua khoảng.
  const tu = range?.tuNgay;
  const den = range?.denNgay;
  return tatCa.filter((r) => {
    const s0 = r.startDate || "";
    const e0 = r.endDate || r.startDate || "";
    if (den && s0 && s0 > den) return false;
    if (tu && e0 && e0 < tu) return false;
    return true;
  });
}

export interface TongSoTonNL {
  tonDau: number;
  dongGui: number;
  conDoSX: number;
  xaDong: number;
  tonCuoi: number;
  nhapTuoi: number;
  soHo: number; // số họ nguyên liệu
  soCanhBao: number; // số kỳ tồn âm
}

/**
 * Cộng gộp cho thẻ Thống kê. Tồn đầu/cuối cộng theo HỌ nguyên liệu (mỗi họ lấy
 * kỳ sớm nhất cho tồn đầu, muộn nhất cho tồn cuối) — không cộng dồn từng kỳ,
 * tránh đếm hai lần phần đã kế thừa.
 */
/* ============================================================
 * TỒN NL "TỔNG" theo NHẬP HÀNG (2026-09-11, PA-a) — khác engine kỳ ở trên.
 *
 * Vì sao: màn /nxt-nl cũ suy tồn theo KỲ cân đối (đông gửi/xả đông) nên nhập hàng
 * không vào tồn + chỉ xưởng Đông có số. Yêu cầu chủ dự án: dùng NHẬP HÀNG làm vế
 * NHẬP thật của tồn kho NL, phủ CẢ 3 xưởng, xem theo NGÀY. Xuất (NL lấy ra SX)
 * CHƯA capture nên = 0 (chừa sẵn cột), tồn hiện là "chưa trừ xuất".
 *
 *   Tồn cuối = Tồn đầu + Nhập hàng − Xuất SX(=0)
 *
 * PA-a (chốt 2026-09-11): đông gửi/xả đông là CHUYỂN NỘI BỘ tươi↔kho đông, KHÔNG
 * cộng vào tổng (tránh đếm đôi phần leftover đã nằm trong nhập hàng) — chỉ lấy làm
 * CỘT THÔNG TIN "kho đông dự trữ" (đọc lại từ engine kỳ `tinhSoTonNL`).
 *
 * Tồn đầu kỳ = tồn đầu khai tay (material_opening_stock, mốc ≤ đầu kỳ) + Σ nhập
 * hàng TRƯỚC kỳ → chính là số dư chạy tới đầu khoảng đang xem.
 * ============================================================ */

/** Một dòng tồn NL "tổng" cho MỘT họ nguyên liệu, trong khoảng ngày đang xem. */
export interface TonNLTongHo {
  hoNL: string;
  tonDau: number; // opening(≤ đầu kỳ) + Σ nhập trước kỳ
  nhapKy: number; // Σ nhập hàng trong kỳ
  xuatSX: number; // 0 — chờ capture "NL lấy ra sản xuất"
  tonCuoi: number; // tonDau + nhapKy − xuatSX
  dongGui: number; // THÔNG TIN (kho đông) — KHÔNG vào tonCuoi
  xaDong: number; // THÔNG TIN — KHÔNG vào tonCuoi
  seedTonDau: boolean; // tồn đầu có phần khai tay
  canhBaoAm: boolean; // tonCuoi < 0
}

/** Một mốc tồn tổng cuối ngày (mọi họ gộp) — cho bảng "tồn theo ngày". */
export interface TonNLTongNgay {
  date: string;
  nhap: number;
  xuatSX: number; // 0
  tonCuoi: number; // tồn tổng cuối ngày = tồn đầu tổng + Σ nhập ≤ ngày
}

export interface TonNLTong {
  theoHo: TonNLTongHo[];
  theoNgay: TonNLTongNgay[];
  tongTonDau: number;
  tongNhap: number;
  tongTonCuoi: number;
  tongDongGui: number;
  tongXaDong: number;
  soHo: number;
  soCanhBao: number;
}

/**
 * Dựng tồn NL "tổng" theo nhập hàng cho khoảng ngày [tuNgay, denNgay] + xưởng.
 * Dòng theo HỌ nguyên liệu (không cần kỳ cân đối) ⇒ phủ cả 3 xưởng. Đông gửi/xả
 * đông lấy làm cột thông tin từ `tinhSoTonNL` (engine kỳ), KHÔNG cộng vào tồn.
 */
export function tinhTonNLTong(
  periods: BalancingPeriod[],
  inputs: BalancingInputItem[],
  imports: MaterialImportItem[],
  opening: MaterialOpeningStock[],
  locks: DailyLock[],
  range?: { tuNgay?: string; denNgay?: string; workshop?: Workshop },
): TonNLTong {
  const workshop = range?.workshop;
  const tu = range?.tuNgay ?? "0000-01-01";
  const den = range?.denNgay ?? "9999-12-31";
  const dungXuong = (w?: Workshop) => !workshop || w === workshop;

  // Đông gửi / xả đông (THÔNG TIN) — gom theo họ từ engine kỳ (kỳ giao khoảng).
  const kyRows = tinhSoTonNL(periods, inputs, imports, opening, locks, range);
  const dongXa = new Map<string, { dongGui: number; xaDong: number }>();
  for (const r of kyRows) {
    const k = r.hoNL.toLowerCase();
    const cur = dongXa.get(k) ?? { dongGui: 0, xaDong: 0 };
    cur.dongGui += r.dongGui;
    cur.xaDong += r.xaDong;
    dongXa.set(k, cur);
  }

  // Tập họ NL: từ nhập hàng + tồn đầu khai tay + kỳ (đều lọc xưởng).
  const dsHo = new Map<string, string>(); // key(lower) → tên họ hiển thị
  const themHo = (ten: string) => {
    const h = hoNguyenLieu(ten);
    if (h) dsHo.set(h.toLowerCase(), h);
  };
  for (const r of imports) if (dungXuong(r.workshop)) themHo(r.materialTypeName);
  for (const o of opening) if (dungXuong(o.workshop)) themHo(o.materialTypeName);
  for (const r of kyRows) dsHo.set(r.hoNL.toLowerCase(), r.hoNL);

  const theoHo: TonNLTongHo[] = [];
  for (const [k, hoNL] of dsHo) {
    const cungHo = (ten: string) => cungHoNguyenLieu(ten, hoNL);
    const openTruoc = opening
      .filter(
        (o) =>
          dungXuong(o.workshop) &&
          cungHo(o.materialTypeName) &&
          (!o.asOfDate || o.asOfDate <= tu),
      )
      .reduce((s, o) => s + (o.quantityKg || 0), 0);
    const nhapTruoc = imports
      .filter(
        (r) => dungXuong(r.workshop) && cungHo(r.materialTypeName) && r.deliveryDate < tu,
      )
      .reduce((s, r) => s + (r.quantityKg || 0), 0);
    const nhapKy = imports
      .filter(
        (r) =>
          dungXuong(r.workshop) &&
          cungHo(r.materialTypeName) &&
          r.deliveryDate >= tu &&
          r.deliveryDate <= den,
      )
      .reduce((s, r) => s + (r.quantityKg || 0), 0);
    const info = dongXa.get(k) ?? { dongGui: 0, xaDong: 0 };
    // Bỏ họ trống trơn (không tồn đầu, không nhập, không đông/xả) khỏi bảng.
    if (openTruoc === 0 && nhapTruoc === 0 && nhapKy === 0 && info.dongGui === 0 && info.xaDong === 0)
      continue;
    const tonDau = openTruoc + nhapTruoc;
    const tonCuoi = tonDau + nhapKy; // − xuất SX(0)
    theoHo.push({
      hoNL,
      tonDau,
      nhapKy,
      xuatSX: 0,
      tonCuoi,
      dongGui: info.dongGui,
      xaDong: info.xaDong,
      seedTonDau: openTruoc > 0,
      canhBaoAm: tonCuoi < 0,
    });
  }
  theoHo.sort((a, b) => b.tonCuoi - a.tonCuoi);

  const tongTonDau = theoHo.reduce((s, r) => s + r.tonDau, 0);

  // Tồn tổng theo NGÀY: mỗi ngày có nhập → tồn cuối ngày = tồn đầu tổng + Σ nhập ≤ ngày.
  const nhapNgay = new Map<string, number>();
  for (const r of imports) {
    if (!dungXuong(r.workshop)) continue;
    if (r.deliveryDate < tu || r.deliveryDate > den) continue;
    nhapNgay.set(r.deliveryDate, (nhapNgay.get(r.deliveryDate) ?? 0) + (r.quantityKg || 0));
  }
  const theoNgay: TonNLTongNgay[] = [...nhapNgay.keys()].sort().reduce<TonNLTongNgay[]>(
    (acc, date) => {
      const nhap = nhapNgay.get(date)!;
      const truoc = acc.length ? acc[acc.length - 1].tonCuoi : tongTonDau;
      acc.push({ date, nhap, xuatSX: 0, tonCuoi: truoc + nhap });
      return acc;
    },
    [],
  );

  return {
    theoHo,
    theoNgay,
    tongTonDau,
    tongNhap: theoHo.reduce((s, r) => s + r.nhapKy, 0),
    tongTonCuoi: theoHo.reduce((s, r) => s + r.tonCuoi, 0),
    tongDongGui: theoHo.reduce((s, r) => s + r.dongGui, 0),
    tongXaDong: theoHo.reduce((s, r) => s + r.xaDong, 0),
    soHo: theoHo.length,
    soCanhBao: theoHo.filter((r) => r.canhBaoAm).length,
  };
}

export function tongSoTonNL(rows: SoTonNLKy[]): TongSoTonNL {
  const theoHo = new Map<string, SoTonNLKy[]>();
  for (const r of rows) {
    const k = r.hoNL.toLowerCase();
    (theoHo.get(k) ?? theoHo.set(k, []).get(k)!).push(r);
  }
  let tonDau = 0;
  let tonCuoi = 0;
  for (const ds of theoHo.values()) {
    const theoNgay = [...ds].sort((a, b) => a.startDate.localeCompare(b.startDate));
    tonDau += theoNgay[0].tonDau;
    tonCuoi += theoNgay[theoNgay.length - 1].tonCuoi;
  }
  return {
    tonDau,
    dongGui: rows.reduce((s, r) => s + r.dongGui, 0),
    conDoSX: rows.reduce((s, r) => s + r.conDoSX, 0),
    xaDong: rows.reduce((s, r) => s + r.xaDong, 0),
    tonCuoi,
    nhapTuoi: rows.reduce((s, r) => s + r.nhapTuoi, 0),
    soHo: theoHo.size,
    soCanhBao: rows.filter((r) => r.canhBaoAm).length,
  };
}
