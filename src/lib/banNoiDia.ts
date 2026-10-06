// ============================================================
// Tên file: src/lib/banNoiDia.ts
// Tên tiếng Việt: Bán nội địa — NL bán thẳng (sổ /wip) ⇄ dòng "Bán nội địa" khối 1 Cân đối
// Description: Pure helpers for domestic raw-material sales (migration 0054).
// ============================================================
// "Bán nội địa" (chốt Q5–Q6 với xí nghiệp) = nguyên liệu bán THẲNG cho khách trong
// nước, VND, không qua chế biến. Bảng cân đối giấy để ở khối NL dưới dạng số ÂM
// (VD −987 kg) — trừ khỏi pool NL đưa vào sản xuất. Ở app:
//   - tổ trưởng ghi từng dòng ở /wip  → sổ `domestic_sales` (kg DƯƠNG);
//   - Cân đối có dòng giảm tên "Bán nội địa" (isReduction ⇒ lưu ÂM) — nút "Lấy
//     bán nội địa từ SX" điền đúng từng ngày bằng `banNoiDiaTheoKy`.
// Dòng giảm âm sẵn hợp lệ với calculateBalancing ⇒ KHÔNG đổi công thức.
import type { BalancingPeriod, DailyQuantities, DomesticSaleItem } from "@/types";
import { cungHoNguyenLieu, ngayTrongKy } from "@/lib/balancingGrid";

/** Tên dòng giảm khối 1 — đúng chữ trên bảng cân đối giấy. */
export const TEN_DONG_BAN_NOI_DIA = "Bán nội địa";

/**
 * Dòng NL khối 1 là dòng Bán nội địa: nhận theo TÊN (không phân hoa thường), BẤT KỂ
 * cờ giảm — dữ liệu cũ (seed 0023, kỳ BT 2 da trên DB thật) lưu "Bán nội địa" là dòng
 * Thủy sản kg âm thường, không phải dòng giảm. Nhận theo cờ thì nút "Lấy từ SX" sẽ
 * đẻ dòng thứ hai ⇒ TRỪ ĐÔI. Khi điền từ SX, dòng cũ được chuyển thành dòng giảm.
 */
export function laDongBanNoiDia(r: { name: string }): boolean {
  return r.name.trim().toLowerCase() === TEN_DONG_BAN_NOI_DIA.toLowerCase();
}

export interface BanNoiDiaKy {
  /** kg DƯƠNG theo ngày (dòng Cân đối tự đổi dấu khi ghi). */
  theoNgay: DailyQuantities;
  tongKg: number;
  /** Đơn giá bình quân gia quyền (VND/kg) trên các dòng có giá; không dòng nào có giá ⇒ null. */
  giaBinhQuan: number | null;
  soDong: number;
}

/**
 * Bán nội địa của MỘT kỳ cân đối: dòng có ngày bán nằm trong kỳ + loại NL CÙNG HỌ
 * với kỳ (kỳ dùng tên họ — "2 da lớn/nhỏ" đều thuộc "Bạch tuộc 2 da"). Bỏ dòng ≤ 0.
 */
export function banNoiDiaTheoKy(
  ds: DomesticSaleItem[],
  ky: Pick<BalancingPeriod, "startDate" | "endDate" | "materialTypeName">
): BanNoiDiaKy {
  const ngay = new Set(ngayTrongKy(ky));
  const theoNgay: DailyQuantities = {};
  let tongKg = 0;
  let kgCoGia = 0;
  let tien = 0;
  let soDong = 0;
  for (const d of ds) {
    const kg = Number(d.quantityKg) || 0;
    if (kg <= 0 || !ngay.has(d.saleDate)) continue;
    if (!cungHoNguyenLieu(d.materialTypeName, ky.materialTypeName)) continue;
    theoNgay[d.saleDate] = (theoNgay[d.saleDate] ?? 0) + kg;
    tongKg += kg;
    soDong += 1;
    if (d.unitPrice != null && d.unitPrice > 0) {
      kgCoGia += kg;
      tien += kg * d.unitPrice;
    }
  }
  return {
    theoNgay,
    tongKg,
    giaBinhQuan: kgCoGia > 0 ? Math.round(tien / kgCoGia) : null,
    soDong,
  };
}

/**
 * So dòng "Bán nội địa" của Cân đối (số ÂM theo ngày) với sổ /wip (số DƯƠNG):
 * "khop" khi mọi ngày bằng nhau (sai số < 0,001 kg), "lech" khi khác, "trong" khi
 * Cân đối chưa có số nào.
 */
export function doiChieuBanNoiDia(
  canDoi: DailyQuantities | undefined,
  sx: DailyQuantities
): "khop" | "lech" | "trong" {
  const cd = canDoi ?? {};
  const coSo = Object.values(cd).some((v) => (Number(v) || 0) !== 0);
  if (!coSo) return "trong";
  const ngay = new Set([...Object.keys(cd), ...Object.keys(sx)]);
  for (const iso of ngay) {
    const a = Math.abs(Number(cd[iso]) || 0);
    const b = Math.abs(Number(sx[iso]) || 0);
    if (Math.abs(a - b) >= 0.001) return "lech";
  }
  return "khop";
}

/** Ngày-theo-kg DƯƠNG → ÂM để ghi vào dòng giảm (bỏ ngày 0). */
export function amTheoNgay(m: DailyQuantities): DailyQuantities {
  const ra: DailyQuantities = {};
  for (const [iso, kg] of Object.entries(m)) if (kg) ra[iso] = -Math.abs(kg);
  return ra;
}
