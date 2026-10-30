// Oracle: docs/app-map/50-planning-reports.ba-spec.md — AC-5…AC-7 (báo cáo Lệnh sản xuất).
import { describe, expect, test } from "vitest";
import type { ExportContractRevision, ProductionOrder, ProductionOrderLine, ProductionOrderMaterial } from "@/types";
import { monthReportPeriod } from "./exportReports";
import { emptyRequirements } from "./productionOrder";
import { buildOrderReport, buildOrderReportExcel, type OrderReportInput } from "./productionOrderReports";

const T0 = "2026-10-01T00:00:00.000Z";
const order = (id: string, over: Partial<ProductionOrder> = {}): ProductionOrder => ({
  id,
  orderNo: id,
  orderDate: "2026-10-27",
  contractId: "c1",
  contractRevisionId: "r0",
  contractNo: "01-26-HAT",
  customerName: "Matsuda",
  market: "",
  lotCode: "",
  productionDates: ["2026-11-02"],
  deliveryDate: "2026-11-15",
  shelfLifeMonths: 24,
  requirements: emptyRequirements(),
  note: "",
  status: "issued",
  issuedAt: T0,
  issuedBy: "",
  revisionNo: 0,
  revisionReason: "",
  cancelReason: "",
  staleAckRevisionId: "",
  staleAckReason: "",
  createdBy: "",
  createdAt: T0,
  ...over,
});
const oLine = (orderId: string, units: number, productId = "p1"): ProductionOrderLine => ({
  id: `${orderId}-l`,
  orderId,
  lineNo: 1,
  contractLineId: "x",
  productId,
  productName: productId === "p1" ? "Bạch tuộc cắt hạt lựu" : "Bạch tuộc luộc",
  description: "",
  spec: "",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: 12,
  units,
  kg: null,
  note: "",
});
const rev = (id: string, revisionNo: number) => ({ id, contractId: "c1", revisionNo }) as ExportContractRevision;
const input = (over: Partial<OrderReportInput>): OrderReportInput => ({
  orders: [],
  lines: [],
  materials: [],
  links: [],
  receiptLines: [],
  exportData: { revisions: [rev("r0", 0)], approvals: [] },
  ...over,
});

describe("AC-5 — lệnh theo tháng SX đầu, lệnh hủy chỉ đếm", () => {
  const d = input({
    orders: [
      order("A"),
      order("B", { status: "draft", issuedAt: "", productionDates: ["2026-11-09"] }),
      order("C", { status: "cancelled", productionDates: ["2026-11-03"] }),
      order("D", { productionDates: ["2026-10-28"] }),
    ],
    lines: [oLine("A", 1000), oLine("B", 500, "p2"), oLine("C", 300), oLine("D", 50)],
  });
  test("tháng 11: 2 lệnh, 1.500 thùng, 18.000 kg, 1 hủy", () => {
    const r = buildOrderReport(d, monthReportPeriod("2026-11"), { today: "2026-11-01" });
    expect(r.totals).toMatchObject({ orders: 2, issued: 1, drafts: 1, cartons: 1500, kg: 18000, cancelled: 1 });
    expect(r.byProduct.map((p) => [p.name, p.kg])).toEqual([
      ["Bạch tuộc cắt hạt lựu", 12000],
      ["Bạch tuộc luộc", 6000],
    ]);
    expect(r.byCustomer).toEqual([{ customerName: "Matsuda", orders: 2, contracts: 1, cartons: 1500, kg: 18000 }]);
  });
  test("lọc khách khác ⇒ 0 lệnh", () => {
    expect(buildOrderReport(d, monthReportPeriod("2026-11"), { today: "2026-11-01", customerName: "Khác" }).totals.orders).toBe(0);
  });
});

describe("AC-6 — NL nhập khẩu đã dành theo lần nhập", () => {
  test("dành trong kỳ 3.000, tổng 7.000, thực nhập 6.000 ⇒ vượt 1.000; lệnh hủy không tính", () => {
    const m = (orderId: string, kg: number): ProductionOrderMaterial => ({ id: `${orderId}-m`, orderId, orderLineId: `${orderId}-l`, receiptId: "R", importLineId: "IL", label: "HĐ nhập AB-01", kg });
    const d = input({
      orders: [order("A"), order("E", { productionDates: ["2026-12-01"] }), order("X", { status: "cancelled" })],
      lines: [oLine("A", 10), oLine("E", 10), oLine("X", 10)],
      materials: [m("A", 3000), m("E", 4000), m("X", 1000)],
      receiptLines: [{ id: "rl", receiptId: "R", contractLineId: "IL", kg: 6000, recordedBy: "", updatedAt: T0 }],
    });
    const r = buildOrderReport(d, monthReportPeriod("2026-11"), { today: "2026-11-01" });
    expect(r.materials).toHaveLength(1);
    expect(r.materials[0]).toMatchObject({ reservedKg: 3000, reservedAllKg: 7000, receivedKg: 6000, overKg: 1000 });
    expect(r.totals.reservedKg).toBe(3000);
  });
});

describe("AC-7 — lệnh cần chú ý", () => {
  test("nháp quá ngày SX · theo bản HĐ trước · chưa gắn chuyến; nháp chưa tới ngày SX thì không", () => {
    const d = input({
      orders: [
        order("N1", { status: "draft", issuedAt: "", productionDates: ["2026-11-02"] }),
        order("U"),
        order("S", { contractRevisionId: "r0" }),
        order("N2", { status: "draft", issuedAt: "", productionDates: ["2026-11-20"] }),
      ],
      lines: [oLine("N1", 1), oLine("U", 1), oLine("S", 1), oLine("N2", 1)],
      links: [{ id: "k", orderId: "S", shipmentId: "sh", createdAt: T0 }],
      exportData: { revisions: [rev("r0", 0), rev("r1", 1)], approvals: [] },
    });
    // U theo r0 nhưng HĐ đã có r1 ⇒ cũng "theo bản HĐ trước"; chỉ U chưa gắn chuyến.
    const r = buildOrderReport(d, monthReportPeriod("2026-11"), { today: "2026-11-05" });
    expect(r.attention.map((a) => [a.orderNo, a.kind])).toEqual([
      ["N1", "draft-overdue"],
      ["U", "stale-revision"],
      ["S", "stale-revision"],
      ["U", "unlinked"],
    ]);
  });
  test("Excel có đủ khối", () => {
    const r = buildOrderReport(input({ orders: [order("A")], lines: [oLine("A", 1000)] }), monthReportPeriod("2026-11"), { today: "2026-11-01" });
    const rows = buildOrderReportExcel(r, { periodLabel: "Tháng 11/2026" });
    expect(rows.map((x) => x[0]).filter((x) => typeof x === "string" && /^Theo|^NL|^Lệnh cần/.test(x))).toEqual(["Theo tháng", "Theo khách", "Theo mặt hàng", "NL nhập khẩu đã dành", "Lệnh cần chú ý"]);
  });
});
