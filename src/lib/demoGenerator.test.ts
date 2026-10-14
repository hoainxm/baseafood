import { describe, expect, it } from "vitest";
import type { MaterialImportItem, Product, Supplier } from "@/types";
import { scanDemoParams, generateDemoBundle, type DemoBundle, type DemoSource } from "./demoGenerator";
import { computeLotMassBalance } from "./lotTraceability";
import { buildFlowStages, buildChainWarnings, buildDataFlow, computeAllPeriodResults, type DataFlowInput } from "./dataFlow";
import { computeWipStockDetail, collectWipDeductions } from "./inventory";
import { sumGridRow } from "@/types";

const makeProduct = (id: string, materialTypeId: string): Product => ({ id, code: id, name: `Mặt hàng ${id}`, finishedGoodCode: "", materialTypeId });
const makeImport = (i: number, workshop: MaterialImportItem["workshop"], material: string, supplier: string, kg: number): MaterialImportItem => ({
  id: `n${i}`, shipmentId: `c${i}`, deliveryDate: "2026-09-01", workshop, category: "Mực", supplierName: supplier,
  materialTypeName: material, quantityKg: kg, unitPrice: 55_000, driverName: "", licensePlate: "", note: "",
});
const makeSupplier = (name: string): Supplier => ({ id: `s-${name}`, code: "", shortName: name, billingName: `Cơ sở ${name}`, address: "12 Lê Lợi", nationalId: "0123", issuedDate: "", issuedPlace: "", phone: "0909555111", note: "" });

const SOURCE: DemoSource = {
  products: [makeProduct("p1", "m1"), makeProduct("p2", "m1"), makeProduct("p3", "m2"), makeProduct("p4", "m2")],
  materialTypes: [
    { id: "m1", name: "Mực ống", category: "Mực", note: "" },
    { id: "m2", name: "Bạch tuộc 2 da", category: "Bạch tuộc", note: "" },
  ],
  suppliers: [makeSupplier("Hồng Phú"), makeSupplier("Bê 3")],
  customers: [{ id: "k1", code: "", name: "Hanwa", market: "Nhật Bản" }, { id: "k2", code: "", name: "Chợ Bà Rịa", market: "Nội địa" }],
  batterTypes: [],
  storageLocations: [],
  imports: [makeImport(1, "Đông", "Mực ống", "Hồng Phú", 1_000), makeImport(2, "Đông", "Mực ống", "Bê 3", 1_500), makeImport(3, "Khô", "Bạch tuộc 2 da", "Hồng Phú", 800)],
  wips: [],
  periods: [],
  balancingInputs: [],
  balancingOutputs: [],
  nxtSnapshots: [],
  monthlyStock: [],
};
const TODAY = "2026-10-12";
const bundle = generateDemoBundle(SOURCE, { today: TODAY });

const toFlowData = (g: DemoBundle): DataFlowInput => ({
  shipments: g.shipments, imports: g.imports, wips: g.wips, packagings: g.packagings, lotInputs: g.lotInputs,
  exportItems: g.exportItems, exportOrders: g.exportOrders, salesOrders: g.salesOrders, products: g.products,
  customers: g.customers, salesItems: g.salesItems, salesInvoices: g.salesInvoices, domesticSales: g.domesticSales,
  lotDispatches: g.lotDispatches, lotWaivers: g.lotWaivers, labelPrints: g.labelPrints, materialTypes: g.materialTypes,
  scraps: g.scraps, dailyLocks: g.dailyLocks, productionLocks: g.productionLocks, periods: g.periods,
  balancingInputs: g.balancingInputs, balancingOutputs: g.balancingOutputs, materialOpening: g.materialOpening,
  finishedOpening: g.finishedOpening,
});

describe("scanDemoParams", () => {
  it("lấy xưởng, NL từng xưởng, đại lý theo kg từ sổ thật", () => {
    const ts = scanDemoParams(SOURCE);
    expect(ts.workshops).toEqual(["Đông", "Khô"]);
    expect(ts.materialsByWorkshop["Đông"]).toEqual(["Mực ống"]);
    expect(ts.suppliers).toEqual(["Hồng Phú", "Bê 3"]); // 1.800 kg > 1.500 kg
    expect(ts.productsByMaterial["Mực ống"]).toEqual(["p1", "p2"]);
    expect(ts.finishedRate).toBe(0.45); // chưa có kỳ cân đối ⇒ mặc định
  });
});

describe("generateDemoBundle", () => {
  it("nhiều hạt khác nhau vẫn giữ mọi bất biến (bán vượt đúng 1 ca, lô không âm, đủ cảnh báo)", () => {
    for (const hat of [1, 7, 42, 99, 2026, 31337]) {
      const g = generateDemoBundle(SOURCE, { today: TODAY, hat });
      const d = toFlowData(g);
      expect(computeWipStockDetail(g.wips, g.exportItems, collectWipDeductions(g.salesItems, g.packagings, g.lotInputs, g.lotDispatches)).oversales.length, `hạt ${hat}`).toBe(1);
      for (const w of g.wips) expect(computeLotMassBalance("W", w.id, d)?.remainingKg ?? 0, `hạt ${hat} W:${w.id}`).toBeGreaterThanOrEqual(0);
      for (const r of g.imports) expect(computeLotMassBalance("S", r.id, d)?.remainingKg ?? 0, `hạt ${hat} S:${r.id}`).toBeGreaterThanOrEqual(0);
      const kinds = new Set(buildChainWarnings(d, { fromDate: "2026-08-14", toDate: TODAY }, TODAY).map((x) => x.kind));
      for (const l of ["imports-unlocked", "production-unlocked", "changed-after-lock", "oversold", "lot-unassigned", "approval-overdue", "yield-deviation"])
        expect(kinds.has(l as never), `hạt ${hat} ${l}`).toBe(true);
    }
  });

  it("tất định theo hạt", () => {
    expect(generateDemoBundle(SOURCE, { today: TODAY })).toEqual(bundle);
    expect(generateDemoBundle(SOURCE, { today: TODAY, hat: 7 }).imports).not.toEqual(bundle.imports);
  });

  it("đủ chuỗi: mọi bảng nửa sau đều có số", () => {
    for (const b of ["imports", "wips", "packagings", "exportItems", "salesItems", "domesticSales", "lotInputs", "lotDispatches", "lotWaivers", "labelPrints", "qcChecklists", "periods", "balancingOutputs"] as const)
      expect(bundle[b].length, b).toBeGreaterThan(0);
  });

  it("ngày nằm trong 60 ngày tới hôm nay, Chủ nhật không nhập", () => {
    const ngays = bundle.imports.map((r) => r.deliveryDate).sort();
    expect(ngays[0] >= "2026-08-14").toBe(true);
    expect(ngays[ngays.length - 1] <= TODAY).toBe(true);
    expect(bundle.imports.every((r) => new Date(`${r.deliveryDate}T00:00:00Z`).getUTCDay() !== 0)).toBe(true);
  });

  it("ẩn danh: không lộ tên đại lý / khách / địa chỉ thật", () => {
    const text = JSON.stringify([bundle.suppliers, bundle.customers, bundle.shipments, bundle.imports]);
    for (const that of ["Hồng Phú", "Bê 3", "Hanwa", "Chợ Bà Rịa", "12 Lê Lợi", "0909555111"]) expect(text).not.toContain(that);
    expect(bundle.suppliers.map((s) => s.shortName)).toEqual(["Đại lý 01", "Đại lý 02"]);
    // Tắt ẩn danh ⇒ giữ tên thật.
    expect(generateDemoBundle(SOURCE, { today: TODAY, anonymize: false }).suppliers[0].shortName).toBe("Hồng Phú");
  });

  it("mọi tham chiếu lô / đơn / lệnh đều trỏ tới bản ghi có trong gói", () => {
    const existing = new Set([...bundle.imports, ...bundle.wips, ...bundle.packagings, ...bundle.salesItems, ...bundle.exportItems, ...bundle.domesticSales].map((x) => x.id));
    for (const l of bundle.lotInputs) expect(existing.has(l.outputId) && existing.has(l.inputId), l.id).toBe(true);
    for (const l of bundle.lotDispatches) expect(existing.has(l.lotId) && existing.has(l.docId), l.id).toBe(true);
    const exportOrderIds = new Set(bundle.exportOrders.map((x) => x.id));
    for (const x of bundle.exportItems) expect(exportOrderIds.has(x.exportId) && existing.has(x.wipId)).toBe(true);
    const salesInvoice = new Set(bundle.salesInvoices.map((x) => x.id));
    for (const b of bundle.salesItems) expect(salesInvoice.has(b.invoiceId)).toBe(true);
  });

  it("đơn đặt nào đã tới ngày xuất cũng có lệnh xuất", () => {
    const closedOrders = bundle.salesOrders.filter((d) => d.status === "closed");
    expect(closedOrders.length).toBeGreaterThan(0);
    for (const d of closedOrders) expect(bundle.exportOrders.some((l) => l.orderId === d.id), d.id).toBe(true);
  });

  it("id không trùng trong từng bảng", () => {
    for (const [table, items] of Object.entries(bundle) as [string, { id?: string; code?: string }[]][]) {
      const keys = items.map((x) => x.id ?? x.code);
      expect(new Set(keys).size, table).toBe(keys.length);
    }
  });

  it("chỉ đúng MỘT ca bán vượt tồn (cài sẵn), còn lại tồn không âm", () => {
    const result = computeWipStockDetail(bundle.wips, bundle.exportItems, collectWipDeductions(bundle.salesItems, bundle.packagings, bundle.lotInputs, bundle.lotDispatches));
    expect(result.oversales.length).toBe(1);
    expect(result.los.every((l) => l.remainingKg >= -1e-6)).toBe(true);
  });

  it("hộ chiếu lô: không lô nào bị dùng quá số kg (cân bằng lô không âm)", () => {
    const d = toFlowData(bundle);
    const lot = [...bundle.imports.map((x) => ["S", x.id] as const), ...bundle.wips.map((x) => ["W", x.id] as const), ...bundle.packagings.map((x) => ["P", x.id] as const)];
    for (const [k, id] of lot) {
      const cb = computeLotMassBalance(k, id, d);
      if (cb) expect(cb.remainingKg, `${k}:${id}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("đủ ca cho mọi loại cảnh báo của Tổng quan", () => {
    const d = toFlowData(bundle);
    const cb = buildChainWarnings(d, { fromDate: "2026-08-14", toDate: TODAY }, TODAY);
    const kinds = new Set(cb.map((x) => x.kind));
    for (const l of ["imports-unlocked", "production-unlocked", "changed-after-lock", "backdated", "oversold", "lot-unassigned", "approval-overdue", "yield-deviation"])
      expect(kinds.has(l as never), l).toBe(true);
  });

  it("dòng kỳ cân đối mang sản lượng theo ngày khớp tổng (lưới tính lại từ ngày)", () => {
    for (const r of [...bundle.balancingInputs, ...bundle.balancingOutputs])
      expect(sumGridRow(r.dailyQuantities, r.carryOverKg), r.id).toBeCloseTo(r.quantityKg, 6);
  });

  it("kỳ cân đối có kỳ lãi và kỳ lỗ", () => {
    const period = computeAllPeriodResults(toFlowData(bundle)).filter((x) => x.hasFinishedGoods);
    expect(period.length).toBeGreaterThanOrEqual(3);
    expect(period.some((x) => x.result.profitOrLoss > 0)).toBe(true);
    expect(period.some((x) => x.result.profitOrLoss < 0)).toBe(true);
  });

  it("dòng chảy đi đủ 5 khâu", () => {
    const d = toFlowData(bundle);
    const k = { fromDate: "2026-08-14", toDate: TODAY };
    expect(buildFlowStages(d, k).every((x) => x.kg > 0)).toBe(true);
    const ids = new Set(buildDataFlow(d, k).nodes.map((n) => n.id));
    for (const n of ["wip", "warehouse", "packaging", "export-order", "block-sale", "packaged-sale", "scrap", "leftover", "domestic-sale"]) expect(ids.has(n), n).toBe(true);
  });
});
