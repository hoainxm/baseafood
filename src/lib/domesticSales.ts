// ============================================================
// Tên file: src/lib/domesticSales.ts
// Tên tiếng Việt: Bán nội địa — NL bán thẳng (sổ /wip) ⇄ dòng "Bán nội địa" khối 1 Cân đối
// Description: Pure helpers for domestic raw-material sales (migration 0054).
// ============================================================
// "Bán nội địa" (chốt Q5–Q6 với xí nghiệp) = nguyên liệu bán THẲNG cho khách trong
// nước, VND, không qua chế biến. Bảng cân đối giấy để ở khối NL dưới dạng số ÂM
// (VD −987 kg) — trừ khỏi pool NL đưa vào sản xuất. Ở app:
//   - tổ trưởng ghi từng dòng ở /wip  → sổ `domestic_sales` (kg DƯƠNG);
//   - Cân đối có dòng giảm tên "Bán nội địa" (isReduction ⇒ lưu ÂM) — nút "Lấy
//     bán nội địa từ SX" điền đúng từng ngày bằng `getPeriodDomesticSales`.
// Dòng giảm âm sẵn hợp lệ với calculateBalancing ⇒ KHÔNG đổi công thức.
import type { BalancingPeriod, DailyQuantities, DomesticSaleItem } from "@/types";
import { isSameMaterialFamily, getPeriodDates } from "@/lib/balancingGrid";

/** Tên dòng giảm khối 1 — đúng chữ trên bảng cân đối giấy. */
export const DOMESTIC_SALE_ROW_NAME = "Bán nội địa";

/**
 * Dòng NL khối 1 là dòng Bán nội địa: nhận theo TÊN (không phân hoa thường), BẤT KỂ
 * cờ giảm — dữ liệu cũ (seed 0023, kỳ BT 2 da trên DB thật) lưu "Bán nội địa" là dòng
 * Thủy sản kg âm thường, không phải dòng giảm. Nhận theo cờ thì nút "Lấy từ SX" sẽ
 * đẻ dòng thứ hai ⇒ TRỪ ĐÔI. Khi điền từ SX, dòng cũ được chuyển thành dòng giảm.
 */
export function isDomesticSaleRow(r: { name: string }): boolean {
  return r.name.trim().toLowerCase() === DOMESTIC_SALE_ROW_NAME.toLowerCase();
}

export interface PeriodDomesticSales {
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
export function getPeriodDomesticSales(
  items: DomesticSaleItem[],
  ky: Pick<BalancingPeriod, "startDate" | "endDate" | "materialTypeName">
): PeriodDomesticSales {
  const dates = new Set(getPeriodDates(ky));
  const byDate: DailyQuantities = {};
  let totalKg = 0;
  let pricedKg = 0;
  let amount = 0;
  let rowCount = 0;
  for (const d of items) {
    const kg = Number(d.quantityKg) || 0;
    if (kg <= 0 || !dates.has(d.saleDate)) continue;
    if (!isSameMaterialFamily(d.materialTypeName, ky.materialTypeName)) continue;
    byDate[d.saleDate] = (byDate[d.saleDate] ?? 0) + kg;
    totalKg += kg;
    rowCount += 1;
    if (d.unitPrice != null && d.unitPrice > 0) {
      pricedKg += kg;
      amount += kg * d.unitPrice;
    }
  }
  return {
    theoNgay: byDate,
    tongKg: totalKg,
    giaBinhQuan: pricedKg > 0 ? Math.round(amount / pricedKg) : null,
    soDong: rowCount,
  };
}

/**
 * So dòng "Bán nội địa" của Cân đối (số ÂM theo ngày) với sổ /wip (số DƯƠNG):
 * "khop" khi mọi ngày bằng nhau (sai số < 0,001 kg), "lech" khi khác, "trong" khi
 * Cân đối chưa có số nào.
 */
export function compareDomesticSales(
  canDoi: DailyQuantities | undefined,
  production: DailyQuantities
): "khop" | "lech" | "trong" {
  const cd = canDoi ?? {};
  const hasValues = Object.values(cd).some((v) => (Number(v) || 0) !== 0);
  if (!hasValues) return "trong";
  const dates = new Set([...Object.keys(cd), ...Object.keys(production)]);
  for (const iso of dates) {
    const a = Math.abs(Number(cd[iso]) || 0);
    const b = Math.abs(Number(production[iso]) || 0);
    if (Math.abs(a - b) >= 0.001) return "lech";
  }
  return "khop";
}

/** Ngày-theo-kg DƯƠNG → ÂM để ghi vào dòng giảm (bỏ ngày 0). */
export function negateDailyQuantities(m: DailyQuantities): DailyQuantities {
  const ra: DailyQuantities = {};
  for (const [iso, kg] of Object.entries(m)) if (kg) ra[iso] = -Math.abs(kg);
  return ra;
}
