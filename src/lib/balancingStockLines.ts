// ============================================================
// Tên file: src/lib/balancingStockLines.ts
// Tên tiếng Việt: Hai dòng kho của Cân đối ⇄ Sổ kho theo tháng (hàm thuần)
// Description: Balancing stock rows (draw-from-lot / send-to-freezer) ⇄ monthly stock ledger
// ============================================================
import type { BalancingInputItem, MonthlyStockLine } from "@/types";
import { getBalancingStockLineKind } from "@/lib/balancingGrid";
import { carryForwardIntoLedger, suyDong, getNextMonth, type MonthlyStockRow } from "@/lib/monthlyStock";
import { num, formatDateVN } from "@/lib/format";

/**
 * VÌ SAO — khối NL ở Cân đối có hai dòng kho (chốt 2026-10-06):
 *   - LẤY XẢ ĐÔNG: lấy NL đông ra chế biến từ một LÔ chọn ĐÍCH DANH (dòng của Sổ kho
 *     tháng: kho · tên · invoice). Kg của tháng ghi vào cột XUẤT của đúng lô đó.
 *   - GỬI ĐÔNG: NL không chế biến, cất kho. Mỗi NGÀY GỬI là MỘT LÔ RIÊNG trong sổ (nhóm
 *     "Nguyên liệu gửi đông", invoice `GĐ-yyyymmdd`, ngày nhập = ngày gửi) — tách khỏi
 *     lô nhập khẩu / mua ngoài cho khỏi nhầm, truy ngược được về kỳ cân đối.
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

export const FREEZE_DEPOSIT_CATEGORY = "Nguyên liệu gửi đông";
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

/* ---------- Tháng của sổ ---------- */

/**
 * Bảo đảm tháng `thang` đã MỞ: chưa có dòng nào thì kế thừa tồn cuối từ tháng gần nhất
 * TRƯỚC đó có dòng, dồn qua từng tháng (tối đa 24) — id `carry|…` tất định nên chạy lại
 * không nhân đôi. Tháng đã có dòng (dù một) thì để nguyên: dồn lúc đó dễ cộng đôi.
 */
export function ensureMonthOpened(
  lines: MonthlyStockLine[],
  month: string
): { lines: MonthlyStockLine[]; keThua: number } {
  if (lines.some((l) => l.period === month)) return { lines, keThua: 0 };
  const prevRows = [...new Set(lines.map((l) => l.period))].filter((p) => p < month).sort();
  const tu = prevRows[prevRows.length - 1];
  if (!tu) return { lines, keThua: 0 };
  let items = lines;
  let carriedCount = 0;
  let source = tu;
  for (let i = 0; i < 24 && source < month; i++) {
    const nextMonth = getNextMonth(source);
    if (!items.some((l) => l.period === nextMonth)) {
      // Cùng hàm ghi dồn kỳ của màn Sổ kho tháng (không thay cả dòng đã có).
      const result = carryForwardIntoLedger(items, nextMonth);
      items = result.lines;
      carriedCount += result.soDong;
    }
    source = nextMonth;
  }
  return { lines: items, keThua: carriedCount };
}

/**
 * Dòng sổ của LÔ `loId` trong tháng `thang`: chính nó nếu cùng tháng, tháng sau theo
 * chuỗi dồn kỳ `carry|<id>` (id dồn tất định). Không có ⇒ null (lô đã hết, chưa dồn).
 */
export function findLotLineInMonth(
  lines: MonthlyStockLine[],
  loId: string,
  month: string
): MonthlyStockLine | null {
  const original = lines.find((l) => l.id === loId);
  if (!original || original.period > month) return null;
  let id = loId;
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
function appendTrace(note: string, rowId: string, kg: number, chu: string): string {
  const dongs = (note ?? "").split("\n").filter((d) => d.length > 0 && !reVet(rowId).test(d));
  if (Math.abs(kg) > 1e-9) dongs.push(`⟦CĐ:${rowId}:${+kg.toFixed(3)}⟧ ${chu}`);
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
  nhanKy: string;
  /** Tên HỌ nguyên liệu của kỳ — tên lô gửi đông trong sổ. */
  hoNL: string;
}

export interface MonthlyStockSyncResult {
  lines: MonthlyStockLine[];
  /** Có đổi gì trong sổ không (khỏi ghi thừa). */
  doi: boolean;
  /** Lỗi chặn ghi (VD vượt tồn lô, chưa chọn lô) — có lỗi thì KHÔNG ghi gì. */
  loi: string | null;
  /** Số dòng sổ tự kế thừa sang tháng chưa mở. */
  keThua: number;
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
  let doi = false;

  const ensureMonth = (t: string) => {
    const result = ensureMonthOpened(items, t);
    if (result.keThua) {
      items = result.lines;
      carriedCount += result.keThua;
      doi = true;
    }
  };

  /** Hai bảng phần (tháng/ngày → kg) có khác nhau không. */
  const mapsDiffer = (x: Map<string, number>, y: Map<string, number>) =>
    [...new Set([...x.keys(), ...y.keys()])].some((k) => (x.get(k) ?? 0) !== (y.get(k) ?? 0));

  for (const id of new Set([...prev.keys(), ...nextById.keys()])) {
    const a = prev.get(id);
    const b = nextById.get(id);
    const lineKind = getBalancingStockLineKind((b ?? a)!);

    if (lineKind === "lay-xa-dong") {
      const prevStockLineId = a?.stockLineId ?? "";
      const nextStockLineId = b?.stockLineId ?? "";
      const oldParts = a ? thawByMonth(a) : new Map<string, number>();
      const newParts = b ? thawByMonth(b) : new Map<string, number>();
      /* Cặp (lô, tháng) cần ĐẶT: lô cũ ⇒ đặt 0 nếu đổi lô; lô mới ⇒ đặt số mới. */
      const can: { lo: string; thang: string; kg: number }[] = [];
      if (prevStockLineId && prevStockLineId !== nextStockLineId) for (const t of oldParts.keys()) can.push({ lo: prevStockLineId, thang: t, kg: 0 });
      if (nextStockLineId) {
        for (const t of new Set([...newParts.keys(), ...(prevStockLineId === nextStockLineId ? oldParts.keys() : [])])) {
          const kg = newParts.get(t) ?? 0;
          /* Cùng lô, tháng không đổi ⇒ bỏ qua (khỏi tự mở tháng khi sửa ô khác). */
          if (a && prevStockLineId === nextStockLineId && (oldParts.get(t) ?? 0) === kg) continue;
          can.push({ lo: nextStockLineId, thang: t, kg });
        }
      } else if (mapsDiffer(oldParts, newParts) && [...newParts.values()].some((v) => v > 0)) {
        /* Chỉ chặn khi CHÍNH dòng này đổi số — dòng cũ có số mà chưa chọn lô (ghi trước khi
           nối sổ kho) không được làm kẹt mọi lần ghi khác của khối NL. */
        return { lines, doi: false, keThua: 0, loi: "Chọn lô (kho · invoice) trước khi ghi số Lấy xả đông." };
      }
      /* Tháng SỚM trước: tháng sau mở bằng kế thừa tồn cuối tháng trước ⇒ phải ghi xuất
         tháng trước xong mới mở, không thì tồn đầu tháng sau đông băng số cũ. */
      can.sort((x, y) => x.thang.localeCompare(y.thang) || (x.kg === 0 ? -1 : 1));
      for (const c of can) {
        ensureMonth(c.thang);
        const dong = findLotLineInMonth(items, c.lo, c.thang);
        if (!dong) {
          if (c.kg === 0) continue; // lô không còn ở tháng đó — không có gì để trả
          return {
            lines,
            doi: false,
            keThua: 0,
            loi: `Lô đã chọn không còn trong sổ kho ${c.thang.slice(5)}/${c.thang.slice(0, 4)} — chọn lô khác.`,
          };
        }
        const existing = getBalancingShareInLot(dong, id);
        const diff = c.kg - existing;
        if (Math.abs(diff) < 1e-9) continue;
        const outKg = dong.outKg + diff;
        const stock = dong.openKg + dong.inKg - outKg;
        if (stock < -1e-6) {
          return {
            lines,
            doi: false,
            keThua: 0,
            loi: `Lô ${shortLocationName(dong)} · ${dong.itemName}${dong.origin ? ` · ${dong.origin}` : ""} chỉ còn ${num(
              dong.openKg + dong.inKg - dong.outKg + existing
            )} kg — không lấy được ${num(c.kg)} kg.`,
          };
        }
        const updatedLine: MonthlyStockLine = {
          ...dong,
          outKg,
          outCtn: dong.outCtn + (dong.kgPerCtn ? diff / dong.kgPerCtn : 0),
          note: appendTrace(dong.note, id, c.kg, `Cân đối ${ctx.nhanKy}: lấy xả đông ${num(c.kg)} kg`),
        };
        items = items.map((l) => (l.id === dong.id ? updatedLine : l));
        doi = true;
      }
      continue;
    }

    if (lineKind === "gui-dong") {
      const oldParts = a ? freezeDepositByDay(a) : new Map<string, number>();
      const newParts = b ? freezeDepositByDay(b) : new Map<string, number>();
      const newLocation = b?.stockLocation ?? "";
      if (!newLocation) {
        if (b && mapsDiffer(oldParts, newParts) && [...newParts.values()].some((v) => v > 0))
          return { lines, doi: false, keThua: 0, loi: "Chọn kho gửi trước khi ghi số Gửi đông." };
        if (b) continue; // chưa chọn kho: chưa có gì trong sổ để đặt
      }
      const { warehouse, storageLocation } = splitDepositLocation(newLocation);
      for (const date of [...new Set([...oldParts.keys(), ...newParts.keys()])].sort()) {
        const kg = newParts.get(date) ?? 0;
        if (
          a &&
          b &&
          (oldParts.get(date) ?? 0) === kg &&
          a.stockLocation === b.stockLocation &&
          a.unitPrice === b.unitPrice
        )
          continue; // ngày này không đổi gì
        const did = freezeDepositRowId(id, date);
        const coSan = items.find((l) => l.id === did);
        if (kg === 0) {
          if (coSan) {
            items = items.filter((l) => l.id !== did);
            doi = true;
          }
          continue;
        }
        const month = monthOfDate(date);
        ensureMonth(month);
        const dong: MonthlyStockLine = {
          id: did,
          period: month,
          category: FREEZE_DEPOSIT_CATEGORY,
          warehouse,
          itemName: ctx.hoNL,
          size: "",
          origin: `GĐ-${date.replace(/-/g, "")}`,
          importDate: date,
          storageLocation,
          kgPerCtn: coSan?.kgPerCtn ?? null,
          unitPrice: b?.unitPrice ?? null,
          openCtn: 0,
          openKg: 0,
          inCtn: coSan?.kgPerCtn ? kg / coSan.kgPerCtn : 0,
          inKg: kg,
          outCtn: coSan?.outCtn ?? 0,
          outKg: coSan?.outKg ?? 0,
          carriedFromId: "",
          sortOrder: coSan?.sortOrder ?? 9000,
          /* Giữ các dòng vết ⟦CĐ:…⟧ của dòng LẤY từ chính lô gửi này (cùng tháng). */
          note: [
            `Gửi đông từ cân đối ${ctx.nhanKy} — ngày gửi ${formatDateVN(date)}`,
            ...(coSan?.note ?? "").split("\n").filter((d) => d.startsWith("⟦CĐ:")),
          ].join("\n"),
        };
        const giong =
          coSan &&
          coSan.inKg === dong.inKg &&
          coSan.warehouse === dong.warehouse &&
          coSan.storageLocation === dong.storageLocation &&
          coSan.unitPrice === dong.unitPrice &&
          coSan.itemName === dong.itemName &&
          coSan.note === dong.note;
        if (giong) continue;
        items = coSan ? items.map((l) => (l.id === did ? dong : l)) : [...items, dong];
        doi = true;
      }
    }
  }
  return { lines: items, doi, loi: null, keThua: carriedCount };
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
    if (lineKind === "lay-xa-dong" && r.stockLineId) {
      for (const [t, kg] of thawByMonth(r)) {
        const dong = findLotLineInMonth(lines, r.stockLineId, t);
        if (!dong || Math.abs(getBalancingShareInLot(dong, r.id) - kg) > 1e-6) mismatchCount++;
      }
    } else if (lineKind === "gui-dong" && r.stockLocation) {
      for (const [date, kg] of freezeDepositByDay(r)) {
        const dong = lines.find((l) => l.id === freezeDepositRowId(r.id, date));
        if (!dong || Math.abs(dong.inKg - kg) > 1e-6) mismatchCount++;
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
  const tu = new Set(normalizeItemName(itemName).split(" "));
  return normalizeItemName(materialFamily)
    .split(" ")
    .filter((w) => w && tu.has(w)).length;
}

export interface LotOption {
  value: string;
  label: string;
  phu: string;
  /** Tồn cuối hiện tại của lô (đã gồm phần cân đối đã lấy). */
  ton: number;
  /** Đơn giá của lô — gợi ý đơn giá dòng Lấy xả đông. */
  gia: number | null;
}

/**
 * Lô để chọn LẤY XẢ ĐÔNG trong tháng `thang` (tháng chưa mở ⇒ xem trước phần kế thừa,
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
    .map((l): MonthlyStockRow => suyDong(l))
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
      label: `${shortLocationName(r)} · ${r.itemName}${r.size ? ` ${r.size}` : ""}${r.origin ? ` · ${r.origin}` : ""}`,
      phu: `còn ${num(r.closeKg)} kg${r.importDate ? ` · nhập ${formatDateVN(r.importDate)}` : ""}`,
      ton: r.closeKg,
      gia: r.unitPrice,
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
): { value: string; label: string; phu?: string }[] {
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
  const ra: { value: string; label: string; phu?: string }[] = [];
  const existing = new Set<string>();
  for (const k of plantWarehouses) {
    if (existing.has(k)) continue;
    existing.add(k);
    ra.push({ value: joinDepositLocation(k, ""), label: k });
  }
  for (const vt of [...storageLocations, ...qtyByLocation.keys()]) {
    if (!vt || existing.has(vt)) continue;
    existing.add(vt);
    const so = mainWarehouseOf(vt);
    ra.push({ value: joinDepositLocation(so, vt), label: vt, phu: `sổ ${so}` });
  }
  return ra;
}
