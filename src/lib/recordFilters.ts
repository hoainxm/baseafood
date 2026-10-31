// ============================================================
// Tên file: src/lib/recordFilters.ts
// Tên tiếng Việt: Bộ lọc sổ / bảng — so khớp ô tra, đếm trạng thái, đếm điều kiện
// Description: Pure helpers behind FilterBar / SearchField (ba-spec docs/app-map/53-filters.ba-spec.md):
//              diacritic-insensitive search (R3), AND of conditions (R4), status option counts (R2),
//              active-condition count for "Bỏ hết bộ lọc (N)" (R6). Display only — never changes ledger data.
// ============================================================

/** Giá trị "Tất cả" của mọi ô lọc một giá trị. */
export const ALL = "";

/** Chuẩn hóa để so: bỏ dấu tiếng Việt, đ → d, chữ thường, gộp khoảng trắng. */
export function foldText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * R3: dòng khớp ô tra khi MỌI từ gõ đều là chuỗi con của chữ dòng (bỏ dấu, không phân hoa thường).
 * Ô tra trống ⇒ mọi dòng khớp.
 */
export function matchesSearch(query: string, ...texts: (string | number | null | undefined)[]): boolean {
  const q = foldText(query);
  if (!q) return true;
  const hay = foldText(texts.filter((t) => t != null && t !== "").join(" "));
  return q.split(" ").every((w) => hay.includes(w));
}

/** Ô lọc một giá trị: "Tất cả" (rỗng) ⇒ khớp; khác ⇒ so bằng. */
export const matchesValue = (selected: string, value: string | null | undefined): boolean => selected === ALL || selected === (value ?? "");

/** R4: lọc AND — mỗi điều kiện là một hàm, dòng phải qua hết. */
export function filterRows<T>(rows: readonly T[], conditions: readonly ((row: T) => boolean)[]): T[] {
  return conditions.length ? rows.filter((r) => conditions.every((c) => c(r))) : [...rows];
}

/** R6: số điều kiện đang bật (khác mặc định) — cho nhãn "Bỏ hết bộ lọc (N)". */
export function activeFilterCount(values: readonly (string | boolean | null | undefined)[]): number {
  return values.filter((v) => (typeof v === "string" ? v.trim() !== "" : !!v)).length;
}

export interface CountedOption {
  value: string;
  label: string;
  count: number;
}

/**
 * R2: lựa chọn trạng thái kèm số đếm: "Tất cả" đầu tiên rồi từng trạng thái theo thứ tự `order`
 * (trạng thái không có dòng nào vẫn hiện với 0 để người dùng biết có trạng thái đó).
 */
export function statusOptions<T>(
  rows: readonly T[],
  statusOf: (row: T) => string,
  order: readonly { value: string; label: string }[],
  allLabel = "Tất cả",
): CountedOption[] {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(statusOf(r), (counts.get(statusOf(r)) ?? 0) + 1);
  return [{ value: ALL, label: allLabel, count: rows.length }, ...order.map((o) => ({ ...o, count: counts.get(o.value) ?? 0 }))];
}

/** Nhãn lựa chọn có số: "Đang gom (3)". */
export const countedLabel = (o: CountedOption): string => `${o.label} (${o.count.toLocaleString("vi-VN")})`;
