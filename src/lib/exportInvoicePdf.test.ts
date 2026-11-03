import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { ExportShipmentLine } from "@/types";
import { buildInvoiceDocument, type InvoiceDocInput } from "./exportInvoice";
import { invoicePdfBytes, invoicePdfFileName, pdfNumber, pdfSafeText } from "./exportInvoicePdf";

const line = (over: Partial<ExportShipmentLine>): ExportShipmentLine => ({
  id: "l", shipmentId: "s", contractId: "c", sortOrder: 0, contractLineId: "", productId: "", description: "FROZEN CRAB KARAAGE",
  size: "", packing: "500gr/box x 20/CTN", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, grossKgPerUnit: 11,
  plannedUnits: null, loadedUnits: null, loadedBy: "", loadedAt: "", expiry: "", note: "", ...over,
});
const input = (over: Partial<InvoiceDocInput> = {}): InvoiceDocInput => ({
  invoiceNo: "275/26", issuedOn: "2026-11-02",
  customer: { name: "KAISEI MARINE PRODUCTS INC.", address: "NO. 2-3, 1-CHOME HIGASHIYAMATO-MACHI, SHIMONOSEKI CITY, YAMAGUCHI PREFECTURE 750-0066, JAPAN" },
  shipment: { loadingDate: "2026-11-03", etd: "2026-11-05", vesselVoyage: "BANGKOK BRIDGE V.0518E", containerNo: "", sealNo: "" },
  blNo: "ONEYSGNGCM332800", portOfLoading: "Cai Mep Port, Vietnam", portOfDischarge: "Tokyo, Japan", currency: "USD",
  tradeTerms: "CFR TOKYO, JAPAN", originNote: "",
  lines: [line({ id: "a", size: "Size: 2 - 4 gr/pc", loadedUnits: 657 }), line({ id: "b", size: "Size: 4 - 8 gr/pc", loadedUnits: 1 })],
  unitPrice: (l) => ({ a: 6.45, b: 6.55 })[l.id] ?? null,
  bankLines: ["Bank name: VIETNAM JOINT STOCK COMMERCIAL BANK FOR INDUSTRY AND TRADE, BRVT BRANCH", "Account number: 110000206680"],
  specialNotes: "",
  ...over,
});

/** Chữ từng trang của PDF (pdf.js bản cho Node). */
async function pageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const fonts = new URL("../../node_modules/pdfjs-dist/standard_fonts/", import.meta.url).pathname;
  const doc = await pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: fonts }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((x) => ("str" in x ? x.str : "")).join(" "));
  }
  return out;
}

describe("exportInvoicePdf — bản PDF theo mẫu INVOICE 275/26", () => {
  it("số kiểu tiếng Anh theo định dạng cột; chữ có dấu bỏ dấu (font chuẩn PDF)", () => {
    expect(pdfNumber(6570, "#,##0.00")).toBe("6,570.00");
    expect(pdfNumber(657, "#,##0")).toBe("657");
    expect(pdfNumber(6.45, "#,##0.00####")).toBe("6.45");
    expect(pdfNumber(5.200975, "#,##0.00####")).toBe("5.200975");
    expect(pdfSafeText("Cá đuối khô – Bà Rịa")).toBe("Ca duoi kho - Ba Ria");
  });

  it("275/26: 2 trang (Invoice, Packing list), mỗi chứng từ một trang, đủ số và chữ của mẫu", async () => {
    const doc = buildInvoiceDocument(input());
    const pages = await pageTexts(await invoicePdfBytes(doc, readFileSync("public/invoice-logo.jpg")));
    expect(pages).toHaveLength(2);
    expect(invoicePdfFileName(doc)).toBe("INVOICE 275.26.pdf");
    for (const t of ["COMMERCIAL INVOICE", "275/26", "Applicant: KAISEI MARINE PRODUCTS INC.", "6,570.00", "42,376.50", "42,442.00", "658", "Please make TT to:", "Account number: 110000206680"])
      expect(pages[0]).toContain(t);
    expect(pages[0]).toContain("United States Dollars Forty two thousand four hundred forty two only.");
    expect(pages[1]).toContain("PACKING LIST");
    expect(pages[1]).toContain("7,238.00");
  });

  it("15 size (5 mặt hàng × 3 size, chung quy cách) vẫn gọn MỘT trang mỗi chứng từ nhờ thu nhỏ; có hạn dùng ⇒ thêm trang Expiry", async () => {
    const lines = Array.from({ length: 15 }, (_, i) => line({ id: `x${i}`, description: `ITEM ${Math.floor(i / 3)}`, size: `Size ${i}`, packing: `P${Math.floor(i / 3)}`, loadedUnits: 10, expiry: "2028.01" }));
    const doc = buildInvoiceDocument(input({ lines, unitPrice: () => 5, specialNotes: "*NOTE:\nItems\tOrigin\nSaury\tJapan" }));
    const pages = await pageTexts(await invoicePdfBytes(doc, null));
    expect(pages).toHaveLength(3);
    expect(pages[0]).toContain("7,500.00"); // 15 dòng × 10 thùng × 10 kg × 5 USD
    expect(pages[2]).toContain("EXPIRY DATE LIST");
  });

  it("quá nhiều dòng (60 size) ⇒ chứng từ sang trang, không mất dòng nào", async () => {
    const lines = Array.from({ length: 60 }, (_, i) => line({ id: `y${i}`, description: `ITEM ${i}`, size: `Size ${i}`, packing: `P${i}`, loadedUnits: 1 }));
    const doc = buildInvoiceDocument(input({ lines, unitPrice: () => 5 }));
    const all = (await pageTexts(await invoicePdfBytes(doc, null))).join(" ");
    expect(all).toContain("ITEM 59");
    expect(all).toContain("3,000.00"); // 60 × 1 × 10 kg × 5 USD
  });
});
