// ============================================================
// Tên file: src/lib/frozenStockLines.ts
// Tên tiếng Việt: Hàng đông lạnh ghi ở Sản xuất ⇄ nhóm "Hàng tạm" của Sổ kho tháng (hàm thuần)
// Description: Frozen semi-processed goods recorded at /wip → monthly stock ledger lots
// ============================================================
// VÌ SAO (chốt với người dùng 2026-10-15): nhóm "III HÀNG TẠM" của bảng kê kho là hàng
// sơ chế đã cấp đông ở dạng NGUYÊN LIỆU — "2 DA <80GR", "BAO TỬ 2DA", "CÁ TRÁO 140UP"…
// Không phải thành phẩm (đừng đưa vào danh mục mặt hàng). Tổ xưởng ghi ở /wip khối
// "Hàng đông lạnh nhập kho"; Lưu vào sổ ⇒ mỗi dòng thành MỘT LÔ NHẬP trong nhóm Hàng tạm
// của tháng theo ngày SX (cùng khuôn "Gửi đông" của Cân đối — balancingStockLines.ts):
//   - id `wip|<id>` ⇒ dòng sổ THUỘC lần ghi ở /wip, màn Sổ kho tháng nhận ra "Từ SX".
//   - Ngày nhập = ngày SX, Invoice `SX-yyyymmdd`, ghi chú mang vết `⟦SX:<xưởng>⟧`.
//   - Tháng chưa mở ⇒ kế thừa tồn cuối tháng trước TRƯỚC (`ensureMonthOpened`), không thì
//     thêm một dòng làm mất bản xem trước dồn kỳ của tháng đó.
// Tháng sau ĐÃ MỞ ⇒ lô mới được đẩy tiếp sang các tháng đó (`propagateLotsForward`) — không
// thì tồn đầu tháng sau thiếu lô (audit 2026-10-15). Bỏ lô ở /wip ⇒ dọn luôn chuỗi dồn kỳ
// "sạch" của nó; chỉ chặn khi lô đã lấy ra hoặc tháng sau đã có người nhập/xuất/ghi chú trên lô.
import type { MonthlyStockLine } from "@/types";
import { ensureMonthOpened, monthOfDate } from "@/lib/balancingStockLines";
import { carryChainIds, propagateLotsForward } from "@/lib/monthlyStock";

export const TEMPORARY_GOODS_CATEGORY = "Hàng tạm";
export const PRODUCTION_FROZEN_ID_PREFIX = "wip|";
/** Sổ kho mặc định cho hàng đông lạnh từ xưởng (kho cấp đông chính). */
export const DEFAULT_FROZEN_WAREHOUSE = "Kho 1500 tấn";

export interface FrozenStockEntry {
  itemName: string;
  kg: number;
  /** Sổ kho (TÊN kho hệ thống, VD "Kho 1500 tấn"). */
  warehouse: string;
}

export const isProductionFrozenLine = (l: Pick<MonthlyStockLine, "id">) =>
  l.id.startsWith(PRODUCTION_FROZEN_ID_PREFIX);

/** Lô gốc từ SX HOẶC dòng dồn kỳ của nó (`carry|wip|…`, `carry|carry|wip|…`) — để Sổ kho tháng gắn nhãn "Từ SX". */
export const isFromProductionFrozen = (l: Pick<MonthlyStockLine, "id">) => l.id.includes(PRODUCTION_FROZEN_ID_PREFIX);

const MARKER = /⟦SX:([^⟧]*)⟧/;
/** Xưởng ghi lô này (đọc từ vết trong ghi chú). */
export const productionFrozenWorkshop = (l: Pick<MonthlyStockLine, "note">) => MARKER.exec(l.note)?.[1] ?? "";

/** Invoice của lô đông lạnh từ SX: `SX-20261015`. */
export const frozenLotInvoice = (productionDate: string) => `SX-${productionDate.replaceAll("-", "")}`;

/** Đủ để lưu: có tên hàng + kg > 0. */
export const isFrozenEntryComplete = (e: FrozenStockEntry) => Boolean(e.itemName.trim()) && e.kg > 0;

/** Dựng dòng sổ kho (nhóm Hàng tạm) cho các dòng hàng đông lạnh của một phiên ghi. */
export function buildFrozenStockLines(
  entries: FrozenStockEntry[],
  ctx: { productionDate: string; workshop: string; operator: string; newId: () => string }
): MonthlyStockLine[] {
  const period = monthOfDate(ctx.productionDate);
  return entries.filter(isFrozenEntryComplete).map((e, i) => ({
    id: `${PRODUCTION_FROZEN_ID_PREFIX}${ctx.newId()}`,
    period,
    category: TEMPORARY_GOODS_CATEGORY,
    warehouse: e.warehouse || DEFAULT_FROZEN_WAREHOUSE,
    itemName: e.itemName.trim(),
    size: "",
    origin: frozenLotInvoice(ctx.productionDate),
    importDate: ctx.productionDate,
    storageLocation: "",
    kgPerCtn: null,
    unitPrice: null,
    openCtn: 0,
    openKg: 0,
    inCtn: 0,
    inKg: e.kg,
    outCtn: 0,
    outKg: 0,
    carriedFromId: "",
    sortOrder: 9000 + i,
    note: `⟦SX:${ctx.workshop}⟧ Ghi từ Sản xuất thành phẩm${ctx.operator ? ` — ${ctx.operator}` : ""}`,
  }));
}

/**
 * Ghi các dòng mới vào sổ: mở tháng (kế thừa) nếu chưa có dòng nào, nối thêm, rồi ĐẨY TIẾP
 * lô mới sang các tháng sau đã mở. `propagated` = số dòng dồn kỳ được thêm/cập nhật.
 */
export function addFrozenStockToLedger(
  ledger: MonthlyStockLine[],
  newLines: MonthlyStockLine[]
): { lines: MonthlyStockLine[]; carriedCount: number; propagated: number } {
  let lines = ledger;
  let carriedCount = 0;
  for (const month of [...new Set(newLines.map((l) => l.period))]) {
    const opened = ensureMonthOpened(lines, month);
    lines = opened.lines;
    carriedCount += opened.carriedCount;
  }
  const pushed = propagateLotsForward([...lines, ...newLines], newLines.map((l) => l.id));
  return { lines: pushed.lines, carriedCount, propagated: pushed.touched };
}

/** Dòng dồn kỳ có ai ĐỤNG chưa (nhập / xuất / ghi chú) — chưa thì xóa theo lô được. */
const isTouchedCarry = (l: MonthlyStockLine) =>
  l.inKg !== 0 || l.outKg !== 0 || l.inCtn !== 0 || l.outCtn !== 0 || Boolean((l.note ?? "").trim());

/** Lý do KHÔNG cho xóa lô ở /wip (rỗng = xóa được). */
export function frozenLineRemovalBlocker(line: MonthlyStockLine, ledger: MonthlyStockLine[]): string {
  if (line.outKg > 0 || line.outCtn > 0)
    return "Lô này đã có số lấy ra ở Sổ kho tháng — sửa hay xóa ở đó.";
  const chain = carryChainIds(ledger, line.id);
  if (ledger.some((l) => chain.includes(l.id) && isTouchedCarry(l)))
    return "Tháng sau đã có số lấy ra / ghi chú trên lô này ở Sổ kho tháng — sửa hay xóa ở đó.";
  return "";
}

/** Bỏ một lô (ghi sai) khỏi sổ + dọn chuỗi dồn kỳ của nó ở các tháng sau. Gọi sau khi blocker rỗng. */
export function removeFrozenLot(ledger: MonthlyStockLine[], lotId: string): MonthlyStockLine[] {
  return propagateLotsForward(
    ledger.filter((l) => l.id !== lotId),
    [lotId]
  ).lines;
}

/** Lô đông lạnh từ SX của một ngày · xưởng (cho sổ ngày ở /wip). */
export function frozenLinesOf(
  ledger: MonthlyStockLine[],
  fromDate: string,
  toDate: string,
  workshop: string | "Tất cả"
): MonthlyStockLine[] {
  return ledger
    .filter(
      (l) =>
        isProductionFrozenLine(l) &&
        l.importDate >= fromDate &&
        l.importDate <= toDate &&
        (workshop === "Tất cả" || productionFrozenWorkshop(l) === workshop)
    )
    .sort((a, b) => a.importDate.localeCompare(b.importDate) || a.sortOrder - b.sortOrder);
}
