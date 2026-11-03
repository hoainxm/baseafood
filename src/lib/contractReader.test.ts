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
  parseShipmentDeadline,
  type ExportContractFillValues,
  type ExportFillContext,
  type ReadContract,
} from "./contractReader";
import { rowsFromDocxXml } from "./contractFileReader";
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

  it("AC-8 file không đọc được trả đúng lý do", () => {
    expect(contractFileProblem("HD cu.doc")).toBe("old-word");
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
  });

  it("rowsFromDocxXml: đoạn văn, bảng, ô gộp ngang, ký tự đặc biệt", () => {
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>THE BUYER: A &amp; B CO.,LTD</w:t></w:r></w:p>' +
      "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Number</w:t></w:r><w:r><w:br/><w:t>pcs/kg</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Size</w:t></w:r></w:p></w:tc></w:tr>" +
      '<w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t xml:space="preserve">Total </w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>&lt; 5</w:t></w:r></w:p></w:tc></w:tr></w:tbl>' +
      "<w:p/><w:p><w:r><w:t>Time of shipment</w:t></w:r></w:p></w:body></w:document>";
    expect(rowsFromDocxXml(xml)).toEqual([["THE BUYER: A & B CO.,LTD"], ["Number pcs/kg", "Size"], ["Total", "", "< 5"], ["Time of shipment"]]);
  });
});
