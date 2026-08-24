// ============================================================
// Tên file cũ: src/lib/kho.ts
// Tên tiếng Việt: Quản lý Tồn kho & Dung tích 5 kho BSF1
// Description: Inventory calculation, batch availability, and 5 BSF1 warehouse capacities
// ============================================================
import type { WipProductionItem, ExportItem, SalesItem, WarehouseInfo } from "@/types";
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

/**
 * Tính tồn từng lô (bất biến: tồn = nhập − xuất). Chỉ lô `da-nhap` mới tính tồn;
 * `cho-nhap` (chưa duyệt) KHÔNG có trong kho. Xuất gom theo `wipId` từ dòng lệnh.
 *
 * `banHang` (tùy chọn) = sổ Bán hàng ngày: mọi dòng bán KHÔNG phải handoff của
 * đơn đặt (sourceWarehouse !== "Đơn đặt") cũng rút khỏi kho dự trữ, phân bổ FIFO
 * lô cũ trước theo (mặt hàng × quy cách). Nhờ vậy tồn kho ở màn Kho dự trữ ăn
 * khớp với Tồn cuối ở Báo cáo NXT thành phẩm (cùng định nghĩa "xuất"), và Đơn đặt
 * không thể xuất phần đã bán ngày. Bỏ trống ⇒ giữ nguyên hành vi cũ (chỉ trừ đơn).
 */
export function tinhTon(
  sanXuat: WipProductionItem[],
  dongLenh: ExportItem[],
  banHang: SalesItem[] = []
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
  if (banHang.length) truBanNgay(los, banHang);
  return los;
}

/**
 * Trừ bán hàng ngày (không phải handoff đơn đặt) khỏi các lô — FIFO lô cũ trước,
 * theo (mặt hàng × quy cách). Sửa `los` tại chỗ. Bán vượt tồn ⇒ lô cuối âm (tín
 * hiệu bán quá số đang trữ; khaDung/loConHang đã kẹp ≥0 nên vẫn an toàn phía đơn).
 */
function truBanNgay(los: LoTon[], banHang: SalesItem[]): void {
  const canTru = new Map<string, number>(); // productId|||spec → kg
  for (const b of banHang) {
    if (b.sourceWarehouse === "Đơn đặt") continue; // handoff đơn đặt đã trừ qua dòng lệnh
    const k = `${b.productId}|||${b.spec}`;
    canTru.set(k, (canTru.get(k) ?? 0) + (b.quantityKg || 0));
  }
  if (canTru.size === 0) return;

  const theoMH = new Map<string, LoTon[]>();
  for (const l of los) {
    const k = `${l.productId}|||${l.spec}`;
    const ds = theoMH.get(k);
    if (ds) ds.push(l);
    else theoMH.set(k, [l]);
  }

  for (const [k, kg0] of canTru) {
    const ds = (theoMH.get(k) ?? []).slice().sort((a, b) => a.ngaySX.localeCompare(b.ngaySX));
    let con = kg0;
    for (const l of ds) {
      if (con <= 0) break;
      const lay = Math.min(con, Math.max(0, l.conLai));
      if (lay <= 0) continue;
      const tyLe = l.luongNhap > 0 ? lay / l.luongNhap : 0;
      const blk = Math.round(l.blockNhap * tyLe);
      l.conLai -= lay;
      l.blockConLai -= blk;
      l.luongXuat += lay;
      l.blockXuat += blk;
      con -= lay;
    }
  }
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

