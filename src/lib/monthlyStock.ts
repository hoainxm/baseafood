// ============================================================
// Tên file: src/lib/monthlyStock.ts
// Tên tiếng Việt: Sổ kho theo THÁNG — hàm thuần (dồn tồn cuối kỳ → đầu kỳ sau)
// Description: Monthly stock ledger — pure helpers (carry closing → next opening)
// ============================================================
import type { MonthlyStockLine } from "@/types";
import { MONTHLY_STOCK_CATEGORIES } from "@/types";

/**
 * Toàn bộ TOÁN của sổ kho theo tháng nằm ở đây — thuần, không React, dễ đối chiếu
 * tay với "bảng kê kho" thật. Quy tắc chính xác nằm DUY NHẤT ở file này.
 *
 * Bất biến: Tồn cuối = Tồn đầu + Nhập − Xuất (cho CẢ kiện và kg). Tồn cuối KHÔNG
 * lưu — suy tại đây nên luôn khớp. Chỉ tồn ĐẦU kỳ được lưu (snapshot kế thừa).
 */

export interface MonthlyStockRow extends MonthlyStockLine {
  closeCtn: number;
  closeKg: number;
  /** Tiền còn lại = tồn cuối (kg) × đơn giá. */
  remainingValue: number;
}

export interface MonthlyStockTotals {
  openCtn: number;
  openKg: number;
  inCtn: number;
  inKg: number;
  outCtn: number;
  outKg: number;
  closeCtn: number;
  closeKg: number;
  remainingValue: number;
  rowCount: number;
}

/** Suy tồn cuối + tiền còn lại cho một dòng (không lưu, luôn tính lại). */
export function deriveRow(l: MonthlyStockLine): MonthlyStockRow {
  const closeCtn = l.openCtn + l.inCtn - l.outCtn;
  const closeKg = l.openKg + l.inKg - l.outKg;
  return {
    ...l,
    closeCtn,
    closeKg,
    remainingValue: closeKg * (l.unitPrice ?? 0),
  };
}

/** Cộng tổng một tập dòng (mỗi dòng độc lập trong cùng một tháng ⇒ cộng thẳng). */
export function sumMonthlyStockRows(rows: MonthlyStockRow[]): MonthlyStockTotals {
  const t: MonthlyStockTotals = {
    openCtn: 0, openKg: 0, inCtn: 0, inKg: 0, outCtn: 0, outKg: 0,
    closeCtn: 0, closeKg: 0, remainingValue: 0, rowCount: rows.length,
  };
  for (const r of rows) {
    t.openCtn += r.openCtn; t.openKg += r.openKg;
    t.inCtn += r.inCtn; t.inKg += r.inKg;
    t.outCtn += r.outCtn; t.outKg += r.outKg;
    t.closeCtn += r.closeCtn; t.closeKg += r.closeKg;
    t.remainingValue += r.remainingValue;
  }
  return t;
}

/* ---------- Tháng dương lịch ---------- */

/** Tháng hiện tại theo giờ máy, dạng 'YYYY-MM'. */
export function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYY-MM' → tháng kế tiếp (qua năm khi tháng 12). */
export function getNextMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYY-MM' → tháng liền trước. */
export function getPrevMonth(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 'YYYY-MM' → "Tháng 7/2026". */
export function formatMonthLabel(period: string): string {
  const [y, m] = period.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/**
 * Danh sách N tháng gần đây (mới → cũ) từ mốc `moc` (mặc định tháng hiện tại),
 * hợp nhất với mọi tháng đã có dữ liệu để không bao giờ thiếu kỳ nào trong sổ.
 */
export function listMonths(existingMonths: string[], anchor = getCurrentMonth(), monthCount = 24): string[] {
  const set = new Set<string>(existingMonths);
  let p = anchor;
  for (let i = 0; i < monthCount; i++) {
    set.add(p);
    p = getPrevMonth(p);
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

/* ---------- Gom nhóm hiển thị (như các "TỔNG" của bảng kê) ---------- */

export interface StockCategoryGroup {
  category: string;
  rows: MonthlyStockRow[];
  totals: MonthlyStockTotals;
}

/* ---------- Loài trong từng bảng: chia nhóm + thứ tự dòng (2026-10-27) ---------- */

/**
 * Thứ tự LOÀI trong mỗi bảng của sổ: cá trên, bạch tuộc dưới (kế toán chốt 2026-10-27), rồi
 * các loài khác theo danh sách chuẩn, "Khác" cuối. Loài lạ (gõ tay ở danh mục) xếp ngay trước "Khác".
 */
export const SPECIES_DISPLAY_ORDER = ["Cá", "Bạch tuộc", "Mực", "Tôm", "Ghẹ", "Bào ngư", "Khác"] as const;

export function speciesRank(species: string): number {
  const i = (SPECIES_DISPLAY_ORDER as readonly string[]).indexOf(species);
  return i === -1 ? SPECIES_DISPLAY_ORDER.length - 1.5 : i;
}

/**
 * Hàm "loài của tên hàng" cho sổ kho: tên trùng (không phân hoa thường, bỏ khoảng trắng thừa)
 * với loại NL / mặt hàng trong danh mục ⇒ loài của danh mục (sửa được ở Danh mục); danh mục
 * không có hoặc để "Khác" ⇒ đoán từ tên (`inferMaterialCategory`).
 */
export function buildSpeciesLookup(
  ...catalogs: readonly { name: string; category?: string }[][]
): (itemName: string) => string {
  const byName = new Map<string, string>();
  for (const list of catalogs)
    for (const x of list) {
      const k = normalizeForMatch(x.name);
      const c = (x.category ?? "").trim();
      if (k && c && c !== "Khác" && !byName.has(k)) byName.set(k, c);
    }
  return (itemName) => byName.get(normalizeForMatch(itemName)) ?? inferMaterialCategory(itemName);
}

const nameCollator = new Intl.Collator("vi", { numeric: true });

/** Thứ tự dòng trong MỘT bảng: loài (cá trên, bạch tuộc dưới) → thứ tự người dùng xếp → tên. */
export function compareStockRowsBySpecies(
  speciesOf: (itemName: string) => string
): (a: Pick<MonthlyStockLine, "itemName" | "sortOrder">, b: Pick<MonthlyStockLine, "itemName" | "sortOrder">) => number {
  return (a, b) =>
    speciesRank(speciesOf(a.itemName)) - speciesRank(speciesOf(b.itemName)) ||
    a.sortOrder - b.sortOrder ||
    nameCollator.compare(a.itemName, b.itemName);
}

/** Đánh lại `sortOrder` = vị trí trong `orderedIds` (chỉ dòng có trong danh sách, chỉ dòng đổi số). */
function renumber(lines: MonthlyStockLine[], orderedIds: readonly string[]): MonthlyStockLine[] {
  const at = new Map(orderedIds.map((id, i) => [id, i]));
  let changed = false;
  const next = lines.map((l) => {
    const i = at.get(l.id);
    if (i == null || l.sortOrder === i) return l;
    changed = true;
    return { ...l, sortOrder: i };
  });
  return changed ? next : lines;
}

/**
 * XẾP DÒNG TUỲ CHỈNH: đưa dòng `rowId` lên (−1) / xuống (+1) một bậc. `orderedIds` = thứ tự
 * của CẢ bảng (mọi dòng của nhóm trong tháng); `visibleIds` = dòng đang hiện khi có lọc (tìm,
 * ẩn dòng trống, một kho) — đổi chỗ với dòng hiện liền kề, dòng ẩn đứng yên. Chỉ đổi chỗ với
 * dòng CÙNG LOÀI — loài vẫn theo thứ tự mặc định. Đầu / cuối nhóm loài ⇒ null. Ghi bằng
 * `sortOrder` (dồn kỳ mang theo sang tháng sau). Không đụng số kg.
 */
export function moveStockRow(
  lines: MonthlyStockLine[],
  orderedIds: readonly string[],
  rowId: string,
  step: -1 | 1,
  speciesOf: (itemName: string) => string,
  visibleIds: readonly string[] = orderedIds
): MonthlyStockLine[] | null {
  const v = visibleIds.indexOf(rowId);
  const neighbor = v === -1 ? undefined : visibleIds[v + step];
  const i = orderedIds.indexOf(rowId);
  const j = neighbor == null ? -1 : orderedIds.indexOf(neighbor);
  if (i === -1 || j === -1) return null;
  const nameOf = new Map(lines.map((l) => [l.id, l.itemName]));
  if (speciesOf(nameOf.get(rowId) ?? "") !== speciesOf(nameOf.get(neighbor as string) ?? "")) return null;
  const ids = [...orderedIds];
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return renumber(lines, ids);
}

/** Về thứ tự MẶC ĐỊNH của một bảng: loài (cá trên, bạch tuộc dưới) rồi tên A → Z, size, invoice. */
export function resetStockRowOrder(
  lines: MonthlyStockLine[],
  ids: readonly string[],
  speciesOf: (itemName: string) => string
): MonthlyStockLine[] {
  const wanted = new Set(ids);
  const ordered = lines
    .filter((l) => wanted.has(l.id))
    .sort(
      (a, b) =>
        speciesRank(speciesOf(a.itemName)) - speciesRank(speciesOf(b.itemName)) ||
        nameCollator.compare(a.itemName, b.itemName) ||
        nameCollator.compare(a.size, b.size) ||
        nameCollator.compare(a.origin, b.origin)
    )
    .map((l) => l.id);
  return renumber(lines, ordered);
}

/** Một ô loài trong bảng (cá riêng, bạch tuộc riêng…) + dòng cộng riêng của loài. */
export interface StockSpeciesGroup {
  species: string;
  rows: MonthlyStockRow[];
  totals: MonthlyStockTotals;
}

/**
 * Chia dòng của MỘT bảng theo loài (kế toán 2026-10-27: "làm ô cá riêng, rồi cộng riêng từng
 * cái"). Loài theo `SPECIES_DISPLAY_ORDER` (cá trên, bạch tuộc dưới); dòng trong loài giữ thứ tự
 * đưa vào. Dùng cho bản in A4 — màn hình chia bằng `SummaryTable groupBy` cùng luật.
 */
export function groupBySpecies(rows: MonthlyStockRow[], speciesOf: (itemName: string) => string): StockSpeciesGroup[] {
  const map = new Map<string, MonthlyStockRow[]>();
  for (const r of rows) {
    const k = speciesOf(r.itemName);
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return [...map.entries()]
    .sort((a, b) => speciesRank(a[0]) - speciesRank(b[0]))
    .map(([species, rs]) => ({ species, rows: rs, totals: sumMonthlyStockRows(rs) }));
}

/**
 * Gom dòng theo NHÓM (category). Nhóm mặc định lên trước theo thứ tự
 * MONTHLY_STOCK_CATEGORIES (khối con "<nhóm> – <tên>" ngay sau nhóm cha), nhóm lạ
 * xếp cuối theo bảng chữ cái. Trong mỗi nhóm giữ `sortOrder` rồi tới tên; truyền
 * `speciesOf` ⇒ loài lên trước (cá trên, bạch tuộc dưới — `compareStockRowsBySpecies`).
 */
export function groupByCategory(rows: MonthlyStockRow[], speciesOf?: (itemName: string) => string): StockCategoryGroup[] {
  const map = new Map<string, MonthlyStockRow[]>();
  for (const r of rows) {
    const k = r.category || "(Chưa phân nhóm)";
    let arr = map.get(k);
    if (!arr) {
      arr = [];
      map.set(k, arr);
    }
    arr.push(r);
  }
  const priorityOf = (c: string) => {
    const i = MONTHLY_STOCK_CATEGORIES.indexOf(c);
    if (i !== -1) return i;
    // Khối con của một nhóm ("Nguyên liệu nhập khẩu – 2 DA") đứng ngay sau nhóm cha.
    const parentIdx = MONTHLY_STOCK_CATEGORIES.findIndex((m) => c.startsWith(`${m} – `));
    return parentIdx === -1 ? MONTHLY_STOCK_CATEGORIES.length : parentIdx + 0.5;
  };
  return [...map.entries()]
    .sort((a, b) => priorityOf(a[0]) - priorityOf(b[0]) || a[0].localeCompare(b[0]))
    .map(([category, rs]) => {
      rs.sort(speciesOf ? compareStockRowsBySpecies(speciesOf) : (x, y) => x.sortOrder - y.sortOrder || x.itemName.localeCompare(y.itemName));
      return { category, rows: rs, totals: sumMonthlyStockRows(rs) };
    });
}

/* ---------- Cờ lệch dồn kỳ (tồn đầu tháng này vs tồn cuối tháng trước) ---------- */

export interface GroupMismatch {
  category: string;
  prevClose: number; // tồn cuối tháng trước (kg)
  currentOpen: number; // tồn đầu tháng này (kg)
  diff: number; // currentOpen − prevClose
}

export interface CarryOverMismatch {
  prevClose: number;
  currentOpen: number;
  diff: number; // tổng: tồn đầu tháng này − tồn cuối tháng trước
  groups: GroupMismatch[]; // các nhóm có chênh (|lech| > NGUONG)
}

const DIFF_THRESHOLD = 1; // < 1 kg coi như khớp (làm tròn số lẻ)

const sumByGroup = (rows: MonthlyStockRow[], take: (r: MonthlyStockRow) => number) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.category || "(Chưa phân nhóm)", (m.get(r.category || "(Chưa phân nhóm)") ?? 0) + take(r));
  return m;
};

/**
 * So tồn đầu tháng NÀY với tồn cuối tháng TRƯỚC (kg). Vòng gối đầu đúng thì
 * bằng nhau; lệch = ghi chép dồn kỳ sai (đúng nỗi đau file Excel gốc). Trả tổng
 * + các nhóm chênh để gọi tên đúng chỗ. KHÔNG sửa số — chỉ soi.
 */
export function measureCarryForwardGap(priorRows: MonthlyStockRow[], currentRows: MonthlyStockRow[]): CarryOverMismatch {
  const prevClose = priorRows.reduce((s, r) => s + r.closeKg, 0);
  const currentOpening = currentRows.reduce((s, r) => s + r.openKg, 0);
  const mClose = sumByGroup(priorRows, (r) => r.closeKg);
  const mOpen = sumByGroup(currentRows, (r) => r.openKg);
  const cats = new Set([...mClose.keys(), ...mOpen.keys()]);
  const byGroup: GroupMismatch[] = [];
  for (const c of cats) {
    const ct = mClose.get(c) ?? 0;
    const on = mOpen.get(c) ?? 0;
    if (Math.abs(on - ct) > DIFF_THRESHOLD) byGroup.push({ category: c, prevClose: ct, currentOpen: on, diff: on - ct });
  }
  byGroup.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return { prevClose, currentOpen: currentOpening, diff: currentOpening - prevClose, groups: byGroup };
}

/** Có đáng gắn cờ lệch không (có tháng trước + tổng lệch quá ngưỡng). */
export const hasCarryForwardGap = (l: CarryOverMismatch | null) => !!l && Math.abs(l.diff) > DIFF_THRESHOLD;

/* ---------- Đối chiếu lệch theo MẶT HÀNG (chẩn đoán, không tự sửa) ---------- */

/**
 * Khóa so hai tháng ở mức MẶT HÀNG: kho · nhóm · tên (BỎ size + xuất xứ). Cố ý
 * thô: giữa các tháng, một lô hay bị TÁCH theo size hoặc đổi mã lô (VD SANMA →
 * SANMA + SANMA 50-90) — gộp về tên thì các tách đó TRIỆT TIÊU, chỉ còn lệch
 * THẬT. So theo size sẽ báo động giả và dẫn tới sửa sai (cộng đôi).
 */
export const stockLineKey = (l: { warehouse: string; category: string; itemName: string }) =>
  [l.warehouse, l.category, l.itemName].map((s) => (s || "").trim().toLowerCase()).join("|");

export interface CarryForwardDiff {
  key: string;
  warehouse: string;
  category: string;
  itemName: string;
  prevCloseKg: number; // tổng tồn cuối tháng trước của mặt hàng
  currentOpenKg: number; // tổng tồn đầu tháng này của mặt hàng
  diffKg: number; // currentOpen − prevClose
  currentRowCount: number; // số dòng tháng này của mặt hàng (để biết sửa ở đâu)
}

function groupByName(rows: MonthlyStockRow[], getKg: (r: MonthlyStockRow) => number) {
  const m = new Map<string, { kg: number; sl: number; w: string; c: string; name: string }>();
  for (const r of rows) {
    const k = stockLineKey(r);
    const g = m.get(k) ?? { kg: 0, sl: 0, w: r.warehouse, c: r.category, name: r.itemName };
    g.kg += getKg(r);
    g.sl += 1;
    m.set(k, g);
  }
  return m;
}

/**
 * Đối chiếu tồn cuối tháng TRƯỚC ↔ tồn đầu tháng NÀY theo MẶT HÀNG. Chỉ trả mặt
 * hàng LỆCH THẬT (|Δkg| > ngưỡng, sau khi gộp các tách size). KHÔNG sửa gì —
 * chẩn đoán để người dùng tự sửa ở lưới Ghi (con người phán đoán, tránh cộng đôi).
 */
export function compareCarryForward(priorRows: MonthlyStockRow[], currentRows: MonthlyStockRow[]): CarryForwardDiff[] {
  const prevCloseByName = groupByName(priorRows, (r) => r.closeKg);
  const openByName = groupByName(currentRows, (r) => r.openKg);
  const keys = new Set([...prevCloseByName.keys(), ...openByName.keys()]);
  const out: CarryForwardDiff[] = [];
  for (const k of keys) {
    const t = prevCloseByName.get(k);
    const n = openByName.get(k);
    const closeKg = t?.kg ?? 0;
    const openKg = n?.kg ?? 0;
    if (Math.abs(openKg - closeKg) <= DIFF_THRESHOLD) continue;
    const g = (t ?? n)!;
    out.push({
      key: k,
      warehouse: g.w,
      category: g.c,
      itemName: g.name,
      prevCloseKg: closeKg,
      currentOpenKg: openKg,
      diffKg: openKg - closeKg,
      currentRowCount: n?.sl ?? 0,
    });
  }
  return out.sort((a, b) => Math.abs(b.diffKg) - Math.abs(a.diffKg));
}

/* ---------- Thẻ kho: lịch sử một MẶT HÀNG qua các tháng ---------- */

export interface StockCardMonth {
  period: string;
  openCtn: number;
  openKg: number;
  inCtn: number;
  inKg: number;
  outCtn: number;
  outKg: number;
  closeCtn: number;
  closeKg: number;
  rowCount: number; // số dòng (lô/size) của mặt hàng trong tháng đó
}

/**
 * "Thẻ kho" (sổ chi tiết vật tư) của MỘT mặt hàng: mỗi tháng một dòng tồn đầu ·
 * nhập · xuất · tồn cuối, mới → cũ. Khóa gộp là `khoaLo` (kho·nhóm·TÊN, bỏ size)
 * nên các lô tách theo size của cùng mặt hàng cộng lại thành một dòng tháng —
 * đúng cách đối chiếu dồn kỳ (xem `compareCarryForward`), tránh báo động giả.
 *
 * Thuần đọc: chỉ cộng lại từ `lines`, KHÔNG sửa gì.
 */
export function buildProductStockCard(
  lines: MonthlyStockLine[],
  key: string,
  maxMonths = 24
): StockCardMonth[] {
  const m = new Map<string, StockCardMonth>();
  for (const l of lines) {
    if (stockLineKey(l) !== key) continue;
    const g =
      m.get(l.period) ??
      {
        period: l.period,
        openCtn: 0, openKg: 0, inCtn: 0, inKg: 0, outCtn: 0, outKg: 0,
        closeCtn: 0, closeKg: 0, rowCount: 0,
      };
    const r = deriveRow(l);
    g.openCtn += r.openCtn; g.openKg += r.openKg;
    g.inCtn += r.inCtn; g.inKg += r.inKg;
    g.outCtn += r.outCtn; g.outKg += r.outKg;
    g.closeCtn += r.closeCtn; g.closeKg += r.closeKg;
    g.rowCount += 1;
    m.set(l.period, g);
  }
  return [...m.values()]
    .sort((a, b) => b.period.localeCompare(a.period))
    .slice(0, maxMonths);
}

/* ---------- Đồng bộ tên mặt hàng trong sổ với danh mục loại nguyên liệu ---------- */

/** Chuẩn hoá để SO KHỚP với danh mục: bỏ khoảng trắng thừa + thường hoá. */
const normalizeForMatch = (s: string) => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
/** Chuẩn hoá NGẶT để dò TRÙNG CÁCH GHI: bỏ hết khoảng trắng + dấu câu (250UP≡250 UP). */
const normalizeCompact = (s: string) => (s || "").toLowerCase().replace(/[\s.,\-()/]+/g, "");

/** "Từ riêng" có chữ tiếng Việt: `\b` của JS không hiểu chữ có dấu ("ống") ⇒ tự chặn hai đầu bằng chữ cái Unicode. */
const word = (w: string) => new RegExp(`(?<!\\p{L})(?:${w})(?!\\p{L})`, "u");

/**
 * Đoán nhóm (category, loài) từ tên — chỉ gợi ý, người dùng sửa được ở Danh mục.
 * Thứ tự dò: tên nói thẳng loài (bạch tuộc · mực · cá) trước, rồi tới dấu bộ phận / phân loại.
 * Dấu bộ phận bạch tuộc đối chiếu bảng kê kho thật của kế toán (T9/2026, khối Hàng tạm):
 * "1 DA" / "2DA" · mada · râu · dạt · bao tử · cổ · tuýp / tip · đuôi.
 */
export function inferMaterialCategory(name: string): string {
  const s = name.toLowerCase();
  if (/b[aạ]ch\s*tu[ộo]c|(?<!\p{L})b\.?\s*tu[ộo]c/u.test(s)) return "Bạch tuộc";
  if (/m[ựu]c/.test(s)) return "Mực";
  if (word("cá").test(s)) return "Cá";
  if (/(?<!\p{L})da(?!\p{L})|mada|râu|dạt|bao\s*t[ửu]|tu[ýy]p|đuôi/u.test(s) || word("cổ|tip").test(s)) return "Bạch tuộc";
  if (word("ống|nang").test(s)) return "Mực";
  if (/ghẹ/.test(s)) return "Ghẹ";
  if (/(t[ôo]m)/.test(s)) return "Tôm";
  if (/(b[àa]o\s*ng[ưu])/.test(s)) return "Bào ngư";
  if (/(saba|sanma|nodoguro|kinmedai|sòng|nục|thu|mòi|cơm|chỉ|nhồng|bò|đổng|hố|sardine|tráo|trích|đục)/.test(s)) return "Cá";
  return "Khác";
}

export type CatalogTarget = "product" | "material" | "skip";

/**
 * Đoán ĐÍCH danh mục cho một tên trong sổ kho:
 *  - Có size/grade (250UP, 150-250, <40…) HOẶC dấu chế biến/phân loại (râu, cắt,
 *    luộc, chần, tẩm, bột, dạt, cổ, bao tử, mada, "X da") → "product" (mặt hàng).
 *  - Còn lại (cá/tôm/mực/bào ngư NGUYÊN CON) → "material" (loại nguyên liệu).
 * Chỉ GỢI Ý — người dùng đổi từng dòng.
 */
export function inferCatalogTarget(name: string): CatalogTarget {
  const hasSize = /(\d+\s*[-/]\s*\d+|\d+\s*up\b|\bup\b|<\s*\d+|>\s*\d+|\d+\s*gr?\b)/i.test(name);
  const isProcessed = /(r[âa]u|c[ắa]t|lu[ộo]c|ch[ầa]n|t[ẩa]m|b[ộo]t|d[aạ]t|\bc[ổo]\b|bao\s*t[ửu]|mada|vòi|\bda\b)/i.test(
    name.toLowerCase()
  );
  return hasSize || isProcessed ? "product" : "material";
}

/**
 * "Rõ ràng" = tên tự nói lên loài NGUYÊN LIỆU (cá/tôm/mực/ghẹ/bào ngư nguyên con)
 * — ai nhìn cũng biết, KHÔNG cần đồng bộ tay (VD "CÁ THU"). "Cần đồng bộ" = mã khó:
 * bạch tuộc phân loại/bộ phận (2 DA RÂU NGẮN, MADA…) hoặc không rõ loài — phải
 * người quyết ánh xạ về danh mục nào.
 */
export function laRoRang(name: string): boolean {
  const group = inferMaterialCategory(name);
  return group !== "Bạch tuộc" && group !== "Khác";
}

export interface CatalogSyncItem {
  name: string;
  suggestedGroup: string;
  suggestedTarget: CatalogTarget; // đích gợi ý (product/material)
  roRang: boolean; // true = tự nhận loài, khỏi bận tâm; false = mã khó, cần đồng bộ
}

export interface CatalogSyncReport {
  nameCount: number; // số tên phân biệt trong sổ
  inMaterialTypes: number; // đã có trong loại NL
  inProducts: number; // đã có trong mặt hàng
  missing: CatalogSyncItem[]; // chưa có ở CẢ HAI (kèm đích + nhóm gợi ý)
  duplicateGroups: { variants: string[] }[]; // các tên TRÙNG CÁCH GHI (>1 biến thể)
}

/**
 * Phân tích tên trong sổ kho so với CẢ HAI danh mục (loại NL + mặt hàng):
 *  - `missing`: tên chưa có ở cả hai (kèm đích + nhóm gợi ý để định tuyến từng dòng).
 *  - `inMaterialTypes`/`inProducts`: đã có sẵn ở đâu.
 *  - `duplicateGroups`: tên chỉ khác nhau cách ghi (chuẩn hoá ngặt) — gom để sửa tay.
 * KHÔNG sửa gì — chỉ báo. Thành phẩm 141 mã kế toán KHÔNG xét (cố định).
 */
export function analyzeCatalogSync(
  ledgerNames: string[],
  materialTypeNames: string[],
  productNames: string[]
): CatalogSyncReport {
  const materialNameSet = new Set(materialTypeNames.map(normalizeForMatch));
  const productNameSet = new Set(productNames.map(normalizeForMatch));
  const distinctNames = [...new Set(ledgerNames.map((t) => t.trim()).filter(Boolean))];
  let existingMaterialCount = 0;
  let existingProductCount = 0;
  const missing: CatalogSyncItem[] = [];
  for (const name of distinctNames) {
    const k = normalizeForMatch(name);
    const isMaterial = materialNameSet.has(k);
    const isProductName = productNameSet.has(k);
    if (isMaterial) existingMaterialCount++;
    if (isProductName) existingProductCount++;
    if (isMaterial || isProductName) continue;
    missing.push({ name, suggestedGroup: inferMaterialCategory(name), suggestedTarget: inferCatalogTarget(name), roRang: laRoRang(name) });
  }

  // Gom trùng-cách-ghi trong chính danh sách tên của sổ.
  const grouped = new Map<string, Set<string>>();
  for (const t of distinctNames) {
    const k = normalizeCompact(t);
    if (!k) continue;
    const set = grouped.get(k) ?? new Set<string>();
    set.add(t);
    grouped.set(k, set);
  }
  const duplicateGroups = [...grouped.values()]
    .filter((s) => s.size > 1)
    .map((s) => ({ variants: [...s].sort() }));

  return {
    nameCount: distinctNames.length,
    inMaterialTypes: existingMaterialCount,
    inProducts: existingProductCount,
    missing,
    duplicateGroups,
  };
}

/* ---------- Dồn kỳ: tồn cuối tháng N → tồn đầu tháng N+1 ---------- */

/** id tất định của dòng sinh ra khi dồn kỳ — chạy lại không đẻ dòng trùng. */
export const idDon = (srcId: string) => `carry|${srcId}`;

/**
 * Dựng dòng tồn đầu cho `thangDich` bằng cách KẾ THỪA tồn cuối các dòng
 * `nguon` (đã suy tồn cuối). Nhập/xuất = 0 (chờ ghi trong kỳ mới). Giữ nguyên
 * mô tả (nhóm, kho, tên, size, xuất xứ, đơn giá, kg/kiện). id tất định theo dòng
 * nguồn ⇒ dồn lại nhiều lần chỉ CẬP NHẬT, không nhân đôi.
 *
 * Chỉ mang sang dòng còn tồn THEO KG (tồn cuối kg ≠ 0) — kg là đơn vị ghi sổ từ
 * 2026-09-15, kiện chỉ đi kèm. Dòng hết kg mà còn lẻ kiện (sai số chia kiện) không dồn,
 * kẻo dồn mãi một dòng màn hình hiện toàn số 0.
 *
 * ⚠ Hàm này chỉ DỰNG dòng (xem trước). GHI vào sổ thì dùng `carryForwardIntoLedger` — nó giữ số
 * người dùng đã gõ ở tháng đích, không thay cả dòng.
 */
export function buildCarryForwardLines(source: MonthlyStockRow[], targetMonth: string): MonthlyStockLine[] {
  return source
    .filter((r) => Math.abs(r.closeKg) > 1e-9)
    .map((r) => ({
      id: idDon(r.id),
      period: targetMonth,
      category: r.category,
      warehouse: r.warehouse,
      itemName: r.itemName,
      size: r.size,
      origin: r.origin,
      importDate: r.importDate,
      storageLocation: r.storageLocation,
      kgPerCtn: r.kgPerCtn,
      unitPrice: r.unitPrice,
      openCtn: r.closeCtn,
      openKg: r.closeKg,
      inCtn: 0,
      inKg: 0,
      outCtn: 0,
      outKg: 0,
      carriedFromId: r.id,
      sortOrder: r.sortOrder,
      note: "",
    }));
}

export interface CarryForwardResult {
  lines: MonthlyStockLine[];
  /** Số dòng tháng đích đang mang tồn kế thừa (thêm mới + cập nhật). */
  rowCount: number;
  added: number;
  updated: number;
  /** Dòng `carry|…` có nguồn đã hết tồn / bị xoá ⇒ tồn đầu đặt về 0 (giữ dòng vì còn số). */
  zeroed: number;
  /** Dòng `carry|…` về 0 mà trống hẳn (không nhập/xuất, không ghi chú) ⇒ bỏ. */
  removed: number;
  /** Tổng kg tồn đầu kế thừa. */
  totalKg: number;
}

/**
 * GHI dồn kỳ vào sổ: tồn cuối tháng liền trước `thangDich` → tồn đầu `thangDich`.
 * MỘT chỗ dùng chung cho mọi đường dồn (gõ ở xem trước, "Kế thừa & lưu", "Dồn sang
 * tháng sau", Cân đối tự mở tháng). `kho` (tuỳ chọn) = chỉ dồn dòng của kho đó.
 *
 * Vì sao không thay cả dòng như trước: dồn LẠI sau khi tháng đích đã có số (nhập/xuất,
 * vị trí, ghi chú, vết ⟦CĐ:…⟧ của Cân đối) sẽ xoá trắng những thứ đó. Quy tắc:
 *  - id `carry|<nguồn>` đã có ⇒ CHỈ cập nhật `openKg/openCtn`, mọi cột khác giữ nguyên.
 *  - chưa có ⇒ thêm dòng mới (`buildCarryForwardLines`).
 *  - dòng `carry|…` ở tháng đích mà nguồn (trong phạm vi kho) đã hết tồn hay bị xoá ⇒
 *    tồn đầu về 0; trống hẳn (không số, không ghi chú) thì bỏ, còn số thì GIỮ.
 */
export function carryForwardIntoLedger(lines: MonthlyStockLine[], targetMonth: string, warehouse?: string): CarryForwardResult {
  const sourceMonth = getPrevMonth(targetMonth);
  const inWarehouse = (l: MonthlyStockLine) => !warehouse || l.warehouse === warehouse;
  const carried = buildCarryForwardLines(
    lines.filter((l) => l.period === sourceMonth && inWarehouse(l)).map(deriveRow),
    targetMonth
  );
  const theoId = new Map(carried.map((c) => [c.id, c]));
  const sourceById = new Map(lines.filter((l) => l.period === sourceMonth).map((l) => [l.id, l]));
  let updatedCount = 0;
  let zeroedCount = 0;
  let removed = 0;
  const existing = new Set<string>();
  const result: MonthlyStockLine[] = [];
  for (const l of lines) {
    const c = theoId.get(l.id);
    if (c) {
      existing.add(l.id);
      updatedCount++;
      result.push(l.openKg === c.openKg && l.openCtn === c.openCtn ? l : { ...l, openKg: c.openKg, openCtn: c.openCtn });
      continue;
    }
    if (l.period !== targetMonth || !l.id.startsWith("carry|")) {
      result.push(l);
      continue;
    }
    // Dòng dồn cũ không còn nguồn mang tồn. Nguồn còn ⇒ xét kho của nguồn; mất ⇒ kho của dòng.
    const source = sourceById.get(l.carriedFromId || l.id.slice("carry|".length));
    if (!(source ? inWarehouse(source) : inWarehouse(l)) || (l.openKg === 0 && l.openCtn === 0)) {
      result.push(l);
      continue;
    }
    const z = { ...l, openKg: 0, openCtn: 0 };
    if (isEmptyLine(z) && !(z.note ?? "").trim()) {
      removed++;
      continue;
    }
    zeroedCount++;
    result.push(z);
  }
  const newCarried = carried.filter((c) => !existing.has(c.id));
  return {
    lines: [...result, ...newCarried],
    rowCount: carried.length,
    added: newCarried.length,
    updated: updatedCount,
    zeroed: zeroedCount,
    removed,
    totalKg: carried.reduce((s, c) => s + c.openKg, 0),
  };
}

/** Chuỗi id dồn kỳ của một lô: `carry|<id>`, `carry|carry|<id>`… (tháng sau, tháng sau nữa). */
export const carryChainIds = (lines: MonthlyStockLine[], lotId: string): string[] => {
  const ids: string[] = [];
  for (let id = idDon(lotId); lines.some((l) => l.id === id); id = idDon(id)) ids.push(id);
  return ids;
};

/** Bảng một dòng đang nằm trong Sổ kho tháng: nhóm hàng (tên bảng) + kho của sổ. */
export interface LedgerTable {
  category: string;
  warehouse: string;
}

/**
 * Cho CHUỖI DỒN KỲ của một lô đi theo khi lô đổi bảng / đổi kho (2026-10-27).
 *
 * Vì sao: dồn kỳ chỉ cập nhật tồn đầu của dòng `carry|…` đã có, giữ nguyên nhóm + kho ⇒ dời
 * lô tháng 10 sang bảng khác khi tháng 11 đã mở thì tháng 11 vẫn xếp lô ở bảng cũ (kho cũ).
 *
 * Đi theo `carry|<lô>`, `carry|carry|<lô>`… (tháng sau, tháng sau nữa). Mỗi dòng dồn chỉ đổi
 * trường nào CÒN GIỐNG giá trị cũ của lô — dòng tháng sau người dùng đã tự dời đi chỗ khác thì
 * giữ, và dừng chuỗi ở đó (từ đó về sau là quyết định riêng của tháng ấy). Không đụng số kg.
 */
export function followTableChange(
  lines: MonthlyStockLine[],
  lotId: string,
  before: LedgerTable,
  after: LedgerTable
): { lines: MonthlyStockLine[]; followed: number } {
  const categoryChanged = before.category !== after.category;
  const warehouseChanged = before.warehouse !== after.warehouse;
  if (!categoryChanged && !warehouseChanged) return { lines, followed: 0 };
  const patch = new Map<string, LedgerTable>();
  for (const id of carryChainIds(lines, lotId)) {
    const l = lines.find((x) => x.id === id) as MonthlyStockLine;
    const moveCategory = categoryChanged && l.category === before.category;
    const moveWarehouse = warehouseChanged && l.warehouse === before.warehouse;
    if (!moveCategory && !moveWarehouse) break;
    patch.set(id, {
      category: moveCategory ? after.category : l.category,
      warehouse: moveWarehouse ? after.warehouse : l.warehouse,
    });
  }
  if (!patch.size) return { lines, followed: 0 };
  return {
    lines: lines.map((l) => {
      const p = patch.get(l.id);
      return p ? { ...l, ...p } : l;
    }),
    followed: patch.size,
  };
}

/**
 * CHUYỂN BẢNG các dòng đang tick: đổi nhóm hàng và/hoặc kho, rồi cho chuỗi dồn kỳ ở các tháng
 * sau đã mở đi theo (`followTableChange`). Bỏ trống một trường ⇒ giữ giá trị riêng của từng
 * dòng. Không đổi số kg, vị trí, ghi chú ⇒ tổng tháng không đổi, chỉ đổi bảng hiển thị.
 */
export function moveLinesToTable(
  lines: MonthlyStockLine[],
  ids: Iterable<string>,
  target: Partial<LedgerTable>
): { lines: MonthlyStockLine[]; moved: number; followed: number } {
  const category = (target.category ?? "").trim();
  const warehouse = (target.warehouse ?? "").trim();
  const wanted = new Set(ids);
  const before = new Map<string, LedgerTable>();
  let items = lines.map((l) => {
    if (!wanted.has(l.id)) return l;
    const next = { ...l, category: category || l.category, warehouse: warehouse || l.warehouse };
    if (next.category === l.category && next.warehouse === l.warehouse) return l;
    before.set(l.id, { category: l.category, warehouse: l.warehouse });
    return next;
  });
  let followed = 0;
  for (const [id, old] of before) {
    const moved = items.find((l) => l.id === id) as MonthlyStockLine;
    const r = followTableChange(items, id, old, { category: moved.category, warehouse: moved.warehouse });
    items = r.lines;
    followed += r.followed;
  }
  return { lines: items, moved: before.size, followed };
}

/**
 * ĐẨY TIẾP tồn cuối của ĐÚNG các lô vừa bị ghi sang các tháng sau ĐÃ MỞ (2026-10-15).
 *
 * Vì sao: tồn đầu tháng được ĐÓNG BĂNG khi dồn kỳ; ghi thêm lô / lấy ra / bỏ lô ở một
 * tháng cũ (hàng đông lạnh /wip, Gửi đông · Lấy xả đông của Cân đối) mà tháng sau đã mở
 * thì tồn đầu tháng sau đứng yên ⇒ lệch dồn kỳ (audit: lô 25 kg ghi vào T10 khi T11 đã
 * mở không sang T11). Không dồn lại CẢ tháng (sẽ đè tồn đầu kế toán đã chốt của lô khác)
 * — chỉ đi theo chuỗi `carry|<lô>` của các lô truyền vào:
 *  - dòng dồn đã có ⇒ CHỈ đặt `openKg/openCtn` = tồn cuối tháng trước (như carryForwardIntoLedger);
 *  - chưa có mà lô còn tồn ⇒ thêm dòng dồn (`buildCarryForwardLines`);
 *  - lô đã bị xoá / hết tồn ⇒ dòng dồn về 0, trống hẳn (không số, không ghi chú) thì bỏ;
 *  - tháng chưa mở ⇒ dừng (mở sau tự kế thừa); dòng dồn đã khớp ⇒ dừng (phía sau không đổi).
 */
export function propagateLotsForward(
  lines: MonthlyStockLine[],
  lotIds: Iterable<string>
): { lines: MonthlyStockLine[]; touched: number } {
  let items = lines;
  let touched = 0;
  for (const lotId of new Set(lotIds)) {
    let sourceId = lotId;
    let source: MonthlyStockLine | undefined = items.find((l) => l.id === lotId);
    let month = source ? getNextMonth(source.period) : items.find((l) => l.id === idDon(lotId))?.period;
    let closeKg = source ? deriveRow(source).closeKg : 0;
    let closeCtn = source ? deriveRow(source).closeCtn : 0;
    for (let i = 0; i < 36 && month; i++) {
      const m = month;
      if (!items.some((l) => l.period === m)) break; // tháng chưa mở — mở sau tự kế thừa
      const carryId = idDon(sourceId);
      const existing = items.find((l) => l.id === carryId);
      let next: MonthlyStockLine;
      if (existing) {
        if (Math.abs(existing.openKg - closeKg) < 1e-9 && Math.abs(existing.openCtn - closeCtn) < 1e-9) break;
        next = { ...existing, openKg: closeKg, openCtn: closeCtn };
        if (isEmptyLine(next) && !(next.note ?? "").trim()) {
          items = items.filter((l) => l.id !== carryId);
          touched++;
          source = undefined;
          sourceId = carryId;
          closeKg = 0;
          closeCtn = 0;
          month = getNextMonth(m);
          continue;
        }
        items = items.map((l) => (l.id === carryId ? next : l));
      } else {
        if (!source || Math.abs(closeKg) < 1e-9) break; // hết tồn ⇒ không đẻ dòng dồn
        const built = buildCarryForwardLines([deriveRow(source)], m)[0];
        if (!built) break;
        next = built;
        items = [...items, next];
      }
      touched++;
      source = next;
      sourceId = carryId;
      const r = deriveRow(next);
      closeKg = r.closeKg;
      closeCtn = r.closeCtn;
      month = getNextMonth(m);
    }
  }
  return { lines: items, touched };
}

/* ---------- Thao tác trên MỘT dòng: lấy ra dùng · nhập thêm · chuyển vị trí ---------- */

/** Dòng KHÔNG có số liệu: tồn đầu, nhập, xuất (kg lẫn kiện) đều bằng 0. */
export function isEmptyLine(l: MonthlyStockLine): boolean {
  const z = (v: number) => Math.abs(v) < 1e-9;
  return z(l.openKg) && z(l.inKg) && z(l.outKg) && z(l.openCtn) && z(l.inCtn) && z(l.outCtn);
}

export type LotActionKind = "out" | "in" | "transfer";

export interface LotActionResult {
  /** Dòng gốc sau khi áp (thay đúng id). */
  line: MonthlyStockLine;
  /** Dòng MỚI tách ra (chỉ khi chuyển MỘT PHẦN sang vị trí khác). */
  splitLine: MonthlyStockLine | null;
}

/** Đổi kiện theo cùng tỉ lệ kg (kiện ẩn trên màn nhưng vẫn phải khớp với kg). */
const cartonRatio = (ctn: number, kg: number, batterKg: number) => (kg > 1e-9 ? (ctn * batterKg) / kg : 0);

/**
 * Áp một thao tác kho lên một dòng — hàm thuần, màn chỉ việc ghi kết quả.
 *
 * - `xuat` (lấy ra sử dụng / xuất bán): CỘNG DỒN vào xuất trong kỳ. Không vượt tồn cuối.
 * - `nhap` (nhập thêm cùng lô): cộng dồn vào nhập trong kỳ.
 * - `chuyen` (đổi chỗ để hàng, VD sang Kho Ánh Dương): KHÔNG phải nhập/xuất ⇒ tổng
 *   nhập, xuất, tồn của tháng không đổi. Chuyển HẾT tồn cuối ⇒ chỉ đổi Vị trí của
 *   dòng. Chuyển MỘT PHẦN ⇒ tách dòng mới cùng mô tả ở vị trí đích, số kg lấy từ
 *   tồn đầu trước rồi tới phần nhập trong kỳ (tổng theo mặt hàng giữ nguyên nên
 *   đối chiếu dồn kỳ không báo lệch giả).
 *
 * `note` được nối vào `note` của dòng để còn vết (ngày · việc · kg).
 */
export function applyLotAction(
  l: MonthlyStockLine,
  kind: LotActionKind,
  kg: number,
  opts: { targetLocation?: string; note: string; newId: string }
): LotActionResult {
  const note = (l.note ? l.note + "\n" : "") + opts.note;
  if (kind === "out") {
    const ctn = l.kgPerCtn ? kg / l.kgPerCtn : 0;
    return { line: { ...l, outKg: l.outKg + kg, outCtn: l.outCtn + ctn, note }, splitLine: null };
  }
  if (kind === "in") {
    const ctn = l.kgPerCtn ? kg / l.kgPerCtn : 0;
    return { line: { ...l, inKg: l.inKg + kg, inCtn: l.inCtn + ctn, note }, splitLine: null };
  }
  const target = (opts.targetLocation ?? "").trim();
  const closeKg = l.openKg + l.inKg - l.outKg;
  if (kg >= closeKg - 1e-9) {
    return { line: { ...l, storageLocation: target, note }, splitLine: null };
  }
  const fromOpening = Math.min(kg, l.openKg);
  const fromIn = kg - fromOpening;
  const openingCtn = cartonRatio(l.openCtn, l.openKg, fromOpening);
  const inCartons = cartonRatio(l.inCtn, l.inKg, fromIn);
  const row: MonthlyStockLine = {
    ...l,
    openKg: l.openKg - fromOpening,
    openCtn: l.openCtn - openingCtn,
    inKg: l.inKg - fromIn,
    inCtn: l.inCtn - inCartons,
    note,
  };
  const splitLine: MonthlyStockLine = {
    ...l,
    id: opts.newId,
    storageLocation: target,
    openKg: fromOpening,
    openCtn: openingCtn,
    inKg: fromIn,
    inCtn: inCartons,
    outKg: 0,
    outCtn: 0,
    carriedFromId: "",
    sortOrder: l.sortOrder,
    note: `${opts.note} (tách từ dòng ${l.id})`,
  };
  return { line: row, splitLine };
}
