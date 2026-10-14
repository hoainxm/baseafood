// ============================================================
// Tên file cũ: src/lib/kho.ts
// Tên tiếng Việt: Quản lý Tồn kho & Dung tích 5 kho BSF1
// Description: Inventory calculation, batch availability, and 5 BSF1 warehouse capacities
// ============================================================
import type { WipProductionItem, ExportItem, WarehouseInfo, Packaging, LotInput, LotDispatch } from "@/types";
import { BSF1_WAREHOUSES } from "@/types";

/** Tồn của MỘT lô = dòng BTP sản xuất đã duyệt vào kho, trừ đi phần đã xuất. */
export interface LotStock {
  wipId: string;
  productId: string;
  spec: string;
  warehouse: string;
  productionDate: string;
  inKg: number;
  inBlocks: number;
  outKg: number;
  outBlocks: number;
  remainingKg: number; // kg còn = nhập − xuất
  remainingBlocks: number;
}

/** Một lô đã gắn cho dòng trừ tồn (truy xuất QR). kg null = gắn mà chưa cân. */
export interface AssignedLot {
  /** id lô: mẻ SX (BTP) khi trừ tồn BTP · phiếu đóng gói (TP) khi trừ tồn TP theo lô. */
  id: string;
  kg: number | null;
}

/**
 * Dòng trừ tồn không qua lệnh xuất (bán lẻ block thô, phiếu đóng gói tiêu hao BTP).
 * Không gắn lô ⇒ trừ FIFO trên các lô cùng mặt hàng × quy cách. Có `lo` (gắn lô
 * qua truy xuất QR) ⇒ trừ ĐÚNG lô đó trước, phần còn lại mới FIFO — để sổ tồn và
 * hộ chiếu lô nói cùng một lô.
 */
export interface StockDeduction {
  productId: string;
  spec: string;
  quantityKg: number;
  lots?: readonly AssignedLot[];
}

/**
 * Tính tồn từng lô (bất biến: tồn = nhập − xuất). Chỉ lô `da-nhap` mới tính tồn;
 * `cho-nhap` (chưa duyệt) KHÔNG có trong kho. Xuất gom theo `sanXuatId` từ dòng lệnh.
 *
 * `banLe` (tùy chọn) = các dòng trừ tồn trực tiếp (bán lẻ, đóng gói — không qua lệnh
 * xuất). Trừ SUY từ dòng, nên xóa dòng là tồn tự hồi — không cần logic đảo. KHÔNG gồm
 * dòng handoff của Đơn đặt (đã trừ qua `dongLenh`) — bên gọi lọc theo marker trước.
 *
 * Thứ tự trừ (mọi dòng cùng đi qua từng bước, để dòng FIFO không ăn mất lô mà dòng
 * khác đã gắn):
 *   1. lô gắn CÓ kg   → trừ đúng lô, đúng kg (không vượt phần lô còn);
 *   2. lô gắn CHƯA cân → FIFO trong các lô đã gắn của dòng đó;
 *   3. phần còn lại    → FIFO trên lô cùng (mặt hàng × quy cách), lô SX sớm trước.
 * Lô gắn khác mặt hàng của dòng bị bỏ qua (gắn nhầm) — phần đó rơi xuống FIFO.
 * Không dòng nào gắn lô ⇒ kết quả y như trước khi có truy xuất (chỉ còn bước 3).
 */
export function computeWipStock(
  wips: WipProductionItem[],
  exportItems: ExportItem[],
  retailSales: StockDeduction[] = []
): LotStock[] {
  return computeWipStockDetail(wips, exportItems, retailSales).los;
}

/**
 * Phần dòng trừ tồn KHÔNG phân được vào lô nào (mọi lô cùng mặt hàng × quy cách
 * đã về 0, hoặc không có lô) — tức bán/đóng gói VƯỢT số đang trữ. Lô không bao
 * giờ âm vì bán lẻ, nên phần này phải trả ra ngoài để màn gọi tên, không được nuốt.
 */
export interface Oversale {
  productId: string;
  spec: string;
  kg: number;
}

export interface LotStockResult {
  los: LotStock[];
  /** Bán vượt theo (mặt hàng × quy cách); rỗng khi không vượt. */
  oversales: Oversale[];
  totalOversoldKg: number;
}

const result = (los: LotStock[], oversales: Oversale[]): LotStockResult => ({
  los,
  oversales,
  totalOversoldKg: oversales.reduce((s, v) => s + v.kg, 0),
});

/**
 * Như `computeWipStock`, kèm phần BÁN VƯỢT (dòng trừ tồn không còn lô nào để trừ).
 * Bất biến: Σ remainingKg các lô − totalOversoldKg = nhập − xuất lệnh − mọi dòng `banLe`
 * (cùng con số sổ NXT `inventoryFinished` khi không có tồn đầu khai tay).
 */
export function computeWipStockDetail(
  wips: WipProductionItem[],
  exportItems: ExportItem[],
  retailSales: readonly StockDeduction[] = []
): LotStockResult {
  const outByLot = new Map<string, { kg: number; block: number }>();
  for (const d of exportItems) {
    const cur = outByLot.get(d.wipId) ?? { kg: 0, block: 0 };
    cur.kg += d.quantityKg || 0;
    cur.block += d.blocksCount || 0;
    outByLot.set(d.wipId, cur);
  }
  const los = wips
    .filter((s) => s.status === "stocked")
    .map((s) => {
      const x = outByLot.get(s.id) ?? { kg: 0, block: 0 };
      return {
        wipId: s.id,
        productId: s.productId,
        spec: s.spec,
        warehouse: s.warehouse,
        productionDate: s.productionDate,
        inKg: s.quantityKg,
        inBlocks: s.blocksCount,
        outKg: x.kg,
        outBlocks: x.block,
        remainingKg: s.quantityKg - x.kg,
        remainingBlocks: s.blocksCount - x.block,
      };
    });

  return result(los, retailSales.length ? deductByLot(los, retailSales) : []);
}

/**
 * Trừ các dòng `banLe` vào danh sách lô `los` (sửa tại chỗ) theo đúng thứ tự ở
 * `computeWipStock`: lô gắn có kg → lô gắn chưa cân (FIFO trong lô gắn) → FIFO theo
 * (mặt hàng × quy cách). Dùng chung cho tồn BTP (mẻ SX) và tồn TP theo lô (phiếu
 * đóng gói) — `LotStock.wipId` khi đó là id phiếu đóng gói.
 * Trả về phần KHÔNG trừ được vào lô nào (bán vượt) theo (mặt hàng × quy cách).
 */
function deductByLot(los: LotStock[], retailSales: readonly StockDeduction[]): Oversale[] {
  /** Trừ tối đa `kg` khỏi một lô (không vượt phần lô còn). Trả kg đã trừ. */
  const deductFromLot = (lot: LotStock, kg: number): number => {
    const take = Math.min(kg, Math.max(0, lot.remainingKg));
    if (take <= 0) return 0;
    const ty = lot.remainingKg > 0 ? take / lot.remainingKg : 0;
    lot.remainingBlocks = Math.max(0, lot.remainingBlocks - Math.round(lot.remainingBlocks * ty));
    lot.remainingKg -= take;
    lot.outKg += take;
    return take;
  };
  const fifo = (a: LotStock, b: LotStock) => a.productionDate.localeCompare(b.productionDate) || a.wipId.localeCompare(b.wipId);
  const theoId = new Map(los.map((l) => [l.wipId, l]));
  const lotOfRow = (b: StockDeduction, g: AssignedLot) => {
    const lot = theoId.get(g.id);
    return lot && lot.productId === b.productId ? lot : undefined;
  };
  const remaining = retailSales.map((b) => b.quantityKg || 0);

  // 1. Lô gắn có kg — trừ đúng lô.
  retailSales.forEach((b, i) => {
    for (const g of b.lots ?? []) {
      if (g.kg == null || !(g.kg > 0) || remaining[i]! <= 0) continue;
      const lot = lotOfRow(b, g);
      if (lot) remaining[i]! -= deductFromLot(lot, Math.min(g.kg, remaining[i]!));
    }
  });
  // 2. Lô gắn chưa cân — FIFO trong các lô đã gắn của dòng.
  retailSales.forEach((b, i) => {
    if (remaining[i]! <= 0) return;
    const items = (b.lots ?? [])
      .filter((g) => g.kg == null)
      .map((g) => lotOfRow(b, g))
      .filter((lot): lot is LotStock => !!lot)
      .sort(fifo);
    for (const lot of items) {
      if (remaining[i]! <= 0) break;
      remaining[i]! -= deductFromLot(lot, remaining[i]!);
    }
  });
  // 3. Phần còn lại — FIFO theo (mặt hàng × quy cách) như trước.
  const pendingDeduct = new Map<string, Oversale>();
  retailSales.forEach((b, i) => {
    if (remaining[i]! <= 0) return;
    const k = `${b.productId}|${b.spec}`;
    const cur = pendingDeduct.get(k);
    if (cur) cur.kg += remaining[i]!;
    else pendingDeduct.set(k, { productId: b.productId, spec: b.spec, kg: remaining[i]! });
  });
  const theoKey = new Map<string, LotStock[]>();
  for (const lot of los) {
    const k = `${lot.productId}|${lot.spec}`;
    const arr = theoKey.get(k);
    if (arr) arr.push(lot);
    else theoKey.set(k, [lot]);
  }
  const oversales: Oversale[] = [];
  for (const [k, can] of pendingDeduct) {
    let remainingKg = can.kg;
    const arr = theoKey.get(k) ?? [];
    arr.sort(fifo);
    for (const lot of arr) {
      if (remainingKg <= 0) break;
      remainingKg -= deductFromLot(lot, remainingKg);
    }
    // Sai số dấu phẩy động (0.1 + 0.2…) không phải bán vượt.
    if (remainingKg > 1e-6) oversales.push({ productId: can.productId, spec: can.spec, kg: remainingKg });
  }
  return oversales;
}

/** Marker `sales_items.sourceWarehouse`: bán block thô ⇒ trừ tồn BTP dự trữ. */
export const RETAIL_WAREHOUSE = "Kho dự trữ";
/** Marker `sales_items.sourceWarehouse`: bán hàng đóng gói ⇒ trừ tồn thành phẩm (G3). */
export const FG_WAREHOUSE = "Kho thành phẩm";

/**
 * Lọc các dòng bán lẻ (trừ tồn) từ sổ bán theo marker nguồn.
 * Mặc định `RETAIL_WAREHOUSE` (bán block thô, trừ tồn BTP). Truyền `FG_WAREHOUSE` để lấy
 * dòng bán hàng đóng gói (trừ tồn TP). Bỏ handoff Đơn đặt ("Lưu trữ") và dòng cũ ("").
 *
 * `loGan` (mig 0056 `lot_dispatches`): dòng bán đã gắn lô ⇒ kèm `lo` để trừ đúng lô
 * (block thô: lô BTP `W` · đóng gói: lô TP `P`).
 */
export function filterRetailSales(
  salesItems: { id?: string; productId: string; spec: string; quantityKg: number; sourceWarehouse: string }[],
  marker: string = RETAIL_WAREHOUSE,
  assignedLots: readonly LotDispatch[] = []
): StockDeduction[] {
  const lotKind = marker === FG_WAREHOUSE ? "P" : "W";
  return salesItems
    .filter((r) => r.sourceWarehouse === marker)
    .map((r) => {
      const lot = r.id
        ? assignedLots
            .filter((d) => d.docKind === "sales_item" && d.docId === r.id && d.lotKind === lotKind)
            .map((d) => ({ id: d.lotId, kg: d.quantityKg }))
        : [];
      return { productId: r.productId, spec: r.spec, quantityKg: r.quantityKg, ...(lot.length ? { lots: lot } : {}) };
    });
}

/**
 * Mọi dòng trừ tồn BTP ngoài lệnh xuất: bán lẻ block thô + phiếu đóng gói tiêu
 * hao BTP, KÈM lô đã gắn (truy xuất QR). MỘT chỗ dựng để các màn tồn (kho dự trữ,
 * kho lạnh, đơn đặt, đóng gói, bán hàng) ra cùng một con số theo lô.
 */
export function collectWipDeductions(
  salesItems: { id?: string; productId: string; spec: string; quantityKg: number; sourceWarehouse: string }[],
  packagings: Packaging[],
  lotInputs: readonly LotInput[] = [],
  lotDispatches: readonly LotDispatch[] = []
): StockDeduction[] {
  return [...filterRetailSales(salesItems, RETAIL_WAREHOUSE, lotDispatches), ...collectPackagingDeductions(packagings, lotInputs)];
}

/** Khả dụng (kg) cho một (mặt hàng × quy cách): tổng phần còn lại các lô. */
export function getAvailableKg(
  stock: LotStock[],
  productId: string,
  spec: string
): number {
  return stock
    .filter((t) => t.productId === productId && t.spec === spec)
    .reduce((s, t) => s + Math.max(0, t.remainingKg), 0);
}

/** Lô còn hàng của (mặt hàng × quy cách), FIFO — lô cũ (ngày SX sớm) trước. */
export function listLotsWithStock(
  stock: LotStock[],
  productId: string,
  spec: string
): LotStock[] {
  return stock
    .filter(
      (t) => t.productId === productId && t.spec === spec && t.remainingKg > 0
    )
    .sort((a, b) => a.productionDate.localeCompare(b.productionDate));
}

/** Lấy thông tin kho BSF1 theo tên hoặc mã kho. */
export function getWarehouseInfo(nameOrCode: string): WarehouseInfo | undefined {
  if (!nameOrCode) return undefined;
  const key = nameOrCode.trim().toLowerCase();
  return BSF1_WAREHOUSES.find(
    (w) =>
      w.name.toLowerCase() === key ||
      w.code.toLowerCase() === key ||
      w.id.toLowerCase() === key
  );
}

export interface WarehouseOccupancy {
  warehouse: WarehouseInfo;
  currentKg: number;
  capacityKg: number;
  percentage: number;
  isOverCapacity: boolean;
}

/** Tính mức độ sử dụng (%) của từng kho BSF1 từ danh sách lô tồn. */
export function computeWarehouseOccupancy(stock: LotStock[]): WarehouseOccupancy[] {
  const stockByWarehouse = new Map<string, number>();
  for (const t of stock) {
    if (!t.warehouse) continue;
    const cur = stockByWarehouse.get(t.warehouse) ?? 0;
    stockByWarehouse.set(t.warehouse, cur + Math.max(0, t.remainingKg));
  }

  return BSF1_WAREHOUSES.map((wh) => {
    // gom ton theo name / code
    let totalKg = 0;
    for (const [k, kgVal] of stockByWarehouse.entries()) {
      if (
        k === wh.name ||
        k === wh.code ||
        k.toLowerCase().includes(wh.name.toLowerCase())
      ) {
        totalKg += kgVal;
      }
    }
    const pct = wh.capacityKg > 0 ? (totalKg / wh.capacityKg) * 100 : 0;
    return {
      warehouse: wh,
      currentKg: totalKg,
      capacityKg: wh.capacityKg,
      percentage: Math.round(pct * 10) / 10,
      isOverCapacity: totalKg > wh.capacityKg,
    };
  });
}

/* ---------- Đóng gói BTP → Thành phẩm (G3) ---------- */

/**
 * Phiếu đóng gói TIÊU HAO BTP — trả về dạng `StockDeduction` để trừ tồn BTP (dùng
 * cùng tham số `banLe` của `computeWipStock`). Nhờ vậy BTP đã đóng gói không còn tính là
 * tồn dự trữ nữa. Truyền kèm với `filterRetailSales(sales)` ở các màn tồn.
 */
export function collectPackagingDeductions(packagings: Packaging[], lotInputs: readonly LotInput[] = []): StockDeduction[] {
  return packagings.map((p) => {
    // Phiếu đã gắn lô BTP (truy xuất QR, mig 0046) ⇒ trừ đúng lô đó trước.
    const lot = lotInputs
      .filter((l) => l.outputKind === "P" && l.outputId === p.id && l.inputKind === "W")
      .map((l) => ({ id: l.inputId, kg: l.quantityKg }));
    return {
      productId: p.fromProductId,
      spec: p.fromSpec,
      quantityKg: p.inputKg,
      ...(lot.length ? { lots: lot } : {}),
    };
  });
}

/** Tồn thành phẩm đóng gói theo (mặt hàng × quy cách): output đóng gói − bán TP. */
export interface FinishedGoodStock {
  productId: string;
  spec: string;
  outputKg: number;
  outputUnits: number;
  soldKg: number;
  remainingKg: number; // kg còn = output − bán
}

/**
 * Tồn TP đóng gói (SUY). `banLeTP` = dòng bán LẺ chọn nguồn "Kho thành phẩm"
 * (marker `FG_WAREHOUSE`). Trừ suy nên xóa dòng bán/đóng gói là tồn tự hồi.
 */
export function computeFinishedGoodStock(packagings: Packaging[], finishedGoodRetail: StockDeduction[] = []): FinishedGoodStock[] {
  const map = new Map<string, FinishedGoodStock>();
  const take = (productId: string, spec: string): FinishedGoodStock => {
    const k = `${productId}|${spec}`;
    let cur = map.get(k);
    if (!cur) {
      cur = { productId, spec, outputKg: 0, outputUnits: 0, soldKg: 0, remainingKg: 0 };
      map.set(k, cur);
    }
    return cur;
  };
  for (const p of packagings) {
    const cur = take(p.toProductId, p.toSpec);
    cur.outputKg += p.outputKg || 0;
    cur.outputUnits += p.outputUnits || 0;
  }
  for (const b of finishedGoodRetail) {
    take(b.productId, b.spec).soldKg += b.quantityKg || 0;
  }
  const arr = [...map.values()];
  for (const t of arr) t.remainingKg = t.outputKg - t.soldKg;
  return arr;
}

/** Tồn TP khả dụng của một (mặt hàng × quy cách). */
export function getAvailableFinishedGoodKg(finishedGoodStock: FinishedGoodStock[], productId: string, spec: string): number {
  const t = finishedGoodStock.find((x) => x.productId === productId && x.spec === spec);
  return t ? t.remainingKg : 0;
}

/**
 * Tồn TP THEO LÔ (mỗi phiếu đóng gói là một lô TP `P:<id>`) — tách được lô nào
 * còn bao nhiêu, cho hộ chiếu lô và gắn lô khi bán. `banLeTP` = `filterRetailSales(sales,
 * FG_WAREHOUSE, loGan)`: dòng đã gắn lô TP trừ đúng lô, còn lại FIFO (phiếu đóng gói sớm
 * trước). Ở kết quả, `wipId` là id PHIẾU ĐÓNG GÓI, `inBlocks` là số thùng/gói ra.
 *
 * KHÔNG phải lúc nào cũng cùng tổng với `computeFinishedGoodStock`: lô không xuống âm, nên khi bán
 * vượt số đã đóng gói thì `computeFinishedGoodStock` âm còn Σ theo lô dừng ở 0. Cần phần vượt ⇒
 * dùng `computeFinishedGoodLotStockDetail` (Σ remainingKg − totalOversoldKg = tổng `computeFinishedGoodStock`).
 */
export function computeFinishedGoodLotStock(packagings: Packaging[], finishedGoodRetail: readonly StockDeduction[] = []): LotStock[] {
  return computeFinishedGoodLotStockDetail(packagings, finishedGoodRetail).los;
}

/** Như `computeFinishedGoodLotStock`, kèm phần bán vượt (bán TP không còn phiếu đóng gói nào để trừ). */
export function computeFinishedGoodLotStockDetail(packagings: Packaging[], finishedGoodRetail: readonly StockDeduction[] = []): LotStockResult {
  const los: LotStock[] = packagings.map((p) => ({
    wipId: p.id,
    productId: p.toProductId,
    spec: p.toSpec,
    warehouse: p.warehouse,
    productionDate: p.date,
    inKg: p.outputKg || 0,
    inBlocks: p.outputUnits || 0,
    outKg: 0,
    outBlocks: 0,
    remainingKg: p.outputKg || 0,
    remainingBlocks: p.outputUnits || 0,
  }));
  return result(los, finishedGoodRetail.length ? deductByLot(los, finishedGoodRetail) : []);
}
