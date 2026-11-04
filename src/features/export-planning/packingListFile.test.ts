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
