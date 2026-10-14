import { describe, expect, it } from "vitest";
import type {
  BalancingInputItem,
  BalancingOutputItem,
  BalancingPeriod,
  DailyLock,
  ExportItem,
  ExportOrder,
  ImportShipment,
  LotInput,
  MaterialImportItem,
  Packaging,
  SalesInvoice,
  SalesItem,
  WipProductionItem,
  Workshop,
} from "@/types";
import { RETAIL_WAREHOUSE, FG_WAREHOUSE } from "./inventory";
import {
  buildFlowStages,
  listDatesInRange,
  buildChainWarnings,
  buildDailyFlowSeries,
  computeYieldByProduct,
  buildDataFlow,
  computeAllPeriodResults,
  splitOutflows,
  bucketStockByAge,
  countQcByDay,
  type DataFlowInput,
  type DataFlow,
} from "./dataFlow";

const makeShipment = (id: string, date: string, workshop: Workshop, supplier = "Hồng Phú", bookDate = date): ImportShipment => ({
  id, deliveryDate: date, postingDate: bookDate, backdateReason: bookDate > date ? "quên ghi" : "", workshop,
  supplierName: supplier, driverName: "", licensePlate: "", note: "",
});
const makeImport = (id: string, shipmentId: string, date: string, workshop: Workshop, kg: number, supplier = "Hồng Phú"): MaterialImportItem => ({
  id, shipmentId, deliveryDate: date, workshop, category: "Mực", supplierName: supplier, materialTypeName: "Mực ống",
  quantityKg: kg, unitPrice: 50000, driverName: "", licensePlate: "", note: "",
});
const wip = (id: string, date: string, workshop: Workshop, kg: number, status: WipProductionItem["status"] = "stocked", productId = "mh1"): WipProductionItem => ({
  id, productionDate: date, postingDate: date, backdateReason: "", workshop, productId, spec: "",
  quantityKg: kg, blocksCount: 0, warehouse: "", status, note: "",
});
const packaging = (id: string, date: string, inputKg: number, output: number): Packaging => ({
  id, date, workshop: "Đông", fromProductId: "mh1", fromSpec: "", inputKg, inputBlocks: 0,
  toProductId: "mh2", toSpec: "", outputKg: output, outputUnits: 1, warehouse: "", note: "",
});
const makeSalesInvoice = (id: string, date: string): SalesInvoice => ({
  id, deliveryDate: date, postingDate: date, backdateReason: "", workshop: "Đông", customerId: "k1", channel: "Nội địa", note: "",
});
const sale = (id: string, invoiceId: string, date: string, productId: string, kg: number, source: string): SalesItem => ({
  id, invoiceId, deliveryDate: date, productId, spec: "", quantityKg: kg, unitPrice: 1, sourceWarehouse: source,
});
const makeLock = (date: string, workshop: Workshop, kg: number, leftoverKg = 0): DailyLock => ({
  id: `${date}|${workshop}`, lockDate: date, workshop, isLocked: true, lockedAt: "", totalKgAtLock: kg,
  reopenReason: "", note: "", leftoverKg,
});
const lotInput = (outputId: string, kg: number | null): LotInput => ({
  id: `li-${outputId}`, outputKind: "W", outputId, inputKind: "S", inputId: "n1", inputLabel: "", material: "",
  quantityKg: kg, method: "picked", operator: "", recordedAt: "",
});

function makeFlowData(p: Partial<DataFlowInput> = {}): DataFlowInput {
  return {
    shipments: [], imports: [], wips: [], packagings: [], lotInputs: [], exportItems: [], exportOrders: [],
    salesOrders: [], products: [{ id: "mh1", code: "", name: "Mực cắt", finishedGoodCode: "" }, { id: "mh2", code: "", name: "Mực khay", finishedGoodCode: "" }],
    customers: [], salesItems: [], salesInvoices: [], domesticSales: [], lotDispatches: [], lotWaivers: [], labelPrints: [],
    scraps: [], dailyLocks: [], productionLocks: [], periods: [], balancingInputs: [], balancingOutputs: [],
    materialOpening: [], finishedOpening: [],
    ...p,
  };
}

/** Bất biến: mọi nút có cả vào lẫn ra ⇒ Σ vào = Σ ra. */
function checkBalance(dc: DataFlow) {
  for (const n of dc.nodes) {
    const inputKg = dc.edges.filter((c) => c.target === n.id).reduce((s, c) => s + c.kg, 0);
    const output = dc.edges.filter((c) => c.source === n.id).reduce((s, c) => s + c.kg, 0);
    if (inputKg > 0 && output > 0) expect(Math.abs(inputKg - output), n.id).toBeLessThan(1e-6);
  }
  for (const c of dc.edges) expect(c.kg).toBeGreaterThan(0);
}

const K = { fromDate: "2026-09-01", toDate: "2026-09-30" };

// Kịch bản chuỗi: 1.000 kg NL → 600 kg BTP (500 nhập kho, 100 chờ) + phế 50 + còn dở 100
// → kho: đóng gói 300 (ra 290), xuất đơn 100, bán block 50 → TP: bán 200.
const flowScenario = makeFlowData({
  shipments: [makeShipment("c1", "2026-09-02", "Đông")],
  imports: [makeImport("n1", "c1", "2026-09-02", "Đông", 1000)],
  wips: [wip("w1", "2026-09-02", "Đông", 500), wip("w2", "2026-09-03", "Đông", 100, "pending")],
  scraps: [{ id: "pl1", periodId: "", name: "Nội tạng", quantityKg: 50, sellingPrice: 0, date: "2026-09-02", workshop: "Đông", source: "Nhập hàng" }],
  productionLocks: [makeLock("2026-09-02", "Đông", 500, 100)],
  dailyLocks: [makeLock("2026-09-02", "Đông", 1000)],
  packagings: [packaging("g1", "2026-09-05", 300, 290)],
  exportOrders: [{ id: "lx1", orderId: "d1", exportDate: "2026-09-06", status: "closed", note: "" } as ExportOrder],
  exportItems: [{ id: "x1", exportId: "lx1", wipId: "w1", productId: "mh1", spec: "", quantityKg: 100, blocksCount: 0 } as ExportItem],
  salesInvoices: [makeSalesInvoice("pb1", "2026-09-07")],
  salesItems: [sale("b1", "pb1", "2026-09-07", "mh1", 50, RETAIL_WAREHOUSE), sale("b2", "pb1", "2026-09-07", "mh2", 200, FG_WAREHOUSE)],
});

describe("listDatesInRange", () => {
  it("liệt kê đủ ngày, qua tháng không lệch múi giờ", () => {
    expect(listDatesInRange("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(listDatesInRange("2026-10-02", "2026-10-01")).toEqual([]);
  });
});

describe("buildDataFlow", () => {
  it("đi đủ chuỗi, cân bằng kg ở mọi nút, gọi tên phần hụt", () => {
    const dc = buildDataFlow(flowScenario, K);
    checkBalance(dc);
    const kg = (source: string, target: string) => dc.edges.find((c) => c.source === source && c.target === target)?.kg ?? 0;
    expect(dc.totalImportedKg).toBe(1000);
    expect(kg("supplier:Hồng Phú", "workshop:Đông")).toBe(1000);
    expect(kg("workshop:Đông", "wip")).toBe(600);
    expect(kg("workshop:Đông", "scrap")).toBe(50);
    expect(kg("workshop:Đông", "leftover")).toBe(100);
    expect(kg("workshop:Đông", "loss")).toBe(250); // 1000 − 600 − 50 − 100
    expect(kg("wip", "warehouse")).toBe(500);
    expect(kg("wip", "pending-approval")).toBe(100);
    expect(kg("warehouse", "packaging")).toBe(300);
    expect(kg("warehouse", "export-order")).toBe(100);
    expect(kg("warehouse", "block-sale")).toBe(50);
    expect(kg("warehouse", "wip-stock")).toBe(50);
    expect(kg("packaging", "packaged-sale")).toBe(200);
    expect(kg("packaging", "fg-stock")).toBe(90);
    expect(kg("packaging", "packaging-loss")).toBe(10);
    // 6 cột: không có nút TP đóng gói riêng.
    expect(Math.max(...dc.nodes.map((n) => n.column))).toBe(5);
  });

  it("ra nhiều hơn vào ⇒ thêm nút nguồn 'tồn trước kỳ', vẫn cân bằng", () => {
    // Kỳ tháng 10: không SX, chỉ xuất 100 kg từ mẻ tháng 9 + SX nhiều hơn nhập.
    const d = makeFlowData({
      imports: [makeImport("n2", "c2", "2026-10-01", "Cá", 100)],
      wips: [wip("w9", "2026-09-20", "Cá", 300), wip("w10", "2026-10-01", "Cá", 150)],
      exportOrders: [{ id: "lx", orderId: "d", exportDate: "2026-10-02", status: "closed", note: "" } as ExportOrder],
      exportItems: [{ id: "x", exportId: "lx", wipId: "w9", productId: "mh1", spec: "", quantityKg: 250, blocksCount: 0 } as ExportItem],
    });
    const dc = buildDataFlow(d, { fromDate: "2026-10-01", toDate: "2026-10-31" });
    checkBalance(dc);
    expect(dc.edges.find((c) => c.source === "material-prior")?.kg).toBe(50);
    expect(dc.edges.find((c) => c.source === "wip-opening")?.kg).toBe(100);
  });

  it("đóng gói ra vượt BTP vào ⇒ gọi tên phần dư, vẫn cân bằng", () => {
    const d = makeFlowData({ wips: [wip("w", "2026-09-02", "Đông", 100)], packagings: [packaging("g", "2026-09-03", 50, 60)] });
    const dc = buildDataFlow(d, K);
    checkBalance(dc);
    expect(dc.edges.find((c) => c.source === "packaging-excess")?.kg).toBe(10);
    expect(dc.edges.find((c) => c.target === "fg-stock")?.kg).toBe(60);
  });

  it("lọc xưởng: chỉ còn số của xưởng đó", () => {
    const d = makeFlowData({
      imports: [makeImport("a", "c", "2026-09-02", "Đông", 100), makeImport("b", "c", "2026-09-02", "Khô", 70, "Bê 3")],
    });
    const dc = buildDataFlow(d, { ...K, workshop: "Khô" });
    expect(dc.totalImportedKg).toBe(70);
    expect(dc.nodes.some((n) => n.id === "workshop:Đông")).toBe(false);
  });

  it("gộp đại lý nhỏ thành 'Đại lý khác' khi quá 5", () => {
    const items = ["A", "B", "C", "D", "E", "F", "G"].map((t, i) => makeImport(`n${i}`, "c", "2026-09-02", "Đông", 100 - i, t));
    const dc = buildDataFlow(makeFlowData({ imports: items }), K);
    expect(dc.nodes.filter((n) => n.group === "source").map((n) => n.label)).toEqual(["A", "B", "C", "D", "E", "Đại lý khác"]);
    expect(dc.edges.find((c) => c.source === "supplier:*")?.kg).toBe(94 + 95);
  });
});

describe("splitOutflows", () => {
  it("chia phần ra của các xưởng: cộng đủ 100%, theo thứ tự cho trước", () => {
    const items = splitOutflows(buildDataFlow(flowScenario, K), (id) => id.startsWith("workshop:"), ["wip", "scrap", "leftover", "loss"]);
    expect(items.map((x) => [x.id, x.kg])).toEqual([["wip", 600], ["scrap", 50], ["leftover", 100], ["loss", 250]]);
    expect(items.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
    expect(items[0].share).toBeCloseTo(0.6);
  });
  it("phần ra của kho: id ngoài thứ tự xếp sau theo kg giảm dần", () => {
    const items = splitOutflows(buildDataFlow(flowScenario, K), (id) => id === "warehouse", ["packaging"]);
    expect(items.map((x) => x.id)).toEqual(["packaging", "export-order", "block-sale", "wip-stock"]);
  });
  it("không có dải nào ⇒ rỗng", () => {
    expect(splitOutflows({ nodes: [], edges: [], totalImportedKg: 0 }, () => true)).toEqual([]);
  });
});

describe("buildFlowStages", () => {
  it("kg từng khâu, kg chờ duyệt, tỉ lệ chuyển tiếp", () => {
    const conveyor = buildFlowStages(flowScenario, K);
    expect(conveyor.map((x) => x.key)).toEqual(["imports", "production", "warehouse", "packaging", "outbound"]);
    expect(conveyor.map((x) => x.kg)).toEqual([1000, 600, 500, 290, 350]);
    expect(conveyor[2].kgCho).toBe(100);
    expect(conveyor[0].conversionRate).toBeNull();
    expect(conveyor[1].conversionRate).toBeCloseTo(0.6);
    // Đóng gói và xuất/bán cùng rút từ kho ⇒ chia cho kg nhập kho, không chia nối tiếp.
    expect(conveyor[3].conversionRate).toBeCloseTo(290 / 500);
    expect(conveyor[4].conversionRate).toBeCloseTo(350 / 500);
    // Mẻ chưa gắn lô ⇒ khâu SX có việc thiếu.
    expect(conveyor[1].missingTaskCount).toBeGreaterThan(0);
  });
});

describe("buildDailyFlowSeries", () => {
  it("tồn BTP + TP cuối ngày theo đúng engine sổ tồn", () => {
    const items = buildDailyFlowSeries(flowScenario, { fromDate: "2026-09-01", toDate: "2026-09-07" });
    const date = (n: string) => items.find((x) => x.date === n)!;
    expect(items).toHaveLength(7);
    expect(date("2026-09-01").wipStockKg).toBe(0);
    expect(date("2026-09-02")).toMatchObject({ importedKg: 1000, producedKg: 500, wipStockKg: 500 });
    expect(date("2026-09-03")).toMatchObject({ producedKg: 100, wipStockKg: 500 }); // mẻ chờ duyệt chưa vào kho
    expect(date("2026-09-05")).toMatchObject({ wipStockKg: 200, finishedStockKg: 290 });
    expect(date("2026-09-07")).toMatchObject({ wipStockKg: 50, finishedStockKg: 90 });
  });
});

describe("computeYieldByProduct", () => {
  it("chỉ tính mẻ đã gắn lô có kg, bình quân gia quyền, cờ lệch ±5%", () => {
    const d = makeFlowData({
      wips: [wip("a", "2026-09-02", "Đông", 100), wip("b", "2026-09-02", "Đông", 100, "stocked", "mh2"), wip("c", "2026-09-02", "Đông", 100)],
      lotInputs: [lotInput("a", 110), lotInput("b", 130), lotInput("c", null)],
    });
    const { rows: row, binhQuan } = computeYieldByProduct(d, K);
    expect(binhQuan).toBeCloseTo(240 / 200);
    expect(row.map((r) => [r.productId, r.yieldRatio, r.exceedsThreshold])).toEqual([
      ["mh2", 1.3, true],
      ["mh1", 1.1, true],
    ]);
    // Ngưỡng nới 10% ⇒ không còn cờ (lệch ±8,3%).
    expect(computeYieldByProduct(d, K, 0.1).rows.every((r) => !r.exceedsThreshold)).toBe(true);
  });
  it("chưa mẻ nào gắn lô ⇒ rỗng, không đoán", () => {
    expect(computeYieldByProduct(flowScenario, K)).toEqual({ rows: [], binhQuan: null });
  });
});

describe("buildChainWarnings", () => {
  it("bắt ngày chưa chốt, đổi sau chốt, ghi bù, chờ duyệt lâu, lô chưa gắn", () => {
    const d = makeFlowData({
      ...flowScenario,
      shipments: [...flowScenario.shipments, makeShipment("c9", "2026-09-10", "Cá", "Bê 3", "2026-09-12")],
      imports: [...flowScenario.imports, makeImport("n9", "c9", "2026-09-10", "Cá", 80, "Bê 3"), makeImport("n10", "c1", "2026-09-02", "Đông", 5)],
    });
    const cb = buildChainWarnings(d, K, "2026-09-20");
    const warningsOfKind = (l: string) => cb.filter((x) => x.kind === l);
    expect(warningsOfKind("changed-after-lock")).toHaveLength(1); // chốt 1.000, nay 1.005
    expect(warningsOfKind("imports-unlocked").map((x) => x.workshop)).toEqual(["Cá"]);
    expect(warningsOfKind("production-unlocked").map((x) => x.date)).toEqual(["2026-09-03"]);
    expect(warningsOfKind("backdated").map((x) => x.id)).toEqual(["gbn|c9"]);
    expect(warningsOfKind("approval-overdue").map((x) => x.path)).toEqual(["/warehouse?approve=W:w2"]);
    expect(warningsOfKind("lot-unassigned").length).toBeGreaterThan(0);
    // Lỗi đứng trước nhắc, nhắc trước tin.
    const order = cb.map((x) => x.level);
    expect(order.indexOf("info")).toBeGreaterThan(order.lastIndexOf("error"));
  });

  it("hôm nay chưa chốt thì chưa nhắc", () => {
    const cb = buildChainWarnings(makeFlowData({ imports: [makeImport("n", "c", "2026-09-20", "Đông", 10)] }), K, "2026-09-20");
    expect(cb.filter((x) => x.kind === "imports-unlocked")).toEqual([]);
  });

  it("bán vượt tồn BTP được gọi tên", () => {
    const d = makeFlowData({
      wips: [wip("w", "2026-09-02", "Đông", 100)],
      salesInvoices: [makeSalesInvoice("pb", "2026-09-03")],
      salesItems: [sale("b", "pb", "2026-09-03", "mh1", 130, RETAIL_WAREHOUSE)],
    });
    const cb = buildChainWarnings(d, K, "2026-09-20").filter((x) => x.kind === "oversold");
    expect(cb).toHaveLength(1);
    expect(cb[0].title).toContain("30 kg");
  });

  it("kỳ cân đối định mức lệch bình quân các kỳ cùng loại NL", () => {
    const period = (id: string, start: string): BalancingPeriod => ({
      id, materialTypeName: "Bạch tuộc", dateRangeDescription: id, startDate: start, endDate: start,
      totalInputKg: null, exchangeRate: 25000, processingCostPerKg: 0, createdAt: start,
    });
    const inputKg = (periodId: string, kg: number) => ({ id: `i${periodId}`, periodId, groupName: "Thủy sản", name: "BT", quantityKg: kg, unitPrice: 1, ratioPercentage: null }) as BalancingInputItem;
    const output = (periodId: string, kg: number) => ({ id: `o${periodId}`, periodId, productId: "mh1", customerId: "", channel: "Nội địa", quantityKg: kg, unitPrice: 1 }) as BalancingOutputItem;
    const d = makeFlowData({
      periods: [period("k1", "2026-09-05"), period("k2", "2026-09-10"), period("k3", "2026-09-15")],
      balancingInputs: [inputKg("k1", 2000), inputKg("k2", 2000), inputKg("k3", 2400)],
      balancingOutputs: [output("k1", 1000), output("k2", 1000), output("k3", 1000)],
    });
    expect(computeAllPeriodResults(d).map((x) => x.period.id)).toEqual(["k3", "k2", "k1"]);
    const cb = buildChainWarnings(d, K, "2026-09-20").filter((x) => x.kind === "period-yield-deviation");
    // Bình quân 6400/3000 = 2,133: k3 (2,4) +12,5% · k1/k2 (2,0) −6,25%.
    expect(cb.map((x) => x.id).sort()).toEqual(["kdm|k1", "kdm|k2", "kdm|k3"]);
  });
});

describe("bucketStockByAge", () => {
  it("chia kg tồn theo số ngày nằm kho, bỏ lô hết hàng", () => {
    const items = bucketStockByAge(
      [
        { productionDate: "2026-10-01", remainingKg: 100 }, // 11 ngày
        { productionDate: "2026-09-12", remainingKg: 50 }, // 30 ngày ⇒ nhóm 30–60
        { productionDate: "2026-07-01", remainingKg: 20 }, // 103 ngày
        { productionDate: "2026-07-01", remainingKg: 0 }, // hết hàng
      ],
      "2026-10-12",
    );
    expect(items.map((x) => [x.key, x.kg, x.lotCount])).toEqual([
      ["under-30", 100, 1],
      ["30-60", 50, 1],
      ["60-90", 0, 0],
      ["over-90", 20, 1],
    ]);
  });
});

describe("countQcByDay", () => {
  it("đếm theo ngày + xưởng, đủ ngày kể cả ngày trống", () => {
    const r = (date: string, workshop: Workshop, result: "pass" | "conditional" | "fail") => ({ date, workshop, result });
    const items = countQcByDay([r("2026-10-01", "Đông", "pass"), r("2026-10-01", "Đông", "fail"), r("2026-10-01", "Cá", "pass"), r("2026-10-03", "Đông", "conditional")], "Đông", "2026-10-01", "2026-10-03");
    expect(items).toEqual([
      { date: "2026-10-01", pass: 1, conditional: 0, fail: 1 },
      { date: "2026-10-02", pass: 0, conditional: 0, fail: 0 },
      { date: "2026-10-03", pass: 0, conditional: 1, fail: 0 },
    ]);
  });
});
