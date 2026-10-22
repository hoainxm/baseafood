// Oracle: docs/app-map/41-export-planning.ba-spec.md v5 — R25, AC-42…AC-44. Số HĐ 18.26 + lô 165
// (INV 234/26: 22.214 kg · 194.557,60 USD, B/L on board 26/09/2026) là số THẬT trên app ngày 21/10/2026.
import { describe, expect, it } from "vitest";
import { EMPTY_EXPORT_DATA, blankItem, deviationText, type ExportData } from "./exportPlanning";
import { buildExportReport, buildReportExcel, monthReportPeriod, onTimeRate, parseReportPeriod, quarterPeriod, shiftReportPeriod, yearPeriod } from "./exportReports";
import type { ExportContract, ExportContractLine, ExportContractRevision, ExportPayment, ExportShipment, ExportStepItem } from "@/types";

let seq = 0;
const nid = () => `id-${++seq}`;
const T0 = "2026-10-01T00:00:00.000Z";

function line(quantity: number, netKgPerCarton: number, unitPrice: number, bundle?: number): ExportContractLine {
  return { id: nid(), description: "x", hsCode: "", size: "", packing: "", unitKind: bundle ? "bundle" : "carton", cartonsPerUnit: bundle ?? 1, netKgPerCarton, quantity, kg: null, unitPrice, microSpec: "" };
}
/** 14 dòng HĐ 18.26 ⇒ 19.000 kg · 172.445 USD. */
const LINES_1826 = [
  line(200, 10, 10.5), line(100, 10, 10.25), line(150, 10, 11.2), line(100, 10, 11.2), line(200, 10, 4.05), line(200, 12, 4.05), line(50, 12, 2.15),
  line(200, 10, 9.2), line(200, 10, 10.9), line(100, 7, 14.95), line(100, 10, 8.1), line(100, 4, 10.15, 2), line(100, 10, 11.4), line(100, 10, 15.8),
];

const contract = (id: string, over: Partial<ExportContract> = {}): ExportContract => ({
  id, customerId: "scm", contractNo: "18.26/BSF-SCM.2026", signedOn: "2026-07-30", orderRef: "#B182", status: "open", cancelReason: "", closeReason: "", note: "", createdAt: T0, ...over,
});
const revision = (id: string, contractId: string, over: Partial<ExportContractRevision> = {}): ExportContractRevision => ({
  id, contractId, revisionNo: 0, revisedOn: "2026-07-30", changeSummary: "",
  terms: { incoterm: "CFR", portOfLoading: "Cái Mép", portOfDischarge: "Tokyo", paymentMethod: "ttr", depositPct: null, lcNo: "", lcExpiry: "", lcLatestShipment: "", currency: "USD", tolerancePct: 10, latestShipmentDate: "2026-09-05", containerCount: 1, containerType: "40RF", requiredDocuments: [] },
  lines: LINES_1826, filePath: "f/hd.pdf", fileName: "hd.pdf", recordedBy: "KH", createdAt: T0, ...over,
});
const shipment = (id: string, contractId: string, over: Partial<ExportShipment> = {}): ExportShipment => ({
  id, contractId, planMonth: "2026-09", kind: "40RF", goodsSummary: "", plannedKg: 19000, lotCode: "165", portOfDischarge: "Tokyo", bookingNo: "", loadingDate: "2026-09-25", etd: "2026-09-26", eta: "",
  vesselVoyage: "", containerNo: "SZLU9522312", sealNo: "VN50853AT", status: "open", cancelReason: "", note: "", createdAt: T0, ...over,
});
const doc = (shipmentId: string, over: Partial<ExportStepItem>): ExportStepItem => ({ ...blankItem(shipmentId, "document", nid(), T0), state: "done", ...over });
const payment = (over: Partial<ExportPayment>): ExportPayment => ({
  id: nid(), contractId: "", shipmentId: "", kind: "payment", date: "", amount: 0, currency: "USD", method: "", note: "", filePath: "", fileName: "", recordedBy: "KT", createdAt: T0, ...over,
});

/** HĐ 18.26 đã duyệt + chuyến lô 165 có invoice 234/26 + B/L on board 26/09. */
function lot165(extra: Partial<ExportData> = {}): ExportData {
  return {
    ...EMPTY_EXPORT_DATA,
    contracts: [contract("c1")],
    revisions: [revision("r0", "c1")],
    approvals: [{ id: "a1", contractId: "c1", revisionId: "r0", decision: "approved", approverName: "Huỳnh Minh Tường — Giám đốc", decidedOn: "2026-08-12", reason: "", filePath: "f/ky.pdf", fileName: "ky.pdf", recordedBy: "KH", createdAt: T0 }],
    shipments: [shipment("s1", "c1")],
    items: [
      doc("s1", { docKind: "commercial-invoice", number: "234/26", issuedOn: "2026-09-25", cartons: 2251, netKg: 22214, amount: 194557.6 }),
      doc("s1", { docKind: "bill-of-lading", number: "PAPTYO260926224", issuedOn: "2026-09-26", onBoardDate: "2026-09-26" }),
    ],
    ...extra,
  };
}
const customers = [{ id: "scm", name: "Seachemot" }, { id: "k2", name: "Lucky" }];
const TODAY = "2026-10-22";

describe("Kỳ báo cáo", () => {
  it("năm · quý · tháng: khoảng ngày và các tháng", () => {
    expect(yearPeriod(2026)).toMatchObject({ key: "2026", from: "2026-01-01", to: "2026-12-31", label: "Năm 2026" });
    expect(yearPeriod(2026).months).toHaveLength(12);
    expect(quarterPeriod(2026, 3)).toMatchObject({ key: "2026-Q3", from: "2026-07-01", to: "2026-09-30", months: ["2026-07", "2026-08", "2026-09"] });
    expect(monthReportPeriod("2026-02")).toMatchObject({ from: "2026-02-01", to: "2026-02-28", months: ["2026-02"] });
  });
  it("đọc khóa URL, khóa hỏng về kỳ chứa hôm nay", () => {
    expect(parseReportPeriod("2026-Q4", TODAY).key).toBe("2026-Q4");
    expect(parseReportPeriod("2026-09", TODAY).kind).toBe("month");
    expect(parseReportPeriod("abc", TODAY).key).toBe("2026");
    expect(parseReportPeriod(null, TODAY, "quarter").key).toBe("2026-Q4");
  });
  it("lùi / tiến kỳ qua năm", () => {
    expect(shiftReportPeriod(quarterPeriod(2026, 1), -1).key).toBe("2025-Q4");
    expect(shiftReportPeriod(monthReportPeriod("2026-12"), 1).key).toBe("2027-01");
    expect(shiftReportPeriod(yearPeriod(2026), -1).key).toBe("2025");
  });
});

describe("AC-42 — báo cáo năm khớp hồ sơ thật lô 165", () => {
  const r = buildExportReport(lot165(), yearPeriod(2026), { customers, today: TODAY });
  it("tháng 9 có đúng chuyến lô 165, các tháng khác 0", () => {
    const sep = r.byMonth.find((m) => m.month === "2026-09")!;
    expect(sep).toMatchObject({ shipments: 1, containers: 1, plannedKg: 19000, actualKg: 22214, actualAmount: 194557.6, received: 0, outstanding: 194557.6 });
    expect(r.byMonth.filter((m) => m.shipments > 0)).toHaveLength(1);
  });
  it("tổng: 1 HĐ ký, trễ 1, đúng hạn 0", () => {
    expect(r.totals).toMatchObject({ contractsSigned: 1, contractKg: 19000, contractAmount: 172445, shipments: 1, late: 1, onTime: 0, delivered: 1 });
    expect(onTimeRate(r.totals)).toBe(0);
  });
  it("HĐ 18.26 cần chú ý: vượt dung sai thừa 16,9% kg, còn tiền chưa về", () => {
    const over = r.attention.find((a) => a.kind === "over-tolerance")!;
    expect(over.contractNo).toBe("18.26/BSF-SCM.2026");
    expect(deviationText(over.kgPct)).toBe("thừa 16,9%");
    expect(deviationText(over.amountPct)).toBe("thừa 12,8%");
    expect(r.attention.find((a) => a.kind === "unpaid")?.outstanding).toBe(194557.6);
    // Đã lên đủ 1/1 cont ⇒ không "quá hạn giao" (trễ chỉ ở chuyến).
    expect(r.attention.some((a) => a.kind === "overdue")).toBe(false);
  });
  it("bước kẹt: bước 1 xong (đã duyệt + file), bước 2 Lệnh SX chưa có", () => {
    expect(r.stuck[1]).toBe(0);
    expect(r.stuck[2]).toBe(1);
  });
  it("kỳ không chứa chuyến lẫn hạn giao ⇒ không số, không HĐ cần chú ý", () => {
    const q1 = buildExportReport(lot165(), quarterPeriod(2026, 1), { customers, today: TODAY });
    expect(q1.totals.shipments).toBe(0);
    expect(q1.attention).toEqual([]);
  });
});

describe("AC-43 — lọc khách áp mọi số, bỏ chuyến / HĐ đã hủy", () => {
  const base = lot165();
  const d: ExportData = {
    ...base,
    contracts: [...base.contracts, contract("c2", { customerId: "k2", contractNo: "LK-01", signedOn: "2026-09-01" }), contract("c3", { customerId: "k2", contractNo: "LK-HUY", status: "cancelled" })],
    revisions: [...base.revisions, revision("r2", "c2"), revision("r3", "c3")],
    shipments: [
      ...base.shipments,
      shipment("s2", "c2", { plannedKg: 5000, loadingDate: "2026-09-10", etd: "2026-09-11", containerNo: "" }),
      shipment("s3", "c2", { plannedKg: 7000, status: "cancelled", loadingDate: "2026-09-12" }),
      shipment("s4", "c3", { plannedKg: 9000, loadingDate: "2026-09-13" }),
    ],
  };
  it("không lọc: tháng 9 có 2 chuyến (bỏ chuyến hủy + chuyến của HĐ hủy)", () => {
    const r = buildExportReport(d, yearPeriod(2026), { customers, today: TODAY });
    expect(r.byMonth.find((m) => m.month === "2026-09")).toMatchObject({ shipments: 2, plannedKg: 24000 });
    expect(r.totals.contractsSigned).toBe(2);
    expect(r.byCustomer.map((c) => c.name)).toEqual(["Seachemot", "Lucky"]);
  });
  it("lọc Seachemot: chỉ 1 chuyến, 1 khách, HĐ cần chú ý chỉ của Seachemot", () => {
    const r = buildExportReport(d, yearPeriod(2026), { customers, customerId: "scm", today: TODAY });
    expect(r.totals.shipments).toBe(1);
    expect(r.totals.contractsSigned).toBe(1);
    expect(r.byCustomer).toHaveLength(1);
    expect(r.attention.every((a) => a.customerId === "scm")).toBe(true);
  });
});

describe("AC-44 — tiền về theo ngày nhận, còn chưa về theo chuyến", () => {
  const d = lot165({
    payments: [
      payment({ shipmentId: "s1", contractId: "c1", date: "2026-10-15", amount: 100000 }),
      payment({ contractId: "c1", date: "2026-08-05", amount: 20000 }),
      payment({ shipmentId: "s1", contractId: "c1", kind: "documents-sent", date: "2026-09-28", amount: null }),
    ],
  });
  it("tiền về rơi vào kỳ của ngày nhận (cả cọc cấp HĐ)", () => {
    expect(buildExportReport(d, monthReportPeriod("2026-10"), { customers, today: TODAY }).totals.received).toBe(100000);
    expect(buildExportReport(d, monthReportPeriod("2026-08"), { customers, today: TODAY }).totals.received).toBe(20000);
  });
  it("còn chưa về của chuyến tháng 9 trừ tiền về của chuyến, không trừ cọc HĐ", () => {
    const sep = buildExportReport(d, monthReportPeriod("2026-09"), { customers, today: TODAY });
    expect(sep.totals.outstanding).toBe(94557.6);
    expect(sep.totals.received).toBe(0);
  });
  it("HĐ còn tiền chưa về = thực xuất − mọi lần tiền về của HĐ", () => {
    const year = buildExportReport(d, yearPeriod(2026), { customers, today: TODAY });
    expect(year.attention.find((a) => a.kind === "unpaid")?.outstanding).toBe(74557.6);
    expect(year.byCustomer[0]).toMatchObject({ received: 120000, outstanding: 94557.6 });
  });
});

describe("AC-45 — Excel báo cáo không có tiền khi không quyền xem giá", () => {
  const r = buildExportReport(lot165(), yearPeriod(2026), { customers, today: TODAY });
  const flat = (aoa: (string | number | null)[][]) => aoa.flat().map((c) => String(c ?? ""));
  it("có quyền giá ⇒ có cột USD và dòng còn tiền chưa về", () => {
    const cells = flat(buildReportExcel(r, { viewPrice: true, deviationText }));
    expect(cells.filter((c) => c.includes("USD")).length).toBeGreaterThan(0);
    expect(cells).toContain("Còn tiền chưa về");
  });
  it("không quyền giá ⇒ 0 ô chứa USD / giá trị tiền, bỏ dòng tiền chưa về", () => {
    const cells = flat(buildReportExcel(r, { viewPrice: false, deviationText }));
    expect(cells.filter((c) => /USD|Giá trị|Tiền về/.test(c))).toEqual([]);
    expect(cells).not.toContain("194557.6");
    expect(cells).not.toContain("Còn tiền chưa về");
    expect(cells).toContain("kg thừa 16,9%");
  });
});
