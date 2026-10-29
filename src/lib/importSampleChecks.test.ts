// Kiểm mẫu của kho (ba-spec 45 v4 — AC-35…AC-39). Lưới dựng theo đúng khuôn báo cáo 25/10/2026
// (ảnh chụp Excel chủ dự án gửi): nhãn cột A (+ nhãn con cột B cho "Loại" / "Size (gr/pc)"), mẫu từ cột C.
import { describe, expect, it } from "vitest";
import type { ImportSampleCheck } from "@/types";
import {
  emptySample,
  exporterMatches,
  mergeSamples,
  parseSampleNumber,
  parseSampleReport,
  suggestLineForSize,
  suggestSampleColumns,
  type SampleCell,
  type SampleMerge,
} from "./importSampleChecks";

const PCT = "0.0%";
const t = (v: SampleCell["v"], z?: string): SampleCell => ({ v, z });
const row = (a: string | null, b: string | null, vals: (SampleCell["v"] | undefined)[], z?: string): SampleCell[] => [
  t(a),
  t(b),
  ...vals.map((v) => t(v ?? null, z)),
];
const merge = (r1: number, c1: number, r2: number, c2: number): SampleMerge => ({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });

/** Báo cáo 25/10/2026: 3 mẫu Grand Marine · 1 Frontline · 1 Ife. */
function report(): { grid: SampleCell[][]; merges: SampleMerge[] } {
  const grid: SampleCell[][] = [
    row("Ngày:", null, ["25/10/2026"]),
    row("Size", null, ["70/100", "80/100", "100/200", "50/100", "100/200"]),
    row("STT mẫu", null, [1, 2, 3, 4, 5]),
    row("Nhà xuất khẩu", null, ["Grand Marine", null, null, "Frontline", "Ife"]),
    row("Ngày nhập", null, ["21/08/2026", null, null, "29/09/2026", "10/09/2026"]),
    row("Packing", null, ["4kg/BL x 5/CTN", null, null, "5kg/BL x 4/CTN", "4kg/BL x 5/CTN"]),
    // Ngày sản xuất mẫu 1 là ô ngày thật của Excel (serial 46162 = 20/05/2026).
    [t("Ngày sản xuất"), t(null), t(46162, "dd/mm/yyyy"), t("20/05/2026"), t("20/05/2026"), t("05/06/2026"), t("19/07/2026")],
    row("Ngày hết hạn", null, ["19/05/2028", "19/05/2028", "19/05/2028", "04/06/2028", "18/07/2028"]),
    row("GW (gr)", null, [24300, 23800, 23800, 22200, 23100]),
    row("NW (gr)", null, [19000, 19500, 19500, 19000, 19000]),
    row("Thiếu net (%)", null, [0.05, 0.025, 0.025, 0.05, 0.05], PCT),
    row("Màu", null, ["Đạt", "Đạt", "Đạt", "Hơi sẫm", "Đạt"]),
    row("Nám", null, ["Đạt", "Đạt", "Đạt", "Đạt", "Đạt"]),
    row("Mùi", null, ["Đạt", "Đạt", "Đạt", "Đạt", "Đạt"]),
    row("Rêu", null, [0.08, 0.05, 0.1, 0.08, 0.05], PCT),
    row("Loại", "1 da", [0.3, 0.25, 0.1, 0.25, 0.95], PCT),
    row(null, "2 da", [0.7, 0.75, 0.9, 0.75, 0.05], PCT),
    row(null, "Mada", []),
    row("Size (gr/pc)", "<30gr", [null, null, null, 0.03, null], PCT),
    row(null, "30/50", [null, null, null, 0.18, null], PCT),
    row(null, "50/70", [0.16, 0.25, null, 0.65, null], PCT),
    row(null, "70/100", [0.84, 0.75, 0.05, 0.14, 0.12], PCT),
    row(null, "100/150", [null, null, 0.65, null, 0.68], PCT),
    row(null, "150/200", [null, null, 0.3, null, 0.2], PCT),
    row(null, "200/300", []),
    row(null, "300/up", []),
    row("Định mức", null, []),
    row("Định mức XĐ", null, [1.05, 1.03, 1.03, 1.05, 1.05]),
    row("Định mức SC", null, [1.49, 1.44, 1.34, 1.37, 1.36]),
    row("Định mức chần", null, [1.21, 1.24, 1.23, 1.25, 1.24]),
    row("Định mức cắt", null, [1.08, 1.08, 1.07, 1.08, 1.07]),
    row("Phụ trội 3%", null, [1.03, 1.03, 1.03, 1.03, 1.03]),
    row("ĐM NL - TP", null, [2.11, 2.04, 1.86, 2.01, 1.96]),
  ];
  const merges = [
    // Nhãn thường gộp A:B; "Loại" gộp A15:A17; "Size (gr/pc)" gộp A18:A25; "Định mức" gộp cả hàng.
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 27, 28, 29, 30, 31, 32].map((r) => merge(r, 0, r, 1)),
    merge(15, 0, 17, 0),
    merge(18, 0, 25, 0),
    merge(26, 0, 26, 6),
    merge(3, 2, 3, 4),
    merge(4, 2, 4, 4),
    merge(5, 2, 5, 4),
  ];
  return { grid, merges };
}

describe("AC-35 — đọc Excel báo cáo mẫu", () => {
  const { grid, merges } = report();
  const r = parseSampleReport(grid, merges);
  it("ra 5 mẫu, ô gộp chép sang từng cột", () => {
    expect(r.failure).toBeUndefined();
    expect(r.reportDate).toBe("2026-10-25");
    expect(r.samples).toHaveLength(5);
    expect(r.samples.map((s) => s.column)).toEqual([2, 3, 4, 5, 6]);
    expect(r.samples.slice(0, 3).map((s) => s.values.exporterName)).toEqual(["Grand Marine", "Grand Marine", "Grand Marine"]);
    expect(r.samples[2].values.importDate).toBe("2026-08-21");
    expect(r.samples[1].values.packing).toBe("4kg/BL x 5/CTN");
  });
  it("số, %, ngày, ô trống", () => {
    const [s1, s2, s3, s4, s5] = r.samples.map((s) => s.values);
    expect(s1.size).toBe("70/100");
    expect(s1.sampleNo).toBe("1");
    expect(s1.productionDate).toBe("2026-05-20");
    expect(s1.expiryDate).toBe("2028-05-19");
    expect(s1.grossWeightG).toBe(24300);
    expect(s2.netShortagePct).toBe(2.5);
    expect(s3.sizeDistribution["100/150"]).toBe(65);
    expect(s4.color).toBe("Hơi sẫm");
    expect(s4.sizeDistribution["<30gr"]).toBe(3);
    expect(s5.oneSkinPct).toBe(95);
    expect(s5.materialToFinishedNorm).toBe(1.96);
    expect(s1.madaPct).toBeNull();
    expect(s1.sizeDistribution["100/150"]).toBeUndefined();
    expect(s1.surplusNorm).toBe(1.03);
    expect(s1.thawingNorm).toBe(1.05);
    expect(r.samples.every((s) => s.needsReview.length === 0)).toBe(true);
    expect(Object.keys(s1.extra)).toHaveLength(0);
  });
  it("không theo khuôn ⇒ báo lỗi, 0 mẫu", () => {
    const bad = parseSampleReport([[t("Hello")], [t("World")]]);
    expect(bad.samples).toHaveLength(0);
    expect(bad.failure).toMatch(/STT mẫu/);
  });
  it("hàng lạ của kho vẫn giữ theo nhãn", () => {
    const { grid: g, merges: m } = report();
    g.splice(10, 0, row("Độ băng", null, ["2%", "3%"]));
    const p = parseSampleReport(g, m.map((x) => (x.s.r >= 10 ? { s: { ...x.s, r: x.s.r + 1 }, e: { ...x.e, r: x.e.r + 1 } } : x)));
    expect(p.samples[0].values.extra["Độ băng"]).toBe("2%");
    expect(p.samples[0].values.netShortagePct).toBe(5);
  });
});

describe("AC-37 — ô không đọc được để trống, đánh dấu soát", () => {
  it("giữ GW, bỏ chữ lạ và % quá 100", () => {
    const { grid, merges } = report();
    grid[10][3] = t("abc");
    grid[14][4] = t("105%");
    const p = parseSampleReport(grid, merges);
    expect(p.samples[0].values.grossWeightG).toBe(24300);
    expect(p.samples[1].values.netShortagePct).toBeNull();
    expect(p.samples[2].values.mossPct).toBeNull();
    expect(p.samples.reduce((n, s) => n + s.needsReview.length, 0)).toBe(2);
  });
  it("số kiểu Việt", () => {
    expect(parseSampleNumber(t("1,05"))).toBe(1.05);
    expect(parseSampleNumber(t("24.300"))).toBe(24300);
    expect(parseSampleNumber(t("5,0%"), true)).toBe(5);
    expect(parseSampleNumber(t("0.05"), true)).toBe(0.05);
    expect(parseSampleNumber(t(0.05, PCT), true)).toBe(5);
    expect(parseSampleNumber(t(""))).toBeNull();
  });
});

describe("AC-36 — chọn sẵn cột của invoice + dòng hàng theo size", () => {
  const { samples } = parseSampleReport(report().grid, report().merges);
  it("Grand Marine: 3 cột đầu; dòng 200/300 không có mẫu", () => {
    const cols = suggestSampleColumns(samples, { supplierNames: ["Grand Marine", "GRAND MARINE FOODS"], docNos: ["GMF/022/26-27"], arrivalDate: "2026-08-21" });
    expect(cols).toEqual([2, 3, 4]);
    const lines = ["70/100", "80/100", "100/200", "200/300"].map((s, i) => ({ id: `l${i + 1}`, productName: `Frozen octopus whole round short arm ${s}` }));
    const picked = samples.filter((s) => cols.includes(s.column)).map((s) => suggestLineForSize(s.values.size, lines));
    expect(picked).toEqual(["l1", "l2", "l3"]);
    expect(picked.filter((x) => x === "l4")).toHaveLength(0);
  });
  it("Ife = chữ đầu tên đầy đủ hoặc tiền tố số invoice; khác ngày về kho thì bỏ", () => {
    expect(suggestSampleColumns(samples, { supplierNames: ["International Freezfish Exports"], docNos: [], arrivalDate: "" })).toEqual([6]);
    expect(suggestSampleColumns(samples, { supplierNames: ["IFX Trading"], docNos: ["IFE/21/2026-27"], arrivalDate: "2026-09-10" })).toEqual([6]);
    expect(suggestSampleColumns(samples, { supplierNames: ["Frontline Exports Pvt. Ltd."], docNos: [], arrivalDate: "2026-10-01" })).toEqual([]);
    expect(exporterMatches("Grand Marine", { supplierNames: ["Frontline Exports"], docNos: ["FLE/65/2026-2027"] })).toBe(false);
  });
  it("size không dính số kề bên; trùng hai dòng ⇒ không gợi ý", () => {
    const lines = [
      { id: "a", productName: "Octopus 100/2000" },
      { id: "b", productName: "Octopus 100 / 200 gr/pc" },
    ];
    expect(suggestLineForSize("100/200", lines)).toBe("b");
    expect(suggestLineForSize("100/200", [...lines, { id: "c", productName: "Octopus WR 100/200" }])).toBe("");
    expect(suggestLineForSize("", lines)).toBe("");
  });
});

describe("AC-39 — nạp lại thay, không cộng đôi", () => {
  const mk = (id: string, receiptId: string, batchId: string): ImportSampleCheck => emptySample(id, { contractId: "c1", receiptId, batchId });
  const old = [mk("a1", "r1", "A"), mk("a2", "r1", "A"), mk("a3", "r1", "A"), mk("x1", "r2", "X")];
  const fresh = [mk("b1", "r1", "B"), mk("b2", "r1", "B"), mk("b3", "r1", "B")];
  it("thay ⇒ còn đúng 3 mẫu đợt mới, lần nhập khác giữ nguyên", () => {
    const out = mergeSamples(old, "r1", fresh, true);
    expect(out.filter((x) => x.receiptId === "r1")).toHaveLength(3);
    expect(out.filter((x) => x.batchId === "A")).toHaveLength(0);
    expect(out.filter((x) => x.receiptId === "r2")).toHaveLength(1);
  });
  it("giữ thêm ⇒ 6 mẫu", () => {
    expect(mergeSamples(old, "r1", fresh, false).filter((x) => x.receiptId === "r1")).toHaveLength(6);
  });
});
