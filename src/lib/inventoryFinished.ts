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
 *   - Nhập kho = BTP sản xuất đã DUYỆT vào kho (status "da-nhap"), theo ngày SX.
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
 *     (`tongBanVuot`), còn ở đây trừ thẳng nên tồn cuối âm (canhBaoAm).
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
  tonDau: number;
  nhap: number; // BTP da-nhap trong kỳ
  xuatDon: number; // xuất đơn đặt (dòng lệnh) trong kỳ
  xuatBan: number; // bán lẻ block rút kho dự trữ (RETAIL_WAREHOUSE) trong kỳ
  xuatDongGoi: number; // BTP tiêu hao để đóng gói TP (G3) trong kỳ
  xuat: number; // xuatDon + xuatBan + xuatDongGoi
  tonCuoi: number;
  tonDauBlock: number;
  nhapBlock: number;
  xuatBlock: number; // block xuất đơn (bán lẻ/đóng gói không theo dõi block chắc)
  tonCuoiBlock: number;
  canhBaoAm: boolean;
  seedTonDau: boolean; // có tồn đầu khai tay
}

interface Acc {
  productId: string;
  spec: string;
  openKg: number;
  openBlock: number;
  nhapTruocKg: number;
  nhapTruocBlock: number;
  nhapKyKg: number;
  nhapKyBlock: number;
  xuatDonTruocKg: number;
  xuatDonTruocBlock: number;
  xuatDonKyKg: number;
  xuatDonKyBlock: number;
  xuatBanTruocKg: number;
  xuatBanKyKg: number;
  xuatGoiTruocKg: number;
  xuatGoiKyKg: number;
  seed: boolean;
  /** Mốc khai tay mới nhất (yyyy-mm-dd) — phát sinh trước mốc đã nằm trong số khai. */
  moc: string;
}

function khoaMH(productId: string, spec: string): string {
  return `${productId}|||${spec}`;
}

function layAcc(map: Map<string, Acc>, productId: string, spec: string): Acc {
  const k = khoaMH(productId, spec);
  let a = map.get(k);
  if (!a) {
    a = {
      productId,
      spec,
      openKg: 0,
      openBlock: 0,
      nhapTruocKg: 0,
      nhapTruocBlock: 0,
      nhapKyKg: 0,
      nhapKyBlock: 0,
      xuatDonTruocKg: 0,
      xuatDonTruocBlock: 0,
      xuatDonKyKg: 0,
      xuatDonKyBlock: 0,
      xuatBanTruocKg: 0,
      xuatBanKyKg: 0,
      xuatGoiTruocKg: 0,
      xuatGoiKyKg: 0,
      seed: false,
      moc: "",
    };
    map.set(k, a);
  }
  return a;
}

export interface FinishedGoodNxtArgs {
  sanXuat: WipProductionItem[];
  exportOrders: ExportOrder[];
  exportItems: ExportItem[];
  salesItems: SalesItem[];
  packagings: Packaging[];
  opening: FinishedGoodsOpeningStock[];
  products: Product[];
  tuNgay: string;
  denNgay: string;
}

/**
 * Dựng sổ NXT kho BTP dự trữ theo (mặt hàng × quy cách) cho khoảng [tuNgay, denNgay].
 * Tồn đầu = khai tay (mốc ≤ denNgay) + lịch sử nhập−xuất từ mốc tới TRƯỚC tuNgay
 * ⇒ chuyển kỳ tự động.
 */
export function computeFinishedGoodNxt(args: FinishedGoodNxtArgs): FinishedGoodNxtRow[] {
  const { sanXuat, exportOrders, exportItems, salesItems, packagings, opening, products, tuNgay, denNgay } = args;
  const map = new Map<string, Acc>();

  // Ngày xuất của mỗi lệnh
  const exportDateById = new Map<string, string>();
  for (const l of exportOrders) exportDateById.set(l.id, l.exportDate);

  // Tồn đầu khai tay: áp khi mốc ≤ CUỐI khoảng xem (mốc giữa khoảng cũng áp).
  for (const o of opening) {
    if (o.asOfDate && o.asOfDate > denNgay) continue;
    const a = layAcc(map, o.productId, o.spec);
    a.openKg += o.quantityKg || 0;
    a.openBlock += o.blocksCount || 0;
    a.seed = true;
    if (o.asOfDate && o.asOfDate > a.moc) a.moc = o.asOfDate;
  }
  /** Phát sinh trước mốc khai tay đã nằm trong số khai ⇒ bỏ, không cộng chồng. */
  const isBeforeCutoff = (a: Acc, date: string) => !!a.moc && date < a.moc;

  // Nhập kho = BTP đã duyệt (da-nhap), theo ngày SX
  for (const s of sanXuat) {
    if (s.status !== "da-nhap") continue;
    if (s.productionDate > denNgay) continue;
    const a = layAcc(map, s.productId, s.spec);
    if (isBeforeCutoff(a, s.productionDate)) continue;
    if (s.productionDate < tuNgay) {
      a.nhapTruocKg += s.quantityKg || 0;
      a.nhapTruocBlock += s.blocksCount || 0;
    } else {
      a.nhapKyKg += s.quantityKg || 0;
      a.nhapKyBlock += s.blocksCount || 0;
    }
  }

  // Xuất đơn đặt = dòng lệnh, theo ngày lệnh xuất
  for (const d of exportItems) {
    const date = exportDateById.get(d.exportId);
    if (!date || date > denNgay) continue;
    const a = layAcc(map, d.productId, d.spec);
    if (isBeforeCutoff(a, date)) continue;
    if (date < tuNgay) {
      a.xuatDonTruocKg += d.quantityKg || 0;
      a.xuatDonTruocBlock += d.blocksCount || 0;
    } else {
      a.xuatDonKyKg += d.quantityKg || 0;
      a.xuatDonKyBlock += d.blocksCount || 0;
    }
  }

  // Xuất bán lẻ = phiếu bán block thô rút KHO DỰ TRỮ (marker RETAIL_WAREHOUSE), theo ngày bán
  for (const b of salesItems) {
    if (b.sourceWarehouse !== RETAIL_WAREHOUSE) continue; // chỉ bán lẻ rút kho dự trữ mới trừ tồn BTP
    if (b.deliveryDate > denNgay) continue;
    const a = layAcc(map, b.productId, b.spec);
    if (isBeforeCutoff(a, b.deliveryDate)) continue;
    if (b.deliveryDate < tuNgay) a.xuatBanTruocKg += b.quantityKg || 0;
    else a.xuatBanKyKg += b.quantityKg || 0;
  }

  // Xuất đóng gói = BTP tiêu hao (inputKg) để đóng gói TP, theo ngày đóng gói
  for (const p of packagings) {
    if (p.date > denNgay) continue;
    const a = layAcc(map, p.fromProductId, p.fromSpec);
    if (isBeforeCutoff(a, p.date)) continue;
    if (p.date < tuNgay) a.xuatGoiTruocKg += p.inputKg || 0;
    else a.xuatGoiKyKg += p.inputKg || 0;
  }

  const tenMH = (id: string) => products.find((m) => m.id === id);
  const rows: FinishedGoodNxtRow[] = [];
  for (const a of map.values()) {
    const openingKg =
      a.openKg + a.nhapTruocKg - a.xuatDonTruocKg - a.xuatBanTruocKg - a.xuatGoiTruocKg;
    const outKg = a.xuatDonKyKg + a.xuatBanKyKg + a.xuatGoiKyKg;
    const closingKg = openingKg + a.nhapKyKg - outKg;
    const openingBlocks = a.openBlock + a.nhapTruocBlock - a.xuatDonTruocBlock;
    const closingBlocks = openingBlocks + a.nhapKyBlock - a.xuatDonKyBlock;

    // Bỏ dòng hoàn toàn trống (không tồn, không phát sinh trong kỳ)
    if (openingKg === 0 && a.nhapKyKg === 0 && outKg === 0 && closingKg === 0) continue;

    const p = tenMH(a.productId);
    rows.push({
      productId: a.productId,
      productCode: p?.code || "",
      productName: p?.name || `Mặt hàng ${a.productId}`,
      spec: a.spec,
      tonDau: openingKg,
      nhap: a.nhapKyKg,
      xuatDon: a.xuatDonKyKg,
      xuatBan: a.xuatBanKyKg,
      xuatDongGoi: a.xuatGoiKyKg,
      xuat: outKg,
      tonCuoi: closingKg,
      tonDauBlock: openingBlocks,
      nhapBlock: a.nhapKyBlock,
      xuatBlock: a.xuatDonKyBlock,
      tonCuoiBlock: closingBlocks,
      canhBaoAm: closingKg < 0,
      seedTonDau: a.seed,
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
  tonDau: number;
  nhap: number;
  xuatDon: number;
  xuatBan: number;
  xuatDongGoi: number;
  xuat: number;
  tonCuoi: number;
  soMatHang: number;
  soCanhBao: number;
}

export function sumFinishedGoodNxt(rows: FinishedGoodNxtRow[]): FinishedGoodNxtTotals {
  return {
    tonDau: rows.reduce((s, r) => s + r.tonDau, 0),
    nhap: rows.reduce((s, r) => s + r.nhap, 0),
    xuatDon: rows.reduce((s, r) => s + r.xuatDon, 0),
    xuatBan: rows.reduce((s, r) => s + r.xuatBan, 0),
    xuatDongGoi: rows.reduce((s, r) => s + r.xuatDongGoi, 0),
    xuat: rows.reduce((s, r) => s + r.xuat, 0),
    tonCuoi: rows.reduce((s, r) => s + r.tonCuoi, 0),
    soMatHang: rows.length,
    soCanhBao: rows.filter((r) => r.canhBaoAm).length,
  };
}
