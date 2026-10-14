// ============================================================
// Tên file: src/lib/inventoryFinished.ts
// Tên tiếng Việt: Sổ Nhập–Xuất–Tồn kho BÁN THÀNH PHẨM (cấp đông dự trữ)
// Description: WIP-reserve (BTP) NXT ledger — pure, no React
// ============================================================
import type {
  WipProductionItem,
  ExportOrder,
  ExportItem,
  SalesItem,
  FinishedGoodsOpeningStock,
  Product,
  Packaging,
} from "@/types";
import { RETAIL_WAREHOUSE } from "@/lib/inventory";

/**
 * VÌ SAO CÓ FILE NÀY — khép vòng phía KHO BTP DỰ TRỮ (đối xứng inventoryMaterial.ts
 * cho nguyên liệu). Suy TỒN hoàn toàn từ dữ liệu đã ghi, không ghi tay lần hai:
 *
 *   Tồn cuối = Tồn đầu + Nhập kho − Xuất kho
 *
 *   - Nhập kho = BTP sản xuất đã DUYỆT vào kho (status "stocked"), theo ngày SX.
 *   - Xuất kho (3 luồng, đúng mô hình 2 kho của inventory.ts):
 *       • Xuất đơn đặt   = dòng lệnh xuất container (theo ngày lệnh).
 *       • Xuất bán lẻ    = phiếu bán block thô rút từ KHO DỰ TRỮ
 *                          (sourceWarehouse === RETAIL_WAREHOUSE), theo ngày bán.
 *       • Xuất đóng gói  = BTP tiêu hao để đóng gói ra thành phẩm G3 (inputKg),
 *                          theo ngày đóng gói.
 *   - Tồn đầu = khai tay + (nhập − xuất) từ MỐC khai tay tới TRƯỚC kỳ (suy lịch sử).
 *     QUY TẮC MỐC — chung với sổ NL (`inventoryMaterial.computeMaterialTotalStock`): khai tay có
 *     mốc asOfDate ≤ CUỐI khoảng xem đều áp (mốc giữa khoảng cũng áp — xem "Năm");
 *     phát sinh TRƯỚC mốc coi như đã nằm trong số khai tay ⇒ bỏ (không cộng chồng);
 *     mốc sau khoảng xem ⇒ chưa áp. Mốc tính theo (mặt hàng × quy cách), lấy mốc mới nhất.
 *
 * ĂN KHỚP với màn Kho dự trữ / Kho lạnh (`inventory.computeWipStockDetail(... banLe = [
 *   ...filterRetailSales(banHang, RETAIL_WAREHOUSE), ...collectPackagingDeductions(packagings) ])`): cùng định
 *   nghĩa "xuất", NHƯNG hai chỗ KHÔNG bằng nhau tuyệt đối:
 *   • Tồn đầu khai tay (FinishedGoodsOpeningStock) CHỈ có ở sổ này — sổ tồn theo lô
 *     không có lô cho số khai tay, và vẫn tính mọi mẻ kể cả trước mốc. Không khai tay
 *     + không bán vượt ⇒ Tồn cuối (xem tới hôm nay) == Tổng tồn Kho dự trữ; có khai
 *     tay ⇒ hai số lệch nhau đúng phần khai tay / phát sinh trước mốc.
 *   • Bán/đóng gói VƯỢT tồn: lô không xuống âm ⇒ Kho dự trữ báo riêng "bán vượt X kg"
 *     (`tongBanVuot`), còn ở đây trừ thẳng nên tồn cuối âm (isNegative).
 *   KHÔNG đếm hai lần: bán đóng gói (FG_WAREHOUSE) rút từ kho THÀNH PHẨM riêng (computeFinishedGoodStock),
 *   không đụng kho này; handoff đơn đặt (FG_WAREHOUSE/"Đơn đặt") cũng bỏ qua vì đã tính ở
 *   "xuất đơn".
 *
 * BỘ DÒ LỖI: tồn cuối < 0 = xuất nhiều hơn số đang trữ → sai ghi chép, màn gọi tên.
 * ⚠️ v1 — đối chiếu tay với một mặt hàng có số thật trước khi tin con số.
 */

export interface FinishedGoodNxtRow {
  productId: string;
  productCode: string;
  productName: string;
  spec: string;
  openingKg: number;
  inKg: number; // BTP da-nhap trong kỳ
  orderOutKg: number; // xuất đơn đặt (dòng lệnh) trong kỳ
  retailOutKg: number; // bán lẻ block rút kho dự trữ (RETAIL_WAREHOUSE) trong kỳ
  packagingOutKg: number; // BTP tiêu hao để đóng gói TP (G3) trong kỳ
  outKg: number; // orderOutKg + retailOutKg + packagingOutKg
  closingKg: number;
  openingBlocks: number;
  inBlocks: number;
  outBlocks: number; // block xuất đơn (bán lẻ/đóng gói không theo dõi block chắc)
  closingBlocks: number;
  isNegative: boolean;
  hasManualOpening: boolean; // có tồn đầu khai tay
}

interface Acc {
  productId: string;
  spec: string;
  openKg: number;
  openBlock: number;
  inBeforeKg: number;
  inBeforeBlocks: number;
  inPeriodKg: number;
  inPeriodBlocks: number;
  orderOutBeforeKg: number;
  orderOutBeforeBlocks: number;
  orderOutPeriodKg: number;
  orderOutPeriodBlocks: number;
  retailOutBeforeKg: number;
  retailOutPeriodKg: number;
  packagingOutBeforeKg: number;
  packagingOutPeriodKg: number;
  seed: boolean;
  /** Mốc khai tay mới nhất (yyyy-mm-dd) — phát sinh trước mốc đã nằm trong số khai. */
  anchorDate: string;
}

function productKey(productId: string, spec: string): string {
  return `${productId}|||${spec}`;
}

function layAcc(map: Map<string, Acc>, productId: string, spec: string): Acc {
  const k = productKey(productId, spec);
  let a = map.get(k);
  if (!a) {
    a = {
      productId,
      spec,
      openKg: 0,
      openBlock: 0,
      inBeforeKg: 0,
      inBeforeBlocks: 0,
      inPeriodKg: 0,
      inPeriodBlocks: 0,
      orderOutBeforeKg: 0,
      orderOutBeforeBlocks: 0,
      orderOutPeriodKg: 0,
      orderOutPeriodBlocks: 0,
      retailOutBeforeKg: 0,
      retailOutPeriodKg: 0,
      packagingOutBeforeKg: 0,
      packagingOutPeriodKg: 0,
      seed: false,
      anchorDate: "",
    };
    map.set(k, a);
  }
  return a;
}

export interface FinishedGoodNxtArgs {
  wips: WipProductionItem[];
  exportOrders: ExportOrder[];
  exportItems: ExportItem[];
  salesItems: SalesItem[];
  packagings: Packaging[];
  opening: FinishedGoodsOpeningStock[];
  products: Product[];
  fromDate: string;
  toDate: string;
}

/**
 * Dựng sổ NXT kho BTP dự trữ theo (mặt hàng × quy cách) cho khoảng [fromDate, toDate].
 * Tồn đầu = khai tay (mốc ≤ toDate) + lịch sử nhập−xuất từ mốc tới TRƯỚC fromDate
 * ⇒ chuyển kỳ tự động.
 */
export function computeFinishedGoodNxt(args: FinishedGoodNxtArgs): FinishedGoodNxtRow[] {
  const { wips, exportOrders, exportItems, salesItems, packagings, opening, products, fromDate, toDate } = args;
  const map = new Map<string, Acc>();

  // Ngày xuất của mỗi lệnh
  const exportDateById = new Map<string, string>();
  for (const l of exportOrders) exportDateById.set(l.id, l.exportDate);

  // Tồn đầu khai tay: áp khi mốc ≤ CUỐI khoảng xem (mốc giữa khoảng cũng áp).
  for (const o of opening) {
    if (o.asOfDate && o.asOfDate > toDate) continue;
    const a = layAcc(map, o.productId, o.spec);
    a.openKg += o.quantityKg || 0;
    a.openBlock += o.blocksCount || 0;
    a.seed = true;
    if (o.asOfDate && o.asOfDate > a.anchorDate) a.anchorDate = o.asOfDate;
  }
  /** Phát sinh trước mốc khai tay đã nằm trong số khai ⇒ bỏ, không cộng chồng. */
  const isBeforeCutoff = (a: Acc, date: string) => !!a.anchorDate && date < a.anchorDate;

  // Nhập kho = BTP đã duyệt (da-nhap), theo ngày SX
  for (const s of wips) {
    if (s.status !== "stocked") continue;
    if (s.productionDate > toDate) continue;
    const a = layAcc(map, s.productId, s.spec);
    if (isBeforeCutoff(a, s.productionDate)) continue;
    if (s.productionDate < fromDate) {
      a.inBeforeKg += s.quantityKg || 0;
      a.inBeforeBlocks += s.blocksCount || 0;
    } else {
      a.inPeriodKg += s.quantityKg || 0;
      a.inPeriodBlocks += s.blocksCount || 0;
    }
  }

  // Xuất đơn đặt = dòng lệnh, theo ngày lệnh xuất
  for (const d of exportItems) {
    const date = exportDateById.get(d.exportId);
    if (!date || date > toDate) continue;
    const a = layAcc(map, d.productId, d.spec);
    if (isBeforeCutoff(a, date)) continue;
    if (date < fromDate) {
      a.orderOutBeforeKg += d.quantityKg || 0;
      a.orderOutBeforeBlocks += d.blocksCount || 0;
    } else {
      a.orderOutPeriodKg += d.quantityKg || 0;
      a.orderOutPeriodBlocks += d.blocksCount || 0;
    }
  }

  // Xuất bán lẻ = phiếu bán block thô rút KHO DỰ TRỮ (marker RETAIL_WAREHOUSE), theo ngày bán
  for (const b of salesItems) {
    if (b.sourceWarehouse !== RETAIL_WAREHOUSE) continue; // chỉ bán lẻ rút kho dự trữ mới trừ tồn BTP
    if (b.deliveryDate > toDate) continue;
    const a = layAcc(map, b.productId, b.spec);
    if (isBeforeCutoff(a, b.deliveryDate)) continue;
    if (b.deliveryDate < fromDate) a.retailOutBeforeKg += b.quantityKg || 0;
    else a.retailOutPeriodKg += b.quantityKg || 0;
  }

  // Xuất đóng gói = BTP tiêu hao (inputKg) để đóng gói TP, theo ngày đóng gói
  for (const p of packagings) {
    if (p.date > toDate) continue;
    const a = layAcc(map, p.fromProductId, p.fromSpec);
    if (isBeforeCutoff(a, p.date)) continue;
    if (p.date < fromDate) a.packagingOutBeforeKg += p.inputKg || 0;
    else a.packagingOutPeriodKg += p.inputKg || 0;
  }

  const productNameOf = (id: string) => products.find((m) => m.id === id);
  const rows: FinishedGoodNxtRow[] = [];
  for (const a of map.values()) {
    const openingKg =
      a.openKg + a.inBeforeKg - a.orderOutBeforeKg - a.retailOutBeforeKg - a.packagingOutBeforeKg;
    const outKg = a.orderOutPeriodKg + a.retailOutPeriodKg + a.packagingOutPeriodKg;
    const closingKg = openingKg + a.inPeriodKg - outKg;
    const openingBlocks = a.openBlock + a.inBeforeBlocks - a.orderOutBeforeBlocks;
    const closingBlocks = openingBlocks + a.inPeriodBlocks - a.orderOutPeriodBlocks;

    // Bỏ dòng hoàn toàn trống (không tồn, không phát sinh trong kỳ)
    if (openingKg === 0 && a.inPeriodKg === 0 && outKg === 0 && closingKg === 0) continue;

    const p = productNameOf(a.productId);
    rows.push({
      productId: a.productId,
      productCode: p?.code || "",
      productName: p?.name || `Mặt hàng ${a.productId}`,
      spec: a.spec,
      openingKg,
      inKg: a.inPeriodKg,
      orderOutKg: a.orderOutPeriodKg,
      retailOutKg: a.retailOutPeriodKg,
      packagingOutKg: a.packagingOutPeriodKg,
      outKg,
      closingKg,
      openingBlocks,
      inBlocks: a.inPeriodBlocks,
      outBlocks: a.orderOutPeriodBlocks,
      closingBlocks,
      isNegative: closingKg < 0,
      hasManualOpening: a.seed,
    });
  }

  rows.sort(
    (x, y) =>
      x.productName.localeCompare(y.productName, "vi") ||
      x.spec.localeCompare(y.spec, "vi")
  );
  return rows;
}

export interface FinishedGoodNxtTotals {
  openingKg: number;
  inKg: number;
  orderOutKg: number;
  retailOutKg: number;
  packagingOutKg: number;
  outKg: number;
  closingKg: number;
  productCount: number;
  warningCount: number;
}

export function sumFinishedGoodNxt(rows: FinishedGoodNxtRow[]): FinishedGoodNxtTotals {
  return {
    openingKg: rows.reduce((s, r) => s + r.openingKg, 0),
    inKg: rows.reduce((s, r) => s + r.inKg, 0),
    orderOutKg: rows.reduce((s, r) => s + r.orderOutKg, 0),
    retailOutKg: rows.reduce((s, r) => s + r.retailOutKg, 0),
    packagingOutKg: rows.reduce((s, r) => s + r.packagingOutKg, 0),
    outKg: rows.reduce((s, r) => s + r.outKg, 0),
    closingKg: rows.reduce((s, r) => s + r.closingKg, 0),
    productCount: rows.length,
    warningCount: rows.filter((r) => r.isNegative).length,
  };
}
