// Oracle: Commercial Invoice 234/26 (Seachemot, lô 165 — bản scan ở gói demo, chép lại từng ô theo
// bố cục Excel gốc). ba-spec 41 v7 NV17 · R27 · AC-51…AC-55.
import { describe, expect, it } from "vitest";
import {
  compareInvoiceToContract,
  fillInvoiceItem,
  invoiceNameLines,
  isReadableInvoiceFile,
  matchInvoiceLine,
  parseInvoiceDate,
  parseInvoiceNumber,
  parseInvoiceRows,
  rowsFromTextItems,
  sumInvoiceLines,
  type InvoiceCell,
} from "./invoiceReader";
import type { ExportContractLine, ExportStepItem } from "@/types";

/** Bảng 234/26 như ô Excel: cột A số TT · B mô tả · C thùng · D kg · E đơn giá · F tiền. */
export const INVOICE_234_26: InvoiceCell[][] = [
  ["BASEAFOOD 1 CO.,LTD"],
  ["321 TRAN XUAN DO ST., QUARTER 2, BA RIA WARD,"],
  ["HO CHI MINH CITY, VIETNAM"],
  [null, null, null, null, "Ba Ria, September 25, 2026"],
  [null, "COMMERCIAL INVOICE", null, null, null, "234/26"],
  ["Applicant: SEACHEMOT CO., LTD", null, null, "Date of delivery:", "SEPTEMBER 26, 2026"],
  ["HK BLDG 6F, 2-9-5, IRIFUNE, CHUO-KU,", null, null, "Vessel's name:", "MOL ENDOWMENT 105N"],
  ["TOKYO 104-0042 JAPAN", null, null, "B/L NO. :", "PAPTYO260926224"],
  ["TEL: 03-6222-8701, FAX: 03-6222-8702", null, null, "Port of loading:", "CAI MEP, VIETNAM"],
  [null, null, null, "Port of discharge:", "TOKYO, JAPAN"],
  ["ITEMS", "DESCRIPTION OF GOODS", "NUMBER OF PACKAGES", "NET WEIGHT", "IN US. DOLLARS"],
  [null, null, null, null, "UNIT PRICE", "AMOUNT"],
  [null, null, null, null, "Trade Terms"],
  [null, null, null, null, "CFR TOKYO, JAPAN"],
  [null, "COUNTRY OF ORIGIN: VIETNAM", "CARTONS", "KGS", "USD/KG", "USD"],
  [1, "FROZEN IWADAKO BLANCHED CUT", 300, 3000, null, 31500],
  [null, "SIZE: 2-3 gr/pc", 200, 2000, 10.5, 21000],
  [null, "SIZE: 5g ±0.5g gr/pc", 100, 1000, 10.5, 10500],
  [null, "Packing: IQF, 1KG/PE x 10/CTN"],
  [2, "FROZEN IWADAKO BOILED CUT", 550, 5500, null, 57400],
  [null, "SIZE: 1-under gr/pc", 100, 1000, 10.15, 10150],
  [null, "SIZE: 1-2 gr/pc (600-900 pcs/kg)", 300, 3000, 10.15, 30450],
  [null, "Packing: Bulk 10kg/PE/CTN"],
  [null, "SIZE: 6-7 gr/pc", 150, 1500, 11.2, 16800],
  [null, "Packing: IQF, 1KG/PE x 10/CTN"],
  [3, "FROZEN TAKO TIP BOILED CUT", 200, 2400, null, 9720],
  [null, "Packing: 1KG/BLOCK/PE x 12/CTN", 200, 2400, 4.05, 9720],
  [4, "FROZEN TAKO NECK BOILED CUT", 180, 1800, null, 7290],
  [null, "SIZE: 1-2 gr/pc", 180, 1800, 4.05, 7290],
  [null, "Packing: IQF, 1KG/PE x 10/CTN"],
  [5, "FROZEN TAKO TIP RAW", 52, 624, null, 1341.6],
  [null, "Packing: 1KG/BLOCK/PE x 12/CTN", 52, 624, 2.15, 1341.6],
  [6, "FROZEN IIDAKO OPEN CUT", 300, 3000, null, 24300],
  [null, "SIZE: 26-40 pcs/kg", 150, 1500, 8.1, 12150],
  [null, "SIZE: 41-60 pcs/kg", 150, 1500, 8.1, 12150],
  [null, "Packing: IQF, 1KG/PE X 10/CTN"],
  [7, "FROZEN TAKO KARAAGE", 200, 1200, null, 9540],
  [null, "SIZE: 10-15 GR/PC"],
  [null, "Packing: IQF, 1KG/PE x 6/CTN x 2/bundle", 200, 1200, 7.95, 9540],
  [8, "FROZEN IIDAKO WHOLE CLEANED SASHIMI", 469, 4690, null, 53466],
  [null, "Size 15-25 gr/pc", 299, 2990, 11.4, 34086],
  [null, "Size 8-15 gr/pc", 170, 1700, 11.4, 19380],
  [null, "Packing: 1kg/bag x 10/CTN"],
  [null, "TOTAL", 2251, 22214, null, 194557.6],
  ["Says: United States Dollars One hundred ninety four thousand five hundred fifty seven and sixty cents only."],
];

/** Cùng invoice nhưng như chữ PDF xuất từ Excel: số in kiểu Anh, mọi ô là chữ. */
const asPdfText = (rows: InvoiceCell[][]): InvoiceCell[][] =>
  rows.map((r) =>
    r.map((c) => (typeof c === "number" ? c.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(c) && c > 1000 ? 2 : 0, maximumFractionDigits: 2 }) : c)),
  );

const ok = (rows: InvoiceCell[][]) => {
  const r = parseInvoiceRows(rows);
  if (!r.ok) throw new Error(r.message);
  return r;
};

describe("Đọc Commercial Invoice 234/26 (AC-51)", () => {
  it("đầu invoice: số, ngày lập (không lấy ngày giao), khách, tiền tệ", () => {
    const { invoice } = ok(INVOICE_234_26);
    expect(invoice.invoiceNo).toBe("234/26");
    expect(invoice.issuedOn).toBe("2026-09-25");
    expect(invoice.buyer).toBe("SEACHEMOT CO., LTD");
    expect(invoice.currency).toBe("USD");
  });

  it("13 dòng size, tổng == dòng TOTAL, không cảnh báo", () => {
    const { invoice, warnings } = ok(INVOICE_234_26);
    expect(invoice.lines).toHaveLength(13);
    expect(invoice.totals).toEqual({ cartons: 2251, netKg: 22214, amount: 194557.6 });
    expect(sumInvoiceLines(invoice.lines)).toEqual(invoice.totals);
    expect(warnings).toEqual([]);
  });

  it("tên nhóm + size + quy cách đi đúng dòng (quy cách sau 2 size, size không số, nhóm không size)", () => {
    const { lines } = ok(INVOICE_234_26).invoice;
    expect(lines[0]).toEqual({ description: "FROZEN IWADAKO BLANCHED CUT", size: "2-3 gr/pc", packing: "IQF, 1KG/PE x 10/CTN", cartons: 200, netKg: 2000, unitPrice: 10.5, amount: 21000 });
    // Nhóm 2: "Bulk" áp cho 2 size đầu, "IQF" cho size 6-7.
    expect(lines.slice(2, 5).map((l) => [l.size, l.packing])).toEqual([
      ["1-under gr/pc", "Bulk 10kg/PE/CTN"],
      ["1-2 gr/pc (600-900 pcs/kg)", "Bulk 10kg/PE/CTN"],
      ["6-7 gr/pc", "IQF, 1KG/PE x 10/CTN"],
    ]);
    // Nhóm 3: không size, số nằm ở dòng Packing.
    expect(lines[5]).toMatchObject({ description: "FROZEN TAKO TIP BOILED CUT", size: "", packing: "1KG/BLOCK/PE x 12/CTN", cartons: 200, netKg: 2400, unitPrice: 4.05 });
    // Nhóm 7: dòng SIZE không số ⇒ size đi theo dòng Packing có số.
    expect(lines[10]).toMatchObject({ description: "FROZEN TAKO KARAAGE", size: "10-15 GR/PC", packing: "IQF, 1KG/PE x 6/CTN x 2/bundle", netKg: 1200, amount: 9540 });
    // Nhóm 8: "Size" không có dấu hai chấm.
    expect(lines[12]).toMatchObject({ description: "FROZEN IIDAKO WHOLE CLEANED SASHIMI", size: "8-15 gr/pc", packing: "1kg/bag x 10/CTN", cartons: 170 });
  });

  it("chữ PDF số kiểu Anh (3,000.00 · 1,341.60) ra cùng kết quả", () => {
    const fromPdf = ok(asPdfText(INVOICE_234_26)).invoice;
    expect(fromPdf.totals).toEqual({ cartons: 2251, netKg: 22214, amount: 194557.6 });
    expect(fromPdf.lines).toEqual(ok(INVOICE_234_26).invoice.lines);
  });
});

describe("Invoice thiếu / lệch (AC-52)", () => {
  it("không có dòng DESCRIPTION ⇒ không nhận ra bảng", () => {
    const r = parseInvoiceRows([["HELLO"], ["SIZE: 1", 1, 2]]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-table");
  });

  it("không có dòng TOTAL ⇒ tổng = cộng dòng + cảnh báo", () => {
    const r = ok(INVOICE_234_26.filter((row) => row[1] !== "TOTAL"));
    expect(r.invoice.totals).toEqual({ cartons: 2251, netKg: 22214, amount: 194557.6 });
    expect(r.warnings).toEqual(["Không thấy dòng TOTAL — tổng lấy bằng cộng các dòng hàng."]);
  });

  it("dòng TOTAL không khớp cộng dòng ⇒ cảnh báo, giữ số TOTAL", () => {
    const rows = INVOICE_234_26.map((row) => (row[1] === "TOTAL" ? [null, "TOTAL", 2251, 22000, null, 194557.6] : row));
    const r = ok(rows);
    expect(r.invoice.totals.netKg).toBe(22000);
    expect(r.warnings).toEqual(["Dòng TOTAL ghi 22000 kg, cộng các dòng ra 22214 kg."]);
  });

  it("đuôi file đọc được: Excel + PDF; ảnh / Word không", () => {
    expect(["a.xlsx", "b.XLS", "c.pdf"].map(isReadableInvoiceFile)).toEqual([true, true, true]);
    expect(["a.jpg", "b.docx", "c.zip"].map(isReadableInvoiceFile)).toEqual([false, false, false]);
  });
});

describe("Số và ngày trên invoice (R22)", () => {
  it("số kiểu Anh, kiểu Việt, ô số Excel", () => {
    expect(["3,000.00", "194,557.60", "10.50", "1.234", "2,5", "52", "1,341.6", "abc", "2-3"].map(parseInvoiceNumber)).toEqual([
      3000, 194557.6, 10.5, 1234, 2.5, 52, 1341.6, null, null,
    ]);
    expect(parseInvoiceNumber(24300)).toBe(24300);
  });

  it("ngày tiếng Anh và dd/mm/yyyy", () => {
    expect(parseInvoiceDate("Ba Ria, September 25, 2026")).toBe("2026-09-25");
    expect(parseInvoiceDate("Date: 5 Oct 2026")).toBe("2026-10-05");
    expect(parseInvoiceDate("Ngày 09/10/2026")).toBe("2026-10-09");
    expect(parseInvoiceDate("TEL: 03-6222-8701")).toBe("");
  });
});

describe("Dựng hàng từ chữ PDF", () => {
  it("gom theo đường chữ, tách ô theo khoảng cách, trang trước đứng trước", () => {
    const rows = rowsFromTextItems([
      { str: "SIZE:", x: 60, y: 500, width: 22, height: 9 },
      { str: "2-3 gr/pc", x: 84, y: 500.6, width: 40, height: 9 },
      { str: "200", x: 260, y: 500, width: 15, height: 9 },
      { str: "2,000.00", x: 310, y: 500, width: 35, height: 9 },
      { str: "FROZEN IWADAKO BLANCHED CUT", x: 60, y: 512, width: 150, height: 9 },
      { str: "TOTAL", x: 60, y: 700, width: 30, height: 9, page: 2 },
      { str: " ", x: 95, y: 700, width: 3, height: 9, page: 2 },
    ]);
    expect(rows).toEqual([["FROZEN IWADAKO BLANCHED CUT"], ["SIZE: 2-3 gr/pc", "200", "2,000.00"], ["TOTAL"]]);
  });
});

const cl = (id: string, description: string, size: string, productId: string | undefined, unitPrice: number | null = null): ExportContractLine => ({
  id,
  description,
  hsCode: "",
  size,
  packing: "",
  unitKind: "carton",
  cartonsPerUnit: 1,
  netKgPerCarton: 10,
  quantity: 100,
  kg: 1000,
  unitPrice,
  microSpec: "",
  productId,
});

describe("Nối dòng invoice ↔ HĐ ↔ mặt hàng (AC-53)", () => {
  const lines = [
    cl("l1", "Frozen iwadako blanched cut", "2-3 gr/pc", "p-23", 10.5),
    cl("l2", "Frozen iwadako blanched cut", "5g ±0.5g gr/pc", "p-5g", 10.5),
    cl("l3", "Frozen tako tip raw", "", "p-tip", 2.0),
    cl("l4", "Frozen iidako open cut", "26-40 pcs/kg", undefined),
  ];
  const names = [{ customerId: "scm", productId: "p-io", tradeName: "Frozen iidako open cut", sizeText: "26-40 pcs/kg" }];
  const products = [{ id: "p-k", tradeName: "Frozen tako karaage" }];

  it("bậc HĐ tên + size tách hai size cùng tên", () => {
    expect(matchInvoiceLine({ description: "FROZEN IWADAKO BLANCHED CUT", size: "2-3 GR/PC" }, lines, "scm", names, products)).toEqual({ productId: "p-23", source: "contract", contractLineId: "l1" });
    expect(matchInvoiceLine({ description: "frozen iwadako blanched cut", size: "5g ±0.5g  gr/pc" }, lines, "scm", names, products).productId).toBe("p-5g");
    // Cùng tên, size không có trong HĐ ⇒ hai mặt hàng khác nhau ⇒ không đoán.
    expect(matchInvoiceLine({ description: "FROZEN IWADAKO BLANCHED CUT", size: "8-9 gr/pc" }, lines, "scm", names, products).productId).toBe("");
  });

  it("dòng HĐ chưa nối ⇒ tên của khách; không có ⇒ tên mặc định; không gì ⇒ trống", () => {
    expect(matchInvoiceLine({ description: "FROZEN IIDAKO OPEN CUT", size: "26-40 pcs/kg" }, lines, "scm", names, products)).toEqual({ productId: "p-io", source: "customer-name", contractLineId: "l4" });
    expect(matchInvoiceLine({ description: "FROZEN TAKO KARAAGE", size: "10-15 GR/PC" }, lines, "scm", names, products)).toEqual({ productId: "p-k", source: "trade-name", contractLineId: "" });
    expect(matchInvoiceLine({ description: "Something else", size: "" }, lines, "scm", names, products).productId).toBe("");
  });

  it("so với HĐ: dòng không có trong HĐ, đơn giá khác", () => {
    const inv = ok(INVOICE_234_26).invoice.lines;
    const matches = inv.map((l) => matchInvoiceLine(l, lines, "scm", names, products));
    const issues = compareInvoiceToContract(inv, matches, lines);
    expect(issues.find((x) => x.lineIndex === 0)).toBeUndefined();
    expect(issues.find((x) => x.lineIndex === 7)).toEqual({ lineIndex: 7, kind: "price-differs", message: "FROZEN TAKO TIP RAW: đơn giá invoice 2.15, hợp đồng 2" });
    expect(issues.filter((x) => x.kind === "not-in-contract").length).toBe(13 - 4);
  });
});

const item = (over: Partial<ExportStepItem> = {}): ExportStepItem => ({
  id: "i1",
  shipmentId: "s1",
  step: "document",
  docKind: "commercial-invoice",
  docForm: "",
  docIssuer: "",
  state: "in-progress",
  number: "",
  issuedOn: "",
  note: "",
  naReason: "",
  sharedFromId: "",
  cartons: null,
  netKg: null,
  amount: null,
  onBoardDate: "",
  createdAt: "",
  ...over,
});

describe("Điền mục Commercial Invoice (AC-54)", () => {
  const inv = ok(INVOICE_234_26).invoice;

  it("ô trống ⇒ điền số, ngày, 3 số tổng", () => {
    const r = fillInvoiceItem(item(), inv);
    expect(r.filled).toEqual(["number", "issuedOn", "cartons", "netKg", "amount"]);
    expect([r.item.number, r.item.issuedOn, r.item.cartons, r.item.netKg, r.item.amount]).toEqual(["234/26", "2026-09-25", 2251, 22214, 194557.6]);
    expect(r.conflicts).toEqual([]);
  });

  it("ô đã có số khác ⇒ không ghi đè, báo lệch; ô trùng ⇒ im", () => {
    const r = fillInvoiceItem(item({ number: "234 / 26", netKg: 22000, cartons: 2251 }), inv);
    expect(r.item.netKg).toBe(22000);
    expect(r.conflicts).toEqual([{ field: "netKg", current: 22000, invoice: 22214 }]);
    expect(r.filled).toEqual(["issuedOn", "amount"]);
  });

  it("dòng có mặt hàng ⇒ dòng cho trích xuất tên (mã HS trống)", () => {
    const xs = invoiceNameLines(inv.lines.slice(0, 2), ["p-23", ""]);
    expect(xs).toEqual([
      { productId: "p-23", description: "FROZEN IWADAKO BLANCHED CUT", size: "2-3 gr/pc", packing: "IQF, 1KG/PE x 10/CTN", hsCode: "" },
      { productId: undefined, description: "FROZEN IWADAKO BLANCHED CUT", size: "5g ±0.5g gr/pc", packing: "IQF, 1KG/PE x 10/CTN", hsCode: "" },
    ]);
  });
});

describe("File invoice của khách để trích xuất (AC-55)", () => {
  it("chỉ file Excel / PDF của mục Commercial Invoice, HĐ chưa hủy của đúng khách, HĐ ký trước đứng trước", async () => {
    const { invoiceFilesOfCustomer } = await import("./invoiceReader");
    const contract = (id: string, customerId: string, signedOn: string, status: "open" | "cancelled" = "open") => ({
      id, customerId, contractNo: id.toUpperCase(), signedOn, orderRef: "", status, cancelReason: "", closeReason: "", note: "", createdAt: signedOn,
    });
    const file = (id: string, contractId: string, stepItemId: string, fileName: string, createdAt = "2026-09-25") => ({
      id, contractId, shipmentId: "s", stepItemId, step: "document" as const, path: `p/${id}`, fileName, layerNo: null, caption: "", uploadedBy: "", createdAt,
    });
    const d = {
      contracts: [contract("c2", "scm", "2026-09-01"), contract("c1", "scm", "2026-07-30"), contract("c3", "scm", "2026-08-01", "cancelled"), contract("c4", "mat", "2026-07-01")],
      revisions: [],
      approvals: [],
      items: [item({ id: "inv1" }), item({ id: "inv2" }), item({ id: "inv3" }), item({ id: "inv4" }), item({ id: "pl", docKind: "packing-list" })],
      files: [
        file("f1", "c2", "inv2", "INV 240-26.xlsx"),
        file("f2", "c1", "inv1", "INV 234-26 scan.pdf"),
        file("f3", "c1", "inv1", "INV 234-26.jpg"),
        file("f4", "c3", "inv3", "huy.xlsx"),
        file("f5", "c4", "inv4", "khac.xlsx"),
        file("f6", "c1", "pl", "packing.xlsx"),
      ],
    };
    expect(invoiceFilesOfCustomer(d, "scm").map((x) => [x.contractNo, x.file.id])).toEqual([
      ["C1", "f2"],
      ["C2", "f1"],
    ]);
  });
});
