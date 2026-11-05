// Phòng KH 2026-11-04: mục Packing List tạo được file riêng (chỉ Packing list), không phải tìm trong file invoice.
import { describe, expect, it } from "vitest";
import type { ExportShipmentLine } from "@/types";
import { buildInvoiceDocument } from "@/lib/exportInvoice";
import { packingListPdfFile } from "./invoiceDocument";

const line = (over: Partial<ExportShipmentLine>): ExportShipmentLine =>
  ({ id: "l", shipmentId: "s", contractId: "c", sortOrder: 0, contractLineId: "", productId: "", description: "FROZEN CRAB KARAAGE", size: "2-4 gr/pc", packing: "", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, grossKgPerUnit: 11, plannedUnits: null, loadedUnits: 657, loadedBy: "", loadedAt: "", expiry: "", note: "", ...over }) as ExportShipmentLine;

async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fonts = new URL("../../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).pathname;
  const doc = await pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: fonts }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) out.push((await (await doc.getPage(i)).getTextContent()).items.map((x) => ("str" in x ? x.str : "")).join(" "));
  return out;
}

describe("file Packing list riêng cho mục Packing List", () => {
  it("chỉ phiếu Packing list, tên file theo số invoice, gross theo SI", async () => {
    const doc = buildInvoiceDocument({
      invoiceNo: "275/26", issuedOn: "2026-11-02", customer: { name: "KAISEI", address: "" },
      shipment: { loadingDate: "", etd: "", vesselVoyage: "", containerNo: "", sealNo: "" },
      blNo: "", portOfLoading: "", portOfDischarge: "", currency: "USD", tradeTerms: "", originNote: "",
      lines: [line({})], unitPrice: () => 6.45, bankLines: [], specialNotes: "", siGrossKg: () => 7300,
    });
    const f = await packingListPdfFile(doc, "275/26");
    expect(f.name).toBe("PACKING LIST 275.26.pdf");
    const pages = await pageTexts(new Uint8Array(await f.arrayBuffer()));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatch(/PACKING LIST/);
    expect(pages[0]).not.toMatch(/COMMERCIAL INVOICE/);
    expect(pages[0]).toMatch(/7,300/);
  });
});

describe("Số B/L trên invoice tự gõ (Phòng KH 2026-11-04)", () => {
  const base = async () => {
    const { EMPTY_EXPORT_DATA, blankItem } = await import("@/lib/exportPlanning");
    const { invoiceDocumentFor } = await import("./invoiceDocument");
    const shipment = { id: "s", contractId: "c", portOfDischarge: "", loadingDate: "", etd: "", vesselVoyage: "", containerNo: "", sealNo: "" } as unknown as import("@/types").ExportShipment;
    const contract = { id: "c", contractNo: "04-26-KMP", customerId: "k" } as unknown as import("@/types").ExportContract;
    const bl = { ...blankItem("s", "document", "bl", "2026-11-04"), docKind: "bill-of-lading" as const, number: "ONEYSGN111" };
    const ci = (blNo: string) => ({ ...blankItem("s", "document", "ci", "2026-11-04"), docKind: "commercial-invoice" as const, number: "275/26", invoiceComposition: { bankOptionId: "", unitPrices: {}, tradeTerms: "", originNote: "", specialNotes: "", blNo } });
    const blCell = (blNo: string) => {
      const d = { ...EMPTY_EXPORT_DATA, contracts: [contract], shipments: [shipment], items: [bl, ci(blNo)], shipmentLines: [] };
      const doc = invoiceDocumentFor(d, shipment, contract, undefined, ci(blNo), []);
      return doc.sheets[0].rows.flatMap((r) => r.cells).find((c) => typeof c === "string" && /ONEY/.test(c));
    };
    return blCell;
  };
  it("gõ số ⇒ in số đó; trống ⇒ số ở mục Bill of Lading", async () => {
    const blCell = await base();
    expect(blCell("ONEYSGN999")).toContain("ONEYSGN999");
    expect(blCell("")).toContain("ONEYSGN111");
  });
});

describe("Bên mua trên invoice / packing list sửa tay được (Phòng KH 2026-11-05)", () => {
  it("trống ⇒ khách hàng của HĐ; gõ ⇒ in tên + địa chỉ đã gõ ở cả Invoice lẫn Packing list", async () => {
    const { EMPTY_EXPORT_DATA, blankItem } = await import("@/lib/exportPlanning");
    const { invoiceDocumentFor } = await import("./invoiceDocument");
    const shipment = { id: "s", contractId: "c", portOfDischarge: "", loadingDate: "", etd: "", vesselVoyage: "", containerNo: "", sealNo: "" } as unknown as import("@/types").ExportShipment;
    const contract = { id: "c", contractNo: "23.26/BSF-SCM.2026", customerId: "k" } as unknown as import("@/types").ExportContract;
    const customer = { id: "k", name: "SEACHEMOT CO., LTD", address: "Tokyo, Japan" } as unknown as import("@/types").Customer;
    const ci = (buyer: { buyerName?: string; buyerAddress?: string }) => ({
      ...blankItem("s", "document", "ci", "2026-11-05"),
      docKind: "commercial-invoice" as const,
      invoiceComposition: { bankOptionId: "", unitPrices: {}, tradeTerms: "", originNote: "", specialNotes: "", ...buyer },
    });
    const text = (item: ReturnType<typeof ci>, sheet: number) => {
      const d = { ...EMPTY_EXPORT_DATA, contracts: [contract], shipments: [shipment], items: [item], shipmentLines: [] };
      return invoiceDocumentFor(d, shipment, contract, customer, item, []).sheets[sheet].rows.flatMap((r) => r.cells).filter((c) => typeof c === "string").join(" | ");
    };
    expect(text(ci({}), 0)).toContain("Applicant: SEACHEMOT CO., LTD");
    expect(text(ci({}), 0)).toContain("Tokyo, Japan");
    const edited = ci({ buyerName: "SEACHEMOT OSAKA BRANCH", buyerAddress: "1-2-3 Umeda\nOsaka" });
    for (const sheet of [0, 1]) {
      expect(text(edited, sheet)).toContain("Applicant: SEACHEMOT OSAKA BRANCH");
      expect(text(edited, sheet)).toContain("Osaka");
      expect(text(edited, sheet)).not.toContain("Tokyo, Japan");
    }
  });
});
