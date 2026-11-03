// ba-spec 66 — AC = test. Oracle: chữ của "ANNEX 2 OF CONTRACT 01 HĐ 02.docx" (phụ lục HĐ 01-26-HAT,
// HYAKUSAIBOU) chép từng ô như rowsFromDocxXml dựng ra. HĐ nhập: fixture dựng tay (66 A1).
import { describe, expect, it } from "vitest";
import {
  applyExportConflicts,
  contractFileProblem,
  fillExportContract,
  fillImportContract,
  matchParty,
  packingNetKg,
  parseContractRows,
  rowsFromPdfItems,
  parseShipmentDeadline,
  type ExportContractFillValues,
  type ExportFillContext,
  type ReadContract,
} from "./contractReader";
import { EMBED_MARKER, rowsFromDocxXml, rowsFromWordBlocks } from "./contractFileReader";
import { wordTextToBlocks } from "./legacyWordText";
import type { PdfTextItem } from "./invoiceReader";
import { emptyTerms } from "./exportPlanning";
import { EXPORT_OPTION_SEED } from "./exportOptions";
import type { ExportContractLine } from "@/types";

const ANNEX2: string[][] = [
  ["ANNEX OF CONTRACT 01-26-HAT DATED April 20, 2026"],
  ["No: 01 dated October 10, 2026"],
  ["THE SELLER: BASEAFOOD 1 CO., LTD"],
  ["Add: 321 Tran Xuan Do St., Quarter 2, Ba Ria Ward, Ho Chi Minh City, S.R.Vietnam"],
  ["THE BUYER: HYAKUSAIBOU CO.,LTD"],
  ["ADD: 736 YAMAKAWA-CHO ONO MIYAMA, FUKUOKA PREFECTURE, JAPAN 835-0102"],
  ["This annex No.1 is made for the purpose “Adjusting assortment for all 6 containers and extend the time of shipment” as below:"],
  ["Ratio tentacle and body", "Size", "Assortment (%)", "Number pcs/kg", "Average gr/pc", "Dao động gr/pc", "Length max cm/pc", "Packing", "Price (usd/kg) CNF Hakata, JP", "Quantity (kgs)", "Amount (USD)"],
  ["100% tentacle", "1.5 gr cut", "22%", "590 – 770", "1.0 – 2.0", "1.0 – 2.0: min 90% (< 1 gr/pc: max 5% and >2 gr/pc: max 5%", "1.5 – 3.0", "IQF, 1kg/PE x 12/ctn", "11.60", "38,880.00", "451,008.00"],
  ["", "2 gr cut", "38%", "435 - 590", "1.7 – 2.3", "1.5 – 2.5", "1.5 – 3.0", "IQF, 1kg/PE x 12/ctn", "11.80", "51,840.00", "617,712.00"],
  ["80% tentacle 20% body", "3 gr cut", "38%", "330 – 370", "2.7 – 3.3", "2.0 – 4.0", "1.5 - 3.5", "IQF, 1kg/PE x 12/ctn", "11.95", "38,880.00", "464,616.00"],
  ["Total", "", "", "", "", "", "", "", "", "129,600.00", "1,533,336.00"],
  ["(10% more or less in quantity and amount are allowed)"],
  ["Time of shipment: from November, 2026 to April, 2027"],
  ["Two parties agree to adjust informations as above."],
  ["All other terms and conditions of the Original Contract remain unchanged."],
  ["FOR THE SELLER FOR THE BUYER"],
];

const IMPORT_FIXTURE: string[][] = [
  ["SALES CONTRACT"],
  ["Contract No: OPS-2026/118 Date: 15/09/2026"],
  ["THE SELLER: OCEAN PRIDE SEAFOOD LTD"],
  ["THE BUYER: BASEAFOOD 1 CO., LTD"],
  ["No.", "Commodity", "Quantity (kgs)", "Unit price (USD/kg)", "Amount (USD)"],
  ["1", "Frozen octopus whole", "20,000", "3.10", "62,000.00"],
  ["2", "Frozen squid", "10,000", "", ""],
  ["Total", "", "30,000", "", "62,000.00"],
  ["Payment: T/T 30% deposit, balance against copy of B/L"],
];

// HĐ xuất gốc Baseafood (13-MAT-26, 17-26-NEWPOINT): chép từ bản scan đã ký theo đúng cách rowsFromDocxXml
// tách bản Word (tiêu đề bảng 2 tầng, "THESELLER" viết liền, mục "II. SHIPMENT:"). Thay bằng file Word khi có.
const MAT13: string[][] = [
  ["SALES CONTRACT"],
  ["No: 13-MAT-26"],
  ["Date: October 16, 2026"],
  ["THESELLER: BASEAFOOD 1 CO.,LTD"],
  ["Add:321 Tran Xuan Do St., Quarter 2, Ba Ria ward, Ho Chi Minh City, S.R Viet Nam"],
  ["THE BUYER: MATSUDA SANGYO CO.,LTD."],
  ["Two parties have mutually agreed to sign this sale contract on the following items and conditions:"],
  ["I.", "COMMODITY, QUANTITY, PRICE:"],
  ["Mark", "Commodities", "Packing", "Price CNF main port", "Quantity", "", "Amount (usd)"],
  ["", "", "", "", "Ctns", "Kgs", ""],
  ["1", "Frozen iidako raw cut, size 1.3 – 1.8 cm, standard grade (including paper skin)", "2kg/Block x 6/PE/CTN", "8.70", "2,200", "26,400.00", "229,680.00"],
  ["", "TOTAL", "", "", "2,200", "26,400.00", "229,680.00"],
  ["(10% more or less in quantity and amount are allowed )"],
  ["Hygiene and chemical standards: Meet Japanese standards (TPC: Under 100.000 CFU/gr for standard grade; Coliform < 100 Group (C.G)/ E.coli/ Salmonella/ Staphylococcus Aureus/ Vibrio: Negative)."],
  ["II. SHIPMENT: 2 container 20 feet to Yokohama, Japan within January and March, 2027"],
  ["III. PAYMENT: By TTR 100% value of the invoice after receiving shipping documents by mail."],
  ["IV: DOCUMENTS: Invoice, Packing list, Health certificate issued by Baseafood 1, BL , CO form VJ."],
  ["V. OTHERS: two parties commit themselves to fully implement all obligation stipulated in the contract. This contract is made in English with equal value by fax/email and binding on from date of signing to May 31, 2027."],
];

const NEWPOINT17: string[][] = [
  ["SALES CONTRACT"],
  ["No: 17-26-NEWPOINT"],
  ["Date: November 03, 2026"],
  ["THE SELLER: BASEAFOOD 1 CO.,LTD"],
  ["ADD: 321 Tran Xuan Do St., Quarter 2, Ba Ria Ward, Ho Chi Minh City, S.R.Vietnam"],
  ["THE BUYER: NEW POINT CO., LTD"],
  ["TWO PARTIES HAVE MUTUALLY AGREED TO SIGN THIS SALE CONTRACT ON THE FOLLOWING ITEM AND CONDITIONS:"],
  ["I.COMMODITY, QUANTITY, PRICE:"],
  ["Item", "Product", "Packing", "Unit price", "Quantity (CTN)", "Quantity (kgs)", "Amount (USD)"],
  ["", "", "", "(usd/kg CFR)", "", "", ""],
  ["1", "Dried seasoned Eihire A, old recipe", "10 kgs / ctn", "14.0", "50", "500.00", "7,000.00"],
  ["2", "Dried seasoned Octopus", "10 kgs / ctn", "18.0", "100", "1,000.00", "18,000.00"],
  ["3", "Dried baby crab", "5 kgs / ctn", "8.7", "350", "1,750.00", "15,225.00"],
  ["4", "Noshiika - Moisute: 30% +/-2% - Length: >=20cm", "10 kgs / ctn", "19.80", "200", "2,000.00", "39,600.00"],
  ["", "Total", "", "", "700", "5,250.00", "79,825.00"],
  ["More or less 10% in quantity and amount should be acceptable"],
  ["II. SHIPMENT: 1 container 20 feet will be shipped before 10 November, 2026"],
  ["Patial shipment: ALLOWED"],
  ["III. PAYMENT: BY LC AT SIGHT (apply +/- 10% in amount and quantity in LC)"],
  ["IV: DOCUMENTS REQUIRED:"],
  ["COMMERCIAL INVOICE, PACKING LIST, BILL OF LADING, CERTIFICATE OF ORIGIN FORM VJ"],
  ["V. OTHERS:"],
  ["TWO PARTIES COMMIT THEMSELVES TO FULLY IMPLEMENT ALL OBLIGATION STIPULATED IN THE CONTRACT. THIS CONTRACT IS MADE IN ENGLISH WITH EQUAL VALUE BY FAX/EMAIL AND BINDING ON FROM DATE OF SIGNING TO LATEST DECEMBER 31, 2026."],
];

// HĐ nhập thật (PDF có chữ): đúng các dòng pdf.js + rowsFromTextItems ra từ "CONTRACT MSA (2) Signed.pdf"
// và "CONTRACT-4-signed.pdf" (bỏ phần tài khoản ngân hàng). Dòng hàng ghi dạng "nhãn : giá trị".
const MSA: string[][] = [
  ["BA RIA-VUNG TAU SEAFOOD PROCESSING AND IMPORT-EXPORT JOIN STOCK COMPANY"],
  ["BASEAFOOD 1 COMPANY LIMITED"],
  ["SALES CONTRACT"],
  ["No", ": 001N.26-MSA"],
  ["Date: September 24, 2026"],
  ["According to the needs and agreement between two sides."],
  ["Today, October 05, 2026 we include:"],
  ["THE SELLER (Party A): MSA SEA FOODS"],
  ["Add: 61/30, ROYES TOWER, KASI GARDEN 2ND STREET, KASIMEDU, ROYAPURAM, CHENNAI - 600 013, INDIA"],
  ["THE BUYER (PartyB):", "BASEAFOOD 1 COMPANY LIMITED"],
  ["After disscusion, two parties have mutualy agreed to sign the sales contract on the following terms and conditions:"],
  ["I/. ARTICLE I - COMMODITY: Party A agree to sell the following products to Party B:"],
  ["1/. Commodity", ":", "FROZEN OCTOPUS WHOLE ROUND SHORT ARM"],
  ["Size", ":", "100/200", "200/300", "300/500"],
  ["Quantity", ":", "18,000.00", "5,000", "1,000", "(KGS)"],
  ["Unit Price", ":", "4.00", "(USD/KG CFR CAT LAI PORT, HO CHI MINH CITY, VIETNAM)"],
  ["Packing", ":", "4Kgs Net WT Blocks x 5 per Carton."],
  ["Total", ":", "96,000.00 USD"],
  ["Total:", "USD 96,000.00 (24,000.00 KGS / 1,200 Ctns) (+/-10% in Amount & Quantity Allowed)"],
  ["II/.ARTICLE II - SHIPMENT:"],
  ["-", "Time of shipment", ": ON OR BEFORE 25 OCTOBER, 2026 (accept date of shipment before issue date of LC)"],
  ["-", "Port of Loading", ": Any Port in India"],
  ["-", "Port of Destination : CAT LAI PORT, HO CHI MINH CITY, VIETNAM"],
  ["III/.ARTICLE III - PAYMENT: PAYMENT: Payment by LC at sight"],
  ["IV/.ARTICLE IV - OTHERS: Two parties commit themselves to fully implement all obligation stipulated in the contract."],
  ["This contract is made in English , has value by fax or email and binding on from the date of signing to late December 31, 2026"],
  ["FOR THE SELLER", "FOR THE BUYER"],
];

const KOR: string[][] = [
  ["SALES CONTRACT"],
  ["No", ": 001N.26-KOR"],
  ["Date: September 24, 2026"],
  ["THE SELLER (Party A):", "KORNISH MARINE FOODS"],
  ["RD"],
  ["60/44, 3", "FLOOR, JS CHAMBER, PANAMPILLY NAGAR, AVENUE, OPP. KAIRALI FLAT,"],
  ["THE BUYER (PartyB):", "BASEAFOOD 1 COMPANY LIMITED"],
  ["I/. ARTICLE I - COMMODITY: Party A agree to sell the following products to Party B:"],
  ["1/. Commodity", ":", "FROZEN OCTOPUS WHOLE ROUND SHORT ARM"],
  ["Size", ":", "100/200"],
  ["Quantity", ":", "25,000.00", "(KGS)"],
  ["Unit Price", ":", "4.00", "(USD/KG CFR CAT LAI PORT, HO CHI MINH CITY, VIETNAM)"],
  ["Packing", ":", "4Kgs Net WT Blocks x 5 per Carton."],
  ["Total", ":", "100,000.00 USD"],
  ["Total:", "USD 100,000.00 (25,000.00 KGS / 1,250 Ctns) (+/-10% in Amount & Quantity Allowed)"],
  ["II/.ARTICLE II - SHIPMENT:"],
  ["-", "Time of shipment", ": ON OR BEFORE 05 OCTOBER, 2026 (accept date of shipment before issue date of LC)"],
  ["III/.ARTICLE III - PAYMENT: PAYMENT: Payment by LC at sight"],
];

// Tọa độ thật (pdf.js) phần bảng của "13-MAT-26.pdf" — PDF xuất từ Word, ô nhiều dòng bị tách thành dòng rời.
const MAT13_PDF_ITEMS: PdfTextItem[] = [
  { str: "I.", x: 83.2, y: 507.5, width: 6.3, height: 9.9 },
  { str: "COMMODITY, QUANTITY, PRICE:", x: 117, y: 507.5, width: 162.9, height: 9.9 },
  { str: "Mark", x: 67.2, y: 484.4, width: 21.4, height: 9.9 },
  { str: "Commodities", x: 140.1, y: 484.4, width: 53.2, height: 9.9 },
  { str: "Packing", x: 253.5, y: 484.4, width: 32, height: 9.9 },
  { str: "Price", x: 322.8, y: 495.7, width: 20.3, height: 9.9 },
  { str: "CNF main", x: 312.2, y: 484.4, width: 41.3, height: 9.9 },
  { str: "port", x: 325.1, y: 473, width: 16, height: 9.9 },
  { str: "Quantity", x: 403.6, y: 495.7, width: 34.7, height: 9.9 },
  { str: "Amount", x: 494, y: 490.1, width: 32.5, height: 9.9 },
  { str: "(usd)", x: 500, y: 478.7, width: 20.4, height: 9.9 },
  { str: "Ctns", x: 381.4, y: 478.4, width: 18.1, height: 9.9 },
  { str: "Kgs", x: 436.5, y: 478.4, width: 15.9, height: 9.9 },
  { str: "1", x: 75.5, y: 449.9, width: 5, height: 9.9 },
  { str: "Frozen iidako raw cut,", x: 122.5, y: 461.2, width: 88.8, height: 9.9 },
  { str: "size 1.3 – 1.8 cm", x: 103, y: 449.9, width: 67.5, height: 9.9 },
  { str: ", standard grade", x: 170.5, y: 449.9, width: 62.7, height: 9.9 },
  { str: "(including paper skin)", x: 123.1, y: 438.5, width: 87.4, height: 9.9 },
  { str: "2kg/Block x", x: 245.2, y: 455.5, width: 48.5, height: 9.9 },
  { str: "6/PE/CTN", x: 248.6, y: 444.1, width: 41.7, height: 9.9 },
  { str: "8.70", x: 324.4, y: 449.9, width: 17.4, height: 9.9 },
  { str: "2,200", x: 379.2, y: 449.9, width: 22.3, height: 9.9 },
  { str: "26,400.00", x: 424.7, y: 449.9, width: 39.6, height: 9.9 },
  { str: "229,680.00", x: 487.8, y: 449.9, width: 44.6, height: 9.9 },
  { str: "TOTAL", x: 149.5, y: 426.6, width: 34.7, height: 9.9 },
  { str: "2,200", x: 379.2, y: 426.6, width: 22.4, height: 9.9 },
  { str: "26,400.00", x: 424.8, y: 426.6, width: 39.6, height: 9.9 },
  { str: "229,680.00", x: 487.9, y: 426.6, width: 44.6, height: 9.9 },
  { str: "(10% more or less in quantity and amount are allowed )", x: 194.7, y: 414.8, width: 219.8, height: 9.9 },
];

const read = (rows: string[][], role: "export" | "import" = "export"): ReadContract => {
  const r = parseContractRows(rows, role);
  if (!r.ok) throw new Error(r.message);
  return r.contract;
};

const TODAY = "2026-11-03";
const customers = [
  { id: "c1", code: "HAT", name: "Hyakusaibou Co., Ltd" },
  { id: "c2", code: "", name: "Seachemot" },
];

let seq = 0;
const ctx = (over: Partial<ExportFillContext> = {}): ExportFillContext => ({
  mode: "create",
  baseline: { signedOn: TODAY, revisedOn: TODAY, paymentMethod: "ttr", currency: "USD" },
  customers,
  options: EXPORT_OPTION_SEED,
  canSeePrice: true,
  newLineId: () => `n${++seq}`,
  ...over,
});

const blankLine = (over: Partial<ExportContractLine> = {}): ExportContractLine => ({
  id: "b1",
  description: "",
  hsCode: "",
  size: "",
  packing: "",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: null,
  quantity: null,
  kg: null,
  unitPrice: null,
  microSpec: "",
  ...over,
});

const createForm = (): ExportContractFillValues => ({
  customerId: "",
  contractNo: "",
  signedOn: TODAY,
  orderRef: "",
  revisedOn: TODAY,
  changeSummary: "",
  terms: emptyTerms(),
  lines: [blankLine()],
});

describe("ba-spec 66 — đọc file hợp đồng", () => {
  it("AC-1 đầu phụ lục ANNEX 2: số HĐ, ngày ký gốc, ngày phụ lục, khách", () => {
    const c = read(ANNEX2);
    expect(c.isAnnex).toBe(true);
    expect(c.contractNo).toBe("01-26-HAT");
    expect(c.signedOn).toBe("2026-04-20");
    expect(c.annexNo).toBe("01");
    expect(c.annexDate).toBe("2026-10-10");
    expect(c.partnerName).toBe("HYAKUSAIBOU CO.,LTD");
    expect(c.partnerSide).toBe("buyer");
    expect(c.changeSummary).toBe("Adjusting assortment for all 6 containers and extend the time of shipment");
  });

  it("AC-2 bảng dòng hàng ANNEX 2: 3 dòng, ô gộp lấy dòng trên, bắt dòng 2 ghi tiền sai", () => {
    const c = read(ANNEX2);
    expect(c.lines).toHaveLength(3);
    expect(c.lines.map((l) => l.size)).toEqual(["1.5 gr cut", "2 gr cut", "3 gr cut"]);
    expect(c.lines.map((l) => l.kg)).toEqual([38880, 51840, 38880]);
    expect(c.lines.map((l) => l.unitPrice)).toEqual([11.6, 11.8, 11.95]);
    expect(c.lines.every((l) => l.netKgPerCarton === 12)).toBe(true);
    expect(c.lines.map((l) => l.cartons)).toEqual([3240, 4320, 3240]);
    expect(c.lines[1].partRatio).toBe("100% tentacle");
    expect(c.lines[2].partRatio).toBe("80% tentacle 20% body");
    expect(c.lines[0].piecesPerKg).toBe("590 – 770");
    expect(c.lines[0].pieceLength).toBe("1.5 – 3.0");
    expect(c.lines[0].note).toContain("Assortment (%): 22%");
    expect(c.lines.reduce((s, l) => s + (l.kg ?? 0), 0)).toBe(129600);
    expect(c.totalKg).toBe(129600);
    expect(c.totalAmount).toBe(1533336);
    expect(c.lineIssues).toEqual([{ lineIndex: 1, expected: 611712, actual: 617712, diff: 6000 }]);
    expect(c.priceWarnings).toHaveLength(1);
  });

  it("AC-3 điều khoản ANNEX 2: CNF ⇒ CFR, Hakata, USD, 10%, hạn giao suy ra 30/04/2027, 6 cont", () => {
    const c = read(ANNEX2);
    expect(c.incoterm).toBe("CFR");
    expect(c.incotermRaw).toBe("CNF");
    expect(c.portOfDischarge).toBe("Hakata");
    expect(c.currency).toBe("USD");
    expect(c.tolerancePct).toBe(10);
    expect(c.latestShipmentDate).toBe("2027-04-30");
    expect(c.latestShipmentInferred).toBe(true);
    expect(c.containerCount).toBe(6);
    expect(c.warnings.some((w) => w.includes("suy ra từ tháng"))).toBe(true);
  });

  it("AC-4 chỉ điền ô trống, ô khác file liệt kê; ≥ 15 ô", () => {
    const form = createForm();
    form.terms.tolerancePct = 5;
    const f = fillExportContract(form, read(ANNEX2), ctx());
    expect(f.values.terms.tolerancePct).toBe(5);
    expect(f.conflicts).toHaveLength(1);
    expect(f.conflicts[0]).toMatchObject({ path: "terms.tolerancePct", label: "Dung sai ±", value: 10 });
    expect(f.filledCells).toBeGreaterThanOrEqual(15);
    expect(f.values.customerId).toBe("c1");
    expect(f.values.contractNo).toBe("01-26-HAT");
    expect(f.values.signedOn).toBe("2026-04-20");
    expect(f.values.terms.portOfDischarge).toBe("Hakata, Japan");
    expect(f.values.terms.incoterm).toBe("CFR");
    expect(f.values.terms.latestShipmentDate).toBe("2027-04-30");
    expect(f.values.terms.containerCount).toBe(6);
    expect(f.values.lines).toHaveLength(3);
    expect(f.values.lines.map((l) => [l.quantity, l.kg, l.netKgPerCarton])).toEqual([
      [3240, null, 12],
      [4320, null, 12],
      [3240, null, 12],
    ]);
  });

  it("AC-5 dùng giá trị trên file theo lựa chọn", () => {
    const form = createForm();
    form.terms.tolerancePct = 5;
    const f = fillExportContract(form, read(ANNEX2), ctx());
    const v = applyExportConflicts(f.values, f.conflicts);
    expect(v.terms.tolerancePct).toBe(10);
    expect(fillExportContract(v, read(ANNEX2), ctx()).conflicts).toHaveLength(0);
  });

  it("AC-6 phụ lục của HĐ khác thì không điền gì", () => {
    const form = { ...createForm(), contractNo: "02-26-XYZ", customerId: "c2", lines: [blankLine({ size: "2 gr cut", quantity: 10 })] };
    const f = fillExportContract(form, read(ANNEX2), ctx({ mode: "revise" }));
    expect(f.filledCells).toBe(0);
    expect(f.values).toEqual(form);
    expect(f.blocked).toContain("01-26-HAT");
    expect(f.blocked).toContain("02-26-XYZ");
    expect(fillExportContract(form, read(ANNEX2), ctx({ mode: "revise", force: true })).blocked).toBe("");
  });

  it("AC-7 bản sửa nối dòng theo size, không tự xóa, giữ mặt hàng đã nối", () => {
    const lines = ["1.5 gr cut", "2 gr cut", "3 gr cut", "4 gr cut"].map((size, i) =>
      blankLine({ id: `l${i}`, size, description: "Frozen octopus cut", quantity: 1000, netKgPerCarton: 12, unitPrice: 11, ...(i === 0 ? { productId: "P1", partRatio: "100% tentacle" } : {}) }),
    );
    const form = { ...createForm(), contractNo: "01-26-HAT", customerId: "c1", signedOn: "2026-04-20", lines };
    const f = fillExportContract(form, read(ANNEX2), ctx({ mode: "revise" }));
    expect(f.values.lines).toHaveLength(4);
    expect(f.lines).toEqual({ matched: 3, added: 0, notOnFile: ["Frozen octopus cut · 4 gr cut"] });
    expect(f.values.lines[0].productId).toBe("P1");
    expect(f.values.lines[0].quantity).toBe(1000);
    expect(f.conflicts.some((c) => c.path === "line:l0:quantity" && c.value === 3240)).toBe(true);
    expect(f.values.revisedOn).toBe("2026-10-10");
    expect(f.values.changeSummary).toContain("Adjusting assortment");
    expect(f.values.customerId).toBe("c1");
  });

  it("AC-8 file không đọc được trả đúng lý do (.doc đọc được từ 2026-11-03)", () => {
    expect(contractFileProblem("HD cu.doc")).toBeNull();
    expect(contractFileProblem("scan.jpg")).toBe("unsupported");
    expect(contractFileProblem("HD.xlsx")).toBe("unsupported");
    expect(contractFileProblem("HD.docx")).toBeNull();
    expect(contractFileProblem("HD.PDF")).toBeNull();
    const r = parseContractRows([["Lorem ipsum"]], "export");
    expect(r.ok).toBe(false);
  });

  it("AC-9 gợi ý đối tác chỉ khi ra đúng một", () => {
    const name = "HYAKUSAIBOU CO.,LTD";
    const names = (c: { name: string }) => [c.name];
    expect(matchParty(name, [{ id: "a", name: "Hyakusaibou Co., Ltd" }], names).match?.id).toBe("a");
    const none = matchParty(name, [{ id: "a", name: "Seachemot" }], names);
    expect(none.match).toBeNull();
    expect(none.candidates).toHaveLength(0);
    const two = matchParty(name, [{ id: "a", name: "Hyakusaibou Foods" }, { id: "b", name: "Hyakusaibou Trading" }], names);
    expect(two.match).toBeNull();
    expect(two.candidates).toHaveLength(2);
    const f = fillExportContract(createForm(), read(ANNEX2), ctx({ customers: [{ id: "x", code: "", name: "Seachemot" }] }));
    expect(f.values.customerId).toBe("");
    expect(f.notes.some((n) => n.includes("HYAKUSAIBOU CO.,LTD"))).toBe(true);
  });

  it("AC-10 HĐ nhập: đối tác là bên bán, dòng chỉ tên · kg · giá", () => {
    const c = read(IMPORT_FIXTURE, "import");
    expect(c.partnerSide).toBe("seller");
    expect(c.partnerName).toBe("OCEAN PRIDE SEAFOOD LTD");
    expect(c.contractNo).toBe("OPS-2026/118");
    expect(c.signedOn).toBe("2026-09-15");
    expect(c.paymentMethod).toBe("ttr");
    expect(c.depositPct).toBe(30);
    const f = fillImportContract(
      { supplierId: "", contractNo: "", signedDate: "", currency: "USD", lines: [{ id: "x", productName: "", productId: "", goodsTypeId: "", kg: null, unitPrice: null }] },
      c,
      { mode: "create", baselineCurrency: "USD", suppliers: [{ id: "s1", code: "", shortName: "Ocean Pride", fullName: "Ocean Pride Seafood Ltd" }], newLineId: () => `i${++seq}` },
    );
    expect(f.values.supplierId).toBe("s1");
    expect(f.values.lines.map((l) => [l.productName, l.kg, l.unitPrice])).toEqual([
      ["Frozen octopus whole", 20000, 3.1],
      ["Frozen squid", 10000, null],
    ]);
  });

  it("AC-11 file HĐ nhập mở ở form Xuất khẩu: không điền khách, có cảnh báo", () => {
    const c = read(IMPORT_FIXTURE, "export");
    expect(c.partnerName).toBe("");
    expect(c.warnings.some((w) => w.includes("HĐ nhập"))).toBe(true);
    expect(fillExportContract(createForm(), c, ctx()).values.customerId).toBe("");
  });

  it("AC-12 không thấy giá thì không điền giá", () => {
    const f = fillExportContract(createForm(), read(ANNEX2), ctx({ canSeePrice: false }));
    expect(f.values.lines.map((l) => l.unitPrice)).toEqual([null, null, null]);
    expect(f.conflicts.some((c) => c.isPrice)).toBe(false);
  });
});

describe("ba-spec 66 — HĐ thật anh gửi 2026-11-03", () => {
  it("13-MAT-26: THESELLER viết liền, tiêu đề 2 tầng Ctns / Kgs, size trong tên hàng, cảng ở mục SHIPMENT", () => {
    const c = read(MAT13);
    expect([c.contractNo, c.signedOn, c.partnerName]).toEqual(["13-MAT-26", "2026-10-16", "MATSUDA SANGYO CO.,LTD."]);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0]).toMatchObject({
      description: "Frozen iidako raw cut, size 1.3 – 1.8 cm, standard grade (including paper skin)",
      size: "1.3 – 1.8 cm",
      packing: "2kg/Block x 6/PE/CTN",
      netKgPerCarton: 12,
      cartons: 2200,
      kg: 26400,
      unitPrice: 8.7,
      amount: 229680,
    });
    expect([c.totalKg, c.totalAmount]).toEqual([26400, 229680]);
    expect([c.incoterm, c.incotermRaw, c.portOfDischarge, c.currency]).toEqual(["CFR", "CNF", "Yokohama, Japan", "USD"]);
    expect([c.tolerancePct, c.latestShipmentDate, c.latestShipmentInferred, c.containerCount, c.paymentMethod]).toEqual([10, "2027-03-31", true, 2, "ttr"]);
    expect(c.lineIssues).toEqual([]);
    // ba-spec 69 AC-5: hạn hợp đồng từ mục OTHERS.
    expect(c.contractValidUntil).toBe("2027-05-31");
    const f = fillExportContract(createForm(), c, ctx());
    expect(f.values.terms.contractValidUntil).toBe("2027-05-31");
  });

  it("17-26-NEWPOINT: cột Item không phải tên hàng, Quantity (CTN) là số thùng, LC không dấu /, dung sai không lấy trong tên hàng", () => {
    const c = read(NEWPOINT17);
    expect([c.contractNo, c.signedOn, c.partnerName]).toEqual(["17-26-NEWPOINT", "2026-11-03", "NEW POINT CO., LTD"]);
    expect(c.lines.map((l) => [l.description, l.netKgPerCarton, l.cartons, l.kg, l.unitPrice, l.amount])).toEqual([
      ["Dried seasoned Eihire A, old recipe", 10, 50, 500, 14, 7000],
      ["Dried seasoned Octopus", 10, 100, 1000, 18, 18000],
      ["Dried baby crab", 5, 350, 1750, 8.7, 15225],
      ["Noshiika - Moisute: 30% +/-2% - Length: >=20cm", 10, 200, 2000, 19.8, 39600],
    ]);
    expect([c.totalKg, c.totalAmount]).toEqual([5250, 79825]);
    expect([c.incoterm, c.currency, c.tolerancePct, c.containerCount, c.paymentMethod]).toEqual(["CFR", "USD", 10, 1, "lc"]);
    expect([c.latestShipmentDate, c.latestShipmentInferred]).toEqual(["2026-11-10", false]);
    expect(c.contractValidUntil).toBe("2026-12-31");
    expect(c.lineIssues).toEqual([]);
    expect(c.priceWarnings).toEqual([]);
  });

  it("HĐ nhập MSA: dạng nhãn : giá trị, 3 size ⇒ 3 dòng, hạn giao bỏ chữ trong ngoặc", () => {
    const c = read(MSA, "import");
    expect([c.contractNo, c.signedOn, c.partnerName, c.partnerSide, c.currency]).toEqual(["001N.26-MSA", "2026-09-24", "MSA SEA FOODS", "seller", "USD"]);
    expect(c.lines.map((l) => [l.description, l.size, l.kg, l.unitPrice, l.netKgPerCarton, l.cartons])).toEqual([
      ["FROZEN OCTOPUS WHOLE ROUND SHORT ARM", "100/200", 18000, 4, 20, 900],
      ["FROZEN OCTOPUS WHOLE ROUND SHORT ARM", "200/300", 5000, 4, 20, 250],
      ["FROZEN OCTOPUS WHOLE ROUND SHORT ARM", "300/500", 1000, 4, 20, 50],
    ]);
    expect([c.totalKg, c.totalAmount]).toEqual([24000, 96000]);
    expect([c.latestShipmentDate, c.latestShipmentInferred, c.paymentMethod, c.tolerancePct]).toEqual(["2026-10-25", false, "lc", 10]);
    expect(c.contractValidUntil).toBe("2026-12-31");
    expect([...c.warnings, ...c.priceWarnings]).toEqual([]);
    const f = fillImportContract(
      { supplierId: "", contractNo: "", signedDate: "", currency: "USD", lines: [{ id: "x", productName: "", productId: "", goodsTypeId: "", kg: null, unitPrice: null }] },
      c,
      { mode: "create", baselineCurrency: "USD", suppliers: [{ id: "s9", code: "MSA", shortName: "MSA Sea Foods", fullName: "" }], newLineId: () => `m${++seq}` },
    );
    expect([f.values.supplierId, f.values.contractNo, f.values.signedDate]).toEqual(["s9", "001N.26-MSA", "2026-09-24"]);
    // ba-spec 69 v2: hạn HĐ nhập — máy chủ chưa có cột (undefined) thì không điền; có cột thì điền ô trống.
    expect(f.values.validUntil).toBeUndefined();
    const g = fillImportContract(
      { supplierId: "", contractNo: "", signedDate: "", validUntil: "", currency: "USD", lines: [] },
      c,
      { mode: "create", baselineCurrency: "USD", suppliers: [], newLineId: () => `v${++seq}` },
    );
    expect(g.values.validUntil).toBe("2026-12-31");
    expect(f.values.lines.map((l) => [l.productName, l.kg, l.unitPrice])).toEqual([
      ["FROZEN OCTOPUS WHOLE ROUND SHORT ARM 100/200", 18000, 4],
      ["FROZEN OCTOPUS WHOLE ROUND SHORT ARM 200/300", 5000, 4],
      ["FROZEN OCTOPUS WHOLE ROUND SHORT ARM 300/500", 1000, 4],
    ]);
  });

  it("13-MAT-26.pdf: ghép lại bảng theo tọa độ — ô nhiều dòng, tiêu đề 3 tầng", () => {
    const rows = rowsFromPdfItems(MAT13_PDF_ITEMS);
    expect(rows).toEqual([
      ["I.", "COMMODITY, QUANTITY, PRICE:"],
      ["Mark", "Commodities", "Packing", "Price CNF main port", "Ctns", "Quantity Kgs", "Amount (usd)"],
      ["1", "Frozen iidako raw cut, size 1.3 – 1.8 cm, standard grade (including paper skin)", "2kg/Block x 6/PE/CTN", "8.70", "2,200", "26,400.00", "229,680.00"],
      ["", "TOTAL", "", "", "2,200", "26,400.00", "229,680.00"],
      ["(10% more or less in quantity and amount are allowed )"],
    ]);
    const c = read([...MAT13.slice(0, 7), ...rows, ...MAT13.slice(14)]);
    expect(c.lines.map((l) => [l.size, l.netKgPerCarton, l.cartons, l.kg, l.unitPrice, l.amount])).toEqual([["1.3 – 1.8 cm", 12, 2200, 26400, 8.7, 229680]]);
  });

  it("HĐ nhập KORNISH: tên bên bán ở ô sau, 1 size", () => {
    const c = read(KOR, "import");
    expect([c.contractNo, c.partnerName]).toEqual(["001N.26-KOR", "KORNISH MARINE FOODS"]);
    expect(c.lines.map((l) => [l.size, l.kg, l.unitPrice, l.cartons, l.amount])).toEqual([["100/200", 25000, 4, 1250, 100000]]);
    expect([c.totalKg, c.totalAmount, c.latestShipmentDate]).toEqual([25000, 100000, "2026-10-05"]);
  });
});

describe("ba-spec 66 — hàm phụ", () => {
  it("kg tịnh / thùng từ quy cách", () => {
    expect(packingNetKg("IQF, 1kg/PE x 12/ctn")).toBe(12);
    expect(packingNetKg("10kg/ctn")).toBe(10);
    expect(packingNetKg("6 x 2kg/ctn")).toBe(12);
    expect(packingNetKg("IQF, 500g x 20/ctn")).toBe(10);
    expect(packingNetKg("Block, bulk")).toBeNull();
  });

  it("hạn giao: ngày rõ hoặc ngày cuối tháng", () => {
    expect(parseShipmentDeadline("Time of shipment: from November, 2026 to April, 2027")).toEqual({ date: "2027-04-30", inferred: true });
    expect(parseShipmentDeadline("Time of shipment: not later than 15/03/2027")).toEqual({ date: "2027-03-15", inferred: false });
    expect(parseShipmentDeadline("Shipment: February 2028")).toEqual({ date: "2028-02-29", inferred: true });
    expect(parseShipmentDeadline("II. SHIPMENT: 2 container 20 feet to Yokohama, Japan within January and March, 2027")).toEqual({ date: "2027-03-31", inferred: true });
    expect(parseShipmentDeadline("- Time of shipment : ON OR BEFORE 25 OCTOBER, 2026 (accept date of shipment before issue date of LC)")).toEqual({ date: "2026-10-25", inferred: false });
  });

  it("Word 97 (.doc): đoạn văn tách ô theo tab, trường EMBED Excel ⇒ dòng đánh dấu đúng chỗ, bảng Word giữ ô", () => {
    // Chữ thô của thân 17-26-NEWPOINT.doc (rút gọn): bảng hàng là trường "EMBED Excel.Sheet.12".
    const raw = "         No: 17-26-NEWPOINT\r\t         Date: November 03, 2026\rI.COMMODITY, QUANTITY, PRICE:\r\x13 EMBED Excel.Sheet.12  \x14\x01\x15More or less 10% in quantity\rA\x07B\x07\x07Size :\t100/200\t200/300\r";
    expect(rowsFromWordBlocks(wordTextToBlocks(raw))).toEqual([
      ["No: 17-26-NEWPOINT"],
      ["Date: November 03, 2026"],
      ["I.COMMODITY, QUANTITY, PRICE:"],
      [EMBED_MARKER, "0"],
      ["More or less 10% in quantity"],
      ["A", "B"],
      ["Size :", "100/200", "200/300"],
    ]);
  });

  it("rowsFromDocxXml: đoạn văn, bảng, ô gộp ngang, ký tự đặc biệt", () => {
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>THE BUYER: A &amp; B CO.,LTD</w:t></w:r></w:p>' +
      "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Number</w:t></w:r><w:r><w:br/><w:t>pcs/kg</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Size</w:t></w:r></w:p></w:tc></w:tr>" +
      '<w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">Total </w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>&lt; 5</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      "<w:p/><w:p><w:r><w:t>Time of shipment</w:t></w:r></w:p>" +
      "<w:p><w:r><w:t>Size :</w:t><w:tab/><w:t>100/200</w:t><w:tab/><w:tab/><w:t>200/300</w:t></w:r></w:p>" +
      '<w:p><w:r><w:object><o:OLEObject Type="Embed" ProgID="Excel.Sheet.12" ShapeID="_x0000_i1025" r:id="rId9"/></w:object></w:r></w:p></w:body></w:document>';
    expect(rowsFromDocxXml(xml)).toEqual([["THE BUYER: A & B CO.,LTD"], ["Number pcs/kg", "Size"], ["Total", "", "< 5"], ["Time of shipment"], ["Size :", "100/200", "200/300"], [EMBED_MARKER, "rId9"]]);
  });
});
