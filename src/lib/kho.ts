import type { DongSanXuat, DongLenh } from "@/types";

/** Tồn của MỘT lô = dòng BTP sản xuất đã duyệt vào kho, trừ đi phần đã xuất. */
export interface LoTon {
  sanXuatId: string;
  matHangId: string;
  quyCach: string;
  kho: string;
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
export function tinhTon(sanXuat: DongSanXuat[], dongLenh: DongLenh[]): LoTon[] {
  const xuatTheoLo = new Map<string, { kg: number; block: number }>();
  for (const d of dongLenh) {
    const cur = xuatTheoLo.get(d.sanXuatId) ?? { kg: 0, block: 0 };
    cur.kg += d.luongKg || 0;
    cur.block += d.soBlock || 0;
    xuatTheoLo.set(d.sanXuatId, cur);
  }
  return sanXuat
    .filter((s) => s.trangThai === "da-nhap")
    .map((s) => {
      const x = xuatTheoLo.get(s.id) ?? { kg: 0, block: 0 };
      return {
        sanXuatId: s.id,
        matHangId: s.matHangId,
        quyCach: s.quyCach,
        kho: s.kho,
        ngaySX: s.ngay,
        luongNhap: s.luongKg,
        blockNhap: s.soBlock,
        luongXuat: x.kg,
        blockXuat: x.block,
        conLai: s.luongKg - x.kg,
        blockConLai: s.soBlock - x.block,
      };
    });
}

/** Khả dụng (kg) cho một (mặt hàng × quy cách): tổng phần còn lại các lô. */
export function khaDung(
  ton: LoTon[],
  matHangId: string,
  quyCach: string
): number {
  return ton
    .filter((t) => t.matHangId === matHangId && t.quyCach === quyCach)
    .reduce((s, t) => s + Math.max(0, t.conLai), 0);
}

/** Lô còn hàng của (mặt hàng × quy cách), FIFO — lô cũ (ngày SX sớm) trước. */
export function loConHang(
  ton: LoTon[],
  matHangId: string,
  quyCach: string
): LoTon[] {
  return ton
    .filter(
      (t) => t.matHangId === matHangId && t.quyCach === quyCach && t.conLai > 0
    )
    .sort((a, b) => a.ngaySX.localeCompare(b.ngaySX));
}
