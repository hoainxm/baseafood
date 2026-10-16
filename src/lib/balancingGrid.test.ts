import { describe, expect, test } from "vitest";
import type { BalancingOutputItem, BalancingPeriod, MaterialImportItem, SalesInvoice, SalesItem } from "@/types";
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
  findUnpricedMaterialRows,
  suggestMaterialPrices,
  salesItemToOutput,
  isEmptyPulledSalesOutput,
  sumFinishedGoodAmounts,
  type MaterialGridRow,
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

/* ---------- Giá NL còn trống (audit demo 2026-10-16) ---------- */
const gridRow = (p: Partial<MaterialGridRow> & Pick<MaterialGridRow, "id" | "total">): MaterialGridRow => ({
  name: p.id,
  stockLineKind: null,
  group: "Thủy sản",
  dailyQuantities: {},
  carryOverKg: 0,
  unitPrice: null,
  ratio: null,
  isDecrease: false,
  decreaseTarget: "",
  fromImports: false,
  sourceIds: [],
  ...p,
});
const pricedImport = (id: string, kg: number, price: number | null): MaterialImportItem => ({
  ...makeImport("2026-10-15", "Bạch tuộc 2 da lớn (80↑)", kg),
  id,
  unitPrice: price,
});

describe("findUnpricedMaterialRows", () => {
  test("chỉ lấy dòng có kg mà chưa có giá", () => {
    const rows = [
      gridRow({ id: "a", total: 100 }),
      gridRow({ id: "b", total: 0 }),
      gridRow({ id: "c", total: 50, unitPrice: 1000 }),
      gridRow({ id: "gui", total: -300, stockLineKind: "freeze-deposit", isDecrease: true }),
    ];
    expect(findUnpricedMaterialRows(rows).map((h) => h.id)).toEqual(["a", "gui"]);
  });
});

describe("suggestMaterialPrices", () => {
  /* Số thật của vòng audit: 5 chuyến 2 da (lớn + nhỏ) kỳ 12–16/10. */
  const imports = [
    pricedImport("i1", 1960, 148000),
    pricedImport("i2", 900, 148000),
    pricedImport("i3", 600, 138000),
    pricedImport("i4", 1200, 155000),
    pricedImport("i5", 800, 140000),
  ];
  const family = gridRow({ id: "ho", total: 5460, fromImports: true, sourceIds: ["i1", "i2", "i3", "i4", "i5"] });
  const thaw = gridRow({ id: "xa", total: 500, group: "Xả đông", stockLineKind: "thaw-out" });

  test("dòng nhập gộp = bình quân gia quyền giá các chuyến nguồn", () => {
    // (1960+900)×148.000 + 600×138.000 + 1200×155.000 + 800×140.000 = 804.080.000 ÷ 5460
    expect(suggestMaterialPrices([family], imports).get("ho")).toBe(147267);
  });
  test("dòng xả đông lô không giá = bình quân NL mua vào (tính cả giá vừa gợi ý)", () => {
    const s = suggestMaterialPrices([family, thaw], imports);
    expect(s.get("xa")).toBe(147267);
  });
  test("dòng mua đã có giá ⇒ xả đông lấy bình quân các dòng có giá, không đụng dòng đã có giá", () => {
    const s = suggestMaterialPrices([{ ...family, unitPrice: 150000 }, thaw], imports);
    expect(s.has("ho")).toBe(false);
    expect(s.get("xa")).toBe(150000);
  });
  test("chuyến nguồn không có giá nào ⇒ không đoán", () => {
    const s = suggestMaterialPrices([family, thaw], [pricedImport("i1", 1960, null)]);
    expect(s.size).toBe(0);
  });
  test("dòng tay khác (bột, phế liệu) không đoán giá", () => {
    const batterRow = gridRow({ id: "bot", total: 20, group: "Phụ gia" });
    expect(suggestMaterialPrices([{ ...family, unitPrice: 150000 }, batterRow], imports).has("bot")).toBe(false);
  });
});

describe("salesItemToOutput — hút dòng bán vào kỳ", () => {
  const invoice: SalesInvoice = {
    id: "p1", deliveryDate: "2026-10-12", postingDate: "2026-10-12", backdateReason: "",
    workshop: "Đông" as SalesInvoice["workshop"], customerId: "kh7", channel: "Xuất khẩu", note: "",
  };
  const item: SalesItem = {
    id: "b1", invoiceId: "p1", deliveryDate: "2026-10-12", productId: "sp1", spec: "Khay 1 kg",
    quantityKg: 25, unitPrice: 7.5, sourceWarehouse: "",
  };
  const testPeriod = { id: "k1", startDate: "2026-10-12", endDate: "2026-10-16" };

  test("số kg vào ô NGÀY giao — trước đây chỉ đặt quantityKg nên lưới mất kg", () => {
    const o = salesItemToOutput(item, invoice, testPeriod, "o1");
    expect(o.dailyQuantities).toEqual({ "2026-10-12": 25 });
    expect(o).toMatchObject({ periodId: "k1", productId: "sp1", customerId: "kh7", unitPrice: 7.5, spec: "Khay 1 kg", salesItemId: "b1" });
  });
  test("ngày giao của dòng ngoài kỳ ⇒ lấy ngày phiếu", () => {
    const o = salesItemToOutput({ ...item, deliveryDate: "2026-10-20" }, invoice, testPeriod, "o1");
    expect(o.dailyQuantities).toEqual({ "2026-10-12": 25 });
  });
  test("dòng hút hỏng (không kg) nhận ra để hút lại; dòng có kg / có chuyển kỳ thì không", () => {
    const base: BalancingOutputItem = { id: "x", periodId: "k1", productId: "sp1", customerId: "", channel: "Xuất khẩu", quantityKg: 25, unitPrice: null, salesItemId: "b1", dailyQuantities: {} };
    expect(isEmptyPulledSalesOutput(base)).toBe(true);
    expect(isEmptyPulledSalesOutput({ ...base, dailyQuantities: { "2026-10-12": 25 } })).toBe(false);
    expect(isEmptyPulledSalesOutput({ ...base, carryOverKg: 10 })).toBe(false);
    expect(isEmptyPulledSalesOutput({ ...base, salesItemId: "" })).toBe(false);
  });
});

describe("sumFinishedGoodAmounts — tổng tiền thành phẩm tách kênh", () => {
  test("nội địa (đồng) không cộng vào USD — số thật kỳ demo 12–16/10", () => {
    const rows = [
      { channel: "Xuất khẩu" as const, total: 500, unitPrice: 9.8 },
      { channel: "Xuất khẩu" as const, total: 25, unitPrice: 7.5 },
      { channel: "Nội địa" as const, total: 45, unitPrice: 128000 },
      { channel: "Xuất khẩu" as const, total: 0, unitPrice: null },
    ];
    expect(sumFinishedGoodAmounts(rows)).toEqual({ exportKg: 525, exportUsd: 5087.5, domesticKg: 45, domesticVnd: 5760000 });
  });
  test("dòng chưa có giá vẫn tính kg, tiền 0", () => {
    expect(sumFinishedGoodAmounts([{ channel: "Xuất khẩu", total: 100, unitPrice: null }])).toEqual({ exportKg: 100, exportUsd: 0, domesticKg: 0, domesticVnd: 0 });
  });
});
