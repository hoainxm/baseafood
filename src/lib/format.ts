const nf = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });

/** Số khối lượng/tiền theo locale vi-VN, cắt tối đa 2 số lẻ. */
export function num(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "";
  return nf.format(v);
}

/** kg hiển thị kèm đơn vị. */
export function kg(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "";
  return `${nf.format(v)} kg`;
}

/** yyyy-mm-dd hôm nay theo giờ máy. */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** yyyy-mm-dd -> dd/mm/yyyy */
export function viDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
