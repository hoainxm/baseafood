// ============================================================
// Tên file cũ: src/lib/ky.ts
// Tên tiếng Việt: Tiện ích xử lý Kỳ sản xuất & Khoảng thời gian
// Description: Balancing period range helpers and date utilities
// ============================================================
/**
 * Kỳ xem sổ — dùng chung cho màn Nhập hàng và phiếu báo cáo.
 *
 * Từ một "ngày neo" suy ra khoảng [từ, đến]: tuần = Thứ 2 → CN, tháng/năm =
 * đầu → cuối. `tuy-chon` dùng thẳng cặp tuNgay/denNgay.
 * Toán ngày dùng Date local (khớp cách DateField parse), KHÔNG lệ thuộc UTC.
 */
export type ViewPeriod = "day" | "week" | "month" | "year" | "custom";

export interface ViewPeriodOption {
  value: ViewPeriod;
  label: string;
}

export const PERIOD_OPTIONS: ViewPeriodOption[] = [
  { value: "day", label: "Ngày" },
  { value: "week", label: "Tuần" },
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
  { value: "custom", label: "Khoảng tự chọn" },
];

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function toIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function startOfWeek(iso: string): string {
  const d = toDate(iso);
  const weekday = (d.getDay() + 6) % 7; // Thứ 2 = 0
  d.setDate(d.getDate() - weekday);
  return toIso(d);
}
export function endOfWeek(iso: string): string {
  const d = toDate(startOfWeek(iso));
  d.setDate(d.getDate() + 6);
  return toIso(d);
}
export const startOfMonth = (iso: string): string => `${iso.slice(0, 7)}-01`;
export function endOfMonth(iso: string): string {
  const d = toDate(iso);
  return toIso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
export const startOfYear = (iso: string): string => `${iso.slice(0, 4)}-01-01`;
export const endOfYear = (iso: string): string => `${iso.slice(0, 4)}-12-31`;

/** [từ, đến] của kỳ đang xem. */
export function getViewPeriodRange(
  period: ViewPeriod,
  anchor: string,
  startDate: string,
  endDate: string
): [string, string] {
  switch (period) {
    case "day":
      return [anchor, anchor];
    case "week":
      return [startOfWeek(anchor), endOfWeek(anchor)];
    case "month":
      return [startOfMonth(anchor), endOfMonth(anchor)];
    case "year":
      return [startOfYear(anchor), endOfYear(anchor)];
    case "custom":
      return [startDate, endDate];
  }
}

/** Lùi / tiến mốc kỳ một bước: ngày ±1, tuần ±7, tháng / năm ±1 (về ngày đầu). Khoảng tự chọn không bước. */
export function stepViewPeriod(period: ViewPeriod, anchor: string, step: 1 | -1): string {
  const d = toDate(anchor);
  if (period === "day") d.setDate(d.getDate() + step);
  else if (period === "week") d.setDate(d.getDate() + 7 * step);
  else if (period === "month") return toIso(new Date(d.getFullYear(), d.getMonth() + step, 1));
  else if (period === "year") return toIso(new Date(d.getFullYear() + step, 0, 1));
  return toIso(d);
}

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** Nhãn ngắn của kỳ đang xem: "03/11/2026" · "Tháng 11/2026" · "Năm 2026" · "02/11/2026 – 08/11/2026". */
export function viewPeriodLabel(period: ViewPeriod, fromDate: string, toDate: string): string {
  if (!fromDate) return "";
  if (period === "day") return dmy(fromDate);
  if (period === "month") return `Tháng ${fromDate.slice(5, 7)}/${fromDate.slice(0, 4)}`;
  if (period === "year") return `Năm ${fromDate.slice(0, 4)}`;
  return toDate ? `${dmy(fromDate)} – ${dmy(toDate)}` : dmy(fromDate);
}
