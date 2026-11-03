import { describe, expect, it } from "vitest";
import type { ExportContractLine, ExportShipmentLine } from "@/types";
import {
  addressLines,
  applyLoadingCounts,
  isDraftLoadingLine,
  loadingCountRows,
  amountInWords,
  bankBlockLines,
  buildInvoiceDocument,
  englishDate,
  invoiceFileName,
  invoiceUnitPrice,
  lineNetKg,
  loadingCountSummary,
  netKgPerUnit,
  packageLabel,
  shipmentLineFromContract,
  specialNoteRows,
  type InvoiceDocInput,
} from "./exportInvoice";
import { parseInvoiceRows } from "./invoiceReader";

const line = (over: Partial<ExportShipmentLine>): ExportShipmentLine => ({
  id: "l1",
  shipmentId: "s1",
  contractId: "c1",
  sortOrder: 10,
  contractLineId: "",
  productId: "",
  description: "FROZEN CRAB KARAAGE",
  size: "",
  packing: "",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: 10,
  grossKgPerUnit: null,
  plannedUnits: null,
  loadedUnits: null,
  loadedBy: "",
  loadedAt: "",
  expiry: "",
  note: "",
  ...over,
});

const contractLine = (over: Partial<ExportContractLine>): ExportContractLine => ({
  id: "cl1",
  description: "FROZEN CRAB KARAAGE",
  hsCode: "",
  size: "2 - 4 gr/pc",
  packing: "500gr/box x 20/CTN",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: 10,
  quantity: 700,
  kg: 7000,
  unitPrice: 6.45,
  microSpec: "",
  productId: "p-crab",
  ...over,
});

/** INVOICE 275/26 (Kaisei) — 2 size cùng tên, chung một quy cách, kho đóng 657 + 1 thùng. */
const kaiseiLines = [
  line({ id: "a", sortOrder: 10, size: "Size: 2 - 4 gr/pc", packing: "500gr/box x 20/CTN", plannedUnits: 660, loadedUnits: 657 }),
  line({ id: "b", sortOrder: 20, size: "Size: 4 - 8 gr/pc", packing: "500gr/box x 20/CTN", plannedUnits: 1, loadedUnits: 1 }),
];
const kaiseiPrices: Record<string, number> = { a: 6.45, b: 6.55 };
const kaiseiInput = (over: Partial<InvoiceDocInput> = {}): InvoiceDocInput => ({
  invoiceNo: "275/26",
  issuedOn: "2026-11-02",
  customer: { name: "KAISEI MARINE PRODUCTS INC.", address: "NO. 2-3, 1-CHOME HIGASHIYAMATO-MACHI,\nSHIMONOSEKI CITY, YAMAGUCHI PREFECTURE\n750-0066, JAPAN" },
  shipment: { loadingDate: "2026-11-03", etd: "2026-11-05", vesselVoyage: "BANGKOK BRIDGE V.0518E", containerNo: "TEXU9016877", sealNo: "VN17376AT" },
  blNo: "ONEYSGNGCM332800",
  portOfLoading: "Cai Mep Port, Vietnam",
  portOfDischarge: "Tokyo, Japan",
  currency: "USD",
  tradeTerms: "CFR TOKYO, JAPAN",
  originNote: "",
  lines: kaiseiLines,
  unitPrice: (l) => kaiseiPrices[l.id] ?? null,
  bankLines: ["Bank name: VIETNAM JOINT STOCK COMMERCIAL BANK FOR INDUSTRY AND TRADE, BRVT BRANCH", "Account number: 110000206680"],
  specialNotes: "",
  ...over,
});

describe("exportInvoice — dòng hàng của chuyến", () => {
  it("kg tịnh / kiện: thùng = kg/thùng; bó = số thùng/bó × kg/thùng (mẫu 236/26: 2 thùng × 6 kg = 12 kg/bó)", () => {
    expect(netKgPerUnit({ unitKind: "carton", cartonsPerUnit: 5, netKgPerCarton: 10 })).toBe(10);
    expect(netKgPerUnit({ unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: 6 })).toBe(12);
    expect(netKgPerUnit({ unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: null })).toBeNull();
  });

  it("kho đã điền số thực đóng ⇒ chứng từ dùng số đó, chưa ⇒ số kế hoạch", () => {
    expect(lineNetKg(line({ plannedUnits: 660, loadedUnits: 657 }))).toBe(6570);
    expect(lineNetKg(line({ plannedUnits: 660, loadedUnits: null }))).toBe(6600);
    expect(lineNetKg(line({ plannedUnits: null }))).toBeNull();
  });

  it("chép dòng HĐ: tên, size, quy cách, kiện, kg/thùng, mặt hàng; số thực đóng trống", () => {
    const l = shipmentLineFromContract(contractLine({ unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: 6 }), { id: "x", shipmentId: "s9", contractId: "c9", sortOrder: 30, plannedUnits: 20 });
    expect(l).toMatchObject({ contractLineId: "cl1", productId: "p-crab", size: "2 - 4 gr/pc", unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: 6, plannedUnits: 20, loadedUnits: null });
  });

  it("tổng số thực đóng: đủ khi mọi dòng có số; lệch = thực đóng − kế hoạch", () => {
    expect(loadingCountSummary(kaiseiLines)).toEqual({ lineCount: 2, filledCount: 2, plannedUnits: 661, loadedUnits: 658, complete: true, diffUnits: -3, unplannedCount: 0 });
    const half = loadingCountSummary([kaiseiLines[0], { ...kaiseiLines[1], loadedUnits: null }]);
    expect(half.complete).toBe(false);
    expect(half.filledCount).toBe(1);
    expect(loadingCountSummary([]).complete).toBe(false);
  });

  it("đơn giá: số sửa ở invoice thắng đơn giá dòng HĐ", () => {
    const l = line({ id: "a", contractLineId: "cl1" });
    expect(invoiceUnitPrice(l, undefined, [contractLine({})])).toBe(6.45);
    expect(invoiceUnitPrice(l, { bankOptionId: "", unitPrices: { a: 6.5 }, tradeTerms: "", originNote: "", specialNotes: "" }, [contractLine({})])).toBe(6.5);
    expect(invoiceUnitPrice(line({ contractLineId: "" }), undefined, [contractLine({})])).toBeNull();
  });
});

describe("exportInvoice — chữ in", () => {
  it("số tiền thành chữ đúng mẫu 275/26 và 236/26", () => {
    expect(amountInWords(42442, "USD")).toBe("United States Dollars Forty two thousand four hundred forty two only.");
    expect(amountInWords(36249.71, "USD")).toBe("United States Dollars Thirty six thousand two hundred forty nine and seventy one cents only.");
    expect(amountInWords(1000000, "JPY")).toBe("Japanese Yen One million only.");
  });

  it("địa chỉ một dòng dài ⇒ ngắt theo từ, ≤ 40 ký tự (ra đúng 3 dòng như PDF 275/26); có xuống dòng ⇒ giữ nguyên", () => {
    expect(addressLines("NO. 2-3, 1-CHOME HIGASHIYAMATO-MACHI, SHIMONOSEKI CITY, YAMAGUCHI PREFECTURE 750-0066, JAPAN")).toEqual([
      "NO. 2-3, 1-CHOME HIGASHIYAMATO-MACHI,",
      "SHIMONOSEKI CITY, YAMAGUCHI PREFECTURE",
      "750-0066, JAPAN",
    ]);
    expect(addressLines("4-1-9 TSUKIJI CHUO-KU TOKYO JAPAN")).toEqual(["4-1-9 TSUKIJI CHUO-KU TOKYO JAPAN"]);
    expect(addressLines("Dòng 1\nDòng 2")).toEqual(["Dòng 1", "Dòng 2"]);
    expect(addressLines("")).toEqual([]);
  });

  it("ngày tiếng Anh, tên file, nhãn kiện", () => {
    expect(englishDate("2026-11-02")).toBe("November 02, 2026");
    expect(englishDate("")).toBe("");
    expect(invoiceFileName("275/26")).toBe("INVOICE 275.26.xlsx");
    expect(packageLabel([{ unitKind: "bundle" }]).short).toBe("BDLS");
    expect(packageLabel([{ unitKind: "carton" }]).short).toBe("CTNS");
    expect(packageLabel([{ unitKind: "carton" }, { unitKind: "bundle" }]).short).toBe("PKGS");
  });

  it("khối ngân hàng: mỗi dòng ghi chú một dòng in; ghi chú riêng tách ô bằng Tab hoặc |", () => {
    expect(bankBlockLines({ id: "b", listKind: "bank-account", name: "MSB", sortOrder: 0, note: "Bank name: X\n\nAccount number: 1" })).toEqual(["Bank name: X", "Account number: 1"]);
    expect(bankBlockLines(undefined)).toEqual([]);
    expect(specialNoteRows("Items\tRef. Import Invoice Number\nPacific saury | BF2606ACM180-03\n")).toEqual([
      ["Items", "Ref. Import Invoice Number"],
      ["Pacific saury", "BF2606ACM180-03"],
    ]);
  });
});

describe("exportInvoice — bố cục Invoice / Packing list", () => {
  it("INVOICE 275/26: 658 thùng · 6.580 kg · 42.442,00 USD; thiếu số không có dòng nào", () => {
    const doc = buildInvoiceDocument(kaiseiInput());
    expect(doc.totals).toEqual({ units: 658, netKg: 6580, grossKg: 0, amount: 42442 });
    expect(doc.incompleteLineIds).toEqual([]);
    expect(doc.sheets.map((s) => s.name)).toEqual(["INVOICE", "PACKING LIST"]);
    expect(doc.fileName).toBe("INVOICE 275.26.xlsx");
    const texts = doc.sheets[0].rows.map((r) => r.cells.filter((c) => typeof c === "string").join(" | "));
    // Hai size chung quy cách ⇒ MỘT dòng Packing cuối nhóm (như PDF 275/26).
    expect(texts.filter((t) => t.startsWith("Packing:"))).toEqual(["Packing: 500gr/box x 20/CTN"]);
    expect(texts).toContain("Says: United States Dollars Forty two thousand four hundred forty two only.");
    expect(texts).toContain("Please make TT to:");
  });

  it("vòng tròn: bảng Invoice dựng ra đọc lại bằng parseInvoiceRows ra đúng số, ngày, dòng, tổng", () => {
    const doc = buildInvoiceDocument(kaiseiInput());
    const r = parseInvoiceRows(doc.sheets[0].rows.map((row) => row.cells));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.invoice.invoiceNo).toBe("275/26");
    expect(r.invoice.issuedOn).toBe("2026-11-02");
    expect(r.invoice.lines.map((l) => [l.description, l.cartons, l.netKg, l.unitPrice, l.amount])).toEqual([
      ["FROZEN CRAB KARAAGE", 657, 6570, 6.45, 42376.5],
      ["FROZEN CRAB KARAAGE", 1, 10, 6.55, 65.5],
    ]);
    expect(r.invoice.totals).toEqual({ cartons: 658, netKg: 6580, amount: 42442 });
  });

  it("mẫu 236/26: quy cách khác nhau theo size ⇒ Packing sau từng size; bó 12/14 kg ra N.W/G.W ở packing list", () => {
    const saury = [
      line({ id: "s50", description: "FROZEN PACIFIC SAURY OPEN CUT (belly bone less)", size: "Size 50GR/PC", packing: "60pcs/bag (3KGS) x 2/CTN x 2/BDL", unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: 6, grossKgPerUnit: 14, plannedUnits: 20 }),
      line({ id: "s60", description: "FROZEN PACIFIC SAURY OPEN CUT (belly bone less)", size: "Size 60GR/PC", packing: "50pcs/bag (3KGS) x 2/CTN x 2/BDL", unitKind: "bundle", cartonsPerUnit: 2, netKgPerCarton: 6, grossKgPerUnit: 14, plannedUnits: 9, expiry: "2028.01" }),
    ];
    const doc = buildInvoiceDocument(kaiseiInput({ lines: saury, unitPrice: () => 4.91097 }));
    // Tiền mỗi dòng làm tròn 2 số lẻ: 1.178,63 + 530,38 (file 236/26 gõ tay 530,39 ở ô F22 ⇒ 1.709,02).
    expect(doc.totals).toEqual({ units: 29, netKg: 348, grossKg: 406, amount: 1709.01 });
    const inv = doc.sheets[0].rows.map((r) => r.cells[1]).filter((c): c is string => typeof c === "string" && /^(Size|Packing)/.test(c));
    expect(inv).toEqual(["Size 50GR/PC", "Packing: 60pcs/bag (3KGS) x 2/CTN x 2/BDL", "Size 60GR/PC", "Packing: 50pcs/bag (3KGS) x 2/CTN x 2/BDL"]);
    const pl = doc.sheets[1].rows.find((r) => r.cells[1] === "Size 50GR/PC");
    expect(pl?.cells.slice(2)).toEqual(["12kgs/14kgs", 20, 240, 280]);
    // Có dòng ghi hạn dùng ⇒ thêm Expiry date list.
    expect(doc.sheets.map((s) => s.name)).toEqual(["INVOICE", "PACKING LIST", "EXPIRY DATE"]);
  });

  it("dòng thiếu đơn giá / số kiện ⇒ báo dòng thiếu, tổng chỉ cộng dòng đủ", () => {
    const doc = buildInvoiceDocument(kaiseiInput({ unitPrice: (l) => (l.id === "a" ? 6.45 : null) }));
    expect(doc.incompleteLineIds).toEqual(["b"]);
    expect(doc.totals.amount).toBe(42376.5);
  });

  it("ghi chú riêng của khách in thành hàng, ô tách theo Tab", () => {
    const doc = buildInvoiceDocument(kaiseiInput({ specialNotes: "*NOTE:\nItems\tOrigin of Raw Material\nPacific saury\tJapan" }));
    const rows = doc.sheets[0].rows.map((r) => r.cells);
    expect(rows).toContainEqual(["Items", "Origin of Raw Material"]);
    expect(rows).toContainEqual(["Pacific saury", "Japan"]);
  });
});

describe("exportInvoiceExcel — file .xlsx", () => {
  it("ghi đủ sheet, số giữ dạng number, đọc lại bằng exceljs ra đúng tổng", async () => {
    const { invoiceWorkbookBytes } = await import("./exportInvoiceExcel");
    const doc = buildInvoiceDocument(kaiseiInput());
    const bytes = await invoiceWorkbookBytes(doc);
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["INVOICE", "PACKING LIST"]);
    const ws = wb.getWorksheet("INVOICE");
    const totalRow = doc.sheets[0].rows.findIndex((r) => r.role === "total") + 1;
    expect(ws?.getRow(totalRow).getCell(6).value).toBe(42442);
    expect(ws?.getRow(totalRow).getCell(3).value).toBe(658);
  });
});

describe("đóng cont tự điền số thực đóng (feedback 2026-11-03, mig 0098)", () => {
  const cls = [contractLine({ id: "cl1", description: "CRAB" }), contractLine({ id: "cl2", description: "OCTOPUS" })];
  it("chuyến chưa có hàng ⇒ mỗi dòng HĐ một dòng tạm; dòng đã có không nhân đôi", () => {
    const empty = loadingCountRows([], cls, { shipmentId: "s1", contractId: "c1" });
    expect(empty.map((l) => l.id)).toEqual(["draft:cl1", "draft:cl2"]);
    expect(empty.every((l) => isDraftLoadingLine(l) && l.plannedUnits == null && l.loadedUnits == null)).toBe(true);
    const some = loadingCountRows([line({ id: "l1", contractLineId: "cl1", plannedUnits: 100, sortOrder: 10 })], cls, { shipmentId: "s1", contractId: "c1" });
    expect(some.map((l) => l.id)).toEqual(["l1", "draft:cl2"]);
    expect(some[1].sortOrder).toBe(11);
  });
  it("lưu: dòng tạm có số ⇒ dòng mới id thật, không kế hoạch; dòng tạm trống ⇒ bỏ; dòng cũ không đổi ⇒ không ghi", () => {
    const rows = loadingCountRows([line({ id: "l1", contractLineId: "cl1", plannedUnits: 100, loadedUnits: 98 })], cls, { shipmentId: "s1", contractId: "c1" });
    let n = 0;
    const ctx = { by: "Kho", at: "2026-11-03T10:00:00Z", newId: () => `new${++n}` };
    expect(applyLoadingCounts(rows, { l1: 98, "draft:cl2": null }, ctx)).toEqual([]);
    const out = applyLoadingCounts(rows, { l1: 97, "draft:cl2": 40 }, ctx);
    expect(out.map((l) => [l.id, l.loadedUnits, l.plannedUnits, l.loadedBy])).toEqual([
      ["l1", 97, 100, "Kho"],
      ["new1", 40, null, "Kho"],
    ]);
    expect(out[1]).toMatchObject({ contractLineId: "cl2", contractId: "c1", shipmentId: "s1", description: "OCTOPUS", note: "", expiry: "", grossKgPerUnit: null });
  });
  it("tóm tắt: dòng không kế hoạch không bị tính là thừa", () => {
    const s = loadingCountSummary([line({ id: "a", plannedUnits: 100, loadedUnits: 98 }), line({ id: "b", plannedUnits: null, loadedUnits: 40 })]);
    expect(s).toMatchObject({ filledCount: 2, loadedUnits: 138, diffUnits: -2, unplannedCount: 1, complete: true });
  });
});

describe("ba-spec 67 AC-2 — người bán lấy từ Thông tin công ty", () => {
  it("đổi địa chỉ EN ⇒ mọi chứng từ in địa chỉ mới, viết hoa; không còn địa chỉ cũ", async () => {
    const { COMPANY_DEFAULTS, companySellerOf } = await import("./companyProfile");
    const seller = companySellerOf({ ...COMPANY_DEFAULTS, addressEn: "1 New Street, Ba Ria", issuePlace: "Vung Tau" });
    const doc = buildInvoiceDocument(kaiseiInput({ seller }));
    const texts = doc.sheets.flatMap((sh) => sh.rows.flatMap((r) => r.cells.map((c) => String(c ?? ""))));
    expect(texts.filter((t) => t.includes("1 NEW STREET, BA RIA")).length).toBeGreaterThanOrEqual(1);
    expect(texts.filter((t) => t.includes("321 TRAN XUAN DO")).length).toBe(0);
    expect(texts.filter((t) => t.startsWith("Vung Tau,")).length).toBeGreaterThanOrEqual(1);
  });
});
