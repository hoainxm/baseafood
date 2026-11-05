// ============================================================
// Tên file: src/design-system/patterns/dateInput.ts
// Tên tiếng Việt: Đọc ngày gõ tay trong ô lịch (DateField)
// Description: Parses a typed Vietnamese-style date (dd/mm/yyyy, dd/mm/yy, ddmmyyyy, dd/mm…) into ISO yyyy-mm-dd
// ============================================================
// Phòng KH 2026-11-05: "ngày nằm 2027, click từng tháng lâu quá" ⇒ ô lịch cho gõ ngày + chọn tháng / năm nhanh.

const pad = (n: number) => String(n).padStart(2, "0");

function valid(y: number, m: number, d: number): string {
  if (!(y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return "";
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? `${y}-${pad(m)}-${pad(d)}` : "";
}

const fullYear = (y: string) => (y.length <= 2 ? 2000 + Number(y) : Number(y));

/**
 * Chữ người dùng gõ ⇒ ngày ISO; không đọc được / ngày không có thật ⇒ "".
 * Nhận (ngày trước, tháng sau — kiểu Việt Nam): "31/12/2027" · "31-12-2027" · "31.12.27" · "31 12 2027" · "31122027" ·
 * "311227" · "31/12" (năm của hôm nay) · ISO "2027-12-31".
 */
export function parseTypedDate(text: string, today: string): string {
  const t = text.trim();
  if (!t) return "";
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[\s/.-]+(\d{1,2})(?:[\s/.-]+(\d{2}|\d{4}))?$/.exec(t);
  if (m) return valid(m[3] ? fullYear(m[3]) : Number(today.slice(0, 4)), Number(m[2]), Number(m[1]));
  m = /^(\d{2})(\d{2})(\d{4}|\d{2})$/.exec(t);
  if (m) return valid(fullYear(m[3]), Number(m[2]), Number(m[1]));
  return "";
}

/** Khoảng năm của ô chọn Năm trên lịch: quanh hôm nay ±15 năm, mở rộng để chứa ngày đang chọn / giới hạn min-max. */
export function calendarYearRange(today: string, ...dates: (string | undefined)[]): { from: number; to: number } {
  const ys = [Number(today.slice(0, 4)), ...dates.filter(Boolean).map((d) => Number(d!.slice(0, 4)))].filter((y) => y > 0);
  const base = Number(today.slice(0, 4));
  return { from: Math.min(base - 15, ...ys), to: Math.max(base + 15, ...ys) };
}
