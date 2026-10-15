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
// Xóa ở /wip chỉ khi lô chưa bị lấy ra và chưa dồn sang tháng sau — đã có thì sửa ở Sổ kho tháng.
import type { MonthlyStockLine } from "@/types";
import { ensureMonthOpened, monthOfDate } from "@/lib/balancingStockLines";

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

/** Ghi các dòng mới vào sổ: mở tháng (kế thừa) nếu chưa có dòng nào rồi nối thêm. */
export function addFrozenStockToLedger(
  ledger: MonthlyStockLine[],
  newLines: MonthlyStockLine[]
): { lines: MonthlyStockLine[]; carriedCount: number } {
  let lines = ledger;
  let carriedCount = 0;
  for (const month of [...new Set(newLines.map((l) => l.period))]) {
    const opened = ensureMonthOpened(lines, month);
    lines = opened.lines;
    carriedCount += opened.carriedCount;
  }
  return { lines: [...lines, ...newLines], carriedCount };
}

/** Lý do KHÔNG cho xóa lô ở /wip (rỗng = xóa được). */
export function frozenLineRemovalBlocker(line: MonthlyStockLine, ledger: MonthlyStockLine[]): string {
  if (line.outKg > 0 || line.outCtn > 0)
    return "Lô này đã có số lấy ra ở Sổ kho tháng — sửa hay xóa ở đó.";
  if (ledger.some((l) => l.carriedFromId === line.id && l.openKg !== 0))
    return "Lô này đã dồn sang tháng sau ở Sổ kho tháng — sửa hay xóa ở đó.";
  return "";
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
