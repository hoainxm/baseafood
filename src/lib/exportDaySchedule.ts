// ============================================================
// Tên file: src/lib/exportDaySchedule.ts
// Tên tiếng Việt: Lịch xuất hàng xếp theo ngày (tab Lịch xuất hàng — Xuất khẩu)
// Description: Pure regrouping of the period plan's shipments by export day (loading date, else ETD):
//              per-day customer / shipment / late / missing counts, customers inside a day, undated
//              shipments, and the day opened by default. Oracle: docs/app-map/57-export-schedule-by-day.ba-spec.md.
// ============================================================
import type { MonthGroup, MonthShipmentRow } from "@/lib/exportPlanning";

/** Chuyến của một khách trong một ngày (hoặc trong khối chưa có ngày). */
export interface ScheduleCustomer {
  customerId: string;
  customerName: string;
  rows: MonthShipmentRow[];
}

export interface ScheduleDay {
  /** yyyy-mm-dd — ngày đóng cont, chưa có thì ETD (R1). */
  date: string;
  /** Số khách KHÁC NHAU có chuyến ngày này (R3). */
  customerCount: number;
  shipmentCount: number;
  /** Chuyến trễ hạn giao (R7). */
  lateCount: number;
  /** Chuyến chưa đủ hồ sơ (R7). */
  missingCount: number;
  plannedKg: number;
  /** Khách xếp theo tên, chuyến trong khách xếp theo số lô (R6). */
  customers: ScheduleCustomer[];
}

export interface DaySchedule {
  days: ScheduleDay[];
  /** Chuyến chỉ có tháng kế hoạch — chưa có ngày đóng lẫn ETD. */
  undated: ScheduleCustomer[];
}

/** Ngày xuất của chuyến (R1) — rỗng khi chỉ có tháng kế hoạch. */
export const shipmentDay = (s: Pick<MonthShipmentRow["shipment"], "loadingDate" | "etd">): string => s.loadingDate || s.etd || "";

const byLot = (a: MonthShipmentRow, b: MonthShipmentRow) =>
  (a.shipment.lotCode || "").localeCompare(b.shipment.lotCode || "", "vi", { numeric: true }) || a.shipment.createdAt.localeCompare(b.shipment.createdAt);

function toCustomers(rows: readonly { row: MonthShipmentRow; customerId: string; customerName: string }[]): ScheduleCustomer[] {
  const map = new Map<string, ScheduleCustomer>();
  for (const x of rows) {
    const c = map.get(x.customerId) ?? { customerId: x.customerId, customerName: x.customerName, rows: [] };
    c.rows.push(x.row);
    map.set(x.customerId, c);
  }
  return [...map.values()].map((c) => ({ ...c, rows: c.rows.sort(byLot) })).sort((a, b) => a.customerName.localeCompare(b.customerName, "vi"));
}

/**
 * Gom lại chuyến của `buildPeriodPlan` (đã lọc kỳ + khách) theo NGÀY xuất: chỉ ngày có chuyến, tăng dần
 * (R2). Tổng chuyến mọi ngày + chưa có ngày = số chuyến của kỳ (R5).
 */
export function buildDaySchedule(groups: readonly MonthGroup[]): DaySchedule {
  const dated = new Map<string, { row: MonthShipmentRow; customerId: string; customerName: string }[]>();
  const undated: { row: MonthShipmentRow; customerId: string; customerName: string }[] = [];
  for (const g of groups) {
    for (const row of g.rows) {
      const item = { row, customerId: g.customerId, customerName: g.customerName };
      const day = shipmentDay(row.shipment);
      if (!day) undated.push(item);
      else dated.set(day, [...(dated.get(day) ?? []), item]);
    }
  }
  const days = [...dated.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]): ScheduleDay => {
      const customers = toCustomers(items);
      return {
        date,
        customerCount: customers.length,
        shipmentCount: items.length,
        lateCount: items.filter((x) => x.row.late).length,
        missingCount: items.filter((x) => !x.row.closed).length,
        plannedKg: Math.round(items.reduce((s, x) => s + (x.row.shipment.plannedKg ?? 0), 0) * 100) / 100,
        customers,
      };
    });
  return { days, undated: toCustomers(undated) };
}

/** Ngày mở sẵn (R9): ngày có chuyến đầu tiên ≥ hôm nay; kỳ đã qua hết ⇒ null. */
export function defaultOpenDay(days: readonly Pick<ScheduleDay, "date">[], today: string): string | null {
  return days.find((d) => d.date >= today)?.date ?? null;
}
