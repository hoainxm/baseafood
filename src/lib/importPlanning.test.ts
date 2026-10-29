// Oracle: docs/app-map/45-import-planning.ba-spec.md — AC-3…AC-18 (hàm thuần).
import { describe, expect, it } from "vitest";
import type { ImportContract, ImportContractLine, ImportDocument, ImportFile, ImportReceipt, ImportReceiptLine } from "@/types";
import {
  canClose,
  canDeleteImportSupplier,
  emptyImportSupplier,
  selectableImportSuppliers,
  validateImportSupplier,
  canDeleteDocument,
  canDeleteReceipt,
  canMarkNotApplicable,
  closeGate,
  contractState,
  contractTotals,
  documentHasEvidence,
  importMonth,
  lineAmount,
  missingDocs,
  monthView,
  quantityWarnings,
  receiptState,
  remainingKg,
  requiredDocumentStubs,
  searchImports,
  suggestImportProductId,
  unlinkedLines,
  productNameAfterPick,
  validateContract,
  validateReceipt,
  type ImportData,
} from "./importPlanning";
import { IMPORT_CONTRACT_LINE_TABLE } from "./repo";

const NOW = "2026-10-29T08:00:00.000Z";

function contract(p: Partial<ImportContract> = {}): ImportContract {
  return {
    id: "c1",
    supplierId: "s1",
    supplierName: "Ocean Fresh Co.",
    contractNo: "AB-01",
    signedDate: "2026-10-01",
    importType: "processing",
    currency: "USD",
    linePrices: {},
    status: "open",
    closeReason: "",
    cancelReason: "",
    note: "",
    createdAt: NOW,
    ...p,
  };
}
const line = (id: string, kg: number | null, p: Partial<ImportContractLine> = {}): ImportContractLine => ({
  id,
  contractId: "c1",
  lineNo: 1,
  productName: `Hàng ${id}`,
  productId: `prod-${id}`,
  kg,
  note: "",
  ...p,
});
function receipt(id: string, p: Partial<ImportReceipt> = {}): ImportReceipt {
  return {
    id,
    contractId: "c1",
    contractNo: "AB-01",
    supplierName: "Ocean Fresh Co.",
    arrivalDate: "2026-11-02",
    expectedDate: "",
    transport: "40RF",
    containerNo: "",
    blNo: "",
    status: "open",
    cancelReason: "",
    note: "",
    createdAt: NOW,
    ...p,
  };
}
const qty = (receiptId: string, contractLineId: string, kg: number): ImportReceiptLine => ({
  id: `${receiptId}-${contractLineId}`,
  receiptId,
  contractLineId,
  kg,
  recordedBy: "",
  updatedAt: NOW,
});
const file = (id: string, documentId: string, receiptId = "r1"): ImportFile => ({
  id,
  contractId: "c1",
  receiptId,
  documentId,
  path: `p/${id}`,
  fileName: `${id}.pdf`,
  uploadedBy: "",
  createdAt: NOW,
});
let seq = 0;
const stubs = (receiptId: string) => requiredDocumentStubs(receiptId, "processing", () => `${receiptId}-d${++seq}`, NOW);

/** 3 chứng từ bắt buộc đã đủ (mỗi mục 1 file, tờ khai có số + loại hình). */
function fullDocs(receiptId: string): { documents: ImportDocument[]; files: ImportFile[] } {
  const documents = stubs(receiptId).map((d) => (d.kind === "import-declaration" ? { ...d, docNo: "105123456789" } : d));
  return { documents, files: documents.map((d) => file(`f-${d.id}`, d.id, receiptId)) };
}

function data(p: Partial<ImportData> = {}): ImportData {
  return { contracts: [contract()], lines: [], receipts: [], receiptLines: [], documents: [], files: [], ...p };
}

describe("AC-3 / AC-4 — tổng hợp đồng (R2)", () => {
  it("AC-3 tổng kg và tổng tiền", () => {
    const lines = [line("l1", 10000), line("l2", 5000)];
    expect(contractTotals(lines, { l1: 2.5, l2: 3 })).toEqual({ totalKg: 15000, totalAmount: 40000 });
  });
  it("AC-4 HĐ gia công không ghi giá vẫn lưu", () => {
    const lines = [line("l1", 8000), line("l2", 2000)];
    const prices = { l1: null, l2: 1.25 };
    expect(validateContract(contract(), lines, [])).toHaveLength(0);
    expect(lineAmount(lines[0], prices)).toBeNull();
    expect(contractTotals(lines, prices)).toEqual({ totalKg: 10000, totalAmount: 2500 });
    expect(contractTotals(lines, {}).totalAmount).toBeNull();
  });
});

describe("AC-5 — thiếu trường bắt buộc / trùng số HĐ (R3)", () => {
  const ok = [line("l1", 100)];
  const codes = (issues: { code: string }[]) => issues.map((i) => i.code);
  it("thiếu loại hình", () => expect(codes(validateContract(contract({ importType: "" }), ok, []))).toEqual(["import-type"]));
  it("0 dòng", () => expect(codes(validateContract(contract(), [], []))).toEqual(["no-lines"]));
  it("dòng kg = 0", () => expect(codes(validateContract(contract(), [line("l1", 0)], []))).toEqual(["line-kg"]));
  it("trùng số theo đối tác, không phân hoa thường, bỏ khoảng trắng", () => {
    const others = [contract({ id: "c0", contractNo: "AB-01" })];
    expect(codes(validateContract(contract({ id: "c2", contractNo: " ab-01 " }), ok, others))).toEqual(["duplicate-no"]);
    // khác đối tác hoặc HĐ cũ đã hủy ⇒ không trùng
    expect(validateContract(contract({ id: "c2", supplierId: "s2" }), ok, others)).toHaveLength(0);
    expect(validateContract(contract({ id: "c2" }), ok, [contract({ id: "c0", status: "cancelled" })])).toHaveLength(0);
  });
});

describe("AC-6 — tháng của lần nhập (R1)", () => {
  it("ngày về kho thắng ngày dự kiến; thiếu cả hai bị chặn", () => {
    expect(importMonth({ arrivalDate: "2026-11-02", expectedDate: "2026-10-28" })).toBe("2026-11");
    expect(importMonth({ arrivalDate: "", expectedDate: "2026-10-28" })).toBe("2026-10");
    const issues = validateReceipt({ contractId: "c1", arrivalDate: "", expectedDate: "" }, contract(), true);
    expect(issues.map((i) => i.code)).toEqual(["no-date"]);
  });
});

describe("AC-7 … AC-10 — chứng từ (R4)", () => {
  it("AC-7 lần nhập mới thiếu đúng 3 chứng từ; HĐ sang Đang nhập", () => {
    const r = receipt("r1");
    const d0 = data();
    expect(contractState(d0, d0.contracts[0])).toBe("no-receipts");
    const d = data({ receipts: [r], documents: stubs("r1") });
    expect(missingDocs(d, "r1")).toEqual(["commercial-invoice", "packing-list", "import-declaration"]);
    expect(receiptState(d, r)).toBe("missing-docs");
    expect(contractState(d, d.contracts[0])).toBe("receiving");
  });
  it("AC-8 mục chỉ Đã có khi có bằng chứng", () => {
    const [inv, , decl] = stubs("r1");
    const a = { ...inv, docNo: "INV-77", docDate: "2026-10-20" };
    const c = { ...decl, importType: "" as const, docNo: "105" };
    const dd = { ...decl, docNo: "105123456789" };
    const files = [file("fb", inv.id), file("fc", decl.id)];
    const d = { files };
    expect([
      documentHasEvidence({ files: [] }, a),
      documentHasEvidence(d, inv),
      documentHasEvidence(d, c),
      documentHasEvidence(d, dd),
    ]).toEqual([false, true, false, true]);
  });
  it("không nối máy chủ ⇒ số chứng từ / ghi chú tính thay file", () => {
    const [inv, , decl] = stubs("r1");
    const off = { files: [], filesAvailable: false };
    expect(documentHasEvidence(off, inv)).toBe(false);
    expect(documentHasEvidence(off, { ...inv, docNo: "INV-77" })).toBe(true);
    expect(documentHasEvidence(off, { ...decl, docNo: "105", importType: "" })).toBe(false);
  });
  it("AC-9 Không áp dụng phải có lý do", () => {
    expect(canMarkNotApplicable("  ").ok).toBe(false);
    const docs = stubs("r1").map((x) => (x.kind === "commercial-invoice" ? { ...x, notApplicable: true, naReason: "hàng mẫu" } : x));
    expect(missingDocs(data({ documents: docs }), "r1")).not.toContain("commercial-invoice");
    const noReason = stubs("r1").map((x) => (x.kind === "commercial-invoice" ? { ...x, notApplicable: true } : x));
    expect(missingDocs(data({ documents: noReason }), "r1")).toContain("commercial-invoice");
  });
  it("AC-10 C/O, kiểm dịch, B/L không bắt; mục bắt buộc không xóa được", () => {
    const d = data({ receipts: [receipt("r1")], ...fullDocs("r1") });
    expect(missingDocs(d, "r1")).toHaveLength(0);
    expect(canDeleteDocument({ kind: "commercial-invoice" })).toBe(false);
    expect(canDeleteDocument({ kind: "certificate-of-origin" })).toBe(true);
  });
});

describe("AC-11 … AC-13 — thực nhập (R5, R6)", () => {
  it("AC-11 Chờ thực nhập rồi Đủ hồ sơ", () => {
    const r = receipt("r1");
    const before = data({ lines: [line("l1", 10000)], receipts: [r], ...fullDocs("r1") });
    expect(receiptState(before, r)).toBe("awaiting-quantity");
    const after = { ...before, receiptLines: [qty("r1", "l1", 6000)] };
    expect(receiptState(after, r)).toBe("complete");
  });
  it("AC-12 còn lại theo dòng, vượt HĐ chỉ cảnh báo", () => {
    const d = data({
      lines: [line("l1", 10000)],
      receipts: [receipt("r1"), receipt("r2")],
      receiptLines: [qty("r1", "l1", 6000), qty("r2", "l1", 4200)],
    });
    expect(remainingKg(d, "l1")).toBe(-200);
    expect(quantityWarnings(d, "r2")).toEqual([{ code: "over-contract", contractLineId: "l1", overKg: 200, blocking: false }]);
  });
  it("AC-13 lần nhập đã hủy không tính", () => {
    const d = data({
      lines: [line("l1", 10000)],
      receipts: [receipt("r1"), receipt("r2", { status: "cancelled", cancelReason: "ghi nhầm" })],
      receiptLines: [qty("r1", "l1", 6000), qty("r2", "l1", 4000)],
    });
    expect(remainingKg(d, "l1")).toBe(4000);
    expect(monthView(d, "2026-11").stats.total).toBe(1);
  });
});

describe("AC-14 / AC-15 — đóng HĐ (R7)", () => {
  const base = () =>
    data({
      lines: [line("l1", 1000), line("l2", 2000, { lineNo: 2 })],
      receipts: [receipt("r1")],
      receiptLines: [qty("r1", "l1", 1000), qty("r1", "l2", 1500)],
    });
  it("AC-14 còn thiếu ⇒ bắt lý do; đã đóng ⇒ không ghi lần nhập mới; mở lại", () => {
    const d = base();
    expect(canClose(d, "c1", "")).toEqual({ ok: false, needsReason: true });
    expect(canClose(d, "c1", "đối tác giao thiếu").ok).toBe(true);
    const closed = { ...d, contracts: [contract({ status: "closed", closeReason: "đối tác giao thiếu" })] };
    expect(contractState(closed, closed.contracts[0])).toBe("closed");
    expect(validateReceipt({ contractId: "c1", arrivalDate: "2026-11-20", expectedDate: "" }, closed.contracts[0], true).map((i) => i.code)).toEqual([
      "contract-closed",
    ]);
    const reopened = { ...closed, contracts: [contract({ status: "open" })] };
    expect(contractState(reopened, reopened.contracts[0])).toBe("receiving");
  });
  it("AC-15 về đủ mọi dòng ⇒ đóng không cần lý do; chưa có lần nhập ⇒ chưa đóng được", () => {
    const d = { ...base(), receiptLines: [qty("r1", "l1", 1000), qty("r1", "l2", 2000)] };
    expect(closeGate(d, "c1")).toEqual({ ok: true, needsReason: false });
    expect(closeGate(data({ lines: [line("l1", 1000)] }), "c1")).toEqual({ ok: false, needsReason: false, reason: "no-receipts" });
  });
});

describe("AC-16 — không bỏ dòng hàng đã có thực nhập (R8)", () => {
  it("bỏ dòng có thực nhập bị chặn, sửa kg vẫn được", () => {
    const l1 = line("l1", 1000);
    const l2 = line("l2", 2000, { lineNo: 2 });
    const d = data({ lines: [l1, l2], receipts: [receipt("r1")], receiptLines: [qty("r1", "l2", 1000)] });
    expect(validateContract(contract(), [l1], [], d).map((i) => i.code)).toEqual(["line-has-receipts"]);
    expect(validateContract(contract(), [l1, { ...l2, kg: 2500 }], [], d)).toHaveLength(0);
    // thực nhập ở lần nhập đã hủy không giữ dòng
    const cancelled = { ...d, receipts: [receipt("r1", { status: "cancelled" })] };
    expect(validateContract(contract(), [l1], [], cancelled)).toHaveLength(0);
  });
});

describe("NI9 — xóa lần nhập", () => {
  it("xóa khi chưa có file và chưa có thực nhập", () => {
    expect(canDeleteReceipt(data({ documents: stubs("r1") }), "r1")).toBe(true);
    expect(canDeleteReceipt(data({ files: [file("f1", "d1")] }), "r1")).toBe(false);
    expect(canDeleteReceipt(data({ receiptLines: [qty("r1", "l1", 5)] }), "r1")).toBe(false);
  });
});

describe("AC-17 / AC-18 — tra số và tháng (NI7)", () => {
  it("AC-17 tra theo số giấy tờ ở mọi tháng", () => {
    const docs = stubs("r1").map((x) =>
      x.kind === "import-declaration" ? { ...x, docNo: "105123456789" } : x.kind === "commercial-invoice" ? { ...x, docNo: "INV-77" } : x,
    );
    const d = data({
      contracts: [contract(), contract({ id: "c2", contractNo: "XY-09" })],
      receipts: [receipt("r1", { arrivalDate: "2026-09-10", containerNo: "ABCU1234567" })],
      documents: docs,
    });
    for (const q of ["105123456789", "INV-77", "abcu 1234567"]) {
      const res = searchImports(d, q);
      expect(res).toHaveLength(1);
      expect(res[0]).toMatchObject({ kind: "receipt", id: "r1" });
    }
    expect(searchImports(d, "xy-09")).toEqual([{ kind: "contract", id: "c2", contractId: "c2" }]);
  });
  it("AC-18 gom theo đối tác + 3 con số", () => {
    const cA = contract({ id: "cA", supplierId: "sA", supplierName: "A Seafood" });
    const cB = contract({ id: "cB", supplierId: "sB", supplierName: "B Marine", contractNo: "B-1" });
    const full = fullDocs("a1");
    const fb = fullDocs("b1");
    const d = data({
      contracts: [cA, cB],
      lines: [line("la", 1000, { contractId: "cA" }), line("lb", 1000, { contractId: "cB" })],
      receipts: [
        receipt("a1", { contractId: "cA" }),
        receipt("a2", { contractId: "cA" }),
        receipt("b1", { contractId: "cB" }),
        receipt("x1", { contractId: "cB", status: "cancelled" }),
      ],
      documents: [...full.documents, ...stubs("a2"), ...fb.documents],
      files: [...full.files, ...fb.files],
      receiptLines: [qty("a1", "la", 500)],
    });
    const v = monthView(d, "2026-11");
    expect(v.groups.map((g) => g.supplierName)).toEqual(["A Seafood", "B Marine"]);
    expect(v.stats).toEqual({ total: 3, complete: 1, incomplete: 2 });
    expect(monthView(d, "2026-11", "sB").stats.total).toBe(1);
    expect(v.groups[1].receipts[0].state).toBe("awaiting-quantity");
  });
});

describe("AC-25 / AC-26 — danh mục NCC nhập khẩu (v2 R16, R17)", () => {
  const pm = { ...emptyImportSupplier("sA"), shortName: "Pacific Marine" };
  it("AC-25 tên gọi tắt bắt buộc, không trùng", () => {
    expect(validateImportSupplier({ ...emptyImportSupplier("x"), shortName: "  " }, [pm]).map((i) => i.code)).toEqual(["name"]);
    expect(validateImportSupplier({ ...emptyImportSupplier("x"), shortName: " pacific marine " }, [pm]).map((i) => i.code)).toEqual(["duplicate-name"]);
    expect(validateImportSupplier({ ...emptyImportSupplier("x"), shortName: "Ocean Fresh" }, [pm])).toHaveLength(0);
    // sửa chính nó không tính trùng
    expect(validateImportSupplier(pm, [pm])).toHaveLength(0);
  });
  it("AC-26 NCC đã có HĐ (kể cả đã hủy) chỉ ngừng giao dịch, không xóa", () => {
    const contracts = [contract({ supplierId: "sA", status: "cancelled" })];
    expect(canDeleteImportSupplier(contracts, "sA")).toBe(false);
    expect(canDeleteImportSupplier(contracts, "sB")).toBe(true);
    const a = { ...pm, status: "inactive" as const };
    const b = { ...emptyImportSupplier("sB"), shortName: "Ocean" };
    expect(selectableImportSuppliers([a, b]).map((x) => x.id)).toEqual(["sB"]);
    // HĐ cũ của A vẫn giữ A trong ô chọn khi sửa
    expect(selectableImportSuppliers([a, b], "sA").map((x) => x.id)).toEqual(["sA", "sB"]);
  });
});

describe("v3 — dòng hàng nối mặt hàng danh mục (R20–R22)", () => {
  const products = [
    { id: "P1", name: "Bạch tuộc nguyên con 1-2", tradeName: "" },
    { id: "P2", name: "Bạch tuộc nguyên con", tradeName: "" },
    { id: "P3", name: "Cá đuối cánh", tradeName: "Frozen skate wing" },
  ];
  const doneReceipt = (lines: ReturnType<typeof line>[]) =>
    data({
      lines,
      receipts: [receipt("r1")],
      ...fullDocs("r1"),
      receiptLines: lines.map((l) => ({ id: `q-${l.id}`, receiptId: "r1", contractLineId: l.id, kg: l.kg, recordedBy: "", updatedAt: NOW })),
    });

  it("AC-29 lưu được khi chưa nối; mặt hàng đã xóa tính là chưa nối", () => {
    const lines = [line("l1", 100, { productId: "P1" }), line("l2", 50, { lineNo: 2, productId: "" })];
    expect(validateContract(contract(), lines, [contract()])).toHaveLength(0);
    expect(unlinkedLines(data({ lines, products }), "c1").map((l) => l.id)).toEqual(["l2"]);
    expect(unlinkedLines(data({ lines, products: products.filter((p) => p.id !== "P1") }), "c1")).toHaveLength(2);
  });

  it("AC-30 đóng HĐ bắt mọi dòng đã nối", () => {
    const d = doneReceipt([line("l1", 100, { productId: "" })]);
    const g = closeGate(d, "c1");
    expect(g).toMatchObject({ ok: false, reason: "unlinked-lines" });
    expect(g.unlinkedLines).toHaveLength(1);
    expect(closeGate(doneReceipt([line("l1", 100, { productId: "P3" })]), "c1")).toEqual({ ok: true, needsReason: false });
  });

  it("AC-31 máy chủ chưa chạy 0084 không bắt nối, dòng không gửi product_id", () => {
    const d = { ...doneReceipt([line("l1", 100, { productId: undefined })]), productLinkAvailable: false };
    expect(closeGate(d, "c1")).toEqual({ ok: true, needsReason: false });
    expect("product_id" in IMPORT_CONTRACT_LINE_TABLE.toRow(line("l1", 100, { productId: undefined }))).toBe(false);
    expect(IMPORT_CONTRACT_LINE_TABLE.toRow(line("l1", 100, { productId: "" })).product_id).toBeNull();
  });

  it("AC-32 gợi ý ra đúng một mặt hàng", () => {
    const d = {
      contracts: [
        contract({ id: "cA", supplierId: "sA", signedDate: "2026-01-01" }),
        contract({ id: "cB", supplierId: "sB", contractNo: "B-1", signedDate: "2026-06-01" }),
      ],
      lines: [
        line("a1", 1, { contractId: "cA", productName: "Frozen whole octopus 1-2 kg", productId: "P1" }),
        line("b1", 1, { contractId: "cB", productName: "Frozen whole octopus 1-2 kg", productId: "P2" }),
      ],
    };
    expect(suggestImportProductId(d, "frozen  WHOLE octopus 1-2 kg", "sA", products)).toBe("P1");
    expect(suggestImportProductId(d, "Frozen whole octopus 1-2 kg", "sX", products)).toBe("P2");
    expect(suggestImportProductId(d, "Frozen skate wing", "sA", products)).toBe("P3");
    expect(suggestImportProductId(d, "Hàng lạ", "sA", products)).toBe("");
    const twin = [...products, { id: "P4", name: "Cá đuối", tradeName: "frozen skate wing" }];
    expect(suggestImportProductId(d, "Frozen skate wing", "sA", twin)).toBe("");
    // Ô tên trống ⇒ điền tên tiếng Anh; đã có chữ ⇒ giữ.
    expect(productNameAfterPick("", products[2])).toBe("Frozen skate wing");
    expect(productNameAfterPick("", products[0])).toBe("Bạch tuộc nguyên con 1-2");
    expect(productNameAfterPick("Skate", products[2])).toBe("Skate");
  });

  it("AC-33 tra theo tên hàng và tên mặt hàng", () => {
    const d = data({ lines: [line("l1", 100, { productName: "Frozen skate wing", productId: "P3" })], products });
    for (const q of ["skate", "cá đuối"]) expect(searchImports(d, q)).toContainEqual({ kind: "contract", id: "c1", contractId: "c1" });
  });
});
