// ============================================================
// Tên file: src/design-system/patterns/tableSort.ts
// Tên tiếng Việt: Sắp xếp cột bảng theo kiểu dữ liệu
// Hàm THUẦN (không hook) — test ở tableSort.test.ts. Luật: README § Sắp xếp cột.
// ============================================================
import * as React from "react";
import { parseVnNumber } from "./numberExpression";

/**
 * Kiểu sắp của một cột — mỗi kiểu một cách so:
 *  - `text`   chữ theo bảng chữ cái tiếng Việt (A → Z), số trong chữ so theo giá trị ("Lô 2" < "Lô 10");
 *  - `number` số bé → lớn (đọc được "1.234,5 kg", "(2.000)" = âm, "12%");
 *  - `date`   ngày cũ → mới (ISO "2026-10-05", "05/10/2026", "05/10", "10/2026", có giờ phía sau cũng được);
 *  - `rank`   cột trạng thái / mức: xếp theo THỨ TỰ NGHIỆP VỤ (nặng → nhẹ, "Sổ sai" trước "Để biết"),
 *             không theo chữ cái — màn khai `sortValue` trả số thứ tự (0 = đứng đầu).
 */
export type SortKind = "text" | "number" | "date" | "rank";
export type SortDirection = "asc" | "desc";
export type SortValue = string | number | null | undefined;

/** Nhãn hai chiều theo kiểu — dùng cho tooltip + thanh "Sắp theo" trên thẻ điện thoại. */
export const SORT_LABELS: Record<SortKind, Record<SortDirection, string>> = {
  text: { asc: "A → Z", desc: "Z → A" },
  number: { asc: "bé → lớn", desc: "lớn → bé" },
  date: { asc: "cũ → mới", desc: "mới → cũ" },
  rank: { asc: "theo mức (gấp trước)", desc: "ngược mức (gấp sau)" },
};

const collator = new Intl.Collator("vi", { numeric: true });

/** Chữ đang hiện trong một ô (ReactNode) — để sắp cột không khai `sortValue`. */
export function nodeText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).filter(Boolean).join(" ");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode; value?: unknown };
    const inner = nodeText(props.children);
    if (inner) return inner;
    // Ô nhập (input/ô số tự dựng) không có children — lấy giá trị đang hiện.
    if (typeof props.value === "string" || typeof props.value === "number") return String(props.value);
  }
  return "";
}

/** Chữ coi như "không có số": rỗng, gạch ngang, "chưa có"… ⇒ luôn xếp cuối. */
function isBlankText(s: string): boolean {
  return /^[\s\-–—·.]*$/.test(s);
}

/** "1.234,5 kg" → 1234.5 · "(2.000)" → −2000 · "−12" → −12 · "12%" → 12 · không có số → null. */
export function parseSortNumber(raw: string): number | null {
  const t = raw.replace(/[  ]/g, " ").replace(/−/g, "-").trim();
  if (isBlankText(t)) return null;
  const m = t.match(/(\()?\s*([-+]?)\s*(\d[\d.,\s]*\d|\d)/);
  if (!m) return null;
  const n = parseVnNumber(m[3]);
  if (n == null) return null;
  return m[1] || m[2] === "-" ? -n : n;
}

/**
 * Chữ ngày → số so được (yyyymmddhhmm). Năm thiếu ("05/10") ⇒ coi là năm 0 — vẫn đúng
 * thứ tự trong cùng một bảng (bảng chỉ có ngày-tháng thì cùng năm). Không phải ngày → null.
 */
export function parseSortDate(raw: string): number | null {
  // Giờ ĐỨNG TRƯỚC ngày (kiểu vi-VN "14:30:05 5/10/2026").
  const lead = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s+(.+)$/);
  if (lead) {
    const day = parseSortDate(lead[3]);
    return day == null ? null : day - (day % 10000) + Number(lead[1]) * 60 + Number(lead[2]);
  }
  const t = raw.trim().replace(/^(tháng|t)\s*/i, "");
  let y = 0;
  let mo = 0;
  let d = 0;
  let rest = "";
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?(.*)$/))) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)];
    rest = m[4];
  } else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?!\d)(.*)$/))) {
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3].length === 2 ? `20${m[3]}` : m[3])];
    rest = m[4];
  } else if ((m = t.match(/^(\d{1,2})[/-](\d{4})(?!\d)(.*)$/))) {
    [mo, y] = [Number(m[1]), Number(m[2])];
    rest = m[3];
  } else if ((m = t.match(/^(\d{1,2})\/(\d{1,2})(?![\d/])(.*)$/))) {
    [d, mo] = [Number(m[1]), Number(m[2])];
    rest = m[3];
  } else return null;
  if (mo < 1 || mo > 12 || d > 31) return null;
  // Giờ phía sau ("05/10/2026 14:30" · "2026-10-05T14:30").
  const time = rest.match(/^[T\s,·]*(\d{1,2}):(\d{2})/);
  const hm = time ? Number(time[1]) * 60 + Number(time[2]) : 0;
  return ((y * 100 + mo) * 100 + d) * 10000 + hm;
}

/** Đoán kiểu cột từ chữ đang hiện: mọi ô có chữ đều là ngày ⇒ date; đều là số ⇒ number; còn lại text. */
export function inferSortKind(samples: string[]): SortKind {
  const filled = samples.filter((s) => !isBlankText(s));
  if (filled.length === 0) return "text";
  if (filled.every((s) => parseSortDate(s) != null)) return "date";
  // "Số" phải là cả chuỗi số (kèm đơn vị ngắn) — "Lô 12 cá ngừ" là chữ.
  if (filled.every((s) => /^[(\s]*[-+−]?\s*\d[\d.,\s]*\)?\s*(%|kg|đ|₫|block|khối|thùng|kiện|bao)?\.?$/i.test(s.replace(/[  ]/g, " ").trim())))
    return "number";
  return "text";
}

/** Đổi một giá trị thô về khoá so theo kiểu. null = ô trống (luôn xếp cuối). */
export function toSortKey(value: SortValue, kind: SortKind): string | number | null {
  if (value == null) return null;
  if (kind === "number" || kind === "rank") {
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    return parseSortNumber(value);
  }
  const s = String(value);
  if (kind === "date") return parseSortDate(s) ?? (isBlankText(s) ? null : s);
  return isBlankText(s) ? null : s.trim();
}

/** So hai khoá đã đổi: ô trống luôn xếp CUỐI dù tăng hay giảm. */
export function compareSortKeys(a: string | number | null, b: string | number | null, dir: SortDirection): number {
  if (a == null || b == null) return a == null ? (b == null ? 0 : 1) : -1;
  let cmp: number;
  if (typeof a === "number" && typeof b === "number") cmp = a - b;
  else if (typeof a === "number") cmp = -1; // ngày đọc được đứng trước chữ lạ
  else if (typeof b === "number") cmp = 1;
  else cmp = collator.compare(a, b);
  return dir === "asc" ? cmp : -cmp;
}

/** Sắp ỔN ĐỊNH (dòng bằng nhau giữ thứ tự gốc). */
export function sortRows<T>(rows: readonly T[], getValue: (row: T) => SortValue, kind: SortKind, dir: SortDirection): T[] {
  const keyed = rows.map((row, i) => ({ row, i, k: toSortKey(getValue(row), kind) }));
  keyed.sort((x, y) => compareSortKeys(x.k, y.k, dir) || x.i - y.i);
  return keyed.map((x) => x.row);
}
