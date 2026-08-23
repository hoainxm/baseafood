// ============================================================
// Tên file cũ: src/lib/kho.ts
// Tên tiếng Việt: Quản lý Tồn kho & Dung tích 5 kho BSF1
// Description: Inventory calculation, batch availability, and 5 BSF1 warehouse capacities
// ============================================================
import type { WipProductionItem, ExportItem, WarehouseInfo, Packaging } from "@/types";
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

/** Dòng bán lẻ trừ tồn (không gắn lô): trừ theo FIFO trên các lô cùng mặt hàng × quy cách. */
export interface BanLeTruTon {
  productId: string;
  spec: string;
  quantityKg: number;
}

/**
 * Tính tồn từng lô (bất biến: tồn = nhập − xuất). Chỉ lô `da-nhap` mới tính tồn;
 * `cho-nhap` (chưa duyệt) KHÔNG có trong kho. Xuất gom theo `sanXuatId` từ dòng lệnh.
 *
 * `banLe` (tùy chọn) = các dòng bán LẺ trực tiếp (không qua lệnh xuất, không gắn lô).
 * Trừ FIFO trên lô cùng (mặt hàng × quy cách), lô SX sớm trước. Vì trừ SUY từ dòng
 * bán, xóa dòng bán là tồn tự hồi — không cần logic đảo. KHÔNG gồm dòng handoff của
 * Đơn đặt (đã trừ qua `dongLenh`) — bên gọi lọc theo marker bán lẻ trước khi truyền vào.
 */
export function tinhTon(
  sanXuat: WipProductionItem[],
  dongLenh: ExportItem[],
  banLe: BanLeTruTon[] = []
): LoTon[] {
  const xuatTheoLo = new Map<string, { kg: number; block: number }>();
  for (const d of dongLenh) {
    const cur = xuatTheoLo.get(d.wipId) ?? { kg: 0, block: 0 };
    cur.kg += d.quantityKg || 0;
    cur.block += d.blocksCount || 0;
    xuatTheoLo.set(d.wipId, cur);
  }
  const los = sanXuat
    .filter((s) => s.status === "da-nhap")
    .map((s) => {
      const x = xuatTheoLo.get(s.id) ?? { kg: 0, block: 0 };
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

  if (banLe.length) {
    const canTru = new Map<string, number>();
    for (const b of banLe) {
      const k = `${b.productId}|${b.spec}`;
      canTru.set(k, (canTru.get(k) ?? 0) + (b.quantityKg || 0));
    }
    const theoKey = new Map<string, LoTon[]>();
    for (const lo of los) {
      const k = `${lo.productId}|${lo.spec}`;
      const arr = theoKey.get(k);
      if (arr) arr.push(lo);
      else theoKey.set(k, [lo]);
    }
    for (const [k, arr] of theoKey) {
      let con = canTru.get(k) ?? 0;
      if (con <= 0) continue;
      arr.sort((a, b) => a.ngaySX.localeCompare(b.ngaySX) || a.wipId.localeCompare(b.wipId));
      for (const lo of arr) {
        if (con <= 0) break;
        const lay = Math.min(con, Math.max(0, lo.conLai));
        if (lay <= 0) continue;
        const ty = lo.conLai > 0 ? lay / lo.conLai : 0;
        lo.blockConLai = Math.max(0, lo.blockConLai - Math.round(lo.blockConLai * ty));
        lo.conLai -= lay;
        lo.luongXuat += lay;
        con -= lay;
      }
    }
  }
  return los;
}

/** Marker `sales_items.sourceWarehouse`: bán block thô ⇒ trừ tồn BTP dự trữ. */
export const KHO_BAN_LE = "Kho dự trữ";
/** Marker `sales_items.sourceWarehouse`: bán hàng đóng gói ⇒ trừ tồn thành phẩm (G3). */
export const KHO_TP = "Kho thành phẩm";

/**
 * Lọc các dòng bán lẻ (trừ tồn) từ sổ bán theo marker nguồn.
 * Mặc định `KHO_BAN_LE` (bán block thô, trừ tồn BTP). Truyền `KHO_TP` để lấy
 * dòng bán hàng đóng gói (trừ tồn TP). Bỏ handoff Đơn đặt ("Lưu trữ") và dòng cũ ("").
 */
export function locBanLe(
  banHang: { productId: string; spec: string; quantityKg: number; sourceWarehouse: string }[],
  marker: string = KHO_BAN_LE
): BanLeTruTon[] {
  return banHang
    .filter((r) => r.sourceWarehouse === marker)
    .map((r) => ({ productId: r.productId, spec: r.spec, quantityKg: r.quantityKg }));
}

/** Khả dụng (kg) cho một (mặt hàng × quy cách): tổng phần còn lại các lô. */
export function khaDung(
  ton: LoTon[],
  productId: string,
  spec: string
): number {
  return ton
    .filter((t) => t.productId === productId && t.spec === spec)
    .reduce((s, t) => s + Math.max(0, t.conLai), 0);
}

/** Lô còn hàng của (mặt hàng × quy cách), FIFO — lô cũ (ngày SX sớm) trước. */
export function loConHang(
  ton: LoTon[],
  productId: string,
  spec: string
): LoTon[] {
  return ton
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
export function tinhDungTichKho(ton: LoTon[]): WarehouseOccupancy[] {
  const tonTheoKho = new Map<string, number>();
  for (const t of ton) {
    if (!t.warehouse) continue;
    const cur = tonTheoKho.get(t.warehouse) ?? 0;
    tonTheoKho.set(t.warehouse, cur + Math.max(0, t.conLai));
  }

  return BSF1_WAREHOUSES.map((wh) => {
    // gom ton theo name / code
    let totalKg = 0;
    for (const [k, kgVal] of tonTheoKho.entries()) {
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
export function dongGoiTruTon(packagings: Packaging[]): BanLeTruTon[] {
  return packagings.map((p) => ({
    productId: p.fromProductId,
    spec: p.fromSpec,
    quantityKg: p.inputKg,
  }));
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
export function tinhTonTP(packagings: Packaging[], banLeTP: BanLeTruTon[] = []): TonTP[] {
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
  for (const b of banLeTP) {
    lay(b.productId, b.spec).soldKg += b.quantityKg || 0;
  }
  const arr = [...map.values()];
  for (const t of arr) t.conLai = t.outputKg - t.soldKg;
  return arr;
}

/** Tồn TP khả dụng của một (mặt hàng × quy cách). */
export function khaDungTP(tonTP: TonTP[], productId: string, spec: string): number {
  const t = tonTP.find((x) => x.productId === productId && x.spec === spec);
  return t ? t.conLai : 0;
}

