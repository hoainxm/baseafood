// ============================================================
// Tên file: src/design-system/patterns/SortableHeader.tsx
// Tên tiếng Việt: Tên cột bấm để sắp xếp + hook giữ trạng thái sắp
// Dùng chung cho SummaryTable / RecordTable và bảng tự dựng ở features.
// Luật: README § Sắp xếp cột.
// ============================================================
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  inferSortKind,
  SORT_LABELS,
  sortRows,
  type SortDirection,
  type SortKind,
  type SortValue,
} from "./tableSort";

/** Một cột theo góc nhìn sắp xếp. */
export interface SortColumnSpec<T> {
  key: string;
  /** false ⇒ cột không sắp (cột nút, ảnh, ô tick…). */
  sortable?: boolean;
  /** Bỏ trống ⇒ cột `numeric` là số, còn lại đoán từ chữ đang hiện. */
  sortKind?: SortKind;
  numeric?: boolean;
  getValue: (row: T) => SortValue;
}

export interface TableSortState {
  key: string;
  dir: SortDirection;
}

/** Số dòng đem đi đoán kiểu cột — đủ để biết cột là ngày/số/chữ mà khỏi đọc cả sổ dài. */
const INFER_SAMPLE = 40;

/**
 * Giữ trạng thái sắp của một bảng. Bấm tên cột: lần 1 tăng (A → Z · bé → lớn · cũ → mới),
 * lần 2 giảm, lần 3 về THỨ TỰ GỐC của màn.
 *
 * Thứ tự đã sắp ĐỨNG YÊN khi chỉ số trong dòng đổi (gõ số ngay trên bảng không làm dòng
 * nhảy đi chỗ khác — như Excel: sắp là một lần bấm, không tự sắp lại). Thêm / bớt dòng
 * (lọc, thêm dòng mới) ⇒ sắp lại theo cột đang chọn.
 */
export function useTableSort<T>(
  rows: readonly T[],
  getKey: (row: T, i: number) => string,
  columns: readonly SortColumnSpec<T>[],
  enabled = true
) {
  const [sort, setSort] = React.useState<TableSortState | null>(null);

  const isSortable = (c: SortColumnSpec<T>) => enabled && c.sortable !== false;
  const kindOf = (c: SortColumnSpec<T>): SortKind =>
    c.sortKind ??
    (c.numeric
      ? "number"
      : inferSortKind(rows.slice(0, INFER_SAMPLE).map((r) => {
          const v = c.getValue(r);
          return v == null ? "" : String(v);
        })));

  const active = sort && enabled ? columns.find((c) => c.key === sort.key && isSortable(c)) : undefined;
  const keys = rows.map((r, i) => getKey(r, i));
  const unique = new Set(keys).size === keys.length;
  // Tập khoá dòng (không kể thứ tự): chỉ đổi khi thêm / bớt dòng ⇒ sắp lại; số trong dòng
  // đổi thì giữ thứ tự cũ. Khoá trùng ⇒ không giữ được thứ tự theo khoá, sắp lại mỗi lần.
  const rowSet = active && unique ? [...keys].sort().join("\u0001") : rows;
  const order = React.useMemo(
    () => {
      if (!sort || !active) return null;
      const sortedRows = sortRows(rows, active.getValue, kindOf(active), sort.dir);
      if (!unique) return { rows: sortedRows };
      const keyOf = new Map(rows.map((r, i) => [r, keys[i]]));
      return { keys: sortedRows.map((r) => keyOf.get(r) as string) };
    },
    // Cố ý KHÔNG theo `rows` khi khoá không đổi — đó là "thứ tự đứng yên khi sửa số".
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort?.key, sort?.dir, Boolean(active), rowSet]
  );
  let sorted: readonly T[] = rows;
  if (order && "rows" in order) sorted = order.rows ?? rows;
  else if (order) {
    const byKey = new Map(rows.map((r, i) => [keys[i], r]));
    sorted = order.keys.flatMap((k) => (byKey.has(k) ? [byKey.get(k) as T] : []));
  }

  const directionOf = (key: string): SortDirection | null => (active && sort?.key === key ? sort.dir : null);
  const toggle = (key: string) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));

  return {
    /** Dòng theo thứ tự đang chọn (chưa sắp ⇒ đúng mảng gốc). */
    rows: sorted,
    sort: active ? sort : null,
    toggle,
    reset: () => setSort(null),
    /** Cột (theo key) có sắp được không. */
    isSortable: (key: string) => columns.some((c) => c.key === key && isSortable(c)),
    /** Kiểu sắp của cột (theo key) — chọn chữ tooltip / nhãn. */
    kindOf: (key: string): SortKind => {
      const c = columns.find((x) => x.key === key);
      return c ? kindOf(c) : "text";
    },
    /** Chiều đang sắp của cột (null = cột này không đang sắp). */
    directionOf,
    /** `aria-sort` cho ô `<th>` của cột. */
    ariaSortOf: (key: string) => ariaSort(directionOf(key)),
    /**
     * Tên cột bấm được — cho BẢNG TỰ DỰNG ở features: `<th aria-sort={s.ariaSortOf("kg")}>
     * {s.header("kg", "Kg", "right")}</th>`. Cột không sắp được ⇒ trả chữ thường.
     */
    header: (key: string, label: string, align: "left" | "right" | "center" = "left") => {
      const c = columns.find((x) => x.key === key);
      if (!c || !isSortable(c)) return label;
      return <SortHeaderButton label={label} kind={kindOf(c)} direction={directionOf(key)} onToggle={() => toggle(key)} align={align} />;
    },
  };
}

/** Giá trị `aria-sort` cho ô tên cột. */
export function ariaSort(dir: SortDirection | null): "ascending" | "descending" | undefined {
  return dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined;
}

/** Câu tooltip của tên cột — nói rõ bấm sẽ xếp kiểu gì. */
export function sortHint(label: string, kind: SortKind, dir: SortDirection | null): string {
  const l = SORT_LABELS[kind];
  if (dir === "asc") return `Đang xếp "${label}" ${l.asc}. Bấm để đảo ${l.desc}.`;
  if (dir === "desc") return `Đang xếp "${label}" ${l.desc}. Bấm để bỏ sắp, về thứ tự gốc.`;
  return `Bấm để sắp theo "${label}": ${l.asc} (bấm lại để đảo ${l.desc}).`;
}

/**
 * Tên cột bấm được để sắp. Đặt BÊN TRONG ô `<th>` (ô giữ `aria-sort={ariaSort(dir)}`).
 * Mũi tên: ↑ đang tăng · ↓ đang giảm · ⇅ mờ = sắp được, chưa sắp.
 */
export function SortHeaderButton({
  label,
  children,
  kind,
  direction,
  onToggle,
  align = "left",
  className,
  tabIndex,
}: {
  /** Tên cột dạng chữ (cho tooltip). */
  label: string;
  /** Nội dung hiển thị — bỏ trống thì dùng `label`. */
  children?: React.ReactNode;
  kind: SortKind;
  direction: SortDirection | null;
  onToggle: () => void;
  align?: "left" | "right" | "center";
  className?: string;
  tabIndex?: number;
}) {
  const Icon = direction === "asc" ? ArrowUp : direction === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={tabIndex}
      title={sortHint(label, kind, direction)}
      className={cn(
        "group/sort inline-flex max-w-full items-center gap-1 rounded-sm text-left font-[inherit] leading-[inherit] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        align === "right" && "flex-row-reverse text-right",
        align === "center" && "justify-center text-center",
        className
      )}
    >
      <span className="min-w-0">{children ?? label}</span>
      <Icon
        aria-hidden
        className={cn(
          "size-3.5 shrink-0",
          direction ? "text-primary" : "text-muted-foreground/50 group-hover/sort:text-muted-foreground"
        )}
      />
    </button>
  );
}
