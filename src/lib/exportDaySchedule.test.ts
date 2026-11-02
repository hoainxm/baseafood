// Oracle: docs/app-map/57-export-schedule-by-day.ba-spec.md — AC-1…AC-7.
import { describe, expect, it } from "vitest";
import type { MonthGroup, MonthShipmentRow } from "./exportPlanning";
import { buildDaySchedule, defaultOpenDay } from "./exportDaySchedule";

type Ship = { id: string; lot?: string; loading?: string; etd?: string; late?: boolean; closed?: boolean; kg?: number };
const row = (s: Ship): MonthShipmentRow =>
  ({
    shipment: { id: s.id, lotCode: s.lot ?? "", loadingDate: s.loading ?? "", etd: s.etd ?? "", planMonth: "2026-11", plannedKg: s.kg ?? 1000, createdAt: `2026-10-01T00:00:0${s.id.length}Z` },
    contract: { id: `c-${s.id}` },
    late: !!s.late,
    closed: s.closed ?? true,
  }) as unknown as MonthShipmentRow;
const group = (customerId: string, customerName: string, ships: Ship[]): MonthGroup => ({
  customerId,
  customerName,
  rows: ships.map(row),
  plannedKg: 0,
  actualKg: 0,
});

describe("AC-1 — xếp theo ngày xuất (đóng cont, chưa có thì ETD)", () => {
  const s = buildDaySchedule([group("k1", "Matsuda", [{ id: "A", loading: "2026-11-05", etd: "2026-11-01" }, { id: "B", etd: "2026-11-03" }, { id: "C" }])]);
  it("2 ngày tăng dần, chuyến chỉ có tháng kế hoạch vào nhóm chưa có ngày", () => {
    expect(s.days.map((d) => d.date)).toEqual(["2026-11-03", "2026-11-05"]);
    expect(s.undated.flatMap((c) => c.rows.map((r) => r.shipment.id))).toEqual(["C"]);
  });
});

describe("AC-2 / AC-6 — đếm khách khác nhau, chi tiết gom theo khách", () => {
  const s = buildDaySchedule([
    group("k2", "Seachemot", [{ id: "S1", loading: "2026-11-03" }]),
    group("k1", "Matsuda", [{ id: "M2", lot: "10.11", loading: "2026-11-03" }, { id: "M1", lot: "2.11", loading: "2026-11-03" }]),
  ]);
  const day = s.days[0];
  it("2 khách · 3 chuyến", () => {
    expect(day.customerCount).toBe(2);
    expect(day.shipmentCount).toBe(3);
  });
  it("khách theo tên, chuyến theo số lô", () => {
    expect(day.customers.map((c) => c.customerName)).toEqual(["Matsuda", "Seachemot"]);
    expect(day.customers[0].rows.map((r) => r.shipment.lotCode)).toEqual(["2.11", "10.11"]);
  });
});

describe("AC-3 — tổng khớp số chuyến của kỳ", () => {
  const groups = [group("k1", "A", [{ id: "1", loading: "2026-11-02" }, { id: "2" }]), group("k2", "B", [{ id: "3", etd: "2026-11-02" }, { id: "4", loading: "2026-11-20" }])];
  const s = buildDaySchedule(groups);
  it("Σ chuyến mọi ngày + chưa có ngày = số chuyến", () => {
    const total = s.days.reduce((n, d) => n + d.shipmentCount, 0) + s.undated.reduce((n, c) => n + c.rows.length, 0);
    expect(total).toBe(4);
  });
});

describe("AC-4 — lọc khách ⇒ mỗi ngày 1 khách", () => {
  const s = buildDaySchedule([group("k2", "Seachemot", [{ id: "1", loading: "2026-11-02" }, { id: "2", loading: "2026-11-02" }, { id: "3", loading: "2026-11-09" }])]);
  it("mọi ngày customerCount == 1", () => {
    expect(s.days.every((d) => d.customerCount === 1)).toBe(true);
  });
});

describe("AC-5 — dấu trễ / còn thiếu", () => {
  const s = buildDaySchedule([group("k1", "A", [{ id: "1", loading: "2026-11-05", late: true, closed: false }, { id: "2", loading: "2026-11-05", closed: false }, { id: "3", loading: "2026-11-05" }])]);
  it("1 trễ, 2 còn thiếu", () => {
    expect(s.days[0].lateCount).toBe(1);
    expect(s.days[0].missingCount).toBe(2);
  });
});

describe("AC-7 — ngày mở sẵn", () => {
  const days = [{ date: "2026-11-03" }, { date: "2026-11-05" }];
  it("ngày có chuyến đầu tiên ≥ hôm nay", () => {
    expect(defaultOpenDay(days, "2026-11-04")).toBe("2026-11-05");
    expect(defaultOpenDay(days, "2026-11-03")).toBe("2026-11-03");
  });
  it("kỳ đã qua hết ⇒ null", () => {
    expect(defaultOpenDay(days, "2026-12-01")).toBeNull();
  });
});
