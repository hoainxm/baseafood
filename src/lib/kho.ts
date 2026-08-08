import type { WipProductionItem, ExportItem } from "@/types";

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
 * `cho-nhap` (chưa duyệt) KHÔNG có trong kho. Xuất gom theo `sanXuatId` từ dòng lệnh.
 */
export function tinhTon(sanXuat: WipProductionItem[], dongLenh: ExportItem[]): LoTon[] {
  const xuatTheoLo = new Map<string, { kg: number; block: number }>();
  for (const d of dongLenh) {
    const cur = xuatTheoLo.get(d.wipId) ?? { kg: 0, block: 0 };
    cur.kg += d.quantityKg || 0;
    cur.block += d.blocksCount || 0;
    xuatTheoLo.set(d.wipId, cur);
  }
  return sanXuat
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
