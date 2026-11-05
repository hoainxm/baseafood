// Phòng KH 2026-11-05: "một cont nhiều hợp đồng — mở chuyến ra chưa chọn được cont" (DAIREI BD-007/008/009 ghi mỗi HĐ
// mỗi tháng một chuyến Đóng ghép) ⇒ đưa chuyến Đóng ghép vào cont của chuyến khác.
import { describe, expect, it } from "vitest";
import type { ExportContract, ExportContractLine, ExportContractRevision, ExportContractTerms, ExportFile, ExportShipment } from "@/types";
import { EMPTY_EXPORT_DATA, contractCoverage, isMultiContractShipment, type ExportData } from "./exportPlanning";
import { consolidateGate, consolidateInto, consolidateTargets } from "./exportConsolidate";

const T0 = "2026-11-05T00:00:00.000Z";
const bundle = (id: string, quantity: number): ExportContractLine => ({
  id, description: `FROZEN OCTOPUS ${id}`, hsCode: "", size: "", packing: "1kg/bag x 5 Bags/Ctn x 2/B'DL", unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: 5, quantity, kg: null, unitPrice: 9, microSpec: "",
});
const terms: ExportContractTerms = {
  incoterm: "CFR", portOfLoading: "", portOfDischarge: "Tokyo", paymentMethod: "ttr", depositPct: null, lcNo: "", lcExpiry: "", lcLatestShipment: "", currency: "USD", tolerancePct: 10, latestShipmentDate: "2027-09-30", containerCount: null, containerType: "", requiredDocuments: [],
};
const contract = (id: string, no: string, customerId = "dairei"): ExportContract => ({ id, customerId, contractNo: no, signedOn: "2026-08-07", orderRef: "", status: "open", cancelReason: "", closeReason: "", note: "", createdAt: T0 });
const revision = (contractId: string, lines: ExportContractLine[]): ExportContractRevision => ({ id: `r-${contractId}`, contractId, revisionNo: 0, revisedOn: "2026-08-07", changeSummary: "", terms, lines, filePath: "", fileName: "", recordedBy: "KH", createdAt: T0 });
const ship = (id: string, contractId: string, over: Partial<ExportShipment> = {}): ExportShipment => ({
  id, contractId, planMonth: "2026-11", kind: "consolidated", goodsSummary: "", plannedKg: null, lotCode: "", portOfDischarge: "Tokyo", bookingNo: "", loadingDate: "2026-11-06", etd: "", eta: "", vesselVoyage: "", containerNo: "", sealNo: "", status: "open", cancelReason: "", note: "", createdAt: T0, ...over,
});
// Hồ sơ "HĐ đã ký" đủ ⇒ qua cổng ghi chuyến của HĐ khác.
const signed = (contractId: string): ExportFile => ({ id: `hd-${contractId}`, contractId, shipmentId: "", stepItemId: "", step: "contract", attachmentKind: "signed-contract", path: "p", fileName: "hd.pdf", layerNo: null, caption: "", uploadedBy: "KH", createdAt: T0 });

const host = ship("h", "c7", { kind: "20RF", plannedKg: 4000, bookingNo: "SGNGCZ486800" });
const consolidatedShip = ship("g", "c8", { plannedKg: 3000, bookingNo: "SGNGCZ486800" });
const base = (over: Partial<ExportData> = {}): ExportData => ({
  ...EMPTY_EXPORT_DATA,
  contracts: [contract("c7", "BD-007/26"), contract("c8", "BD-008/26"), contract("x", "X-1", "khac")],
  revisions: [revision("c7", [bundle("l7", 5000)]), revision("c8", [bundle("l8", 6000)]), revision("x", [bundle("lx", 100)])],
  files: [signed("c7"), signed("c8"), signed("x")],
  shipments: [host, consolidatedShip],
  ...over,
});

describe("đưa chuyến Đóng ghép vào cont của chuyến khác", () => {
  it("BD-008 3.000 kg vào cont 20RF của BD-007 4.000 kg (cùng booking 06/11) ⇒ một chuyến hai HĐ, kg từng HĐ giữ nguyên", () => {
    const d = base();
    const before7 = contractCoverage(d, "c7").plannedKg;
    const before8 = contractCoverage(d, "c8").plannedKg;
    expect(consolidateTargets(d, consolidatedShip).map((s) => s.id)).toEqual(["h"]);
    let n = 0;
    const out = consolidateInto(d, consolidatedShip, host, () => `n${++n}`);
    const after = { ...d, ...out };
    expect(after.shipments.map((s) => s.id)).toEqual(["h"]);
    const h = after.shipments[0];
    expect(isMultiContractShipment(after, h)).toBe(true);
    expect(h.plannedKg).toBe(7000);
    // BD-007: 400 bó × 10 kg; BD-008: 300 bó × 10 kg.
    expect(out.shipmentLines.map((l) => [l.contractId, l.plannedUnits])).toEqual([["c7", 400], ["c8", 300]]);
    expect(contractCoverage(after, "c7").plannedKg).toBe(before7);
    expect(contractCoverage(after, "c8").plannedKg).toBe(before8);
    expect(out.notices).toEqual([]);
  });

  it("chặn: khác khách · chuyến Đóng ghép đã có file · chuyến nhận không phải cont", () => {
    const d = base({ shipments: [host, consolidatedShip, ship("o", "x", { kind: "20RF" }), ship("t", "c7", { kind: "truck" })] });
    expect(consolidateGate(d, consolidatedShip, d.shipments[2])).toEqual({ ok: false, reason: "customer-mismatch" });
    expect(consolidateGate(d, consolidatedShip, d.shipments[3])).toEqual({ ok: false, reason: "not-container" });
    const withFile = { ...d, files: [...d.files, { ...signed("c8"), id: "f", shipmentId: "g", step: "booking" as const }] };
    expect(consolidateGate(withFile, consolidatedShip, host)).toEqual({ ok: false, reason: "has-progress" });
    expect(consolidateGate(d, host, consolidatedShip)).toEqual({ ok: false, reason: "not-consolidated" });
    const closed = { ...d, contracts: d.contracts.map((c) => (c.id === "c7" ? { ...c, status: "closed" as const } : c)) };
    expect(consolidateGate(closed, consolidatedShip, host)).toEqual({ ok: false, reason: "not-open" });
  });

  it("HĐ nhiều dòng ⇒ dòng chưa có số kiện + nhắc ghi ở Hàng của chuyến", () => {
    const d = base({ revisions: [revision("c7", [bundle("l7", 5000)]), revision("c8", [bundle("a", 1), bundle("b", 1)]), revision("x", [])] });
    const out = consolidateInto(d, consolidatedShip, host, () => "id");
    expect(out.shipmentLines.filter((l) => l.contractId === "c8").map((l) => l.plannedUnits)).toEqual([null, null]);
    expect(out.notices[0]).toContain("BD-008/26 có 2 dòng hàng");
  });
});
