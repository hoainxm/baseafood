import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import PizZip from "pizzip";
import type { ExportShipmentLine } from "@/types";
import { buildInvoiceDocument } from "./exportInvoice";
import { invoiceDocxBytes, invoiceDocxFileName, jpegSize } from "./exportInvoiceDocx";

const line = (over: Partial<ExportShipmentLine>): ExportShipmentLine => ({
  id: "l", shipmentId: "s", contractId: "c", sortOrder: 0, contractLineId: "", productId: "", description: "FROZEN CRAB KARAAGE",
  size: "", packing: "500gr/box x 20/CTN", unitKind: "carton", cartonsPerUnit: 1, netKgPerCarton: 10, grossKgPerUnit: 11,
  plannedUnits: null, loadedUnits: null, loadedBy: "", loadedAt: "", expiry: "", note: "", ...over,
});
const doc = (expiry = "") =>
  buildInvoiceDocument({
    invoiceNo: "275/26", issuedOn: "2026-11-02",
    customer: { name: "KAISEI MARINE PRODUCTS INC.", address: "750-0066, JAPAN" },
    shipment: { loadingDate: "2026-11-03", etd: "2026-11-05", vesselVoyage: "BANGKOK BRIDGE V.0518E", containerNo: "SZLU2030326", sealNo: "VN48840AW" },
    blNo: "ONEYSGNGCM332800", portOfLoading: "Cai Mep Port, Vietnam", portOfDischarge: "Tokyo, Japan", currency: "USD",
    tradeTerms: "CFR TOKYO, JAPAN", originNote: "",
    lines: [line({ id: "a", size: "Size: 2 - 4 gr/pc", loadedUnits: 657, expiry }), line({ id: "b", size: "Size: 4 - 8 gr/pc", loadedUnits: 1, expiry })],
    unitPrice: (l) => ({ a: 6.45, b: 6.55 })[l.id] ?? null,
    bankLines: ["Bank name: VIETNAM JOINT STOCK COMMERCIAL BANK FOR INDUSTRY AND TRADE, BRVT BRANCH", "Account number: 110000206680"],
    specialNotes: "*NOTE:\nItems\tOrigin of Raw Material\nGhẹ\tViệt Nam",
  });
const text = (xml: string) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(" ");

describe("exportInvoiceDocx — bản Word theo bố cục PDF mẫu 275/26", () => {
  it("file .docx mở được: đủ phần bắt buộc, logo nhúng, tên file theo số invoice", () => {
    const zip = new PizZip(invoiceDocxBytes(doc(), readFileSync("public/invoice-logo.jpg")));
    for (const part of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/_rels/document.xml.rels", "word/media/logo.jpg"]) expect(zip.file(part)).not.toBeNull();
    expect(invoiceDocxFileName(doc())).toBe("INVOICE 275.26.docx");
    expect(jpegSize(new Uint8Array(readFileSync("public/invoice-logo.jpg")))).toEqual({ w: 480, h: 281 });
  });

  it("đủ chữ + số của mẫu, giữ dấu tiếng Việt (khác PDF font chuẩn), mỗi chứng từ một trang", () => {
    const xml = new PizZip(invoiceDocxBytes(doc("2028.05"), null)).file("word/document.xml")!.asText();
    const t = text(xml);
    for (const s of ["COMMERCIAL INVOICE", "275/26", "Applicant: KAISEI MARINE PRODUCTS INC.", "6,570.00", "42,376.50", "42,442.00", "PACKING LIST", "7,238.00", "EXPIRY DATE LIST", "Please make TT to:", "Việt Nam"])
      expect(t).toContain(s);
    expect(t).toContain("United States Dollars Forty two thousand four hundred forty two only.");
    // 3 chứng từ ⇒ 2 lần ngắt trang; không logo ⇒ không có ảnh.
    expect(xml.match(/<w:br w:type="page"\/>/g)).toHaveLength(2);
    expect(xml).not.toContain("<w:drawing>");
  });
});
