// Oracle: docs/app-map/50-planning-reports.ba-spec.md — AC-1…AC-4, AC-8 (báo cáo Nhập khẩu).
import { describe, expect, test } from "vitest";
import type { ImportContract, ImportContractLine, ImportDocument, ImportReceipt, ImportReceiptLine } from "@/types";
import { monthReportPeriod, quarterPeriod } from "./exportReports";
import { buildImportReport, buildImportReportExcel } from "./importReports";
import type { ImportData } from "./importPlanning";

const T0 = "2026-10-01T00:00:00.000Z";
const contract = (id: string, over: Partial<ImportContract> = {}): ImportContract => ({
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
  ...over,
});
const line = (id: string, contractId: string, kg: number, productName = "Frozen octopus"): ImportContractLine => ({ id, contractId, lineNo: 1, productName, kg, note: "" });
const receipt = (id: string, contractId: string, over: Partial<ImportReceipt> = {}): ImportReceipt => ({
  id,
  contractId,
  contractNo: contractId.toUpperCase(),
  supplierName: "Pacific Marine",
  arrivalDate: "",
  expectedDate: "",
  transport: "40RF",
  containerNo: "",
  blNo: "",
  status: "open",
  cancelReason: "",
  note: "",
  createdAt: T0,
  ...over,
});
const rl = (receiptId: string, contractLineId: string, kg: number | null): ImportReceiptLine => ({ id: `${receiptId}-${contractLineId}`, receiptId, contractLineId, kg, recordedBy: "", updatedAt: T0 });
const doc = (receiptId: string, kind: ImportDocument["kind"], docNo = "x"): ImportDocument => ({
  id: `${receiptId}-${kind}`,
  receiptId,
  kind,
  customName: "",
  docNo,
  docDate: "",
  importType: "export-production",
  notApplicable: false,
  naReason: "",
  note: "",
  createdAt: T0,
});
const fullDocs = (receiptId: string) => [doc(receiptId, "commercial-invoice"), doc(receiptId, "packing-list"), doc(receiptId, "import-declaration")];
const data = (over: Partial<ImportData>): ImportData => ({ contracts: [], lines: [], receipts: [], receiptLines: [], documents: [], files: [], filesAvailable: false, ...over });

describe("AC-1 — kỳ theo tháng về kho / dự kiến, lần hủy không tính", () => {
  const d = data({
    contracts: [contract("c1")],
    lines: [line("l1", "c1", 10000), line("l2", "c1", 10000)],
    receipts: [
      receipt("r1", "c1", { arrivalDate: "2026-10-10" }),
      receipt("r2", "c1", { expectedDate: "2026-10-20" }),
      receipt("r3", "c1", { arrivalDate: "2026-11-05" }),
      receipt("rx", "c1", { arrivalDate: "2026-10-15", status: "cancelled" }),
    ],
    receiptLines: [rl("r1", "l1", 6000), rl("r1", "l2", 4000), rl("rx", "l1", 5000)],
  });
  test("tháng 10: 2 lần nhập, 10.000 kg", () => {
    const r = buildImportReport(d, monthReportPeriod("2026-10"), { today: "2026-10-30" });
    expect(r.totals.receipts).toBe(2);
    expect(r.totals.receivedKg).toBe(10000);
    expect(r.totals.containers).toBe(2);
  });
  test("quý 4: 3 lần nhập", () => {
    expect(buildImportReport(d, quarterPeriod(2026, 4), { today: "2026-10-30" }).totals.receipts).toBe(3);
  });
});

describe("AC-2 — trị giá tách tiền tệ, dòng không giá không cộng", () => {
  test("USD 15.000 · EUR 14.700", () => {
    const d = data({
      contracts: [contract("c1", { linePrices: { l1: 2.5 } }), contract("c2", { currency: "EUR", linePrices: { l2: 3 } }), contract("c3", { importType: "processing", linePrices: { l3: null } })],
      lines: [line("l1", "c1", 6000), line("l2", "c2", 4900), line("l3", "c3", 4000)],
      receipts: [receipt("r1", "c1", { arrivalDate: "2026-10-10" }), receipt("r2", "c2", { arrivalDate: "2026-10-11" }), receipt("r3", "c3", { arrivalDate: "2026-10-12", transport: "lcl" })],
      receiptLines: [rl("r1", "l1", 6000), rl("r2", "l2", 4900), rl("r3", "l3", 4000)],
    });
    const r = buildImportReport(d, monthReportPeriod("2026-10"), { today: "2026-10-30" });
    expect(r.totals.value).toEqual({ USD: 15000, EUR: 14700 });
    expect(r.totals.loose).toBe(1);
    expect(r.byImportType.map((x) => [x.importType, x.receivedKg])).toEqual([
      ["export-production", 10900],
      ["processing", 4000],
    ]);
  });
});

describe("AC-3 — lọc đối tác, kg HĐ còn chưa về", () => {
  const d = data({
    contracts: [contract("c1"), contract("c2", { supplierId: "sB", supplierName: "Andaman", status: "closed" })],
    lines: [line("l1", "c1", 20000), line("l2", "c2", 5000)],
    receipts: [receipt("r1", "c1", { arrivalDate: "2026-10-10" }), receipt("r2", "c2", { supplierName: "Andaman", arrivalDate: "2026-10-12" })],
    receiptLines: [rl("r1", "l1", 10000), rl("r2", "l2", 4900)],
  });
  test("lọc NCC A ⇒ 1 dòng, còn 10.000", () => {
    const r = buildImportReport(d, monthReportPeriod("2026-10"), { today: "2026-10-30", supplierId: "sA" });
    expect(r.bySupplier.length).toBe(1);
    expect(r.bySupplier[0].shortKg).toBe(10000);
  });
  test("không lọc ⇒ HĐ đã đóng của B có còn chưa về 0", () => {
    const r = buildImportReport(d, monthReportPeriod("2026-10"), { today: "2026-10-30" });
    expect(r.bySupplier.find((s) => s.supplierName === "Andaman")?.shortKg).toBe(0);
  });
});

describe("AC-4 — lần nhập cần chú ý", () => {
  test("thiếu chứng từ + chờ thực nhập đã về; chưa tới ngày về thì không", () => {
    const d = data({
      contracts: [contract("c1")],
      lines: [line("l1", "c1", 30000)],
      receipts: [receipt("r1", "c1", { arrivalDate: "2026-10-10" }), receipt("r2", "c1", { arrivalDate: "2026-10-12" }), receipt("r3", "c1", { expectedDate: "2026-10-30" })],
      receiptLines: [rl("r1", "l1", 5000)],
      documents: [doc("r1", "commercial-invoice"), doc("r1", "packing-list"), ...fullDocs("r2"), ...fullDocs("r3")],
    });
    const r = buildImportReport(d, monthReportPeriod("2026-10"), { today: "2026-10-25" });
    expect(r.attention.map((a) => a.kind)).toEqual(["missing-docs", "awaiting-quantity"]);
    expect(r.attention.length).toBe(2);
    expect(r.attention.find((a) => a.kind === "missing-docs")?.missing).toEqual(["import-declaration"]);
  });
});

describe("AC-8 — Excel không lộ giá khi không có quyền giá", () => {
  test("không có ô Trị giá / Đơn giá", () => {
    const d = data({ contracts: [contract("c1", { linePrices: { l1: 2.5 } })], lines: [line("l1", "c1", 6000)], receipts: [receipt("r1", "c1", { arrivalDate: "2026-10-10" })], receiptLines: [rl("r1", "l1", 6000)] });
    const r = buildImportReport(d, monthReportPeriod("2026-10"), { today: "2026-10-30" });
    const cells = buildImportReportExcel(r, { periodLabel: "Tháng 10/2026", viewPrice: false }).flat().map(String);
    expect(cells.filter((c) => /Trị giá|Đơn giá|USD/.test(c)).length).toBe(0);
    const priced = buildImportReportExcel(r, { periodLabel: "Tháng 10/2026", viewPrice: true }).flat().map(String);
    expect(priced.some((c) => c.includes("15000 USD"))).toBe(true);
  });
});
