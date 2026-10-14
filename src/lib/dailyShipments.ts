// ============================================================
// Tên file: src/lib/dailyShipments.ts
// Tên tiếng Việt: Gom chuyến nhập theo ngày → đại lý → chuyến (chỉ đọc)
// Description: Group material imports of a day by supplier and shipment
// ============================================================
import type { ImportShipment, MaterialImportItem } from "@/types";

/** Một dòng hàng của chuyến (một loại NL). */
export interface DailyShipmentLine {
  id: string;
  materialType: string;
  kg: number;
  unitPrice: number | null;
  amount: number;
}

/** Một chuyến nhập trong ngày. */
export interface DailyShipment {
  shipmentId: string;
  /** Mã lô nếu có, không thì "Chuyến n" theo thứ tự trong ngày của đại lý. */
  label: string;
  workshop: string;
  vehicle: string;
  lines: DailyShipmentLine[];
  kg: number;
  amount: number;
}

/** Một đại lý trong ngày với các chuyến của họ. */
export interface DailySupplierGroup {
  supplier: string;
  shipments: DailyShipment[];
  kg: number;
  amount: number;
}

const rowAmount = (r: MaterialImportItem) => r.quantityKg * (r.unitPrice ?? 0);

/** Mỗi ngày (ngày hàng về) có bao nhiêu chuyến + bao nhiêu kg — cho hàng nút chọn ngày. */
export function summarizeImportsByDay(imports: MaterialImportItem[]): Map<string, { shipmentCount: number; kg: number }> {
  const shipments = new Map<string, Set<string>>();
  const kg = new Map<string, number>();
  for (const r of imports) {
    const d = r.deliveryDate;
    if (!shipments.has(d)) shipments.set(d, new Set());
    shipments.get(d)!.add(r.shipmentId || r.id);
    kg.set(d, (kg.get(d) ?? 0) + r.quantityKg);
  }
  const ra = new Map<string, { shipmentCount: number; kg: number }>();
  for (const [d, s] of shipments) ra.set(d, { shipmentCount: s.size, kg: kg.get(d) ?? 0 });
  return ra;
}

/**
 * Dòng nhập của MỘT ngày → đại lý (nhiều kg đứng trước) → chuyến (giữ thứ tự ghi)
 * → dòng loại NL. Dòng cũ không có chuyến (shipmentId rỗng) coi mỗi dòng là một chuyến.
 */
export function groupDailyShipments(
  imports: MaterialImportItem[],
  date: string,
  shipmentList: Pick<ImportShipment, "id" | "lotCode">[] = []
): DailySupplierGroup[] {
  const lotCodes = new Map(shipmentList.map((c) => [c.id, c.lotCode ?? ""]));
  const bySupplier = new Map<string, Map<string, MaterialImportItem[]>>();
  for (const r of imports) {
    if (r.deliveryDate !== date) continue;
    const dl = r.supplierName.trim() || "(chưa ghi đại lý)";
    const k = r.shipmentId || r.id;
    if (!bySupplier.has(dl)) bySupplier.set(dl, new Map());
    const m = bySupplier.get(dl)!;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(r);
  }
  const ra: DailySupplierGroup[] = [];
  for (const [supplier, m] of bySupplier) {
    let i = 0;
    const shipments: DailyShipment[] = [...m].map(([shipmentId, items]) => {
      i += 1;
      const dong = items.map((r) => ({
        id: r.id,
        materialType: r.materialTypeName,
        kg: r.quantityKg,
        unitPrice: r.unitPrice,
        amount: rowAmount(r),
      }));
      const dau = items[0];
      return {
        shipmentId,
        label: lotCodes.get(shipmentId) || `Chuyến ${i}`,
        workshop: dau.workshop,
        vehicle: [dau.licensePlate, dau.driverName].filter(Boolean).join(" · "),
        lines: dong,
        kg: dong.reduce((s, d) => s + d.kg, 0),
        amount: dong.reduce((s, d) => s + d.amount, 0),
      };
    });
    ra.push({
      supplier,
      shipments,
      kg: shipments.reduce((s, c) => s + c.kg, 0),
      amount: shipments.reduce((s, c) => s + c.amount, 0),
    });
  }
  return ra.sort((a, b) => b.kg - a.kg || a.supplier.localeCompare(b.supplier, "vi"));
}

/** Một đại lý trong CẢ KỲ — cho dòng con theo đại lý dưới dòng loại NL của lưới. */
export interface PeriodSupplierRow {
  supplier: string;
  /** kg theo ngày hàng về. */
  dailyAmounts: Record<string, number>;
  kg: number;
  amount: number;
  /** id các dòng sổ nhập của đại lý (để mở chuyến trong ô). */
  ids: string[];
}

/**
 * Gom dòng sổ nhập (thường là các dòng làm nên MỘT dòng loại NL của lưới) theo đại
 * lý, kg theo ngày — tổng các đại lý đúng bằng dòng cha. Đại lý nhiều kg đứng trước.
 */
export function groupImportsBySupplier(imports: MaterialImportItem[]): PeriodSupplierRow[] {
  const m = new Map<string, PeriodSupplierRow>();
  for (const r of imports) {
    const dl = r.supplierName.trim() || "(chưa ghi đại lý)";
    const o = m.get(dl) ?? { supplier: dl, dailyAmounts: {}, kg: 0, amount: 0, ids: [] };
    o.dailyAmounts[r.deliveryDate] = (o.dailyAmounts[r.deliveryDate] ?? 0) + r.quantityKg;
    o.kg += r.quantityKg;
    o.amount += rowAmount(r);
    o.ids.push(r.id);
    m.set(dl, o);
  }
  return [...m.values()].sort((a, b) => b.kg - a.kg || a.supplier.localeCompare(b.supplier, "vi"));
}

/** Số chuyến (shipmentId khác nhau) của các dòng trong một ngày — cho nhãn "n chuyến" ở ô. */
export function countDailyShipments(imports: MaterialImportItem[], date: string): number {
  return new Set(imports.filter((r) => r.deliveryDate === date).map((r) => r.shipmentId || r.id)).size;
}
