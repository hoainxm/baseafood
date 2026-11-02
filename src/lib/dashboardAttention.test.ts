// Oracle: docs/app-map/55-dashboard-modules.ba-spec.md — AC-1…AC-9 (khối Phòng Kế hoạch + việc cần đốc mới).
import { describe, expect, test } from "vitest";
import type { ImportContract, ImportContractLine, ImportReceipt, ImportShipment, MaterialImportItem, SupplierInvoice, SupplierInvoiceLine } from "@/types";
import { EMPTY_EXPORT_DATA } from "./exportPlanning";
import type { ExportReport } from "./exportReports";
import { buildImportReport } from "./importReports";
import type { ImportData } from "./importPlanning";
import type { OrderReport } from "./productionOrderReports";
import {
  PLANNING_ATTENTION_LABELS,
  PLANNING_ATTENTION_LEVELS,
  buildPlanningAttention,
  buildPlanningReports,
  buildPlanningSummary,
  buildSupplierInvoiceAttention,
  planningPeriodFor,
  type PlanningAccess,
  type PlanningAttentionKind,
  type PlanningReports,
} from "./dashboardAttention";

const ALL: PlanningAccess = { import: true, productionOrder: true, export: true, exportPrice: true, supplierInvoice: true };
const T0 = "2026-10-01T00:00:00.000Z";
const TODAY = "2026-11-02";

const contract = (id: string): ImportContract => ({
  id,
  supplierId: "sA",
  supplierName: "Pacific Marine",
  contractNo: id.toUpperCase(),
  signedDate: "2026-09-01",
  importType: "export-production",
  currency: "USD",
  linePrices: {},
  status: "open",
  closeReason: "",
  cancelReason: "",
  note: "",
  createdAt: T0,
});
const line = (id: string, contractId: string, kg: number): ImportContractLine => ({ id, contractId, lineNo: 1, productName: "Frozen octopus", kg, note: "" });
const receipt = (id: string, contractId: string, arrivalDate: string): ImportReceipt => ({
  id,
  contractId,
  contractNo: contractId.toUpperCase(),
  supplierName: "Pacific Marine",
  arrivalDate,
  expectedDate: "",
  transport: "40RF",
  containerNo: "",
  blNo: "",
  status: "open",
  cancelReason: "",
  note: "",
  createdAt: T0,
});
const importData = (over: Partial<ImportData> = {}): ImportData => ({ contracts: [], lines: [], receipts: [], receiptLines: [], documents: [], files: [], filesAvailable: false, ...over });

/** Báo cáo Lệnh SX / Xuất khẩu tối thiểu — chỉ phần Tổng quan đọc. */
const orderReport = (attention: OrderReport["attention"]): OrderReport =>
  ({ totals: { orders: 3, cartons: 120, kg: 2400, issued: 2, drafts: 1, cancelled: 0, revised: 0, reservedKg: 0 }, attention }) as unknown as OrderReport;
const exportReport = (attention: Partial<ExportReport["attention"][number]>[]): ExportReport =>
  ({
    totals: { shipments: 4, containers: 3, plannedKg: 80000, actualKg: 76000, actualAmount: 300000, received: 200000, outstanding: 100000, delivered: 3, late: 1 },
    attention: attention.map((a) => ({ contractId: "x1", contractNo: "X1", customerId: "k", customerName: "Khách A", kgPct: 0, amountPct: 0, deadline: "2026-10-20", missingKg: 0, missingContainers: 0, outstanding: 0, kind: "overdue", ...a })),
  }) as unknown as ExportReport;

describe("AC-2 — kỳ ngắn hơn tháng tính theo tháng chạm kỳ", () => {
  test("28/10 → 03/11 ⇒ tháng 10 + 11, trọn tháng", () => {
    const p = planningPeriodFor("2026-10-28", "2026-11-03");
    expect(p.months).toEqual(["2026-10", "2026-11"]);
    expect([p.from, p.to]).toEqual(["2026-10-01", "2026-11-30"]);
  });
  test("một ngày ⇒ đúng tháng chứa ngày, khóa tháng", () => {
    const p = planningPeriodFor("2026-12-31", "2026-12-31");
    expect(p.months).toEqual(["2026-12"]);
    expect(p.key).toBe("2026-12");
  });
  test("qua năm", () => {
    expect(planningPeriodFor("2026-12-15", "2027-01-10").months).toEqual(["2026-12", "2027-01"]);
  });
});

describe("AC-1 — khối kế hoạch khớp số tổng tab Báo cáo", () => {
  const d = importData({
    contracts: [contract("c1")],
    lines: [line("l1", "c1", 10000)],
    receipts: [receipt("r1", "c1", "2026-10-10")],
    receiptLines: [{ id: "r1-l1", receiptId: "r1", contractLineId: "l1", kg: 9800, recordedBy: "", updatedAt: T0 }],
  });
  const period = planningPeriodFor("2026-10-01", "2026-10-31");
  const reports: PlanningReports = { import: buildImportReport(d, period, { today: TODAY }), productionOrder: orderReport([]), export: exportReport([]) };
  const s = buildPlanningSummary(reports, ALL);

  test("Nhập khẩu = buildImportReport cùng tháng", () => {
    const t = buildImportReport(d, period, { today: TODAY }).totals;
    expect(s.import).toMatchObject({ receipts: t.receipts, receivedKg: t.receivedKg, missingDocs: t.missingDocs, awaitingQuantity: t.awaitingQuantity });
    expect(s.import?.receivedKg).toBe(9800);
  });
  test("Lệnh SX + Xuất khẩu chép đúng số tổng", () => {
    expect(s.productionOrder).toEqual({ orders: 3, issued: 2, drafts: 1, cartons: 120, kg: 2400 });
    expect(s.export).toEqual({ shipments: 4, containers: 3, actualKg: 76000, delivered: 3, late: 1, outstanding: 100000 });
  });
});

describe("AC-3 — việc kế hoạch vào danh sách chung, mở thẳng màn module", () => {
  const d = importData({ contracts: [contract("c1")], lines: [line("l1", "c1", 10000)], receipts: [receipt("r1", "c1", "2026-10-10")] });
  const period = planningPeriodFor("2026-10-01", "2026-10-31");
  const reports: PlanningReports = {
    import: buildImportReport(d, period, { today: TODAY }),
    productionOrder: orderReport([{ orderId: "o1", orderNo: "LSX-01", customerName: "Khách A", kind: "draft-overdue", firstProductionDate: "2026-10-25" }]),
    export: exportReport([{ kind: "overdue", missingKg: 2000 }]),
  };
  const rows = buildPlanningAttention(reports, ALL);

  test("đủ 3 loại, mỗi dòng có đường mở /planning-…", () => {
    const kinds = rows.map((r) => r.kind);
    expect(kinds).toContain("import-missing-docs");
    expect(kinds).toContain("order-draft-overdue");
    expect(kinds).toContain("export-overdue");
    expect(rows.every((r) => r.path.startsWith("/planning-"))).toBe(true);
  });
  test("Nhập khẩu thiếu chứng từ nêu đúng tên chứng từ", () => {
    const r = rows.find((x) => x.kind === "import-missing-docs");
    expect(r?.detail).toContain("Commercial Invoice");
    expect(r?.path).toBe("/planning-import?contract=c1&receipt=r1");
  });
  test("id không trùng", () => {
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });
});

describe("AC-4 — mức của từng loại", () => {
  const expected: Record<PlanningAttentionKind, "error" | "reminder" | "info"> = {
    "export-overdue": "reminder",
    "export-over-tolerance": "info",
    "export-under-tolerance": "info",
    "export-unpaid": "reminder",
    "import-missing-docs": "reminder",
    "import-awaiting-quantity": "reminder",
    "order-draft-overdue": "reminder",
    "order-stale-revision": "error",
    "order-unlinked": "reminder",
    "invoice-awaiting": "reminder",
    "invoice-mismatch": "error",
  };
  test("11/11 loại theo bảng R3, có nhãn", () => {
    expect(PLANNING_ATTENTION_LEVELS).toEqual(expected);
    expect(Object.values(PLANNING_ATTENTION_LABELS).every((l) => l.length > 0)).toBe(true);
  });
});

describe("AC-5 / AC-6 — quyền", () => {
  const reports: PlanningReports = {
    import: null,
    productionOrder: orderReport([{ orderId: "o1", orderNo: "LSX-01", customerName: "A", kind: "unlinked", firstProductionDate: "2026-10-25" }]),
    export: exportReport([{ kind: "unpaid", outstanding: 5000 }, { kind: "over-tolerance", kgPct: 7 }]),
  };
  test("chỉ quyền Lệnh SX ⇒ không khối / việc module khác", () => {
    const only: PlanningAccess = { import: false, productionOrder: true, export: false, exportPrice: false, supplierInvoice: false };
    const r = buildPlanningReports({ importData: importData(), orderData: { orders: [], lines: [], materials: [], links: [], receiptLines: [], exportData: EMPTY_EXPORT_DATA }, exportData: EMPTY_EXPORT_DATA, customers: [], exportFilesAvailable: true }, planningPeriodFor("2026-10-01", "2026-10-31"), TODAY, only);
    const s = buildPlanningSummary(r, only);
    expect(s.import).toBeNull();
    expect(s.export).toBeNull();
    expect(s.productionOrder).not.toBeNull();
  });
  test("không quyền xem giá ⇒ bỏ Còn tiền chưa về + khối không có tiền", () => {
    const noPrice: PlanningAccess = { ...ALL, exportPrice: false };
    const rows = buildPlanningAttention(reports, noPrice);
    expect(rows.filter((r) => r.kind === "export-unpaid")).toHaveLength(0);
    expect(rows.filter((r) => r.kind === "export-over-tolerance")).toHaveLength(1);
    expect(rows.find((r) => r.kind === "export-over-tolerance")?.detail).not.toContain("tiền");
    expect(buildPlanningSummary(reports, noPrice).export?.outstanding).toBeNull();
  });
  test("có quyền xem giá ⇒ có dòng tiền chưa về", () => {
    expect(buildPlanningAttention(reports, ALL).filter((r) => r.kind === "export-unpaid")).toHaveLength(1);
  });
});

describe("AC-7 / AC-8 — chuyến chờ hóa đơn đại lý", () => {
  const ship = (id: string, deliveryDate: string, workshop: ImportShipment["workshop"] = "Đông"): ImportShipment =>
    ({ id, deliveryDate, postingDate: deliveryDate, backdateReason: "", workshop, supplierName: "Hồng Phú", driverName: "", licensePlate: "", note: "" }) as ImportShipment;
  const trip = (id: string, shipmentId: string, deliveryDate: string, workshop: MaterialImportItem["workshop"] = "Đông"): MaterialImportItem => ({
    id,
    shipmentId,
    deliveryDate,
    workshop,
    category: "Bạch tuộc",
    supplierName: "Hồng Phú",
    materialTypeName: "Bạch tuộc 1 da",
    quantityKg: 500,
    unitPrice: 100000,
    driverName: "",
    licensePlate: "",
    note: "",
    balancingPeriodId: "",
  });
  const mapped = new Set(["Bạch tuộc 1 da"]);
  const range = { fromDate: "2026-10-01", toDate: "2026-10-31" };
  const base = {
    shipments: [ship("s1", "2026-10-20"), ship("s2", "2026-10-30")],
    trips: [trip("t1", "s1", "2026-10-20"), trip("t2", "s2", "2026-10-30")],
    invoices: [] as SupplierInvoice[],
    lines: [] as SupplierInvoiceLine[],
    mappedMaterials: mapped,
  };

  test("chỉ chuyến về quá 10 ngày", () => {
    const rows = buildSupplierInvoiceAttention(base, range, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-10-20");
    expect(rows[0].kind).toBe("invoice-awaiting");
    expect(rows[0].workshop).toBe("Đông");
  });
  test("lọc xưởng khác ⇒ không dòng", () => {
    expect(buildSupplierInvoiceAttention(base, { ...range, workshop: "Cá" }, TODAY)).toHaveLength(0);
  });
  test("loại NL chưa ánh xạ mã kế toán ⇒ không đốc (không thuộc HĐ đại lý)", () => {
    expect(buildSupplierInvoiceAttention({ ...base, mappedMaterials: new Set() }, range, TODAY)).toHaveLength(0);
  });
});

describe("AC-9 — module rỗng / chưa có bảng không làm hỏng trang", () => {
  test("mọi sổ rỗng ⇒ số 0, không việc", () => {
    const r = buildPlanningReports(
      { importData: importData(), orderData: { orders: [], lines: [], materials: [], links: [], receiptLines: [], exportData: EMPTY_EXPORT_DATA }, exportData: EMPTY_EXPORT_DATA, customers: [], exportFilesAvailable: false },
      planningPeriodFor("2026-10-01", "2026-10-31"),
      TODAY,
      ALL,
    );
    expect(buildPlanningAttention(r, ALL)).toHaveLength(0);
    const s = buildPlanningSummary(r, ALL);
    expect(s.import?.receipts).toBe(0);
    expect(s.productionOrder?.orders).toBe(0);
    expect(s.export?.shipments).toBe(0);
    expect(buildSupplierInvoiceAttention({ shipments: [], trips: [], invoices: [], lines: [], mappedMaterials: new Set() }, { fromDate: "2026-10-01", toDate: "2026-10-31" }, TODAY)).toHaveLength(0);
  });
});
