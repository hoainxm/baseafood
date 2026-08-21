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
  dongGui: number; // + vào kho tồn (Σ |carryOverKg<0|)
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

    const dongGui = tongCarryAm(inputs, ky.id);
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
    xaDong: rows.reduce((s, r) => s + r.xaDong, 0),
    tonCuoi,
    nhapTuoi: rows.reduce((s, r) => s + r.nhapTuoi, 0),
    soHo: theoHo.size,
    soCanhBao: rows.filter((r) => r.canhBaoAm).length,
  };
}
