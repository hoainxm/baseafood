// ============================================================
// Tên file cũ: src/lib/kho.ts
// Tên tiếng Việt: Quản lý Tồn kho & Dung tích 5 kho BSF1
// Description: Inventory calculation, batch availability, and 5 BSF1 warehouse capacities
// ============================================================
import type { WipProductionItem, ExportItem, WarehouseInfo, Packaging, LotInput, LotDispatch } from "@/types";
import { BSF1_WAREHOUSES } from "@/types";

/** Tồn của MỘT lô = dòng BTP sản xuất đã duyệt vào kho, trừ đi phần đã xuất. */
export interface LoTon {
  wipId: string;
  productId: string;
  spec: string;
  warehouse: string;
  ngaySX: string;
  luongNhap: number;
  blockNhap: number;
  luongXuat: number;
  blockXuat: number;
  conLai: number; // kg còn = nhập − xuất
  blockConLai: number;
}

/** Một lô đã gắn cho dòng trừ tồn (truy xuất QR). kg null = gắn mà chưa cân. */
export interface LoGan {
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
export interface BanLeTruTon {
  productId: string;
  spec: string;
  quantityKg: number;
  lo?: readonly LoGan[];
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
export function tinhTon(
  wips: WipProductionItem[],
  exportItems: ExportItem[],
  retailSales: BanLeTruTon[] = []
): LoTon[] {
  return tinhTonChiTiet(wips, exportItems, retailSales).los;
}

/**
 * Phần dòng trừ tồn KHÔNG phân được vào lô nào (mọi lô cùng mặt hàng × quy cách
 * đã về 0, hoặc không có lô) — tức bán/đóng gói VƯỢT số đang trữ. Lô không bao
 * giờ âm vì bán lẻ, nên phần này phải trả ra ngoài để màn gọi tên, không được nuốt.
 */
export interface BanVuot {
  productId: string;
  spec: string;
  kg: number;
}

export interface KetQuaTon {
  los: LoTon[];
  /** Bán vượt theo (mặt hàng × quy cách); rỗng khi không vượt. */
  banVuot: BanVuot[];
  tongBanVuot: number;
}

const ketQua = (los: LoTon[], banVuot: BanVuot[]): KetQuaTon => ({
  los,
  banVuot,
  tongBanVuot: banVuot.reduce((s, v) => s + v.kg, 0),
});

/**
 * Như `tinhTon`, kèm phần BÁN VƯỢT (dòng trừ tồn không còn lô nào để trừ).
 * Bất biến: Σ conLai các lô − tongBanVuot = nhập − xuất lệnh − mọi dòng `banLe`
 * (cùng con số sổ NXT `inventoryFinished` khi không có tồn đầu khai tay).
 */
export function tinhTonChiTiet(
  wips: WipProductionItem[],
  exportItems: ExportItem[],
  retailSales: readonly BanLeTruTon[] = []
): KetQuaTon {
  const outByLot = new Map<string, { kg: number; block: number }>();
  for (const d of exportItems) {
    const cur = outByLot.get(d.wipId) ?? { kg: 0, block: 0 };
    cur.kg += d.quantityKg || 0;
    cur.block += d.blocksCount || 0;
    outByLot.set(d.wipId, cur);
  }
  const los = wips
    .filter((s) => s.status === "da-nhap")
    .map((s) => {
      const x = outByLot.get(s.id) ?? { kg: 0, block: 0 };
      return {
        wipId: s.id,
        productId: s.productId,
        spec: s.spec,
        warehouse: s.warehouse,
        ngaySX: s.productionDate,
        luongNhap: s.quantityKg,
        blockNhap: s.blocksCount,
        luongXuat: x.kg,
        blockXuat: x.block,
        conLai: s.quantityKg - x.kg,
        blockConLai: s.blocksCount - x.block,
      };
    });

  return ketQua(los, retailSales.length ? deductByLot(los, retailSales) : []);
}

/**
 * Trừ các dòng `banLe` vào danh sách lô `los` (sửa tại chỗ) theo đúng thứ tự ở
 * `tinhTon`: lô gắn có kg → lô gắn chưa cân (FIFO trong lô gắn) → FIFO theo
 * (mặt hàng × quy cách). Dùng chung cho tồn BTP (mẻ SX) và tồn TP theo lô (phiếu
 * đóng gói) — `LoTon.wipId` khi đó là id phiếu đóng gói.
 * Trả về phần KHÔNG trừ được vào lô nào (bán vượt) theo (mặt hàng × quy cách).
 */
function deductByLot(los: LoTon[], retailSales: readonly BanLeTruTon[]): BanVuot[] {
  /** Trừ tối đa `kg` khỏi một lô (không vượt phần lô còn). Trả kg đã trừ. */
  const deductFromLot = (lo: LoTon, kg: number): number => {
    const lay = Math.min(kg, Math.max(0, lo.conLai));
    if (lay <= 0) return 0;
    const ty = lo.conLai > 0 ? lay / lo.conLai : 0;
    lo.blockConLai = Math.max(0, lo.blockConLai - Math.round(lo.blockConLai * ty));
    lo.conLai -= lay;
    lo.luongXuat += lay;
    return lay;
  };
  const fifo = (a: LoTon, b: LoTon) => a.ngaySX.localeCompare(b.ngaySX) || a.wipId.localeCompare(b.wipId);
  const theoId = new Map(los.map((l) => [l.wipId, l]));
  const lotOfRow = (b: BanLeTruTon, g: LoGan) => {
    const lo = theoId.get(g.id);
    return lo && lo.productId === b.productId ? lo : undefined;
  };
  const con = retailSales.map((b) => b.quantityKg || 0);

  // 1. Lô gắn có kg — trừ đúng lô.
  retailSales.forEach((b, i) => {
    for (const g of b.lo ?? []) {
      if (g.kg == null || !(g.kg > 0) || con[i]! <= 0) continue;
      const lo = lotOfRow(b, g);
      if (lo) con[i]! -= deductFromLot(lo, Math.min(g.kg, con[i]!));
    }
  });
  // 2. Lô gắn chưa cân — FIFO trong các lô đã gắn của dòng.
  retailSales.forEach((b, i) => {
    if (con[i]! <= 0) return;
    const ds = (b.lo ?? [])
      .filter((g) => g.kg == null)
      .map((g) => lotOfRow(b, g))
      .filter((lo): lo is LoTon => !!lo)
      .sort(fifo);
    for (const lo of ds) {
      if (con[i]! <= 0) break;
      con[i]! -= deductFromLot(lo, con[i]!);
    }
  });
  // 3. Phần còn lại — FIFO theo (mặt hàng × quy cách) như trước.
  const pendingDeduct = new Map<string, BanVuot>();
  retailSales.forEach((b, i) => {
    if (con[i]! <= 0) return;
    const k = `${b.productId}|${b.spec}`;
    const cur = pendingDeduct.get(k);
    if (cur) cur.kg += con[i]!;
    else pendingDeduct.set(k, { productId: b.productId, spec: b.spec, kg: con[i]! });
  });
  const theoKey = new Map<string, LoTon[]>();
  for (const lo of los) {
    const k = `${lo.productId}|${lo.spec}`;
    const arr = theoKey.get(k);
    if (arr) arr.push(lo);
    else theoKey.set(k, [lo]);
  }
  const banVuot: BanVuot[] = [];
  for (const [k, can] of pendingDeduct) {
    let conKey = can.kg;
    const arr = theoKey.get(k) ?? [];
    arr.sort(fifo);
    for (const lo of arr) {
      if (conKey <= 0) break;
      conKey -= deductFromLot(lo, conKey);
    }
    // Sai số dấu phẩy động (0.1 + 0.2…) không phải bán vượt.
    if (conKey > 1e-6) banVuot.push({ productId: can.productId, spec: can.spec, kg: conKey });
  }
  return banVuot;
}

/** Marker `sales_items.sourceWarehouse`: bán block thô ⇒ trừ tồn BTP dự trữ. */
export const KHO_BAN_LE = "Kho dự trữ";
/** Marker `sales_items.sourceWarehouse`: bán hàng đóng gói ⇒ trừ tồn thành phẩm (G3). */
export const KHO_TP = "Kho thành phẩm";

/**
 * Lọc các dòng bán lẻ (trừ tồn) từ sổ bán theo marker nguồn.
 * Mặc định `KHO_BAN_LE` (bán block thô, trừ tồn BTP). Truyền `KHO_TP` để lấy
 * dòng bán hàng đóng gói (trừ tồn TP). Bỏ handoff Đơn đặt ("Lưu trữ") và dòng cũ ("").
 *
 * `loGan` (mig 0056 `lot_dispatches`): dòng bán đã gắn lô ⇒ kèm `lo` để trừ đúng lô
 * (block thô: lô BTP `W` · đóng gói: lô TP `P`).
 */
export function locBanLe(
  salesItems: { id?: string; productId: string; spec: string; quantityKg: number; sourceWarehouse: string }[],
  marker: string = KHO_BAN_LE,
  assignedLots: readonly LotDispatch[] = []
): BanLeTruTon[] {
  const lotKind = marker === KHO_TP ? "P" : "W";
  return salesItems
    .filter((r) => r.sourceWarehouse === marker)
    .map((r) => {
      const lo = r.id
        ? assignedLots
            .filter((d) => d.docKind === "sales_item" && d.docId === r.id && d.lotKind === lotKind)
            .map((d) => ({ id: d.lotId, kg: d.quantityKg }))
        : [];
      return { productId: r.productId, spec: r.spec, quantityKg: r.quantityKg, ...(lo.length ? { lo } : {}) };
    });
}

/**
 * Mọi dòng trừ tồn BTP ngoài lệnh xuất: bán lẻ block thô + phiếu đóng gói tiêu
 * hao BTP, KÈM lô đã gắn (truy xuất QR). MỘT chỗ dựng để các màn tồn (kho dự trữ,
 * kho lạnh, đơn đặt, đóng gói, bán hàng) ra cùng một con số theo lô.
 */
export function truTonBTP(
  salesItems: { id?: string; productId: string; spec: string; quantityKg: number; sourceWarehouse: string }[],
  packagings: Packaging[],
  lotInputs: readonly LotInput[] = [],
  lotDispatches: readonly LotDispatch[] = []
): BanLeTruTon[] {
  return [...locBanLe(salesItems, KHO_BAN_LE, lotDispatches), ...dongGoiTruTon(packagings, lotInputs)];
}

/** Khả dụng (kg) cho một (mặt hàng × quy cách): tổng phần còn lại các lô. */
export function khaDung(
  stock: LoTon[],
  productId: string,
  spec: string
): number {
  return stock
    .filter((t) => t.productId === productId && t.spec === spec)
    .reduce((s, t) => s + Math.max(0, t.conLai), 0);
}

/** Lô còn hàng của (mặt hàng × quy cách), FIFO — lô cũ (ngày SX sớm) trước. */
export function loConHang(
  stock: LoTon[],
  productId: string,
  spec: string
): LoTon[] {
  return stock
    .filter(
      (t) => t.productId === productId && t.spec === spec && t.conLai > 0
    )
    .sort((a, b) => a.ngaySX.localeCompare(b.ngaySX));
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
export function tinhDungTichKho(stock: LoTon[]): WarehouseOccupancy[] {
  const stockByWarehouse = new Map<string, number>();
  for (const t of stock) {
    if (!t.warehouse) continue;
    const cur = stockByWarehouse.get(t.warehouse) ?? 0;
    stockByWarehouse.set(t.warehouse, cur + Math.max(0, t.conLai));
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
 * Phiếu đóng gói TIÊU HAO BTP — trả về dạng `BanLeTruTon` để trừ tồn BTP (dùng
 * cùng tham số `banLe` của `tinhTon`). Nhờ vậy BTP đã đóng gói không còn tính là
 * tồn dự trữ nữa. Truyền kèm với `locBanLe(sales)` ở các màn tồn.
 */
export function dongGoiTruTon(packagings: Packaging[], lotInputs: readonly LotInput[] = []): BanLeTruTon[] {
  return packagings.map((p) => {
    // Phiếu đã gắn lô BTP (truy xuất QR, mig 0046) ⇒ trừ đúng lô đó trước.
    const lo = lotInputs
      .filter((l) => l.outputKind === "P" && l.outputId === p.id && l.inputKind === "W")
      .map((l) => ({ id: l.inputId, kg: l.quantityKg }));
    return {
      productId: p.fromProductId,
      spec: p.fromSpec,
      quantityKg: p.inputKg,
      ...(lo.length ? { lo } : {}),
    };
  });
}

/** Tồn thành phẩm đóng gói theo (mặt hàng × quy cách): output đóng gói − bán TP. */
export interface TonTP {
  productId: string;
  spec: string;
  outputKg: number;
  outputUnits: number;
  soldKg: number;
  conLai: number; // kg còn = output − bán
}

/**
 * Tồn TP đóng gói (SUY). `banLeTP` = dòng bán LẺ chọn nguồn "Kho thành phẩm"
 * (marker `KHO_TP`). Trừ suy nên xóa dòng bán/đóng gói là tồn tự hồi.
 */
export function tinhTonTP(packagings: Packaging[], finishedGoodRetail: BanLeTruTon[] = []): TonTP[] {
  const map = new Map<string, TonTP>();
  const lay = (productId: string, spec: string): TonTP => {
    const k = `${productId}|${spec}`;
    let cur = map.get(k);
    if (!cur) {
      cur = { productId, spec, outputKg: 0, outputUnits: 0, soldKg: 0, conLai: 0 };
      map.set(k, cur);
    }
    return cur;
  };
  for (const p of packagings) {
    const cur = lay(p.toProductId, p.toSpec);
    cur.outputKg += p.outputKg || 0;
    cur.outputUnits += p.outputUnits || 0;
  }
  for (const b of finishedGoodRetail) {
    lay(b.productId, b.spec).soldKg += b.quantityKg || 0;
  }
  const arr = [...map.values()];
  for (const t of arr) t.conLai = t.outputKg - t.soldKg;
  return arr;
}

/** Tồn TP khả dụng của một (mặt hàng × quy cách). */
export function khaDungTP(finishedGoodStock: TonTP[], productId: string, spec: string): number {
  const t = finishedGoodStock.find((x) => x.productId === productId && x.spec === spec);
  return t ? t.conLai : 0;
}

/**
 * Tồn TP THEO LÔ (mỗi phiếu đóng gói là một lô TP `P:<id>`) — tách được lô nào
 * còn bao nhiêu, cho hộ chiếu lô và gắn lô khi bán. `banLeTP` = `locBanLe(sales,
 * KHO_TP, loGan)`: dòng đã gắn lô TP trừ đúng lô, còn lại FIFO (phiếu đóng gói sớm
 * trước). Ở kết quả, `wipId` là id PHIẾU ĐÓNG GÓI, `blockNhap` là số thùng/gói ra.
 *
 * KHÔNG phải lúc nào cũng cùng tổng với `tinhTonTP`: lô không xuống âm, nên khi bán
 * vượt số đã đóng gói thì `tinhTonTP` âm còn Σ theo lô dừng ở 0. Cần phần vượt ⇒
 * dùng `tinhTonTPTheoLoChiTiet` (Σ conLai − tongBanVuot = tổng `tinhTonTP`).
 */
export function tinhTonTPTheoLo(packagings: Packaging[], finishedGoodRetail: readonly BanLeTruTon[] = []): LoTon[] {
  return tinhTonTPTheoLoChiTiet(packagings, finishedGoodRetail).los;
}

/** Như `tinhTonTPTheoLo`, kèm phần bán vượt (bán TP không còn phiếu đóng gói nào để trừ). */
export function tinhTonTPTheoLoChiTiet(packagings: Packaging[], finishedGoodRetail: readonly BanLeTruTon[] = []): KetQuaTon {
  const los: LoTon[] = packagings.map((p) => ({
    wipId: p.id,
    productId: p.toProductId,
    spec: p.toSpec,
    warehouse: p.warehouse,
    ngaySX: p.date,
    luongNhap: p.outputKg || 0,
    blockNhap: p.outputUnits || 0,
    luongXuat: 0,
    blockXuat: 0,
    conLai: p.outputKg || 0,
    blockConLai: p.outputUnits || 0,
  }));
  return ketQua(los, finishedGoodRetail.length ? deductByLot(los, finishedGoodRetail) : []);
}
