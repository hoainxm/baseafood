// ============================================================
// Tên file: src/lib/format.ts
// Tên tiếng Việt tương đương: Định dạng Số & Ngày tháng Locale vi-VN
// Description: Formatting helpers for numbers, currency, dates, and weights (kg)
// ============================================================
const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/**
 * Số làm tròn 2 số lẻ ra 0 (kể cả −0 và sai số cộng trừ số thực như −5,55e−17) ⇒ 0,
 * kẻo Intl in "-0" (tồn cuối = đầu + nhập − xuất hay dư một vụn âm cực nhỏ).
 */
export const chuan0 = (v: number) => (Math.abs(v) < 0.005 ? 0 : v);

/** Số khối lượng/tiền theo locale vi-VN, cắt tối đa 2 số lẻ. */
export function num(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "";
  return nf.format(chuan0(v));
}

/** kg hiển thị kèm đơn vị. */
export function kg(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "";
  return `${nf.format(chuan0(v))} kg`;
}

/** yyyy-mm-dd hôm nay theo giờ máy. */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** yyyy-mm-dd -> dd/mm/yyyy */
export function formatDateVN(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Tiền ngoại tệ (USD…) đủ 2 số lẻ kiểu vi-VN: 194557.6 → "194.557,60"; null → "". */
export function formatMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return chuan0(v).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
