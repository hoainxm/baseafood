import { describe, expect, it } from "vitest";
import type { MonthlyStockLine } from "@/types";
import {
  MAP_NEW,
  MAP_SKIP,
  applyNxtPlan,
  buildNxtPlan,
  checkNxtReport,
  joinCellLines,
  listNxtBlockers,
  monthOfReport,
  parseNxtPdfItems,
  parseReportNumber,
  tidyItemName,
  warehouseOfReport,
  type NxtReport,
  type PdfTextPiece,
} from "./nxtStockImport";

/* ---------- PDF giả theo hình học mẫu thật (pdfjs: y hướng lên, số canh phải) ---------- */
const HEADER: [string, number, number][] = [
  ["Mã hàng", 55, 92],
  ["Tên hàng", 164, 204],
  ["Tồn đầu kỳ", 290, 337],
  ["Giá trị đầu kỳ", 354, 411],
  ["SL Nhập", 426, 463],
  ["Giá trị nhập", 488, 538],
  ["SL Xuất", 552, 586],
  ["Giá trị xuất", 616, 663],
  ["Tồn cuối kỳ", 680, 730],
  ["Giá trị cuối kỳ", 760, 814],
];
const NUM_RIGHT = [337, 411, 463, 538, 586, 663, 730, 814];

function words(text: string, x: number, y: number, page: number): PdfTextPiece[] {
  const out: PdfTextPiece[] = [];
  let cx = x;
  for (const w of text.split(" ")) {
    const width = w.length * 5;
    out.push({ str: w, x: cx, y, width, page });
    cx += width + 3;
  }
  return out;
}
function numbers(vals: (string | number)[], y: number, page: number): PdfTextPiece[] {
  return vals.map((v, i) => {
    const str = typeof v === "number" ? v.toLocaleString("en-US") : v;
    const width = str.length * 5;
    return { str, x: NUM_RIGHT[i] - width, y, width, page };
  });
}
function pageHead(page: number, top: number): PdfTextPiece[] {
  return [
    ...words("Ngày lập: 02/11/2026 15:38", 50, top + 88, page),
    ...words("Báo cáo xuất nhập tồn", 354, top + 84, page),
    ...words("Từ ngày 01/10/2026 đến ngày 31/10/2026", 350, top + 65, page),
    ...words("Chi nhánh: KHO TP - KHO 1000", 370, top + 48, page),
    ...HEADER.flatMap(([t, l, r]) => {
      // tiêu đề: các chữ sát nhau (khoảng 2pt) trong khung [l, r]
      const ws = t.split(" ");
      const each = (r - l - 2 * (ws.length - 1)) / ws.length;
      return ws.map((w, i) => ({ str: w, x: l + i * (each + 2), y: top, width: each, page }));
    }),
    ...words("SL mặt hàng: 4", 55, top - 30, page),
    ...numbers([12000, 0, 500, 0, 3000, 0, 9500, 0], top - 30, page),
  ];
}
function footer(page: number): PdfTextPiece[] {
  return [...words(`Trang:${page}/2`, 784, 41.4, page), ...words("KHO TP - KHO 1000: Bà Rịa - Phường Phước Trung", 247, 41.2, page)];
}
const nums = (open: number, inn: number, out: number, close = open + inn - out) => [open, 0, inn, 0, out, 0, close, 0];

/** 4 dòng / 2 trang: tên 3 dòng canh giữa · mã ngắt dòng "2022-" / "144" · tên "100-" / "200". */
const PIECES: PdfTextPiece[] = [
  ...pageHead(1, 467),
  // Dòng 1 (y 408.6): tên 3 dòng 414.9 / 404.5 / 394.2
  ...words("BẠCH TUỘC 1 DA", 164, 414.9, 1),
  ...words("PXĐ.BTNL.TĐ 20023", 55, 408.6, 1),
  ...numbers(nums(6000, 500, 3000), 408.6, 1),
  ...words("NGUYÊN LIỆU XÔ ( NL", 164, 404.5, 1),
  ...words("MUA ANH PHÁP ) (KG)", 164, 394.2, 1),
  // Dòng 2 (y 372): tên "BAO TỬ 2DA NHẬP 100-" / "200"
  ...words("BAO TỬ 2DA NHẬP 100-", 164, 377.2, 1),
  ...words("PXĐ.BTNL.TĐ 059", 55, 372, 1),
  ...numbers(nums(4000, 0, 0), 372, 1),
  ...words("200", 164, 366.8, 1),
  ...footer(1),
  ...pageHead(2, 549.5),
  // Dòng 3 (y 295.2): mã "PXĐ.BTNL.TĐ 2022-" (300.4) + "144" (290.1) — cùng hàng với tên
  ...words("PXĐ.BTNL.TĐ 2022-", 55, 300.4, 2),
  ...words("ĐUÔI BẠCH TUỘC", 164, 300.4, 2),
  ...numbers(nums(384, 0, 0), 295.2, 2),
  ...words("144", 55, 290.1, 2),
  ...words("SỐNG 2DA (KG)", 164, 290.1, 2),
  // Dòng 4 (y 266.7): tên có "-" đứng riêng
  ...words("BẠCH TUỘC 2 DA", 164, 272.9, 2),
  ...words("PXĐ.BTNL.TĐ 109", 55, 266.7, 2),
  ...numbers(nums(1616, 0, 0), 266.7, 2),
  ...words("NGUYÊN LIỆU >80GR -", 164, 262.6, 2),
  ...words("ÔNG MẬU (KG)", 164, 252.2, 2),
  ...footer(2),
];

describe("đọc PDF báo cáo XNT", () => {
  const r = parseNxtPdfItems(PIECES);

  it("đọc đầu trang: khoảng ngày, kho, ngày lập", () => {
    expect(r.dateFrom).toBe("2026-10-01");
    expect(r.dateTo).toBe("2026-10-31");
    expect(r.warehouseText).toBe("KHO TP - KHO 1000");
    expect(r.createdText).toContain("02/11/2026");
  });

  it("gom tên nhiều dòng về đúng dòng số, nối '100-' + '200', mã ngắt dòng", () => {
    expect(r.rows.map((x) => x.code)).toEqual(["PXĐ.BTNL.TĐ 20023", "PXĐ.BTNL.TĐ 059", "PXĐ.BTNL.TĐ 2022-144", "PXĐ.BTNL.TĐ 109"]);
    expect(r.rows[0].name).toBe("BẠCH TUỘC 1 DA NGUYÊN LIỆU XÔ ( NL MUA ANH PHÁP ) (KG)");
    expect(r.rows[1].name).toBe("BAO TỬ 2DA NHẬP 100-200");
    expect(r.rows[2].name).toBe("ĐUÔI BẠCH TUỘC SỐNG 2DA (KG)");
    expect(r.rows[3].name).toBe("BẠCH TUỘC 2 DA NGUYÊN LIỆU >80GR - ÔNG MẬU (KG)");
  });

  it("số theo cột, dòng tổng 'SL mặt hàng' chỉ lấy một lần (mỗi trang lặp lại)", () => {
    expect(r.rows[0]).toMatchObject({ openKg: 6000, inKg: 500, outKg: 3000, closeKg: 3500 });
    expect(r.declared).toMatchObject({ count: 4, openKg: 12000, inKg: 500, outKg: 3000, closeKg: 9500 });
  });

  it("file đọc đủ + cân ⇒ không có lỗi; đọc thiếu ⇒ lỗi chặn nạp", () => {
    expect(checkNxtReport(r)).toEqual([]);
    const missingRow = { ...r, rows: r.rows.slice(1) };
    expect(checkNxtReport(missingRow).filter((i) => i.level === "error").length).toBeGreaterThanOrEqual(2);
  });

  it("không phải mẫu XNT ⇒ báo lỗi dễ hiểu", () => {
    expect(() => parseNxtPdfItems(words("Hóa đơn giá trị gia tăng", 50, 500, 1))).toThrow(/Báo cáo xuất nhập tồn/);
  });
});

describe("tiện ích", () => {
  it("số, khoảng ngày, kho, tên", () => {
    expect(parseReportNumber("229,812")).toBe(229812);
    expect(parseReportNumber("(360)")).toBe(-360);
    expect(parseReportNumber("KG")).toBeNull();
    expect(joinCellLines(["2 DA NGUYÊN LIỆU 100-", "UP F34"])).toBe("2 DA NGUYÊN LIỆU 100-UP F34");
    expect(monthOfReport({ dateFrom: "2026-10-01", dateTo: "2026-10-31" })).toBe("2026-10");
    expect(monthOfReport({ dateFrom: "2026-10-01", dateTo: "2026-10-15" })).toBeNull();
    expect(monthOfReport({ dateFrom: "2026-02-01", dateTo: "2026-02-28" })).toBe("2026-02");
    expect(warehouseOfReport("KHO TP - KHO 1000")).toBe("Kho 1000 tấn");
    expect(tidyItemName("BẠCH TUỘC 1 DA NGUYÊN LIỆU 40-UP (KG)")).toBe("Bạch tuộc 1 da nguyên liệu 40-up");
  });
});

/* ---------- Đối chiếu với sổ ---------- */
const W = "Kho 1000 tấn";
const line = (id: string, p: Partial<MonthlyStockLine>): MonthlyStockLine => ({
  id,
  period: "2026-10",
  category: "Hàng tạm",
  warehouse: W,
  itemName: id,
  size: "",
  origin: "",
  importDate: "",
  storageLocation: "",
  kgPerCtn: null,
  unitPrice: null,
  openCtn: 0,
  openKg: 0,
  inCtn: 0,
  inKg: 0,
  outCtn: 0,
  outKg: 0,
  carriedFromId: "",
  sortOrder: 0,
  note: "",
  ...p,
});
const report = (rows: [string, number, number, number][]): NxtReport => ({
  source: "pdf",
  createdText: "",
  dateFrom: "2026-10-01",
  dateTo: "2026-10-31",
  warehouseText: "KHO TP - KHO 1000",
  rows: rows.map(([code, openKg, inKg, outKg]) => ({ code, name: code.toUpperCase(), openKg, inKg, outKg, closeKg: openKg + inKg - outKg })),
});
const opts = { warehouse: W, month: "2026-10" };

describe("đối chiếu file ↔ sổ", () => {
  it("mã đã lưu ⇒ khớp, điền nhập/xuất, nạp lại không đổi gì", () => {
    const lines = [line("a", { openKg: 100, accountingCode: "A" })];
    const rep = report([["A", 100, 20, 50]]);
    const plan = buildNxtPlan(lines, rep, opts);
    expect(plan.items[0]).toMatchObject({ status: "match", mapSource: "code", resultCloseKg: 70 });
    expect(listNxtBlockers(plan, [])).toEqual([]);
    const r1 = applyNxtPlan(plan, { category: "Hàng tạm", sourceNote: "XNT" });
    expect(r1.lines[0]).toMatchObject({ inKg: 20, outKg: 50 });
    const again = applyNxtPlan(buildNxtPlan(r1.lines, rep, opts), { category: "Hàng tạm", sourceNote: "XNT" });
    expect(again.updated).toBe(0);
    expect(again.added).toBe(0);
  });

  it("chưa có mã ⇒ gợi ý theo tồn đầu trùng (duy nhất), ghi xong lưu mã", () => {
    const lines = [line("x", { openKg: 46176 }), line("y", { openKg: 500 })];
    const plan = buildNxtPlan(lines, report([["1001", 46176, 0, 20520]]), opts);
    expect(plan.items[0]).toMatchObject({ status: "match", mapSource: "suggest", rowIds: ["x"] });
    expect(plan.items[0].warnings.join(" ")).toMatch(/kiểm lại/);
    const r = applyNxtPlan(plan, { category: "Hàng tạm", sourceNote: "XNT" });
    expect(r.lines.find((l) => l.id === "x")).toMatchObject({ outKg: 20520, accountingCode: "1001" });
  });

  it("ghi chú 'mã KT:' kiểu cũ được nhận như mã đã lưu", () => {
    const lines = [line("adj", { openKg: 864, note: "Bổ sung theo XNT T10 — mã KT: PXĐ.BTNL.TĐ 015" }), line("m", { openKg: 5472, accountingCode: "PXĐ.BTNL.TĐ 015" })];
    const plan = buildNxtPlan(lines, report([["PXĐ.BTNL.TĐ 015", 6336, 0, 6336]]), opts);
    // mã đã lưu thắng; ghi chú cũ chỉ dùng khi không dòng nào có mã ⇒ ở đây dòng "m" đơn lẻ ⇒ lệch
    expect(plan.items[0].status).toBe("opening-diff");
    const onlyNotes = buildNxtPlan([lines[0], { ...lines[1], accountingCode: "", note: "mã KT: PXĐ.BTNL.TĐ 015" }], report([["PXĐ.BTNL.TĐ 015", 6336, 0, 6336]]), opts);
    expect(onlyNotes.items[0]).toMatchObject({ status: "match", mapSource: "note" });
    const r = applyNxtPlan(onlyNotes, { category: "Hàng tạm", sourceNote: "XNT" });
    // xuất chia theo tồn có từng dòng, dòng chính (không phải điều chỉnh) trước
    expect(r.lines.find((l) => l.id === "m")!.outKg).toBe(5472);
    expect(r.lines.find((l) => l.id === "adj")!.outKg).toBe(864);
  });

  it("lệch tồn đầu ⇒ bắt chọn; 'Theo file' file nhiều hơn ⇒ dòng điều chỉnh mang phần chênh", () => {
    const lines = [line("c", { openKg: 5472, accountingCode: "015" })];
    const rep = report([["015", 6336, 0, 6336]]);
    const plan = buildNxtPlan(lines, rep, opts);
    expect(plan.items[0].status).toBe("opening-diff");
    expect(listNxtBlockers(plan, []).join(" ")).toMatch(/015/);
    const d = { "015": { choice: "file" as const } };
    const chosen = buildNxtPlan(lines, rep, { ...opts, decisions: d });
    expect(listNxtBlockers(chosen, [])).toEqual([]);
    const r = applyNxtPlan(chosen, { category: "Hàng tạm", sourceNote: "XNT", decisions: d });
    const adj = r.lines.find((l) => l.id.startsWith("nxt-adj|"))!;
    expect(adj).toMatchObject({ openKg: 864, outKg: 864, accountingCode: "015" });
    expect(r.lines.find((l) => l.id === "c")).toMatchObject({ outKg: 5472 });
    // nạp lại: dòng điều chỉnh đã mang mã ⇒ khớp, không thêm dòng nữa
    const again = buildNxtPlan(r.lines, rep, opts);
    expect(again.items[0].status).toBe("match");
  });

  it("'Theo file' sổ nhiều hơn ⇒ KHÔNG đẻ dòng âm, ghi thành xuất điều chỉnh trên lô", () => {
    const lines = [line("h", { openKg: 11424, accountingCode: "1008" })];
    const d = { "1008": { choice: "file" as const } };
    const plan = buildNxtPlan(lines, report([["1008", 11064, 0, 11064]]), { ...opts, decisions: d });
    expect(plan.items[0].resultCloseKg).toBe(0);
    const r = applyNxtPlan(plan, { category: "Hàng tạm", sourceNote: "XNT", decisions: d });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ outKg: 11424 });
    expect(r.lines[0].note).toMatch(/điều chỉnh/);
    // nạp lại cùng file: nhớ lựa chọn từ ghi chú, không bắt chọn lại, không đổi gì
    const again = buildNxtPlan(r.lines, report([["1008", 11064, 0, 11064]]), opts);
    expect(again.items[0]).toMatchObject({ status: "opening-diff", choice: "file" });
    expect(listNxtBlockers(again, [])).toEqual([]);
    expect(applyNxtPlan(again, { category: "Hàng tạm", sourceNote: "XNT" }).updated).toBe(0);
  });

  it("'Giữ sổ' mà xuất vượt tồn ⇒ chặn (tồn âm)", () => {
    const lines = [line("c", { openKg: 5472, accountingCode: "015" })];
    const plan = buildNxtPlan(lines, report([["015", 6336, 0, 6336]]), { ...opts, decisions: { "015": { choice: "ledger" } } });
    expect(plan.items[0].resultCloseKg).toBe(-864);
    expect(listNxtBlockers(plan, []).join(" ")).toMatch(/âm/);
  });

  it("sổ thiếu dòng (file có tồn đầu) ⇒ bắt chọn; mã mới tồn đầu 0 ⇒ tự thêm dòng", () => {
    const plan = buildNxtPlan([], report([["040", 635, 0, 0], ["568", 0, 13248, 0]]), opts);
    expect(plan.items.map((i) => i.status)).toEqual(["missing", "new"]);
    expect(listNxtBlockers(plan, [])).toHaveLength(1);
    const d = { "040": { choice: "file" as const }, "568": { newName: "Bạch tuộc 1 da 40up" } };
    const r = applyNxtPlan(buildNxtPlan([], report([["040", 635, 0, 0], ["568", 0, 13248, 0]]), { ...opts, decisions: d }), {
      category: "Hàng tạm",
      sourceNote: "XNT",
      decisions: d,
    });
    expect(r.added).toBe(2);
    expect(r.lines.find((l) => l.accountingCode === "040")).toMatchObject({ openKg: 635, category: "Hàng tạm" });
    expect(r.lines.find((l) => l.accountingCode === "568")).toMatchObject({ inKg: 13248, itemName: "Bạch tuộc 1 da 40up" });
  });

  it("chọn tay dòng sổ / bỏ mã / thêm dòng mới thay gợi ý", () => {
    const lines = [line("x", { openKg: 100 }), line("y", { openKg: 100 })];
    const rep = report([["A", 100, 0, 10]]);
    // hai dòng cùng tồn đầu ⇒ không gợi ý (không đoán) ⇒ sổ thiếu dòng
    expect(buildNxtPlan(lines, rep, opts).items[0].status).toBe("missing");
    expect(buildNxtPlan(lines, rep, { ...opts, decisions: { A: { target: "y" } } }).items[0]).toMatchObject({ status: "match", rowIds: ["y"], mapSource: "user" });
    expect(buildNxtPlan(lines, rep, { ...opts, decisions: { A: { target: MAP_SKIP } } }).items[0].status).toBe("skipped");
    expect(buildNxtPlan(lines, rep, { ...opts, decisions: { A: { target: MAP_NEW } } }).items[0].status).toBe("missing");
  });

  it("ghi đè nhập/xuất cũ + xuất do Cân đối ⇒ cảnh báo; dòng sổ mang mã mà file không có ⇒ liệt kê", () => {
    const lines = [
      line("a", { openKg: 100, outKg: 15, accountingCode: "A", note: "⟦CĐ:row1:15⟧ Cân đối: lấy xả đông 15 kg" }),
      line("z", { openKg: 50, accountingCode: "Z" }),
    ];
    const plan = buildNxtPlan(lines, report([["A", 100, 0, 30]]), opts);
    expect(plan.items[0].overwrite).toEqual({ inKg: 0, outKg: 15 });
    expect(plan.items[0].balancingOutKg).toBe(15);
    expect(plan.items[0].warnings.join(" ")).toMatch(/THAY/);
    expect(plan.ledgerOnly).toEqual([{ rowId: "z", code: "Z", itemName: "z", closeKg: 50 }]);
  });

  it("tháng chưa mở ⇒ kế thừa tồn cuối tháng trước (mang theo mã) rồi mới đối chiếu", () => {
    const lines = [line("s", { period: "2026-09", openKg: 100, outKg: 40, accountingCode: "A" })];
    const plan = buildNxtPlan(lines, report([["A", 60, 0, 60]]), opts);
    expect(plan.opensMonth).toBe(true);
    expect(plan.items[0]).toMatchObject({ status: "match", rowIds: ["carry|s"], mapSource: "code" });
  });

  it("dòng file không cân ⇒ chỉ được bỏ mã", () => {
    const rep = report([["A", 100, 0, 10]]);
    rep.rows[0].closeKg = 80;
    const plan = buildNxtPlan([line("a", { openKg: 100, accountingCode: "A" })], rep, opts);
    expect(plan.items[0].status).toBe("unbalanced");
    expect(listNxtBlockers(plan, []).join(" ")).toMatch(/Bỏ mã này/);
    const ok = buildNxtPlan([line("a", { openKg: 100, accountingCode: "A" })], rep, { ...opts, decisions: { A: { choice: "skip" } } });
    expect(listNxtBlockers(ok, [])).toEqual([]);
  });
});
