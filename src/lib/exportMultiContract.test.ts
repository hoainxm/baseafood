// ba-spec 70 — một chuyến chở hàng của nhiều HĐ cùng khách (lịch gọi hàng DAIREI, HĐ BD-009/26).
import { describe, expect, it } from "vitest";
import {
  EMPTY_EXPORT_DATA,
  addContractGate,
  addableContracts,
  blankItem,
  canDeleteContract,
  contractActuals,
  contractClosure,
  contractPaymentSummary,
  contractState,
  customerChangeGate,
  lineContractOf,
  linesWithContractNo,
  shipmentContractIds,
  shipmentContractLines,
  shipmentDeadline,
  stepState,
  type ExportData,
} from "./exportPlanning";
import { loadingCountRows, shipmentLineFromContract } from "./exportInvoice";
import type { ExportContract, ExportContractLine, ExportContractRevision, ExportContractTerms, ExportShipment, ExportShipmentLine, ExportStepItem } from "@/types";

let seq = 0;
const nid = () => `id-${++seq}`;
const T0 = "2026-08-07T00:00:00.000Z";
const NO_FILES = { filesAvailable: false };

/** Một dòng HĐ: bó × 2 thùng × 5 kg, giá USD/kg. */
function cline(id: string, description: string, quantity: number, unitPrice: number): ExportContractLine {
  return { id, description, hsCode: "", size: "", packing: "1kg/bag x 5 Bags/Ctn x 2/B'DL", unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: 5, quantity, kg: null, unitPrice, microSpec: "" };
}

function terms(over: Partial<ExportContractTerms> = {}): ExportContractTerms {
  return {
    incoterm: "CFR",
    portOfLoading: "Cái Mép",
    portOfDischarge: "Tokyo",
    paymentMethod: "ttr",
    depositPct: null,
    lcNo: "",
    lcExpiry: "",
    lcLatestShipment: "",
    currency: "USD",
    tolerancePct: 10,
    latestShipmentDate: "2027-09-30",
    containerCount: null,
    containerType: "40RF",
    requiredDocuments: [],
    ...over,
  };
}

const contract = (id: string, contractNo: string, over: Partial<ExportContract> = {}): ExportContract => ({
  id,
  customerId: "dairei",
  contractNo,
  signedOn: "2026-08-07",
  orderRef: "",
  status: "open",
  cancelReason: "",
  closeReason: "",
  note: "",
  createdAt: T0,
  ...over,
});
const revision = (contractId: string, lines: ExportContractLine[], over: Partial<ExportContractTerms> = {}): ExportContractRevision => ({
  id: `r-${contractId}`,
  contractId,
  revisionNo: 0,
  revisedOn: "2026-08-07",
  changeSummary: "",
  terms: terms(over),
  lines,
  filePath: "",
  fileName: "",
  recordedBy: "KH",
  createdAt: T0,
});

function shipment(id: string, contractId: string, over: Partial<ExportShipment> = {}): ExportShipment {
  return {
    id,
    contractId,
    planMonth: "2026-12",
    kind: "40RF",
    goodsSummary: "",
    plannedKg: null,
    lotCode: "",
    portOfDischarge: "Tokyo",
    bookingNo: "",
    loadingDate: "",
    etd: "",
    eta: "",
    vesselVoyage: "",
    containerNo: "",
    sealNo: "",
    status: "open",
    cancelReason: "",
    note: "",
    createdAt: T0,
    ...over,
  };
}

/** Dòng chuyến lấy từ dòng HĐ, số bó thực đóng. */
const sline = (s: ExportShipment, contractId: string, cl: ExportContractLine, loaded: number): ExportShipmentLine => ({
  ...shipmentLineFromContract(cl, { id: nid(), shipmentId: s.id, contractId, sortOrder: 0 }),
  loadedUnits: loaded,
});

/** Mọi mục bước 2–5 "không áp dụng" + số cont / seal hợp lệ ⇒ chuyến khép (41 `isShipmentClosed`). */
function closedItems(shipmentId: string): ExportStepItem[] {
  const steps: ExportStepItem["step"][] = ["production-order", "packaging", "export-order", "loading-plan", "loading-photos", "customs-declaration", "document"];
  return steps.map((step) => ({ ...blankItem(shipmentId, step, nid(), T0), state: "not-applicable", ...(step === "document" ? { docKind: "commercial-invoice" } : {}) }) as ExportStepItem);
}
const CLOSED: Partial<ExportShipment> = { containerNo: "SZLU9522312", sealNo: "VN50853AT", loadingDate: "2026-12-01", etd: "2026-12-02" };

// HĐ của DAIREI: mã 3192, BD-009/26 (mã 3970 — 1.250 bó, 9,65 USD/kg), mã 3824.
const L3192 = cline("l3192", "FROZEN OCTOPUS (DAIREI-3192)", 5000, 9);
const L3970 = cline("l3970", "FROZEN OCTOPUS KARAAGE IQF (UCC BRAND-3970)", 1250, 9.65);
const L3824 = cline("l3824", "FROZEN OCTOPUS (JFDA-3824)", 6000, 8);
const C3192 = contract("c3192", "BD-007/26");
const BD009 = contract("bd009", "BD-009/26");
const C3824 = contract("c3824", "BD-008/26");
const REVS = [revision("c3192", [L3192]), revision("bd009", [L3970]), revision("c3824", [L3824])];
const base = (over: Partial<ExportData> = {}): ExportData => ({ ...EMPTY_EXPORT_DATA, contracts: [C3192, BD009, C3824], revisions: REVS, ...over });

describe("ba-spec 70 — chuyến gộp nhiều HĐ", () => {
  it("AC-1: đã giao chia theo dòng của từng HĐ", () => {
    const s = shipment("s12", "c3192");
    const lines = [sline(s, "c3192", L3192, 430), sline(s, "bd009", L3970, 200), sline(s, "c3824", L3824, 500)];
    const d = base({ shipments: [s], shipmentLines: lines });
    expect(shipmentContractIds(d, s)).toEqual(["c3192", "bd009", "c3824"]);
    expect(contractActuals(d, "bd009")).toEqual({ cartons: 400, kg: 2000, amount: 19300 });
    expect(contractActuals(d, "c3192").kg).toBe(4300);
    expect(lines.reduce((t, l) => t + (l.loadedUnits ?? 0), 0)).toBe(1130);
  });

  it("AC-2: HĐ xong khi đủ tổng dù lệch tháng; một chuyến chưa khép ⇒ đang ghi chuyến", () => {
    const ships = [shipment("t12", "c3192", CLOSED), shipment("t03", "c3824", CLOSED), shipment("t06", "c3192", CLOSED)];
    const lines = [sline(ships[0], "bd009", L3970, 400), sline(ships[1], "bd009", L3970, 300), sline(ships[2], "bd009", L3970, 550)];
    const items = ships.flatMap((s) => closedItems(s.id));
    const d = base({ shipments: ships, shipmentLines: lines, items });
    expect(contractActuals(d, "bd009").kg).toBe(12500);
    expect(contractState(d, "bd009", NO_FILES)).toBe("final-review");
    const open = base({ shipments: ships, shipmentLines: lines, items: items.filter((i) => i.shipmentId !== "t06") });
    expect(contractState(open, "bd009", NO_FILES)).toBe("shipping");
  });

  it("AC-3: dung sai 10 % hai đầu (1.125 – 1.375 bó)", () => {
    const closedWith = (units: number) => {
      const s = shipment("s", "c3192", CLOSED);
      return contractClosure(base({ shipments: [s], shipmentLines: [sline(s, "bd009", L3970, units)], items: closedItems("s") }), "bd009", NO_FILES).closed;
    };
    expect([1120, 1125, 1375, 1380].map(closedWith)).toEqual([false, true, true, false]);
  });

  it("AC-4: chuyến gộp vẫn là một chuyến — bước 1 xét mọi HĐ, hạn giao lấy hạn sớm nhất", () => {
    const revs = [revision("c3192", [L3192]), revision("bd009", [L3970], { latestShipmentDate: "2027-03-31" }), revision("c3824", [L3824])];
    const s = shipment("s", "c3192");
    const d = base({ revisions: revs, shipments: [s], shipmentLines: [sline(s, "c3192", L3192, 430), sline(s, "bd009", L3970, 200)] });
    expect(shipmentDeadline(d, s)).toBe("2027-03-31");
    expect(stepState(d, s, 1, NO_FILES)).toBe("done");
    const noRev = { ...d, revisions: revs.filter((r) => r.contractId !== "bd009") };
    expect(stepState(noRev, s, 1, NO_FILES)).not.toBe("done");
  });

  it("AC-5: chặn HĐ khách khác / thiếu hồ sơ; danh sách HĐ thêm được", () => {
    const other = contract("x", "X-01/26", { customerId: "khac" });
    const needSigned = revision("c3824", [L3824], { requiredDocuments: [] });
    const d = base({ contracts: [C3192, BD009, C3824, other], revisions: [...REVS.filter((r) => r.contractId !== "c3824"), needSigned, revision("x", [L3192])] });
    const s = shipment("s", "c3192");
    expect(addContractGate(d, s, "x", NO_FILES)).toMatchObject({ ok: false, reason: "customer-mismatch" });
    expect(addContractGate(d, s, "c3192", NO_FILES)).toMatchObject({ ok: false, reason: "same-contract" });
    expect(addContractGate(d, s, "bd009", NO_FILES).ok).toBe(true);
    const closedBd = { ...d, contracts: d.contracts.map((c) => (c.id === "bd009" ? { ...c, status: "closed" as const } : c)) };
    expect(addContractGate(closedBd, s, "bd009", NO_FILES)).toMatchObject({ ok: false, reason: "not-open" });
    expect(addableContracts(d, s, NO_FILES).map((c) => c.id)).toEqual(["c3824", "bd009"]);
  });

  it("R10, R41: HĐ chỉ có hàng trên chuyến gộp vẫn bị khóa đổi khách / xóa", () => {
    const s = shipment("s", "c3192", { ...CLOSED, bookingNo: "BKG-1" });
    const d = base({ shipments: [s], shipmentLines: [sline(s, "bd009", L3970, 200)], items: closedItems("s") });
    expect(customerChangeGate(d, "bd009", NO_FILES).ok).toBe(false);
    expect(canDeleteContract(d, "bd009")).toMatchObject({ ok: false, reason: "has-shipments" });
    expect(canDeleteContract(d, "c3824").ok).toBe(true);
  });

  it("NL7: tiền về của chuyến gộp chia về HĐ theo tiền từng dòng", () => {
    const s = shipment("s", "c3192");
    // 3192: 430 bó × 10 kg × 9 = 38.700 · BD-009/26: 200 bó × 10 kg × 9,65 = 19.300 ⇒ tổng 58.000
    const d = base({
      shipments: [s],
      shipmentLines: [sline(s, "c3192", L3192, 430), sline(s, "bd009", L3970, 200)],
      payments: [{ id: "p1", contractId: "c3192", shipmentId: "s", kind: "payment", date: "2027-01-10", amount: 29000, currency: "USD", note: "", recordedBy: "KT", createdAt: T0 } as ExportData["payments"][number]],
    });
    expect(contractPaymentSummary(d, "bd009")).toEqual({ received: 9650, expected: 19300 });
    expect(contractPaymentSummary(d, "c3192")).toEqual({ received: 19350, expected: 38700 });
  });

  it("R2: chuyến cũ chưa có dòng chỉ thuộc HĐ chính", () => {
    const s = shipment("old", "c3192");
    const d = base({ shipments: [s] });
    expect(shipmentContractIds(d, s)).toEqual(["c3192"]);
    expect(contractActuals(d, "bd009")).toEqual({ cartons: 0, kg: 0, amount: 0 });
  });

  it("Q3 + R9: chứng từ ghi số HĐ theo dòng; dòng tạm của đóng cont mang đúng HĐ", () => {
    const s = shipment("s", "c3192");
    const lines = [sline(s, "c3192", L3192, 430), sline(s, "bd009", L3970, 200)];
    const d = base({ shipments: [s], shipmentLines: lines });
    expect(linesWithContractNo(d, s, lines).map((l) => l.description)).toEqual([
      "FROZEN OCTOPUS (DAIREI-3192) (Contract No. BD-007/26)",
      "FROZEN OCTOPUS KARAAGE IQF (UCC BRAND-3970) (Contract No. BD-009/26)",
    ]);
    const single = base({ shipments: [s], shipmentLines: [lines[0]] });
    expect(linesWithContractNo(single, s, [lines[0]])[0].description).toBe("FROZEN OCTOPUS (DAIREI-3192)");
    // Chuyến gộp 3192 + BD-009/26: dòng 3824 không thuộc chuyến; dòng tạm lấy HĐ theo dòng HĐ.
    const rows = loadingCountRows([], shipmentContractLines(d, s), { shipmentId: "s", contractId: "c3192", lineContract: lineContractOf(d, s) });
    expect(rows.map((r) => r.contractId)).toEqual(["c3192", "bd009"]);
  });
});
