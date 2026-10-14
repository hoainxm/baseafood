// ============================================================
// Tên file: src/design-system/patterns/rowMarkSource.ts
// Tên tiếng Việt: Tô màu dòng — hợp đồng dữ liệu + hook (không phải component)
// Description: Row highlight context, palette, hooks (components in RowMarkToolbar.tsx)
// ============================================================
import * as React from "react";

/*
 * MỘT cách dùng, giống Excel: tick các dòng → thanh "Đã chọn N dòng" → Tô màu ▾ /
 * In đậm / Bỏ tô áp cho mọi dòng đang tick. Design-system CHỈ định nghĩa hợp đồng
 * `RowMarkSource`; đọc/ghi dấu do app cấp qua `RowMarkContext` — provider ở
 * `features/shared/RowMarkProvider.tsx` nối bảng `row_marks`. Luật: README § Tô màu dòng.
 */

/* ---------- Bảng màu kiểu Excel: 10 sắc × 5 mức (1 rất nhạt → 5 rất đậm) ----------
   Mã lưu DB = "<sắc>-<mức>" (VD "vang-5"). Màu thật ở token `--to-<mã>` (tokens.css).
   Khớp `SAC_TO_LIB` ở lib/rowMarks.ts — test rowMarkSource.test.ts canh. */
export const MARK_COLORS = [
  { code: "xam", label: "xám" },
  { code: "do", label: "đỏ" },
  { code: "cam", label: "cam" },
  { code: "vang", label: "vàng" },
  { code: "chuoi", label: "xanh nõn chuối" },
  { code: "la", label: "xanh lá" },
  { code: "troi", label: "xanh da trời" },
  { code: "duong", label: "xanh dương" },
  { code: "tim", label: "tím" },
  { code: "hong", label: "hồng" },
] as const;
export const MARK_SHADES = ["rất nhạt", "nhạt", "vừa", "đậm", "rất đậm"] as const;

export type MarkColorDef = (typeof MARK_COLORS)[number]["code"];
export type MarkColor = `${MarkColorDef}-${1 | 2 | 3 | 4 | 5}`;

/** Ô nền "tối" (độ chói < 0,68) ⇒ chữ phụ/chữ màu trong dòng về màu chữ thường. */
export const DARK_MARK_COLORS: ReadonlySet<string> = new Set([
  "xam-3", "xam-4", "xam-5", "do-2", "do-3", "do-4", "do-5", "cam-3", "cam-4", "cam-5",
  "chuoi-4", "chuoi-5", "la-3", "la-4", "la-5", "troi-3", "troi-4", "troi-5",
  "duong-2", "duong-3", "duong-4", "duong-5", "tim-3", "tim-4", "tim-5",
  "hong-3", "hong-4", "hong-5",
]);

/** Lưới bảng chọn: HÀNG = mức (nhạt → đậm), CỘT = sắc — như bảng màu Excel. */
export const MARK_COLOR_GRID: MarkColor[][] = MARK_SHADES.map((_, i) =>
  MARK_COLORS.map((s) => `${s.code}-${(i + 1) as 1 | 2 | 3 | 4 | 5}` as MarkColor)
);

/** "vàng rất đậm", "xanh lá nhạt"… — cho aria-label / title. */
export function getMarkColorName(code: string): string {
  const i = code.lastIndexOf("-");
  const s = MARK_COLORS.find((x) => x.code === code.slice(0, i));
  const shadeLevel = MARK_SHADES[Number(code.slice(i + 1)) - 1];
  return s && shadeLevel ? `${s.label} ${shadeLevel}` : "";
}

/** Dấu của một dòng. `mau` rỗng = chỉ in đậm. */
export interface MarkStyle {
  color: MarkColor | "";
  bold: boolean;
}

/** Hợp đồng app cấp cho design-system — đọc/ghi dấu theo khoá bảng. */
export interface RowMarkSource {
  /** Dấu CẢ DÒNG của một bảng: Map(khoá dòng → dấu). Bảng chưa có dấu ⇒ Map rỗng. */
  getTableMarks: (tableKey: string) => ReadonlyMap<string, MarkStyle>;
  /** Đặt dấu cho nhiều dòng một lượt. `null` = bỏ tô (xoá dấu). */
  setMarks: (tableKey: string, rowKeys: string[], mark: MarkStyle | null) => void;
}

export const RowMarkContext = React.createContext<RowMarkSource | null>(null);

const EMPTY_MARKS: ReadonlyMap<string, MarkStyle> = new Map();

/** Vá dấu: chỉ đổi phần được nêu (màu HOẶC in đậm), phần kia giữ theo từng dòng. */
export type MarkStylePatch = Partial<MarkStyle>;

/** Áp vá lên dấu cũ ⇒ dấu mới (null = hết dấu). */
export function applyMarkPatch(prev: MarkStyle | undefined | null, patch: MarkStylePatch | null): MarkStyle | null {
  if (!patch) return null;
  const mark = { color: patch.color ?? prev?.color ?? "", bold: patch.bold ?? prev?.bold ?? false };
  return mark.color || mark.bold ? mark : null;
}

export interface RowMarkTools {
  /** Có tô được không (có provider + màn đã khai khoá bảng). */
  enabled: boolean;
  getMark: (key: string) => MarkStyle | undefined;
  /**
   * Vá dấu các dòng. `null` = bỏ tô. Đổi màu giữ nguyên in đậm của TỪNG dòng (và
   * ngược lại). Không bắn thông báo — thao tác trình bày (README luật 8).
   */
  patch: (key: string[], patch: MarkStylePatch | null) => void;
  /** Thuộc tính gắn lên `<tr>` / thẻ để nền + chữ đậm ăn theo dấu. */
  getRowProps: (key: string) => Record<string, unknown>;
}

/** Gom các dòng theo dấu đích ⇒ mỗi nhóm một lần ghi. */
function groupByMark(cap: [string, MarkStyle | null][]) {
  const groups = new Map<string, { mark: MarkStyle | null; keys: string[] }>();
  for (const [k, d] of cap) {
    const kk = JSON.stringify(d);
    const g = groups.get(kk) ?? { mark: d, keys: [] };
    g.keys.push(k);
    groups.set(kk, g);
  }
  return [...groups.values()];
}

/**
 * Hook tô màu của MỘT bảng. `maBang` = khoá ổn định của bảng (VD "ton-kho-thang")
 * — đổi khoá là mất dấu cũ, nên đặt một lần rồi để yên. Bỏ trống ⇒ tắt.
 */
export function useRowMarkTools(tableKey?: string): RowMarkTools {
  const source = React.useContext(RowMarkContext);
  const bat = Boolean(source && tableKey);
  const map = bat && source && tableKey ? source.getTableMarks(tableKey) : EMPTY_MARKS;

  return React.useMemo<RowMarkTools>(() => {
    const update = (key: string[], patch: MarkStylePatch | null) => {
      const items = [...new Set(key)];
      if (!source || !tableKey || items.length === 0) return;
      const prev = items.map((k) => [k, map.get(k) ?? null] as [string, MarkStyle | null]);
      const nextMarks = prev.map(([k, d]) => [k, applyMarkPatch(d, patch)] as [string, MarkStyle | null]);
      // KHÔNG toast (README luật 8): tô màu / in đậm là dấu trình bày, không đổi số
      // sổ sách — màu dòng đổi ngay trước mắt đã là phản hồi; muốn gỡ thì Bỏ tô.
      for (const g of groupByMark(nextMarks)) source.setMarks(tableKey, g.keys, g.mark);
    };
    return {
      enabled: bat,
      getMark: (k) => map.get(k),
      patch: update,
      getRowProps: (k) => {
        const d = map.get(k);
        if (!d) return {};
        return {
          ...(d.color ? { "data-marked": d.color, style: { "--mark-bg": `var(--to-${d.color})` } } : {}),
          ...(d.color && DARK_MARK_COLORS.has(d.color) ? { "data-mark-dark": "" } : {}),
          ...(d.bold ? { "data-bold": "" } : {}),
        };
      },
    };
  }, [bat, map, source, tableKey]);
}

/**
 * Tick chọn dòng do BẢNG tự giữ (khi màn không truyền `chon` riêng). Shift+tick
 * chọn cả khoảng từ dòng tick trước — như Shift+bấm ở Excel.
 */
export function useRowSelection() {
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(() => new Set());
  const neo = React.useRef<string | null>(null);
  /** Tick/bỏ một dòng; `shift` + `thuTu` (khoá đang hiện) ⇒ đặt cả khoảng theo dòng vừa bấm. */
  const toggle = React.useCallback((k: string, shift = false, order: string[] = []) => {
    const a = neo.current ? order.indexOf(neo.current) : -1;
    neo.current = k;
    setSelected((prev) => {
      const n = new Set(prev);
      const bat = !prev.has(k);
      const b = order.indexOf(k);
      if (shift && a >= 0 && b >= 0) {
        for (const x of order.slice(Math.min(a, b), Math.max(a, b) + 1)) {
          if (bat) n.add(x);
          else n.delete(x);
        }
      } else if (bat) n.add(k);
      else n.delete(k);
      return n;
    });
  }, []);
  const toggleAll = React.useCallback((keys: string[], bat: boolean) => {
    setSelected((prev) => {
      const n = new Set(prev);
      for (const k of keys) {
        if (bat) n.add(k);
        else n.delete(k);
      }
      return n;
    });
  }, []);
  const clearSelection = React.useCallback(() => setSelected(new Set()), []);
  return { selected, toggle, toggleAll, clearSelection };
}
