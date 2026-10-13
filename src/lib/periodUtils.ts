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
export type ViewPeriod = "ngay" | "tuan" | "thang" | "nam" | "tuy-chon";

export interface ViewPeriodOption {
  value: ViewPeriod;
  label: string;
}

export const KY_OPT: ViewPeriodOption[] = [
  { value: "ngay", label: "Ngày" },
  { value: "tuan", label: "Tuần" },
  { value: "thang", label: "Tháng" },
  { value: "nam", label: "Năm" },
  { value: "tuy-chon", label: "Khoảng tự chọn" },
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
  const thu = (d.getDay() + 6) % 7; // Thứ 2 = 0
  d.setDate(d.getDate() - thu);
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
  ky: ViewPeriod,
  moc: string,
  startDate: string,
  endDate: string
): [string, string] {
  switch (ky) {
    case "ngay":
      return [moc, moc];
    case "tuan":
      return [startOfWeek(moc), endOfWeek(moc)];
    case "thang":
      return [startOfMonth(moc), endOfMonth(moc)];
    case "nam":
      return [startOfYear(moc), endOfYear(moc)];
    case "tuy-chon":
      return [startDate, endDate];
  }
}
