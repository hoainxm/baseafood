// ============================================================
// Tên file: src/lib/chuyenTrongNgay.ts
// Tên tiếng Việt: Gom chuyến nhập theo ngày → đại lý → chuyến (chỉ đọc)
// Description: Group material imports of a day by supplier and shipment
// ============================================================
import type { ImportShipment, MaterialImportItem } from "@/types";

/** Một dòng hàng của chuyến (một loại NL). */
export interface DongChuyenNgay {
  id: string;
  loai: string;
  kg: number;
  donGia: number | null;
  tien: number;
}

/** Một chuyến nhập trong ngày. */
export interface ChuyenNgay {
  shipmentId: string;
  /** Mã lô nếu có, không thì "Chuyến n" theo thứ tự trong ngày của đại lý. */
  nhan: string;
  xuong: string;
  xe: string;
  dong: DongChuyenNgay[];
  kg: number;
  tien: number;
}

/** Một đại lý trong ngày với các chuyến của họ. */
export interface DaiLyNgay {
  daiLy: string;
  chuyen: ChuyenNgay[];
  kg: number;
  tien: number;
}

const tienDong = (r: MaterialImportItem) => r.quantityKg * (r.unitPrice ?? 0);

/** Mỗi ngày (ngày hàng về) có bao nhiêu chuyến + bao nhiêu kg — cho hàng nút chọn ngày. */
export function tomTatTheoNgay(nhap: MaterialImportItem[]): Map<string, { soChuyen: number; kg: number }> {
  const chuyen = new Map<string, Set<string>>();
  const kg = new Map<string, number>();
  for (const r of nhap) {
    const d = r.deliveryDate;
    if (!chuyen.has(d)) chuyen.set(d, new Set());
    chuyen.get(d)!.add(r.shipmentId || r.id);
    kg.set(d, (kg.get(d) ?? 0) + r.quantityKg);
  }
  const ra = new Map<string, { soChuyen: number; kg: number }>();
  for (const [d, s] of chuyen) ra.set(d, { soChuyen: s.size, kg: kg.get(d) ?? 0 });
  return ra;
}

/**
 * Dòng nhập của MỘT ngày → đại lý (nhiều kg đứng trước) → chuyến (giữ thứ tự ghi)
 * → dòng loại NL. Dòng cũ không có chuyến (shipmentId rỗng) coi mỗi dòng là một chuyến.
 */
export function chuyenTrongNgay(
  nhap: MaterialImportItem[],
  ngay: string,
  chuyenSo: Pick<ImportShipment, "id" | "lotCode">[] = []
): DaiLyNgay[] {
  const maLo = new Map(chuyenSo.map((c) => [c.id, c.lotCode ?? ""]));
  const theoDaiLy = new Map<string, Map<string, MaterialImportItem[]>>();
  for (const r of nhap) {
    if (r.deliveryDate !== ngay) continue;
    const dl = r.supplierName.trim() || "(chưa ghi đại lý)";
    const k = r.shipmentId || r.id;
    if (!theoDaiLy.has(dl)) theoDaiLy.set(dl, new Map());
    const m = theoDaiLy.get(dl)!;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  const ra: DaiLyNgay[] = [];
  for (const [daiLy, m] of theoDaiLy) {
    let i = 0;
    const chuyen: ChuyenNgay[] = [...m].map(([shipmentId, ds]) => {
      i += 1;
      const dong = ds.map((r) => ({
        id: r.id,
        loai: r.materialTypeName,
        kg: r.quantityKg,
        donGia: r.unitPrice,
        tien: tienDong(r),
      }));
      const dau = ds[0];
      return {
        shipmentId,
        nhan: maLo.get(shipmentId) || `Chuyến ${i}`,
        xuong: dau.workshop,
        xe: [dau.licensePlate, dau.driverName].filter(Boolean).join(" · "),
        dong,
        kg: dong.reduce((s, d) => s + d.kg, 0),
        tien: dong.reduce((s, d) => s + d.tien, 0),
      };
    });
    ra.push({
      daiLy,
      chuyen,
      kg: chuyen.reduce((s, c) => s + c.kg, 0),
      tien: chuyen.reduce((s, c) => s + c.tien, 0),
    });
  }
  return ra.sort((a, b) => b.kg - a.kg || a.daiLy.localeCompare(b.daiLy, "vi"));
}
