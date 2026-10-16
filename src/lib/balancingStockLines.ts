// ============================================================
// Tên file: src/lib/balancingStockLines.ts
// Tên tiếng Việt: Hai dòng kho của Cân đối ⇄ Sổ kho theo tháng (hàm thuần)
// Description: Balancing stock rows (draw-from-lot / send-to-freezer) ⇄ monthly stock ledger
// ============================================================
import type { BalancingInputItem, MonthlyStockLine } from "@/types";
import { MONTHLY_STOCK_CATEGORIES } from "@/types";
import { BALANCING_STOCK_LINE_NAMES, getBalancingStockLineKind } from "@/lib/balancingGrid";
import { carryForwardIntoLedger, deriveRow, getNextMonth, propagateLotsForward, type MonthlyStockRow } from "@/lib/monthlyStock";
import { num, formatDateVN } from "@/lib/format";

/**
 * VÌ SAO — khối NL ở Cân đối có hai dòng kho (chốt 2026-10-06):
 *   - LẤY XẢ ĐÔNG: lấy NL đông ra chế biến từ một LÔ chọn ĐÍCH DANH (dòng của Sổ kho
 *     tháng: kho · tên · invoice). Kg của tháng ghi vào cột XUẤT của đúng lô đó.
 *   - GỬI ĐÔNG: NL không chế biến, cất kho. Mỗi NGÀY GỬI là MỘT LÔ RIÊNG trong sổ (invoice
 *     `GĐ-yyyymmdd`, ngày nhập = ngày gửi), truy ngược được về kỳ cân đối. Lô vào NHÓM
 *     người dùng chọn trong hộp "Gửi vào sổ kho" (Nguyên liệu mua ngoài / nhập khẩu / Hàng
 *     tạm…) — bỏ nhóm riêng "Nguyên liệu gửi đông" (chốt 2026-10-16: thừa một bảng, kế
 *     toán muốn lô gửi nằm cùng bảng với hàng cùng loại). Lô đã ghi ở nhóm cũ giữ nguyên.
 *
 * MỘT nơi giữ số kho: Sổ kho tháng. Cân đối ghi theo kiểu ĐẶT GIÁ TRỊ (không cộng dồn
 * theo phím gõ) nên chạy lại bao nhiêu lần cũng ra cùng kết quả:
 *   - Lấy xả đông: phần của MỖI dòng cân đối trong một lô-tháng được ghi thành một dòng
 *     vết trong ghi chú lô `⟦CĐ:<id dòng>:<kg>⟧ …`. Đặt lại ⇒ đọc phần cũ từ vết, cột
 *     xuất cộng phần CHÊNH, vết đổi theo. Ai đọc sổ kho cũng thấy kg nào do cân đối lấy.
 *   - Gửi đông: dòng sổ id `cd|<id dòng>|<ngày>` THUỘC dòng cân đối ⇒ đặt thẳng `inKg`.
 * Xoá dòng / xoá kỳ = đặt mọi phần về 0 ⇒ sổ kho trả lại đúng như trước.
 *
 * Tháng chưa mở (chưa có dòng nào) ⇒ tự KẾ THỪA tồn cuối tháng gần nhất trước đó, từng
 * tháng một — đúng nút "Kế thừa & lưu vào sổ" của màn Sổ kho tháng (chốt với người dùng).
 */

/** Nhóm CŨ của lô gửi đông (trước 2026-10-16). Không còn ghi mới vào đây; lô đã ghi giữ nguyên. */
export const LEGACY_FREEZE_DEPOSIT_CATEGORY = "Nguyên liệu gửi đông";
/** Nhóm mặc định của lô gửi đông khi người dùng chưa chọn: NL mua của đại lý trong nước. */
export const DEFAULT_DEPOSIT_CATEGORY = "Nguyên liệu mua ngoài";
/** Sổ kho mặc định khi vị trí gửi là kho ngoài chưa từng xuất hiện trong sổ. */
export const DEFAULT_LEDGER_WAREHOUSE = "Kho 1500 tấn";

export const monthOfDate = (iso: string) => iso.slice(0, 7);

/** "<sổ kho>|<vị trí>" ⇄ cặp (warehouse, storageLocation) của dòng sổ kho. */
export function splitDepositLocation(v: string): { warehouse: string; storageLocation: string } {
  const i = v.indexOf("|");
  if (i < 0) return { warehouse: v, storageLocation: "" };
  return { warehouse: v.slice(0, i), storageLocation: v.slice(i + 1) };
}
export const joinDepositLocation = (warehouse: string, storageLocation: string) =>
  `${warehouse}|${storageLocation}`;

/** Tên ngắn của nơi để hàng: vị trí nếu có, không thì sổ kho; bỏ chữ "Kho " đầu. */
export const shortLocationName = (l: Pick<MonthlyStockLine, "warehouse" | "storageLocation">) =>
  (l.storageLocation || l.warehouse).replace(/^Kho\s+/i, "");

/**
 * Nhãn kho RẤT GỌN cho ô chọn kho của dòng Gửi đông (kế toán: "Kho 1000 tấn" đọc K1000 là
 * hiểu): kho xí nghiệp "Kho <số> tấn" ⇒ "K<số>"; kho ngoài bỏ chữ "Kho " đầu.
 */
export function shortWarehouseLabel(name: string): string {
  const m = /^Kho\s+(\d+)\s*(tấn|t)?$/i.exec(name.trim());
  if (m) return `K${m[1]}`;
  return name.trim().replace(/^Kho\s+/i, "");
}

/* ---------- Tháng của sổ ---------- */

/**
 * Bảo đảm tháng `month` đã MỞ: chưa có dòng nào thì kế thừa tồn cuối từ tháng gần nhất
 * TRƯỚC đó có dòng, dồn qua từng tháng (tối đa 24) — id `carry|…` tất định nên chạy lại
 * không nhân đôi. Tháng đã có dòng (dù một) thì để nguyên: dồn lúc đó dễ cộng đôi.
 */
export function ensureMonthOpened(
  lines: MonthlyStockLine[],
  month: string
): { lines: MonthlyStockLine[]; carriedCount: number } {
  if (lines.some((l) => l.period === month)) return { lines, carriedCount: 0 };
  const prevRows = [...new Set(lines.map((l) => l.period))].filter((p) => p < month).sort();
  const fromDate = prevRows[prevRows.length - 1];
  if (!fromDate) return { lines, carriedCount: 0 };
  let items = lines;
  let carriedCount = 0;
  let source = fromDate;
  for (let i = 0; i < 24 && source < month; i++) {
    const nextMonth = getNextMonth(source);
    if (!items.some((l) => l.period === nextMonth)) {
      // Cùng hàm ghi dồn kỳ của màn Sổ kho tháng (không thay cả dòng đã có).
      const result = carryForwardIntoLedger(items, nextMonth);
      items = result.lines;
      carriedCount += result.rowCount;
    }
    source = nextMonth;
  }
  return { lines: items, carriedCount };
}

/**
 * Dòng sổ của LÔ `loId` trong tháng `month`: chính nó nếu cùng tháng, tháng sau theo
 * chuỗi dồn kỳ `carry|<id>` (id dồn tất định). Không có ⇒ null (lô đã hết, chưa dồn).
 */
export function findLotLineInMonth(
  lines: MonthlyStockLine[],
  lotId: string,
  month: string
): MonthlyStockLine | null {
  const original = lines.find((l) => l.id === lotId);
  if (!original || original.period > month) return null;
  let id = lotId;
  let p = original.period;
  while (p < month) {
    id = `carry|${id}`;
    p = getNextMonth(p);
  }
  return lines.find((l) => l.id === id && l.period === month) ?? null;
}

/* ---------- Vết của cân đối trong ghi chú lô ---------- */

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reVet = (rowId: string) => new RegExp(`⟦CĐ:${escapeRegex(rowId)}:(-?[0-9.]+)⟧[^\\n]*`);

/** Phần kg dòng cân đối `rowId` đang ghi vào lô (đọc từ vết trong ghi chú). */
export function getBalancingShareInLot(l: Pick<MonthlyStockLine, "note">, rowId: string): number {
  const m = (l.note ?? "").match(reVet(rowId));
  return m ? Number(m[1]) || 0 : 0;
}

/** Đặt dòng vết của `rowId` trong ghi chú (thay dòng cũ / thêm mới / gỡ khi 0 kg). */
function appendTrace(note: string, rowId: string, kg: number, text: string): string {
  const dongs = (note ?? "").split("\n").filter((d) => d.length > 0 && !reVet(rowId).test(d));
  if (Math.abs(kg) > 1e-9) dongs.push(`⟦CĐ:${rowId}:${+kg.toFixed(3)}⟧ ${text}`);
  return dongs.join("\n");
}

/* ---------- Phần của một dòng cân đối trong sổ ---------- */

/** Lấy xả đông: kg theo THÁNG (Σ các ngày của tháng). */
function thawByMonth(r: BalancingInputItem): Map<string, number> {
  const m = new Map<string, number>();
  for (const [iso, v] of Object.entries(r.dailyQuantities ?? {})) {
    if (!v) continue;
    const t = monthOfDate(iso);
    m.set(t, (m.get(t) ?? 0) + Math.abs(v));
  }
  return m;
}

/** Gửi đông: kg theo NGÀY (lưu âm như dòng giảm ⇒ lấy trị tuyệt đối). */
function freezeDepositByDay(r: BalancingInputItem): Map<string, number> {
  const m = new Map<string, number>();
  for (const [iso, v] of Object.entries(r.dailyQuantities ?? {})) if (v) m.set(iso, Math.abs(v));
  return m;
}

export const freezeDepositRowId = (rowId: string, date: string) => `cd|${rowId}|${date}`;

export interface BalancingPeriodContext {
  /** Nhãn kỳ để ghi vết, VD "Bạch tuộc 2 da 01/10/2026 – 05/10/2026". */
  periodLabel: string;
  /** Tên HỌ nguyên liệu của kỳ — tên lô gửi đông trong sổ. */
  materialFamily: string;
}

export interface MonthlyStockSyncResult {
  lines: MonthlyStockLine[];
  /** Có đổi gì trong sổ không (khỏi ghi thừa). */
  changed: boolean;
  /** Lỗi chặn ghi (VD vượt tồn lô, chưa chọn lô) — có lỗi thì KHÔNG ghi gì. */
  error: string | null;
  /** Số dòng sổ tự kế thừa sang tháng chưa mở. */
  carriedCount: number;
}

/**
 * Đồng bộ phần kho của các dòng cân đối `truoc` → `sau` vào Sổ kho tháng. Dòng chỉ có
 * ở `truoc` (bị xoá) ⇒ đặt mọi phần về 0. ĐẶT GIÁ TRỊ ⇒ gọi lại với cùng `sau` không đổi
 * gì; truyền `truoc = []` để GHI LẠI toàn bộ (sửa lệch sau khi sổ bị nạp đè).
 */
export function syncMonthlyStockLedger(
  lines: MonthlyStockLine[],
  prevRows: BalancingInputItem[],
  after: BalancingInputItem[],
  ctx: BalancingPeriodContext
): MonthlyStockSyncResult {
  const isStockLine = (r: BalancingInputItem) => getBalancingStockLineKind(r) != null;
  const prev = new Map(prevRows.filter(isStockLine).map((r) => [r.id, r]));
  const nextById = new Map(after.filter(isStockLine).map((r) => [r.id, r]));
  let items = lines;
  let carriedCount = 0;
  let changed = false;
  /** Lô vừa bị đặt số (lấy xả đông / gửi đông) — cuối hàm đẩy tiếp sang các tháng sau đã mở. */
  const touchedLots = new Set<string>();

  const ensureMonth = (t: string) => {
    const result = ensureMonthOpened(items, t);
    if (result.carriedCount) {
      items = result.lines;
      carriedCount += result.carriedCount;
      changed = true;
    }
  };

  /** Hai bảng phần (tháng/ngày → kg) có khác nhau không. */
  const mapsDiffer = (x: Map<string, number>, y: Map<string, number>) =>
    [...new Set([...x.keys(), ...y.keys()])].some((k) => (x.get(k) ?? 0) !== (y.get(k) ?? 0));

  for (const id of new Set([...prev.keys(), ...nextById.keys()])) {
    const a = prev.get(id);
    const b = nextById.get(id);
    const lineKind = getBalancingStockLineKind((b ?? a)!);

    if (lineKind === "thaw-out") {
      const prevStockLineId = a?.stockLineId ?? "";
      const nextStockLineId = b?.stockLineId ?? "";
      const oldParts = a ? thawByMonth(a) : new Map<string, number>();
      const newParts = b ? thawByMonth(b) : new Map<string, number>();
      /* Cặp (lô, tháng) cần ĐẶT: lô cũ ⇒ đặt 0 nếu đổi lô; lô mới ⇒ đặt số mới. */
      const can: { lot: string; month: string; kg: number }[] = [];
      if (prevStockLineId && prevStockLineId !== nextStockLineId) for (const t of oldParts.keys()) can.push({ lot: prevStockLineId, month: t, kg: 0 });
      if (nextStockLineId) {
        for (const t of new Set([...newParts.keys(), ...(prevStockLineId === nextStockLineId ? oldParts.keys() : [])])) {
          const kg = newParts.get(t) ?? 0;
          /* Cùng lô, tháng không đổi ⇒ bỏ qua (khỏi tự mở tháng khi sửa ô khác). */
          if (a && prevStockLineId === nextStockLineId && (oldParts.get(t) ?? 0) === kg) continue;
          can.push({ lot: nextStockLineId, month: t, kg });
        }
      } else if (mapsDiffer(oldParts, newParts) && [...newParts.values()].some((v) => v > 0)) {
        /* Chỉ chặn khi CHÍNH dòng này đổi số — dòng cũ có số mà chưa chọn lô (ghi trước khi
           nối sổ kho) không được làm kẹt mọi lần ghi khác của khối NL. */
        return { lines, changed: false, carriedCount: 0, error: "Chọn lô (kho · invoice) trước khi ghi số Lấy xả đông." };
      }
      /* Tháng SỚM trước: tháng sau mở bằng kế thừa tồn cuối tháng trước ⇒ phải ghi xuất
         tháng trước xong mới mở, không thì tồn đầu tháng sau đông băng số cũ. */
      can.sort((x, y) => x.month.localeCompare(y.month) || (x.kg === 0 ? -1 : 1));
      for (const c of can) {
        ensureMonth(c.month);
        const row = findLotLineInMonth(items, c.lot, c.month);
        if (!row) {
          if (c.kg === 0) continue; // lô không còn ở tháng đó — không có gì để trả
          return {
            lines,
            changed: false,
            carriedCount: 0,
            error: `Lô đã chọn không còn trong sổ kho ${c.month.slice(5)}/${c.month.slice(0, 4)} — chọn lô khác.`,
          };
        }
        const existing = getBalancingShareInLot(row, id);
        const diff = c.kg - existing;
        if (Math.abs(diff) < 1e-9) continue;
        const outKg = row.outKg + diff;
        const stock = row.openKg + row.inKg - outKg;
        if (stock < -1e-6) {
          return {
            lines,
            changed: false,
            carriedCount: 0,
            error: `Lô ${shortLocationName(row)} · ${row.itemName}${row.origin ? ` · ${row.origin}` : ""} chỉ còn ${num(
              row.openKg + row.inKg - row.outKg + existing
            )} kg — không lấy được ${num(c.kg)} kg.`,
          };
        }
        const updatedLine: MonthlyStockLine = {
          ...row,
          outKg,
          outCtn: row.outCtn + (row.kgPerCtn ? diff / row.kgPerCtn : 0),
          note: appendTrace(row.note, id, c.kg, `Cân đối ${ctx.periodLabel}: lấy xả đông ${num(c.kg)} kg`),
        };
        items = items.map((l) => (l.id === row.id ? updatedLine : l));
        touchedLots.add(row.id);
        changed = true;
      }
      continue;
    }

    if (lineKind === "freeze-deposit") {
      const oldParts = a ? freezeDepositByDay(a) : new Map<string, number>();
      const newParts = b ? freezeDepositByDay(b) : new Map<string, number>();
      const newLocation = b?.stockLocation ?? "";
      if (!newLocation) {
        if (b && mapsDiffer(oldParts, newParts) && [...newParts.values()].some((v) => v > 0))
          return { lines, changed: false, carriedCount: 0, error: "Chọn kho gửi trước khi ghi số Gửi đông." };
        if (b) continue; // chưa chọn kho: chưa có gì trong sổ để đặt
      }
      const { warehouse, storageLocation } = splitDepositLocation(newLocation);
      /* Tên lô gửi = NGUYÊN LIỆU người dùng chọn trên dòng (lưu ở `name`, VD "2 da lớn" —
         chốt 2026-10-16); chưa chọn ⇒ tên họ NL của kỳ như trước. */
      const depositName = (r: BalancingInputItem | undefined) =>
        r && r.name.trim() && r.name !== BALANCING_STOCK_LINE_NAMES["freeze-deposit"] ? r.name.trim() : ctx.materialFamily;
      for (const date of [...new Set([...oldParts.keys(), ...newParts.keys()])].sort()) {
        const kg = newParts.get(date) ?? 0;
        if (
          a &&
          b &&
          (oldParts.get(date) ?? 0) === kg &&
          a.stockLocation === b.stockLocation &&
          (a.stockCategory ?? "") === (b.stockCategory ?? "") &&
          a.unitPrice === b.unitPrice &&
          depositName(a) === depositName(b)
        )
          continue; // ngày này không đổi gì
        const did = freezeDepositRowId(id, date);
        const existing = items.find((l) => l.id === did);
        if (kg === 0) {
          if (existing) {
            items = items.filter((l) => l.id !== did);
            touchedLots.add(did);
            changed = true;
          }
          continue;
        }
        const month = monthOfDate(date);
        ensureMonth(month);
        const row: MonthlyStockLine = {
          id: did,
          period: month,
          /* Nhóm người dùng chọn; chưa chọn ⇒ giữ nhóm lô đã ghi (lô cũ ở nhóm "Nguyên liệu
             gửi đông" không tự dời), lô mới ⇒ nhóm mặc định. */
          category: b?.stockCategory || existing?.category || DEFAULT_DEPOSIT_CATEGORY,
          warehouse,
          itemName: depositName(b),
          size: "",
          origin: `GĐ-${date.replace(/-/g, "")}`,
          importDate: date,
          storageLocation,
          kgPerCtn: existing?.kgPerCtn ?? null,
          unitPrice: b?.unitPrice ?? null,
          openCtn: 0,
          openKg: 0,
          inCtn: existing?.kgPerCtn ? kg / existing.kgPerCtn : 0,
          inKg: kg,
          outCtn: existing?.outCtn ?? 0,
          outKg: existing?.outKg ?? 0,
          carriedFromId: "",
          sortOrder: existing?.sortOrder ?? 9000,
          /* Giữ các dòng vết ⟦CĐ:…⟧ của dòng LẤY từ chính lô gửi này (cùng tháng). */
          note: [
            `Gửi đông từ cân đối ${ctx.periodLabel} — ngày gửi ${formatDateVN(date)}`,
            ...(existing?.note ?? "").split("\n").filter((d) => d.startsWith("⟦CĐ:")),
          ].join("\n"),
        };
        const same =
          existing &&
          existing.inKg === row.inKg &&
          existing.warehouse === row.warehouse &&
          existing.storageLocation === row.storageLocation &&
          existing.category === row.category &&
          existing.unitPrice === row.unitPrice &&
          existing.itemName === row.itemName &&
          existing.note === row.note;
        if (same) continue;
        items = existing ? items.map((l) => (l.id === did ? row : l)) : [...items, row];
        touchedLots.add(did);
        changed = true;
      }
    }
  }
  /* Tháng sau ĐÃ MỞ thì tồn đầu của các lô vừa đổi phải đi theo (audit 2026-10-15) — chỉ
     chuỗi dồn kỳ của chính các lô này, không dồn lại cả tháng (giữ tồn đầu đã chốt của lô khác). */
  if (touchedLots.size) {
    const pushed = propagateLotsForward(items, touchedLots);
    if (pushed.touched) {
      items = pushed.lines;
      changed = true;
    }
  }
  return { lines: items, changed, error: null, carriedCount };
}

/* ---------- Kiểm khớp Cân đối ⇄ sổ kho ---------- */

/**
 * Số chỗ sổ kho KHÔNG khớp phần kho của các dòng cân đối (VD sổ tháng bị nạp lại Excel
 * đè mất cột xuất). = số thay đổi mà `syncMonthlyStockLedger(lines, [], rows)` sẽ phải ghi.
 */
export function countMonthlyStockMismatches(
  lines: MonthlyStockLine[],
  rows: BalancingInputItem[]
): number {
  let mismatchCount = 0;
  for (const r of rows) {
    const lineKind = getBalancingStockLineKind(r);
    if (lineKind === "thaw-out" && r.stockLineId) {
      for (const [t, kg] of thawByMonth(r)) {
        const row = findLotLineInMonth(lines, r.stockLineId, t);
        if (!row || Math.abs(getBalancingShareInLot(row, r.id) - kg) > 1e-6) mismatchCount++;
      }
    } else if (lineKind === "freeze-deposit" && r.stockLocation) {
      for (const [date, kg] of freezeDepositByDay(r)) {
        const row = lines.find((l) => l.id === freezeDepositRowId(r.id, date));
        if (!row || Math.abs(row.inKg - kg) > 1e-6) mismatchCount++;
      }
    }
  }
  return mismatchCount;
}

/* ---------- Danh sách chọn ---------- */

/** Chuẩn hoá tên để so: bỏ dấu, "B." → "bach", chỉ giữ chữ số. */
export function normalizeItemName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/\bb\.\s*/g, "bach ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Độ khớp tên lô với họ NL của kỳ: số từ của họ có mặt trong tên lô. */
export function scoreNameMatch(itemName: string, materialFamily: string): number {
  const fromDate = new Set(normalizeItemName(itemName).split(" "));
  return normalizeItemName(materialFamily)
    .split(" ")
    .filter((w) => w && fromDate.has(w)).length;
}

export interface LotOption {
  value: string;
  label: string;
  subLabel: string;
  /** Tồn cuối hiện tại của lô (đã gồm phần cân đối đã lấy). */
  stockKg: number;
  /** Đơn giá của lô — gợi ý đơn giá dòng Lấy xả đông. */
  price: number | null;
}

/**
 * Lô để chọn LẤY XẢ ĐÔNG trong tháng `month` (tháng chưa mở ⇒ xem trước phần kế thừa,
 * id `carry|…` tất định nên chọn trước, ghi sau vẫn trúng). Chỉ lô còn tồn (+ lô đang
 * chọn). Lô trùng tên họ NL của kỳ lên đầu.
 */
export function listThawLotOptions(
  lines: MonthlyStockLine[],
  month: string,
  materialFamily: string,
  selected: string[] = []
): LotOption[] {
  const { lines: items } = ensureMonthOpened(lines, month);
  const keepIds = new Set(selected);
  return items
    .filter((l) => l.period === month)
    .map((l): MonthlyStockRow => deriveRow(l))
    .filter((r) => r.closeKg > 1e-9 || keepIds.has(r.id))
    .sort(
      (a, b) =>
        scoreNameMatch(b.itemName, materialFamily) - scoreNameMatch(a.itemName, materialFamily) ||
        shortLocationName(a).localeCompare(shortLocationName(b), "vi") ||
        a.itemName.localeCompare(b.itemName, "vi") ||
        (a.importDate || "").localeCompare(b.importDate || "")
    )
    .map((r) => ({
      value: r.id,
      // Nhãn KHÔNG mở đầu bằng kho (người dùng bỏ 2026-10-16 — thừa); kho nằm cuối dòng phụ,
      // vẫn gõ tên kho để tìm được (Combobox tìm theo nhãn + dòng phụ).
      label: `${r.itemName}${r.size ? ` ${r.size}` : ""}${r.origin ? ` · ${r.origin}` : ""}`,
      // Giá của lô (giá lúc gửi với lô gửi đông) — kế toán thấy ngay khi chọn lô để lấy.
      subLabel: `còn ${num(r.closeKg)} kg${r.importDate ? ` · nhập ${formatDateVN(r.importDate)}` : ""}${
        r.unitPrice != null ? ` · giá ${num(r.unitPrice)} đ` : ""
      } · ${shortLocationName(r)}`,
      stockKg: r.closeKg,
      price: r.unitPrice,
    }));
}

/**
 * Kho để chọn GỬI ĐÔNG: kho xí nghiệp (sổ riêng) + nơi để hàng (danh mục kho lưu và vị
 * trí đã dùng trong sổ). Kho ngoài ghi vào sổ kho đang quản lý nó nhiều nhất.
 */
export function listDepositLocationOptions(
  lines: MonthlyStockLine[],
  plantWarehouses: string[],
  storageLocations: string[]
): { value: string; label: string; subLabel?: string }[] {
  const qtyByLocation = new Map<string, Map<string, number>>();
  for (const l of lines) {
    if (!l.storageLocation) continue;
    const m = qtyByLocation.get(l.storageLocation) ?? new Map<string, number>();
    m.set(l.warehouse, (m.get(l.warehouse) ?? 0) + 1);
    qtyByLocation.set(l.storageLocation, m);
  }
  const mainWarehouseOf = (vt: string) => {
    const m = qtyByLocation.get(vt);
    if (!m) return DEFAULT_LEDGER_WAREHOUSE;
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };
  const result: { value: string; label: string; subLabel?: string }[] = [];
  const existing = new Set<string>();
  for (const k of plantWarehouses) {
    if (existing.has(k)) continue;
    existing.add(k);
    result.push({ value: joinDepositLocation(k, ""), label: k });
  }
  for (const vt of [...storageLocations, ...qtyByLocation.keys()]) {
    if (!vt || existing.has(vt)) continue;
    existing.add(vt);
    const num = mainWarehouseOf(vt);
    result.push({ value: joinDepositLocation(num, vt), label: vt, subLabel: `sổ ${num}` });
  }
  return result;
}

/* ---------- Gửi đông: chọn BẢNG (nhóm) của Sổ kho tháng để gửi vào ---------- */

export interface DepositTargetRow {
  id: string;
  category: string;
  itemName: string;
  size: string;
  origin: string;
  warehouse: string;
  storageLocation: string;
  closeKg: number;
  unitPrice: number | null;
}

export interface DepositTargetGroup {
  category: string;
  rows: DepositTargetRow[];
}

/**
 * Các bảng (nhóm) của Sổ kho tháng `month` để chọn chỗ GỬI ĐÔNG trong hộp "Gửi vào sổ
 * kho" — xem và đối chiếu ngay ở Cân đối, khỏi qua lại màn Sổ kho tháng. Gồm nhóm gợi ý
 * mặc định (kể cả đang trống) + nhóm đang có trong sổ; BỎ nhóm cũ "Nguyên liệu gửi đông".
 * Dòng trong nhóm: tên trùng họ NL của kỳ lên đầu, rồi theo tên. Tháng chưa mở ⇒ xem
 * trước phần kế thừa (như chọn lô lấy xả đông).
 */
export function listDepositTargets(lines: MonthlyStockLine[], month: string, materialFamily: string): DepositTargetGroup[] {
  const { lines: items } = ensureMonthOpened(lines, month);
  const byCategory = new Map<string, DepositTargetRow[]>();
  for (const c of MONTHLY_STOCK_CATEGORIES) byCategory.set(c, []);
  for (const l of items) {
    if (l.period !== month || l.category === LEGACY_FREEZE_DEPOSIT_CATEGORY) continue;
    const d = deriveRow(l);
    const list = byCategory.get(l.category) ?? [];
    list.push({
      id: l.id,
      category: l.category,
      itemName: l.itemName,
      size: l.size,
      origin: l.origin,
      warehouse: l.warehouse,
      storageLocation: l.storageLocation,
      closeKg: d.closeKg,
      unitPrice: l.unitPrice,
    });
    byCategory.set(l.category, list);
  }
  return [...byCategory.entries()].map(([category, rows]) => ({
    category,
    rows: rows.sort(
      (a, b) =>
        scoreNameMatch(b.itemName, materialFamily) - scoreNameMatch(a.itemName, materialFamily) ||
        a.itemName.localeCompare(b.itemName, "vi") ||
        (a.origin || "").localeCompare(b.origin || "")
    ),
  }));
}
