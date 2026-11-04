// Bản sửa HĐ cấp id dòng mới (trước 2026-11-04) ⇒ hàng của chuyến mất nối ⇒ đơn giá 0 (KAISEI 04-26-KMP, chuyến 02/11).
import { describe, expect, it } from "vitest";
import type { ExportContractLine, ExportContractRevision, ExportShipment, ExportShipmentLine } from "@/types";
import { EMPTY_EXPORT_DATA, currentContractLineId, matchLineAcrossRevisions, remapLegacyContractLineIds, type ExportData } from "./exportPlanning";
import { buildInvoiceDocument, invoiceUnitPrice } from "./exportInvoice";
import { siGrossByLine } from "./shippingInstruction";

const cl = (id: string, size: string, unitPrice: number | null, productId = "crab"): ExportContractLine =>
  ({ id, description: "FROZEN CRAB KARAAGE", size, unitPrice, productId, netKgPerCarton: 10, unitKind: "carton", cartonsPerUnit: 1 }) as ExportContractLine;
const rev = (id: string, no: number, lines: ExportContractLine[]) => ({ id, contractId: "c1", revisionNo: no, lines, terms: {} }) as unknown as ExportContractRevision;
const sl = (id: string, contractLineId: string, units: number, over: Partial<ExportShipmentLine> = {}): ExportShipmentLine =>
  ({ id, shipmentId: "s1", contractId: "c1", sortOrder: 0, contractLineId, description: "FROZEN CRAB KARAAGE", size: "", packing: "", productId: "", note: "", loadedBy: "", loadedAt: "", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, grossKgPerUnit: null, plannedUnits: null, loadedUnits: units, expiry: "", ...over }) as ExportShipmentLine;

// Bản 1 (chuyến lập lúc này) và bản 2 (lập 04/11, id dòng mới).
const r1 = rev("r1", 1, [cl("a1", "2-4 gr/pc", 6.45), cl("b1", "4-8 gr/pc", 6.55)]);
const r2 = rev("r2", 2, [cl("a2", "2-4 gr/pc", 6.45), cl("b2", "4-8 gr/pc", 6.55)]);
const d: ExportData = { ...EMPTY_EXPORT_DATA, revisions: [r1, r2], shipments: [{ id: "s1", contractId: "c1" } as ExportShipment] };

describe("dòng HĐ qua các bản sửa", () => {
  it("khớp mặt hàng + size + tên sang bản mới", () => {
    expect(matchLineAcrossRevisions(r1.lines, r2.lines, "b1")?.id).toBe("b2");
    expect(currentContractLineId(d, "c1", "a1")).toBe("a2");
    expect(currentContractLineId(d, "c1", "a2")).toBe("a2");
    expect(currentContractLineId(d, "c1", "lạ")).toBe("lạ");
  });

  it("không khớp được theo khóa ⇒ cùng vị trí khi cùng mặt hàng; khác hẳn ⇒ null", () => {
    const changed = [cl("x", "2-5 gr/pc", 6.4), cl("y", "5-8 gr/pc", 6.6)];
    expect(matchLineAcrossRevisions(r1.lines, changed, "b1")?.id).toBe("y");
    expect(matchLineAcrossRevisions(r1.lines, [cl("z", "2-4", 1, "other")].map((l) => ({ ...l, description: "SQUID" })), "a1")).toBeNull();
  });

  it("KAISEI: hàng của chuyến trỏ bản 1 ⇒ nối sang bản 2, đơn giá 6,45 / 6,55, invoice đủ tiền", () => {
    const lines = remapLegacyContractLineIds(d, [sl("l1", "a1", 657), sl("l2", "b1", 1)]);
    expect(lines.map((l) => l.contractLineId)).toEqual(["a2", "b2"]);
    expect(lines.map((l) => invoiceUnitPrice(l, undefined, r2.lines))).toEqual([6.45, 6.55]);
    const doc = buildInvoiceDocument({
      invoiceNo: "1", issuedOn: "2026-11-02", customer: { name: "KAISEI", address: "" },
      shipment: { loadingDate: "", etd: "", vesselVoyage: "", containerNo: "", sealNo: "" },
      blNo: "", portOfLoading: "", portOfDischarge: "", currency: "USD", tradeTerms: "", originNote: "",
      lines, unitPrice: (l) => invoiceUnitPrice(l, undefined, r2.lines), bankLines: [], specialNotes: "",
    });
    expect(doc.totals.amount).toBe(42442); // 6.570 kg × 6,45 + 10 kg × 6,55
    expect(doc.incompleteLines).toEqual([]);
  });

  it("không đổi gì ⇒ trả đúng mảng cũ (không vẽ lại)", () => {
    const lines = [sl("l1", "a2", 1)];
    expect(remapLegacyContractLineIds(d, lines)).toBe(lines);
  });
});

describe("cảnh báo dòng invoice chưa đủ — nói đích danh thiếu gì", () => {
  it("thiếu đơn giá / thiếu số kiện", () => {
    const doc = buildInvoiceDocument({
      invoiceNo: "1", issuedOn: "2026-11-02", customer: { name: "K", address: "" },
      shipment: { loadingDate: "", etd: "", vesselVoyage: "", containerNo: "", sealNo: "" },
      blNo: "", portOfLoading: "", portOfDischarge: "", currency: "USD", tradeTerms: "", originNote: "",
      lines: [sl("l1", "a2", 657), sl("l2", "b2", 0, { loadedUnits: null })], unitPrice: (l) => (l.id === "l1" ? null : 6.55), bankLines: [], specialNotes: "",
    });
    expect(doc.incompleteLines).toEqual([
      { lineId: "l1", missing: ["unitPrice"] },
      { lineId: "l2", missing: ["units"] },
    ]);
  });
});

describe("Packing list lấy gross theo SI", () => {
  const si = (goods: { contractLineId: string; grossKg: number | null }[]) => ({ values: { goods: goods.map((g) => ({ ...g, description: "", hsCode: "", packages: null })) } });

  it("khớp theo dòng HĐ, kể cả SI lưu id của bản cũ", () => {
    const lines = [sl("l1", "a2", 657), sl("l2", "b2", 1)];
    const m = siGrossByLine(si([{ contractLineId: "a1", grossKg: 7227 }, { contractLineId: "b1", grossKg: 11 }]), lines, (id) => currentContractLineId(d, "c1", id));
    expect(m.get("l1")).toBe(7227);
    expect(m.get("l2")).toBe(11);
  });

  it("phiếu Packing list in gross theo SI, gross mỗi kiện = gross ÷ số kiện", () => {
    const lines = [sl("l1", "a2", 657)];
    const doc = buildInvoiceDocument({
      invoiceNo: "1", issuedOn: "2026-11-02", customer: { name: "K", address: "" },
      shipment: { loadingDate: "", etd: "", vesselVoyage: "", containerNo: "", sealNo: "" },
      blNo: "", portOfLoading: "", portOfDischarge: "", currency: "USD", tradeTerms: "", originNote: "",
      lines, unitPrice: () => 6.45, bankLines: [], specialNotes: "", siGrossKg: () => 7227,
    });
    expect(doc.totals.grossKg).toBe(7227);
    const pl = doc.sheets.find((x) => /pack/i.test(x.name))!;
    expect(pl.rows.some((r) => r.cells.includes("10kgs/11kgs"))).toBe(true);
  });

  it("không có SI / dòng SI không khớp ⇒ không lấy", () => {
    expect(siGrossByLine(null, [sl("l1", "a2", 1)]).size).toBe(0);
    expect(siGrossByLine(si([{ contractLineId: "zz", grossKg: 5 }]), [sl("l1", "a2", 1)]).size).toBe(0);
  });
});
