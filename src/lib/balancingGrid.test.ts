import { describe, expect, test } from "vitest";
import type { BalancingOutputItem, BalancingPeriod, MaterialImportItem } from "@/types";
import {
  OTHER_CUSTOMER_ID,
  setRepaidDebt,
  getBalancingStockLineKind,
  splitRepaidDebt,
  getBalancingCustomerName,
  findMissingTemplateRows,
  buildFinishedGoodTemplateRows,
  suggestCustomerPrice,
  groupImportsByMaterialType,
  finishedGoodTemplateKey,
  pickTemplatePeriod,
  findOverlappingFamilyPeriods,
  getPeriodDates,
  filterEligibleImports,
} from "./balancingGrid";

const period = (id: string, startDate: string, endDate: string, materialTypeName = "Bạch tuộc 2 da") =>
  ({ id, materialTypeName, startDate, endDate }) as BalancingPeriod;

let n = 0;
const makeImport = (deliveryDate: string, materialTypeName: string, quantityKg: number, balancingPeriodId = ""): MaterialImportItem => ({
  id: `m${++n}`,
  shipmentId: "",
  deliveryDate,
  workshop: "Đông" as MaterialImportItem["workshop"],
  category: "" as MaterialImportItem["category"],
  supplierName: "",
  materialTypeName,
  quantityKg,
  unitPrice: null,
  driverName: "",
  licensePlate: "",
  note: "",
  balancingPeriodId,
});

/* Sổ nhập thật 31/08–06/09/2026 (rút gọn): mỗi ngày 2 da lớn + nhỏ, xen 1 da. */
const num: MaterialImportItem[] = [
  makeImport("2026-08-31", "Bạch tuộc 2 da lớn (80↑)", 1649),
  makeImport("2026-08-31", "Bạch tuộc 1 da", 1525),
  makeImport("2026-09-01", "Bạch tuộc 2 da lớn (80↑)", 6762),
  makeImport("2026-09-01", "Bạch tuộc 2 da nhỏ (80↓)", 1202),
  makeImport("2026-09-01", "Bạch tuộc 1 da", 2160),
  makeImport("2026-09-03", "Bạch tuộc 2 da nhỏ (80↓)", 5019),
  makeImport("2026-09-03", "Bạch tuộc 1 da", 6137),
  makeImport("2026-09-05", "Bạch tuộc 2 da lớn (80↑)", 2491),
  makeImport("2026-09-05", "Bạch tuộc 1 da", 5509),
  makeImport("2026-09-06", "Bạch tuộc 2 da lớn (80↑)", 3146),
];

describe("hút sổ nhập vào kỳ cân đối", () => {
  test("ngày trong kỳ tính theo UTC, đủ cả hai đầu mút", () => {
    expect(getPeriodDates(period("k", "2026-09-01", "2026-09-05"))).toEqual([
      "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05",
    ]);
  });

  test("chỉ lấy ĐÚNG họ 2 da (lớn + nhỏ) trong ngày của kỳ — không 1 da, không ngày ngoài kỳ", () => {
    const eligible = filterEligibleImports(period("k", "2026-09-01", "2026-09-05"), num);
    expect(eligible.every((r) => r.materialTypeName.startsWith("Bạch tuộc 2 da"))).toBe(true);
    expect(eligible.map((r) => r.deliveryDate).sort()).toEqual(["2026-09-01", "2026-09-01", "2026-09-03", "2026-09-05"]);
    const grouped = groupImportsByMaterialType(eligible);
    expect([...grouped.keys()]).toEqual(["Bạch tuộc 2 da"]);
    expect(grouped.get("Bạch tuộc 2 da")!.dailyQuantities).toEqual({ "2026-09-01": 7964, "2026-09-03": 5019, "2026-09-05": 2491 });
  });

  test("chuyến đã thuộc kỳ khác không bị hút lại", () => {
    const assigned = num.map((r) => (r.deliveryDate === "2026-09-01" ? { ...r, balancingPeriodId: "kyA" } : r));
    const eligible = filterEligibleImports(period("kyB", "2026-09-01", "2026-09-05"), assigned);
    expect(eligible.some((r) => r.deliveryDate === "2026-09-01")).toBe(false);
  });
});

describe("findOverlappingFamilyPeriods", () => {
  const periods = [
    period("A", "2026-09-01", "2026-09-05"),
    period("B", "2026-09-01", "2026-09-05"),
    period("C", "2026-09-06", "2026-09-10"),
    period("D", "2026-09-03", "2026-09-04", "Bạch tuộc 1 da"),
    period("E", "2026-09-05", "2026-09-07", "Bạch tuộc 2 da lớn (80↑)"),
  ];
  test("bắt kỳ cùng họ chồng ngày; bỏ qua chính nó, kỳ liền kề không chồng, kỳ khác loại", () => {
    expect(findOverlappingFamilyPeriods(periods[1], periods).map((k) => k.id).sort()).toEqual(["A", "E"]);
    expect(findOverlappingFamilyPeriods(periods[2], periods).map((k) => k.id)).toEqual(["E"]);
  });
});

const finishedGoodRow = (periodId: string, productId: string, customerId: string, unitPrice: number | null, spec = "", channel: BalancingOutputItem["channel"] = "Xuất khẩu"): BalancingOutputItem => ({
  id: `${periodId}-${productId}-${customerId}-${spec}`,
  periodId,
  productId,
  customerId,
  channel,
  quantityKg: 0,
  unitPrice,
  spec,
});

describe("dòng mẫu khối 2", () => {
  const periods = [
    period("K1", "2026-08-20", "2026-08-25"),
    period("K2", "2026-08-26", "2026-08-31"),
    period("K3", "2026-09-01", "2026-09-05"),
    period("K4", "2026-09-10", "2026-09-12"),
    period("L1", "2026-08-28", "2026-08-30", "Bạch tuộc 1 da"),
  ];
  const allOutputs = [
    finishedGoodRow("K1", "luoc230", "hanwa", 10.4),
    finishedGoodRow("K2", "luoc230", "hanwa", 10.43),
    finishedGoodRow("K2", "tambot", "jfda", 9.3),
    finishedGoodRow("K2", "tambot", "dairei", 9.2),
    finishedGoodRow("K2", "tambot", "jfda", null),
    finishedGoodRow("L1", "motda", "x", 5),
  ];

  test("kỳ mẫu = kỳ cùng họ gần nhất KẾT THÚC TRƯỚC, có dòng; không lấy kỳ khác loại", () => {
    expect(pickTemplatePeriod(periods[2], periods, allOutputs)?.id).toBe("K2");
    expect(pickTemplatePeriod(periods[3], periods, allOutputs)?.id).toBe("K2");
    // kỳ đầu tiên, không có kỳ trước có dòng ⇒ lấy kỳ mới nhất còn lại
    expect(pickTemplatePeriod(period("K0", "2026-08-01", "2026-08-05"), periods, allOutputs)?.id).toBe("K2");
    expect(pickTemplatePeriod(period("M", "2026-09-01", "2026-09-05", "Mực ống"), periods, allOutputs)).toBeNull();
  });

  test("mỗi mặt hàng × khách × GIÁ một dòng mẫu; khác khách hoặc khác giá vẫn tách", () => {
    const templates = buildFinishedGoodTemplateRows(allOutputs.filter((r) => r.periodId === "K2"));
    expect(templates.map((m) => [m.key, m.unitPrice])).toEqual([
      [finishedGoodTemplateKey("luoc230", "", "hanwa"), 10.43],
      [finishedGoodTemplateKey("tambot", "", "jfda"), 9.3],
      [finishedGoodTemplateKey("tambot", "", "dairei"), 9.2],
      [finishedGoodTemplateKey("tambot", "", "jfda"), null],
    ]);
    expect(new Set(templates.map((m) => m.id)).size).toBe(4);
  });

  test("hai dòng mẫu cùng khoá: kỳ đã có 1 dòng ⇒ còn thiếu đúng 1 (không biến mất cả hai)", () => {
    const templates = buildFinishedGoodTemplateRows(allOutputs.filter((r) => r.periodId === "K2"));
    const missingRows = findMissingTemplateRows(templates, [{ productId: "tambot", spec: "", customerId: "jfda" }]);
    expect(missingRows.filter((m) => m.customerId === "jfda").map((m) => m.unitPrice)).toEqual([null]);
  });

  test("dòng mẫu còn thiếu: bỏ dòng kỳ đã có (cùng khách, hoặc dòng hút chưa chọn khách)", () => {
    const templates = buildFinishedGoodTemplateRows(allOutputs.filter((r) => r.periodId === "K2"));
    expect(findMissingTemplateRows(templates, [{ productId: "luoc230", spec: "", customerId: "hanwa" }]).length).toBe(3);
    expect(findMissingTemplateRows(templates, [{ productId: "tambot", spec: "", customerId: "" }]).map((m) => m.productId)).toEqual(["luoc230"]);
  });

  test("gợi ý khách + giá: ưu tiên dòng mẫu, rồi kỳ gần nhất có giá, không có ⇒ null", () => {
    const templates = buildFinishedGoodTemplateRows(allOutputs.filter((r) => r.periodId === "K2"));
    expect(suggestCustomerPrice("tambot", "", templates, allOutputs, periods, "K3")).toEqual({ customerId: "jfda", channel: "Xuất khẩu", unitPrice: 9.3 });
    expect(suggestCustomerPrice("luoc230", "", [], allOutputs, periods, "K3")?.unitPrice).toBe(10.43);
    expect(suggestCustomerPrice("moi", "", templates, allOutputs, periods, "K3")).toBeNull();
  });
});

describe("dòng kho khối NL — getBalancingStockLineKind", () => {
  const base = { groupName: "Xả đông" as const, sourceWarehouse: "Kho mình", isReduction: false };
  test("Xả đông · Kho mình = lấy xả đông; thêm cờ giảm = gửi đông", () => {
    expect(getBalancingStockLineKind(base)).toBe("thaw-out");
    expect(getBalancingStockLineKind({ ...base, isReduction: true })).toBe("freeze-deposit");
  });
  test("xả đông mua về / dòng thủy sản / dòng giảm thường KHÔNG phải dòng kho", () => {
    expect(getBalancingStockLineKind({ ...base, sourceWarehouse: "Mua về" })).toBeNull();
    expect(getBalancingStockLineKind({ ...base, sourceWarehouse: "" })).toBeNull();
    expect(getBalancingStockLineKind({ ...base, groupName: "Thủy sản", isReduction: true })).toBeNull();
  });
});

describe("Trả · Nợ — splitRepaidDebt / setRepaidDebt", () => {
  test("chuyển kỳ cũ (chưa có debtKg) hiện ở Trả", () => {
    expect(splitRepaidDebt({ carryOverKg: -2000 })).toEqual({ repaidKg: -2000, debtKg: 0 });
  });
  test("ghi một cột giữ cột kia, tổng chuyển kỳ = Trả + Nợ (có dấu)", () => {
    const after = setRepaidDebt({ carryOverKg: -2000 }, { debtKg: 258 });
    expect(after).toEqual({ carryOverKg: -1742, debtKg: 258 });
    expect(splitRepaidDebt(after)).toEqual({ repaidKg: -2000, debtKg: 258 });
    expect(setRepaidDebt(after, { repaidKg: 0 })).toEqual({ carryOverKg: 258, debtKg: 258 });
  });
  test("số lẻ không trôi dấu phẩy động", () => {
    expect(splitRepaidDebt(setRepaidDebt({ carryOverKg: 0.3 }, { debtKg: 0.1 }))).toEqual({ repaidKg: 0.3, debtKg: 0.1 });
  });
});

describe("khách Khác", () => {
  test("mục cố định ngoài danh mục", () => {
    expect(getBalancingCustomerName(OTHER_CUSTOMER_ID, [])).toBe("Khác");
    expect(getBalancingCustomerName("k1", [{ id: "k1", name: "Hanwa" }])).toBe("Hanwa");
    expect(getBalancingCustomerName("", [])).toBe("—");
  });
});
