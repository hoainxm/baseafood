import { describe, expect, it } from "vitest";
import type { MaterialImportItem, Product, Supplier } from "@/types";
import { scanDemoParams, generateDemoBundle, type GoiDemo, type DemoSource } from "./demoGenerator";
import { computeLotMassBalance } from "./lotTraceability";
import { buildFlowStages, buildChainWarnings, buildDataFlow, computeAllPeriodResults, type DataFlowInput } from "./dataFlow";
import { computeWipStockDetail, collectWipDeductions } from "./inventory";
import { sumGridRow } from "@/types";

const makeProduct = (id: string, materialTypeId: string): Product => ({ id, code: id, name: `Mặt hàng ${id}`, finishedGoodCode: "", materialTypeId });
const makeImport = (i: number, workshop: MaterialImportItem["workshop"], material: string, dl: string, kg: number): MaterialImportItem => ({
  id: `n${i}`, shipmentId: `c${i}`, deliveryDate: "2026-09-01", workshop, category: "Mực", supplierName: dl,
  materialTypeName: material, quantityKg: kg, unitPrice: 55_000, driverName: "", licensePlate: "", note: "",
});
const makeSupplier = (ten: string): Supplier => ({ id: `s-${ten}`, code: "", shortName: ten, billingName: `Cơ sở ${ten}`, address: "12 Lê Lợi", nationalId: "0123", issuedDate: "", issuedPlace: "", phone: "0909555111", note: "" });

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
const goi = generateDemoBundle(SOURCE, { homNay: TODAY });

const toFlowData = (g: GoiDemo): DataFlowInput => ({
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
    expect(ts.xuong).toEqual(["Đông", "Khô"]);
    expect(ts.nlTheoXuong["Đông"]).toEqual(["Mực ống"]);
    expect(ts.daiLy).toEqual(["Hồng Phú", "Bê 3"]); // 1.800 kg > 1.500 kg
    expect(ts.matHangTheoNL["Mực ống"]).toEqual(["p1", "p2"]);
    expect(ts.tiLeTP).toBe(0.45); // chưa có kỳ cân đối ⇒ mặc định
  });
});

describe("generateDemoBundle", () => {
  it("nhiều hạt khác nhau vẫn giữ mọi bất biến (bán vượt đúng 1 ca, lô không âm, đủ cảnh báo)", () => {
    for (const hat of [1, 7, 42, 99, 2026, 31337]) {
      const g = generateDemoBundle(SOURCE, { homNay: TODAY, hat });
      const d = toFlowData(g);
      expect(computeWipStockDetail(g.wips, g.exportItems, collectWipDeductions(g.salesItems, g.packagings, g.lotInputs, g.lotDispatches)).banVuot.length, `hạt ${hat}`).toBe(1);
      for (const w of g.wips) expect(computeLotMassBalance("W", w.id, d)?.con ?? 0, `hạt ${hat} W:${w.id}`).toBeGreaterThanOrEqual(0);
      for (const r of g.imports) expect(computeLotMassBalance("S", r.id, d)?.con ?? 0, `hạt ${hat} S:${r.id}`).toBeGreaterThanOrEqual(0);
      const kinds = new Set(buildChainWarnings(d, { tu: "2026-08-14", den: TODAY }, TODAY).map((x) => x.loai));
      for (const l of ["chua-chot-nhap", "chua-chot-sx", "doi-sau-chot", "ban-vuot", "lo-chua-gan", "cho-duyet-lau", "dinh-muc-lech"])
        expect(kinds.has(l as never), `hạt ${hat} ${l}`).toBe(true);
    }
  });

  it("tất định theo hạt", () => {
    expect(generateDemoBundle(SOURCE, { homNay: TODAY })).toEqual(goi);
    expect(generateDemoBundle(SOURCE, { homNay: TODAY, hat: 7 }).imports).not.toEqual(goi.imports);
  });

  it("đủ chuỗi: mọi bảng nửa sau đều có số", () => {
    for (const b of ["imports", "wips", "packagings", "exportItems", "salesItems", "domesticSales", "lotInputs", "lotDispatches", "lotWaivers", "labelPrints", "qcChecklists", "periods", "balancingOutputs"] as const)
      expect(goi[b].length, b).toBeGreaterThan(0);
  });

  it("ngày nằm trong 60 ngày tới hôm nay, Chủ nhật không nhập", () => {
    const ngays = goi.imports.map((r) => r.deliveryDate).sort();
    expect(ngays[0] >= "2026-08-14").toBe(true);
    expect(ngays[ngays.length - 1] <= TODAY).toBe(true);
    expect(goi.imports.every((r) => new Date(`${r.deliveryDate}T00:00:00Z`).getUTCDay() !== 0)).toBe(true);
  });

  it("ẩn danh: không lộ tên đại lý / khách / địa chỉ thật", () => {
    const chu = JSON.stringify([goi.suppliers, goi.customers, goi.shipments, goi.imports]);
    for (const that of ["Hồng Phú", "Bê 3", "Hanwa", "Chợ Bà Rịa", "12 Lê Lợi", "0909555111"]) expect(chu).not.toContain(that);
    expect(goi.suppliers.map((s) => s.shortName)).toEqual(["Đại lý 01", "Đại lý 02"]);
    // Tắt ẩn danh ⇒ giữ tên thật.
    expect(generateDemoBundle(SOURCE, { homNay: TODAY, anDanh: false }).suppliers[0].shortName).toBe("Hồng Phú");
  });

  it("mọi tham chiếu lô / đơn / lệnh đều trỏ tới bản ghi có trong gói", () => {
    const co = new Set([...goi.imports, ...goi.wips, ...goi.packagings, ...goi.salesItems, ...goi.exportItems, ...goi.domesticSales].map((x) => x.id));
    for (const l of goi.lotInputs) expect(co.has(l.outputId) && co.has(l.inputId), l.id).toBe(true);
    for (const l of goi.lotDispatches) expect(co.has(l.lotId) && co.has(l.docId), l.id).toBe(true);
    const exportOrderIds = new Set(goi.exportOrders.map((x) => x.id));
    for (const x of goi.exportItems) expect(exportOrderIds.has(x.exportId) && co.has(x.wipId)).toBe(true);
    const salesInvoice = new Set(goi.salesInvoices.map((x) => x.id));
    for (const b of goi.salesItems) expect(salesInvoice.has(b.invoiceId)).toBe(true);
  });

  it("đơn đặt nào đã tới ngày xuất cũng có lệnh xuất", () => {
    const closedOrders = goi.salesOrders.filter((d) => d.status === "closed");
    expect(closedOrders.length).toBeGreaterThan(0);
    for (const d of closedOrders) expect(goi.exportOrders.some((l) => l.orderId === d.id), d.id).toBe(true);
  });

  it("id không trùng trong từng bảng", () => {
    for (const [bang, items] of Object.entries(goi) as [string, { id?: string; code?: string }[]][]) {
      const keys = items.map((x) => x.id ?? x.code);
      expect(new Set(keys).size, bang).toBe(keys.length);
    }
  });

  it("chỉ đúng MỘT ca bán vượt tồn (cài sẵn), còn lại tồn không âm", () => {
    const result = computeWipStockDetail(goi.wips, goi.exportItems, collectWipDeductions(goi.salesItems, goi.packagings, goi.lotInputs, goi.lotDispatches));
    expect(result.banVuot.length).toBe(1);
    expect(result.los.every((l) => l.conLai >= -1e-6)).toBe(true);
  });

  it("hộ chiếu lô: không lô nào bị dùng quá số kg (cân bằng lô không âm)", () => {
    const d = toFlowData(goi);
    const lo = [...goi.imports.map((x) => ["S", x.id] as const), ...goi.wips.map((x) => ["W", x.id] as const), ...goi.packagings.map((x) => ["P", x.id] as const)];
    for (const [k, id] of lo) {
      const cb = computeLotMassBalance(k, id, d);
      if (cb) expect(cb.con, `${k}:${id}`).toBeGreaterThanOrEqual(0);
    }
  });

  it("đủ ca cho mọi loại cảnh báo của Tổng quan", () => {
    const d = toFlowData(goi);
    const cb = buildChainWarnings(d, { tu: "2026-08-14", den: TODAY }, TODAY);
    const kinds = new Set(cb.map((x) => x.loai));
    for (const l of ["chua-chot-nhap", "chua-chot-sx", "doi-sau-chot", "ghi-bu", "ban-vuot", "lo-chua-gan", "cho-duyet-lau", "dinh-muc-lech"])
      expect(kinds.has(l as never), l).toBe(true);
  });

  it("dòng kỳ cân đối mang sản lượng theo ngày khớp tổng (lưới tính lại từ ngày)", () => {
    for (const r of [...goi.balancingInputs, ...goi.balancingOutputs])
      expect(sumGridRow(r.dailyQuantities, r.carryOverKg), r.id).toBeCloseTo(r.quantityKg, 6);
  });

  it("kỳ cân đối có kỳ lãi và kỳ lỗ", () => {
    const ky = computeAllPeriodResults(toFlowData(goi)).filter((x) => x.coThanhPham);
    expect(ky.length).toBeGreaterThanOrEqual(3);
    expect(ky.some((x) => x.kq.profitOrLoss > 0)).toBe(true);
    expect(ky.some((x) => x.kq.profitOrLoss < 0)).toBe(true);
  });

  it("dòng chảy đi đủ 5 khâu", () => {
    const d = toFlowData(goi);
    const k = { tu: "2026-08-14", den: TODAY };
    expect(buildFlowStages(d, k).every((x) => x.kg > 0)).toBe(true);
    const ids = new Set(buildDataFlow(d, k).nut.map((n) => n.id));
    for (const n of ["btp", "kho", "goi", "xd", "bb", "btpb", "pl", "cd", "nd"]) expect(ids.has(n), n).toBe(true);
  });
});
