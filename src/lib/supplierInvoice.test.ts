// AC của ba-spec 51 (docs/app-map/51-supplier-invoice-matching.ba-spec.md §10) — số thật tháng 10/2026.
import { describe, expect, it } from "vitest";
import type { AccountingCodeMap, MaterialImportItem, Supplier, SupplierInvoice, SupplierInvoiceLine } from "@/types";
import {
  accountingCodeMapId,
  applyInvoiceToTripLine,
  buildTripsFromInvoice,
  excelDateToIso,
  indexLinesByTripLine,
  lineStateNow,
  matchPdfToInvoice,
  parseDeliveryNote,
  parseInvoiceFileName,
  parseLedgerSheets,
  parseVatInvoiceText,
  planLedgerImport,
  supplierInvoiceId,
  tripInvoiceInfo,
  type LedgerRow,
} from "./supplierInvoice";

const ONE = "Bạch tuộc 1 da";
const SMALL = "Bạch tuộc 2 da nhỏ (80↓)";
const LARGE = "Bạch tuộc 2 da lớn (80↑)";
const MAT: Record<string, string> = { "1": "BT-1DANL", s: "BT-2DA<100", l: "BT-2DA>100" };

const maps: AccountingCodeMap[] = [
  ...[
    ["HONG-PHU", "Hồng Phú"],
    ["HOACHUONG", "Bé 3"],
    ["HUONGPHAP", "Hương Pháp"],
    ["LANGHUYNH", "Mậu"],
  ].map(([code, targetName]) => ({ id: accountingCodeMapId("supplier", code), kind: "supplier" as const, code, targetName })),
  ...[
    ["BT-1DANL", ONE],
    ["BT-2DA<100", SMALL],
    ["BT-2DA>100", LARGE],
  ].map(([code, targetName]) => ({ id: accountingCodeMapId("material", code), kind: "material" as const, code, targetName })),
];

/** Dòng sổ chi tiết: [mã đại lý, số HĐ, NGAY dd, Ngày HĐ dd, loại 1|s|l, kg, giá, biển số] — tháng 10/2026. */
type R = [string, string, number, number, string, number, number, string?];
const day = (d: number) => `2026-10-${String(d).padStart(2, "0")}`;
const ledger = (rs: R[]): LedgerRow[] =>
  rs.map(([c, inv, ng, nh, t, kg, pr, pl = ""], i) => ({
    sheet: t,
    rowNo: i + 2,
    postingDate: day(ng),
    voucherNo: `${i}/008/10`,
    content: "",
    supplierCode: c,
    materialCode: MAT[t],
    quantityKg: kg,
    unitPrice: pr,
    amount: kg * pr,
    invoiceNo: inv,
    deliveryDate: day(nh),
    driverName: "",
    licensePlate: pl,
  }));

/** Dòng sổ Nhập hàng: [id, đại lý, ngày, loại, kg, giá, biển số]. */
type T = [string, string, number, string, number, number | null, string?];
const trips = (ts: T[]): MaterialImportItem[] =>
  ts.map(([id, sup, d, mat, kg, pr, pl = ""]) => ({
    id,
    shipmentId: `s-${sup}-${d}-${pl}`,
    deliveryDate: day(d),
    workshop: "Đông",
    category: "Bạch tuộc",
    supplierName: sup,
    materialTypeName: mat,
    quantityKg: kg,
    unitPrice: pr,
    driverName: "",
    licensePlate: pl,
    note: "",
    balancingPeriodId: "",
  }));

const HP_0110 = trips([
  ["hp1", "Hồng Phú", 1, ONE, 1707, 152000, "72'B-04168"],
  ["hp2", "Hồng Phú", 1, LARGE, 2053, 140000, "72'B-04168"],
  ["hp3", "Hồng Phú", 1, SMALL, 75, 133000, "72'B-04168"],
]);
const L936 = ledger([
  ["HONG-PHU", "936", 2, 1, "1", 1707, 152000, "72B 04168"],
  ["HONG-PHU", "936", 2, 1, "s", 75, 133000, "72B 04168"],
  ["HONG-PHU", "936", 2, 1, "l", 2053, 140000, "72B 04168"],
]);

const plan = (rows: LedgerRow[], tripLines: MaterialImportItem[], prev?: { invoices: SupplierInvoice[]; lines: SupplierInvoiceLine[] }) =>
  planLedgerImport({ ledgerRows: rows, maps, tripLines, existingInvoices: prev?.invoices ?? [], existingLines: prev?.lines ?? [] });
const saved = (p: ReturnType<typeof plan>) => ({ invoices: p.invoices, lines: p.lines.map((l) => l.line) });

describe("đọc file", () => {
  it("sheet sổ chi tiết: tiêu đề, ngày serial, tài xế + biển số trong NOI DUNG", () => {
    const header = ["CTGS", "NGAY", "PHIEU", "NOI DUNG", "TK_DU", "MADM", "DG_Nhap", "SL_Nhap", "STien_Nhap", "DG_Xuat", "SL_Xuat", "STien_Xuat", "SLg", "Đ.giá", "Số tiền", "TK nợ", "DM nợ", "kho nợ", "TK có", "DM có", "kho có", "KH", "Số HĐ", "Ngày HĐ"];
    const row = ["008", 46297, "03/008/10", "Nhập kho NL tháng 10/2026 : 1707kg BT 1 da NL ; HĐ 936 (người giao Phạm Hoàng Khánh - số xe 72B 04168)", "331N", "HONG-PHU", 152000, 1707, 259464000, 0, 0, 0, 1707, 152000, 259464000, "15211", "BT-1DANL", null, "331N", "HONG-PHU", null, null, 936, 46296];
    const { rows, warnings } = parseLedgerSheets([{ name: "1 da", rows: [header, row, []] }]);
    expect(warnings).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ postingDate: "2026-10-02", deliveryDate: "2026-10-01", invoiceNo: "936", supplierCode: "HONG-PHU", materialCode: "BT-1DANL", quantityKg: 1707, unitPrice: 152000, driverName: "Phạm Hoàng Khánh", licensePlate: "72B 04168" });
  });

  it("ngày: serial, chuỗi, Date", () => {
    expect(excelDateToIso(46296)).toBe("2026-10-01");
    expect(excelDateToIso("01/10/2026")).toBe("2026-10-01");
    expect(excelDateToIso(new Date(2026, 9, 1, 0, 0, 30))).toBe("2026-10-01");
    expect(parseDeliveryNote("75kg BT 1 da NL ; HĐ 939")).toEqual({ driverName: "", licensePlate: "" });
  });

  it("AC-11 — PDF 936: tên file + chữ trên hóa đơn", () => {
    expect(parseInvoiceFileName("936_1C26THP_3500424838.pdf")).toEqual({ invoiceNo: "936", invoiceSymbol: "1C26THP", sellerTaxId: "3500424838" });
    const pdf = parseVatInvoiceText(PDF_936);
    expect(pdf).toMatchObject({ invoiceNo: "936", invoiceSymbol: "1C26THP", issueDate: "2026-10-02", sellerTaxId: "3500424838", buyerTaxId: "3502297423", subtotal: 556859000, vatAmount: 0, totalAmount: 556859000 });
    expect(pdf.lines.map((l) => [l.quantity, l.unitPrice, l.amount])).toEqual([
      [1707, 152000, 259464000],
      [2053, 140000, 287420000],
      [75, 133000, 9975000],
    ]);
  });
});

describe("ghép sổ chi tiết ⇄ chuyến", () => {
  it("AC-1 — HĐ 936 ghép đủ 3 dòng chuyến Hồng Phú 01/10", () => {
    const p = plan(L936, HP_0110);
    expect(p.lines.filter((l) => l.state === "matched")).toHaveLength(3);
    expect(new Set(p.lines.map((l) => l.line.tripLineId))).toEqual(new Set(["hp1", "hp2", "hp3"]));
    expect(p.invoices).toHaveLength(1);
    expect(p.invoices[0].id).toBe(supplierInvoiceId("HONG-PHU", 2026, "936"));
  });

  it("AC-2 — lệch giá được báo, số chuyến không đổi", () => {
    const t = HP_0110.map((x) => (x.id === "hp1" ? { ...x, unitPrice: 154000 } : x));
    const p = plan(L936, t);
    const l = p.lines.find((x) => x.line.tripLineId === "hp1")!;
    expect(l.state).toBe("price-mismatch");
    expect([l.line.unitPrice, l.tripPrice]).toEqual([152000, 154000]);
    expect(t.find((x) => x.id === "hp1")!.unitPrice).toBe(154000);
  });

  it("AC-3 — cập nhật theo HĐ để dòng vết, ngày đã chốt ghi rõ", () => {
    const trip = { ...HP_0110[0], unitPrice: 154000 };
    const line = plan(L936, [trip, ...HP_0110.slice(1)]).lines.find((x) => x.line.tripLineId === "hp1")!.line;
    const next = applyInvoiceToTripLine(trip, line, { invoiceNo: "936", stamp: "30/10/2026 14:05", editor: "Trúc", dayLocked: true });
    expect(next.unitPrice).toBe(152000);
    expect(next.note).toContain("[Sửa theo HĐ 936");
    expect(next.note).toContain("SAU KHI CHỐT NGÀY 01/10/2026");
    expect(next.note).toContain("giá 154.000 → 152.000");
    expect(applyInvoiceToTripLine(next, line, { invoiceNo: "936", stamp: "", editor: "", dayLocked: false })).toBe(next);
  });

  it("AC-4 — giữ số xưởng: lệch đã giải trình, số chuyến không đổi", () => {
    const t = HP_0110.map((x) => (x.id === "hp3" ? { ...x, quantityKg: 80 } : x));
    const p = plan(L936, t);
    const l = p.lines.find((x) => x.line.tripLineId === "hp3")!;
    expect(l.state).toBe("quantity-mismatch");
    const inv = p.invoices[0];
    const explained = { ...l.line, resolution: "explained" as const, resolutionReason: "cân xưởng đúng" };
    expect(lineStateNow(explained, inv, new Map(t.map((x) => [x.id, x])))).toBe("explained");
    expect(t.find((x) => x.id === "hp3")!.quantityKg).toBe(80);
  });

  it("AC-5 — Bé 3 HĐ 247 gộp 3 chuyến 09, 10, 11/10", () => {
    const t = trips([
      ["b9s", "Bé 3", 9, SMALL, 65, 134000],
      ["b9l", "Bé 3", 9, LARGE, 106, 140000],
      ["b10s", "Bé 3", 10, SMALL, 541, 134000],
      ["b10l", "Bé 3", 10, LARGE, 562, 140000],
      ["b11s", "Bé 3", 11, SMALL, 429, 134000],
      ["b11l", "Bé 3", 11, LARGE, 728, 140000],
    ]);
    const p = plan(
      ledger([
        ["HOACHUONG", "247", 12, 9, "s", 65, 134000],
        ["HOACHUONG", "247", 12, 11, "s", 429, 134000],
        ["HOACHUONG", "247", 12, 10, "s", 541, 134000],
        ["HOACHUONG", "247", 12, 10, "l", 562, 140000],
        ["HOACHUONG", "247", 12, 9, "l", 106, 140000],
        ["HOACHUONG", "247", 12, 11, "l", 728, 140000],
      ]),
      t,
    );
    expect(p.lines.filter((l) => l.state === "matched")).toHaveLength(6);
    expect(new Set(p.lines.map((l) => t.find((x) => x.id === l.line.tripLineId)!.deliveryDate)).size).toBe(3);
  });

  it("AC-6 — số HĐ 242 trùng giữa Hương Pháp và Bé 3 không lẫn", () => {
    const t = trips([
      ["hp12a", "Hương Pháp", 12, ONE, 3352, 142000],
      ["hp12b", "Hương Pháp", 12, SMALL, 55, 131000],
      ["b2s", "Bé 3", 2, SMALL, 750, 134000],
      ["b2l", "Bé 3", 2, LARGE, 661, 140000],
    ]);
    const p = plan(
      ledger([
        ["HUONGPHAP", "242", 13, 12, "1", 3352, 142000],
        ["HUONGPHAP", "242", 13, 12, "s", 55, 131000],
        ["HOACHUONG", "242", 9, 2, "s", 750, 134000],
        ["HOACHUONG", "242", 9, 2, "l", 661, 140000],
      ]),
      t,
    );
    expect(p.invoices.map((i) => i.id).sort()).toEqual([supplierInvoiceId("HOACHUONG", 2026, "242"), supplierInvoiceId("HUONGPHAP", 2026, "242")]);
    const hpId = supplierInvoiceId("HUONGPHAP", 2026, "242");
    for (const l of p.lines.filter((x) => x.invoiceId === hpId)) expect(t.find((x) => x.id === l.line.tripLineId)!.supplierName).toBe("Hương Pháp");
  });

  it("AC-7 — hai dòng cùng loại khác giá trong một chuyến (HĐ 1016)", () => {
    const t = trips([
      ["a", "Hồng Phú", 20, SMALL, 285, 133000],
      ["b", "Hồng Phú", 20, SMALL, 76, 135000],
    ]);
    const p = plan(
      ledger([
        ["HONG-PHU", "1016", 21, 20, "s", 76, 135000],
        ["HONG-PHU", "1016", 21, 20, "s", 285, 133000],
      ]),
      t,
    );
    expect(p.lines.map((l) => [l.line.quantityKg, l.line.tripLineId, l.state])).toEqual([
      [76, "b", "matched"],
      [285, "a", "matched"],
    ]);
  });

  it("hai lượt cùng ngày cùng loại, kg đều lệch ⇒ phân bằng biển số", () => {
    const t = trips([
      ["x", "Hồng Phú", 10, SMALL, 1700, 133000, "72C-16603"],
      ["y", "Hồng Phú", 10, SMALL, 250, 133000, "72C-14510"],
    ]);
    const p = plan(
      ledger([
        ["HONG-PHU", "982", 12, 10, "s", 256, 133000, "72C 14510"],
        ["HONG-PHU", "982", 12, 10, "s", 1721, 133000, "72C 16603"],
      ]),
      t,
    );
    expect(p.lines.map((l) => [l.line.tripLineId, l.state])).toEqual([
      ["y", "quantity-mismatch"],
      ["x", "quantity-mismatch"],
    ]);
  });

  it("AC-8 — HĐ không có chuyến ⇒ tạo chuyến ghi bù rồi khớp", () => {
    const rows = ledger([
      ["HOACHUONG", "242", 9, 1, "s", 2201, 134000, "86A 20964"],
      ["HOACHUONG", "242", 9, 1, "l", 1669, 140000, "86A 20964"],
    ]);
    const p = plan(rows, []);
    expect(p.lines.filter((l) => l.state === "no-trip")).toHaveLength(2);
    let n = 0;
    const [made] = buildTripsFromInvoice({
      invoice: p.invoices[0],
      lines: p.lines.map((l) => l.line),
      materialByCode: new Map(maps.filter((m) => m.kind === "material").map((m) => [m.code, m.targetName])),
      categoryOf: () => "Bạch tuộc",
      workshop: "Đông",
      postingDate: "2026-10-30",
      operator: "Trúc",
      lotCodeFor: (d, k) => `Đ-${d}-${k}`,
      newId: () => `new${++n}`,
    });
    expect(made.shipment).toMatchObject({ deliveryDate: "2026-10-01", postingDate: "2026-10-30", supplierName: "Bé 3", licensePlate: "86A 20964", operator: "Trúc" });
    expect(made.shipment.backdateReason.startsWith("Theo HĐ 242")).toBe(true);
    expect(made.items).toHaveLength(2);
    const after = plan(rows, made.items, saved(p));
    expect(after.lines.filter((l) => l.state === "no-trip")).toHaveLength(0);
    expect(after.lines.filter((l) => l.state === "matched")).toHaveLength(2);
  });

  it("AC-9 — HĐ đã xếp 'Không thuộc chuyến' giữ nguyên khi nạp lại", () => {
    const rows = ledger([["HONG-PHU", "978", 10, 10, "s", 20515, 134000]]);
    const first = saved(plan(rows, []));
    first.invoices = first.invoices.map((i) => ({ ...i, classification: "not-trip" as const }));
    const again = plan(rows, trips([["z", "Hồng Phú", 10, SMALL, 20515, 134000]]), first);
    expect(again.lines.map((l) => l.state)).toEqual(["not-trip"]);
    expect(again.lines[0].line.tripLineId).toBe("");
  });

  it("AC-10 — nạp lại không nhân đôi, báo dòng đổi", () => {
    const rows = ledger([["HONG-PHU", "1040", 27, 26, "s", 960, 134000, "72C 16247"]]);
    const first = saved(plan(rows, []));
    const same = plan(rows, [], first);
    expect(same.lines.map((l) => l.change)).toEqual(["same"]);
    expect(same.lines.map((l) => l.line.id)).toEqual(first.lines.map((l) => l.id));
    const changed = plan(ledger([["HONG-PHU", "1040", 27, 26, "s", 980, 134000, "72C 16247"]]), [], first);
    expect(changed.lines.filter((l) => l.change === "changed")).toHaveLength(1);
    expect(changed.lines).toHaveLength(1);
  });

  it("nạp lại: dòng biến khỏi file ⇒ 'Không còn trong file', liên kết giữ", () => {
    const first = saved(plan(L936, HP_0110));
    const again = plan(L936.slice(0, 2), HP_0110, first);
    const gone = again.lines.filter((l) => l.change === "missing");
    expect(gone).toHaveLength(1);
    expect(gone[0].line.missingFromFile).toBe(true);
    expect(gone[0].line.tripLineId).toBe("hp2");
  });

  it("R5 — dòng chuyến đã gắn HĐ khác không bị gắn lần hai", () => {
    const first = saved(plan(L936, HP_0110));
    const dup = plan(ledger([["HONG-PHU", "999", 3, 1, "1", 1707, 152000]]), HP_0110, first);
    expect(dup.lines[0].state).toBe("no-trip");
  });

  it("mã chưa ánh xạ ⇒ không ghép, báo mã", () => {
    const p = plan(ledger([["VYPHAT", "785", 9, 9, "l", 7740, 142000]]), []);
    expect(p.lines[0].state).toBe("unmapped");
    expect(p.unmapped.suppliers).toEqual(["VYPHAT"]);
  });
});

describe("PDF ⇄ HĐ", () => {
  const suppliers = (taxId: string): Supplier[] => [
    { id: "s1", code: "", shortName: "Hồng Phú", billingName: "CÔNG TY TNHH TM HỒNG PHÚ", address: "", nationalId: taxId, issuedDate: "", issuedPlace: "", phone: "", email: "", bankAccount: "", bankName: "", bankBranch: "", note: "" },
  ];
  it("AC-11 — PDF gắn HĐ 936, kiểm chéo khớp", () => {
    const p = saved(plan(L936, HP_0110));
    const m = matchPdfToInvoice(parseVatInvoiceText(PDF_936), p.invoices, p.lines, suppliers("3500424838"));
    expect(m).toEqual({ invoiceId: supplierInvoiceId("HONG-PHU", 2026, "936"), warnings: [] });
  });
  it("AC-12 — MST danh mục khác hóa đơn ⇒ vẫn ghép, cảnh báo", () => {
    const p = saved(plan(L936, HP_0110));
    const list = suppliers("3500424848");
    const m = matchPdfToInvoice(parseVatInvoiceText(PDF_936), p.invoices, p.lines, list);
    expect(m.warnings).toEqual(["tax-id-mismatch"]);
    expect(list[0].nationalId).toBe("3500424848");
  });
  it("PDF lệch sổ ⇒ cảnh báo pdf-mismatch", () => {
    const p = saved(plan(L936.slice(0, 2), HP_0110));
    expect(matchPdfToInvoice(parseVatInvoiceText(PDF_936), p.invoices, p.lines, suppliers("3500424838")).warnings).toEqual(["pdf-mismatch"]);
  });
});

describe("AC-13 — trạng thái HĐ của chuyến", () => {
  it("Chờ HĐ · Đã có HĐ · Lệch HĐ · Đã có HĐ (dòng Nút không xét, chưa có file)", () => {
    const mapped = new Set([ONE, SMALL, LARGE]);
    const hm = trips([["hm", "Huỳnh Mừng", 15, ONE, 56, 99000]]);
    const hpPlan = plan(L936, HP_0110);
    const hpInv = { ...hpPlan.invoices[0], filePath: "x.pdf" };
    const hpa = trips([["hpa", "Hương Pháp", 6, ONE, 2318, 142000]]);
    const hpaPlan = plan(ledger([["HUONGPHAP", "229", 8, 6, "1", 2318, 144000]]), hpa);
    const lh = trips([
      ["m1", "Mậu", 2, LARGE, 1563, 140000],
      ["m2", "Mậu", 2, SMALL, 32, 134000],
      ["m3", "Mậu", 2, "Nút", 35, 105000],
    ]);
    const lhPlan = plan(
      ledger([
        ["LANGHUYNH", "628", 5, 2, "s", 32, 134000],
        ["LANGHUYNH", "628", 5, 2, "l", 1563, 140000],
      ]),
      lh,
    );
    const lines = [...hpPlan.lines, ...hpaPlan.lines, ...lhPlan.lines].map((l) => l.line);
    const byTrip = indexLinesByTripLine(lines);
    const invs = new Map([hpInv, ...hpaPlan.invoices, ...lhPlan.invoices].map((i) => [i.id, i]));
    const st = [hm, HP_0110, hpa, lh].map((t) => tripInvoiceInfo(t, byTrip, invs, mapped));
    expect(st.map((s) => s?.status)).toEqual(["awaiting", "complete", "mismatch", "complete"]);
    expect(st[3]?.noFile).toBe(true);
    expect(st[1]?.invoiceNos).toEqual(["936"]);
    expect(tripInvoiceInfo(trips([["n", "Mậu", 2, "Nút", 35, 105000]]), byTrip, invs, mapped)).toBeNull();
  });
});

/** Chữ PDF 936 (Hồng Phú, 02/10/2026) như đọc ra theo dòng. */
const PDF_936 = [
  "HÓA ĐƠN GIÁ TRỊ GIA TĂNG Ký hiệu (Serial): 1C26THP",
  "(VAT INVOICE) Số (No.): 936",
  "Ngày (Date) 02 tháng (month) 10 năm (year) 2026",
  "Đơn vị bán hàng (Seller): CÔNG TY TNHH THƯƠNG MẠI HỒNG PHÚ",
  "Mã số thuế (Tax code): 3 5 0 0 4 2 4 8 3 8",
  "Tài khoản (A/C number): 08001010051219 Tại Ngân hàng TMCP Hàng Hải Việt Nam - CN Vũng Tàu",
  "Tên đơn vị (Company name): CÔNG TY TNHH BASEAFOOD 1",
  "Mã số thuế (Tax code): 3502297423",
  "STT Tên hàng hóa, dịch vụ Đơn vị tính Số lượng Đơn giá Thành tiền",
  "(1) (2) (3) (4) (5) (6)=(4)x(5)",
  "1 Bạch tuộc nguyên liệu Kg 1.707 152.000 259.464.000",
  "2 Bạch tuộc nguyên liệu Kg 2.053 140.000 287.420.000",
  "3 Bạch tuộc nguyên liệu Kg 75 133.000 9.975.000",
  "Cộng tiền hàng (Sub total): 556.859.000",
  "Thuế suất GTGT (VAT rate): KKKNT Tiền thuế GTGT (VAT amount): 0",
  "Tổng cộng tiền thanh toán (Total payment): 556.859.000",
  "Mã của cơ quan thuế (Tax authority code): 00F90DD256EDD14F2F990DD550DAB19A86",
];
