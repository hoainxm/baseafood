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

const makeShipment = (id: string, date: string, workshop: Workshop, dl = "Hồng Phú", bookDate = date): ImportShipment => ({
  id, deliveryDate: date, postingDate: bookDate, backdateReason: bookDate > date ? "quên ghi" : "", workshop: workshop,
  supplierName: dl, driverName: "", licensePlate: "", note: "",
});
const makeImport = (id: string, shipmentId: string, date: string, workshop: Workshop, kg: number, dl = "Hồng Phú"): MaterialImportItem => ({
  id, shipmentId, deliveryDate: date, workshop: workshop, category: "Mực", supplierName: dl, materialTypeName: "Mực ống",
  quantityKg: kg, unitPrice: 50000, driverName: "", licensePlate: "", note: "",
});
const me = (id: string, date: string, workshop: Workshop, kg: number, status: WipProductionItem["status"] = "da-nhap", productId = "mh1"): WipProductionItem => ({
  id, productionDate: date, postingDate: date, backdateReason: "", workshop: workshop, productId, spec: "",
  quantityKg: kg, blocksCount: 0, warehouse: "", status, note: "",
});
const goi = (id: string, date: string, inputKg: number, ra: number): Packaging => ({
  id, date: date, workshop: "Đông", fromProductId: "mh1", fromSpec: "", inputKg: inputKg, inputBlocks: 0,
  toProductId: "mh2", toSpec: "", outputKg: ra, outputUnits: 1, warehouse: "", note: "",
});
const makeSalesInvoice = (id: string, date: string): SalesInvoice => ({
  id, deliveryDate: date, postingDate: date, backdateReason: "", workshop: "Đông", customerId: "k1", channel: "Nội địa", note: "",
});
const ban = (id: string, invoiceId: string, date: string, productId: string, kg: number, source: string): SalesItem => ({
  id, invoiceId, deliveryDate: date, productId, spec: "", quantityKg: kg, unitPrice: 1, sourceWarehouse: source,
});
const makeLock = (date: string, workshop: Workshop, kg: number, leftoverKg = 0): DailyLock => ({
  id: `${date}|${workshop}`, lockDate: date, workshop: workshop, isLocked: true, lockedAt: "", totalKgAtLock: kg,
  reopenReason: "", note: "", leftoverKg: leftoverKg,
});
const lotInput = (outputId: string, kg: number | null): LotInput => ({
  id: `li-${outputId}`, outputKind: "W", outputId, inputKind: "S", inputId: "n1", inputLabel: "", material: "",
  quantityKg: kg, method: "chon", operator: "", recordedAt: "",
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
  for (const n of dc.nut) {
    const inputKg = dc.canh.filter((c) => c.den === n.id).reduce((s, c) => s + c.kg, 0);
    const ra = dc.canh.filter((c) => c.tu === n.id).reduce((s, c) => s + c.kg, 0);
    if (inputKg > 0 && ra > 0) expect(Math.abs(inputKg - ra), n.id).toBeLessThan(1e-6);
  }
  for (const c of dc.canh) expect(c.kg).toBeGreaterThan(0);
}

const K = { tu: "2026-09-01", den: "2026-09-30" };

// Kịch bản chuỗi: 1.000 kg NL → 600 kg BTP (500 nhập kho, 100 chờ) + phế 50 + còn dở 100
// → kho: đóng gói 300 (ra 290), xuất đơn 100, bán block 50 → TP: bán 200.
const chuoi = makeFlowData({
  shipments: [makeShipment("c1", "2026-09-02", "Đông")],
  imports: [makeImport("n1", "c1", "2026-09-02", "Đông", 1000)],
  wips: [me("w1", "2026-09-02", "Đông", 500), me("w2", "2026-09-03", "Đông", 100, "cho-nhap")],
  scraps: [{ id: "pl1", periodId: "", name: "Nội tạng", quantityKg: 50, sellingPrice: 0, date: "2026-09-02", workshop: "Đông", source: "Nhập hàng" }],
  productionLocks: [makeLock("2026-09-02", "Đông", 500, 100)],
  dailyLocks: [makeLock("2026-09-02", "Đông", 1000)],
  packagings: [goi("g1", "2026-09-05", 300, 290)],
  exportOrders: [{ id: "lx1", orderId: "d1", exportDate: "2026-09-06", status: "dong", note: "" } as ExportOrder],
  exportItems: [{ id: "x1", exportId: "lx1", wipId: "w1", productId: "mh1", spec: "", quantityKg: 100, blocksCount: 0 } as ExportItem],
  salesInvoices: [makeSalesInvoice("pb1", "2026-09-07")],
  salesItems: [ban("b1", "pb1", "2026-09-07", "mh1", 50, RETAIL_WAREHOUSE), ban("b2", "pb1", "2026-09-07", "mh2", 200, FG_WAREHOUSE)],
});

describe("listDatesInRange", () => {
  it("liệt kê đủ ngày, qua tháng không lệch múi giờ", () => {
    expect(listDatesInRange("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(listDatesInRange("2026-10-02", "2026-10-01")).toEqual([]);
  });
});

describe("buildDataFlow", () => {
  it("đi đủ chuỗi, cân bằng kg ở mọi nút, gọi tên phần hụt", () => {
    const dc = buildDataFlow(chuoi, K);
    checkBalance(dc);
    const kg = (tu: string, den: string) => dc.canh.find((c) => c.tu === tu && c.den === den)?.kg ?? 0;
    expect(dc.tongNhap).toBe(1000);
    expect(kg("dl:Hồng Phú", "x:Đông")).toBe(1000);
    expect(kg("x:Đông", "btp")).toBe(600);
    expect(kg("x:Đông", "pl")).toBe(50);
    expect(kg("x:Đông", "cd")).toBe(100);
    expect(kg("x:Đông", "hh")).toBe(250); // 1000 − 600 − 50 − 100
    expect(kg("btp", "kho")).toBe(500);
    expect(kg("btp", "cho")).toBe(100);
    expect(kg("kho", "goi")).toBe(300);
    expect(kg("kho", "xd")).toBe(100);
    expect(kg("kho", "bb")).toBe(50);
    expect(kg("kho", "tonBtp")).toBe(50);
    expect(kg("goi", "btpb")).toBe(200);
    expect(kg("goi", "tonTp")).toBe(90);
    expect(kg("goi", "hdg")).toBe(10);
    // 6 cột: không có nút TP đóng gói riêng.
    expect(Math.max(...dc.nut.map((n) => n.tang))).toBe(5);
  });

  it("ra nhiều hơn vào ⇒ thêm nút nguồn 'tồn trước kỳ', vẫn cân bằng", () => {
    // Kỳ tháng 10: không SX, chỉ xuất 100 kg từ mẻ tháng 9 + SX nhiều hơn nhập.
    const d = makeFlowData({
      imports: [makeImport("n2", "c2", "2026-10-01", "Cá", 100)],
      wips: [me("w9", "2026-09-20", "Cá", 300), me("w10", "2026-10-01", "Cá", 150)],
      exportOrders: [{ id: "lx", orderId: "d", exportDate: "2026-10-02", status: "dong", note: "" } as ExportOrder],
      exportItems: [{ id: "x", exportId: "lx", wipId: "w9", productId: "mh1", spec: "", quantityKg: 250, blocksCount: 0 } as ExportItem],
    });
    const dc = buildDataFlow(d, { tu: "2026-10-01", den: "2026-10-31" });
    checkBalance(dc);
    expect(dc.canh.find((c) => c.tu === "nlTruoc")?.kg).toBe(50);
    expect(dc.canh.find((c) => c.tu === "tonBtpDau")?.kg).toBe(100);
  });

  it("đóng gói ra vượt BTP vào ⇒ gọi tên phần dư, vẫn cân bằng", () => {
    const d = makeFlowData({ wips: [me("w", "2026-09-02", "Đông", 100)], packagings: [goi("g", "2026-09-03", 50, 60)] });
    const dc = buildDataFlow(d, K);
    checkBalance(dc);
    expect(dc.canh.find((c) => c.tu === "goiDu")?.kg).toBe(10);
    expect(dc.canh.find((c) => c.den === "tonTp")?.kg).toBe(60);
  });

  it("lọc xưởng: chỉ còn số của xưởng đó", () => {
    const d = makeFlowData({
      imports: [makeImport("a", "c", "2026-09-02", "Đông", 100), makeImport("b", "c", "2026-09-02", "Khô", 70, "Bê 3")],
    });
    const dc = buildDataFlow(d, { ...K, xuong: "Khô" });
    expect(dc.tongNhap).toBe(70);
    expect(dc.nut.some((n) => n.id === "x:Đông")).toBe(false);
  });

  it("gộp đại lý nhỏ thành 'Đại lý khác' khi quá 5", () => {
    const ds = ["A", "B", "C", "D", "E", "F", "G"].map((t, i) => makeImport(`n${i}`, "c", "2026-09-02", "Đông", 100 - i, t));
    const dc = buildDataFlow(makeFlowData({ imports: ds }), K);
    expect(dc.nut.filter((n) => n.nhom === "nguon").map((n) => n.nhan)).toEqual(["A", "B", "C", "D", "E", "Đại lý khác"]);
    expect(dc.canh.find((c) => c.tu === "dl:*")?.kg).toBe(94 + 95);
  });
});

describe("splitOutflows", () => {
  it("chia phần ra của các xưởng: cộng đủ 100%, theo thứ tự cho trước", () => {
    const ds = splitOutflows(buildDataFlow(chuoi, K), (id) => id.startsWith("x:"), ["btp", "pl", "cd", "hh"]);
    expect(ds.map((x) => [x.id, x.kg])).toEqual([["btp", 600], ["pl", 50], ["cd", 100], ["hh", 250]]);
    expect(ds.reduce((s, x) => s + x.tiLe, 0)).toBeCloseTo(1);
    expect(ds[0].tiLe).toBeCloseTo(0.6);
  });
  it("phần ra của kho: id ngoài thứ tự xếp sau theo kg giảm dần", () => {
    const ds = splitOutflows(buildDataFlow(chuoi, K), (id) => id === "kho", ["goi"]);
    expect(ds.map((x) => x.id)).toEqual(["goi", "xd", "bb", "tonBtp"]);
  });
  it("không có dải nào ⇒ rỗng", () => {
    expect(splitOutflows({ nut: [], canh: [], tongNhap: 0 }, () => true)).toEqual([]);
  });
});

describe("buildFlowStages", () => {
  it("kg từng khâu, kg chờ duyệt, tỉ lệ chuyển tiếp", () => {
    const conveyor = buildFlowStages(chuoi, K);
    expect(conveyor.map((x) => x.khoa)).toEqual(["nhap", "san-xuat", "kho", "dong-goi", "xuat-ban"]);
    expect(conveyor.map((x) => x.kg)).toEqual([1000, 600, 500, 290, 350]);
    expect(conveyor[2].kgCho).toBe(100);
    expect(conveyor[0].tiLeChuyen).toBeNull();
    expect(conveyor[1].tiLeChuyen).toBeCloseTo(0.6);
    // Đóng gói và xuất/bán cùng rút từ kho ⇒ chia cho kg nhập kho, không chia nối tiếp.
    expect(conveyor[3].tiLeChuyen).toBeCloseTo(290 / 500);
    expect(conveyor[4].tiLeChuyen).toBeCloseTo(350 / 500);
    // Mẻ chưa gắn lô ⇒ khâu SX có việc thiếu.
    expect(conveyor[1].viecThieu).toBeGreaterThan(0);
  });
});

describe("buildDailyFlowSeries", () => {
  it("tồn BTP + TP cuối ngày theo đúng engine sổ tồn", () => {
    const ds = buildDailyFlowSeries(chuoi, { tu: "2026-09-01", den: "2026-09-07" });
    const date = (n: string) => ds.find((x) => x.ngay === n)!;
    expect(ds).toHaveLength(7);
    expect(date("2026-09-01").tonBtp).toBe(0);
    expect(date("2026-09-02")).toMatchObject({ nhap: 1000, sanXuat: 500, tonBtp: 500 });
    expect(date("2026-09-03")).toMatchObject({ sanXuat: 100, tonBtp: 500 }); // mẻ chờ duyệt chưa vào kho
    expect(date("2026-09-05")).toMatchObject({ tonBtp: 200, tonTp: 290 });
    expect(date("2026-09-07")).toMatchObject({ tonBtp: 50, tonTp: 90 });
  });
});

describe("computeYieldByProduct", () => {
  it("chỉ tính mẻ đã gắn lô có kg, bình quân gia quyền, cờ lệch ±5%", () => {
    const d = makeFlowData({
      wips: [me("a", "2026-09-02", "Đông", 100), me("b", "2026-09-02", "Đông", 100, "da-nhap", "mh2"), me("c", "2026-09-02", "Đông", 100)],
      lotInputs: [lotInput("a", 110), lotInput("b", 130), lotInput("c", null)],
    });
    const { dong, binhQuan } = computeYieldByProduct(d, K);
    expect(binhQuan).toBeCloseTo(240 / 200);
    expect(dong.map((r) => [r.productId, r.dinhMuc, r.vuotNguong])).toEqual([
      ["mh2", 1.3, true],
      ["mh1", 1.1, true],
    ]);
    // Ngưỡng nới 10% ⇒ không còn cờ (lệch ±8,3%).
    expect(computeYieldByProduct(d, K, 0.1).dong.every((r) => !r.vuotNguong)).toBe(true);
  });
  it("chưa mẻ nào gắn lô ⇒ rỗng, không đoán", () => {
    expect(computeYieldByProduct(chuoi, K)).toEqual({ dong: [], binhQuan: null });
  });
});

describe("buildChainWarnings", () => {
  it("bắt ngày chưa chốt, đổi sau chốt, ghi bù, chờ duyệt lâu, lô chưa gắn", () => {
    const d = makeFlowData({
      ...chuoi,
      shipments: [...chuoi.shipments, makeShipment("c9", "2026-09-10", "Cá", "Bê 3", "2026-09-12")],
      imports: [...chuoi.imports, makeImport("n9", "c9", "2026-09-10", "Cá", 80, "Bê 3"), makeImport("n10", "c1", "2026-09-02", "Đông", 5)],
    });
    const cb = buildChainWarnings(d, K, "2026-09-20");
    const warningsOfKind = (l: string) => cb.filter((x) => x.loai === l);
    expect(warningsOfKind("doi-sau-chot")).toHaveLength(1); // chốt 1.000, nay 1.005
    expect(warningsOfKind("chua-chot-nhap").map((x) => x.xuong)).toEqual(["Cá"]);
    expect(warningsOfKind("chua-chot-sx").map((x) => x.ngay)).toEqual(["2026-09-03"]);
    expect(warningsOfKind("ghi-bu").map((x) => x.id)).toEqual(["gbn|c9"]);
    expect(warningsOfKind("cho-duyet-lau").map((x) => x.duongDan)).toEqual(["/warehouse?duyet=W:w2"]);
    expect(warningsOfKind("lo-chua-gan").length).toBeGreaterThan(0);
    // Lỗi đứng trước nhắc, nhắc trước tin.
    const thuTu = cb.map((x) => x.muc);
    expect(thuTu.indexOf("tin")).toBeGreaterThan(thuTu.lastIndexOf("loi"));
  });

  it("hôm nay chưa chốt thì chưa nhắc", () => {
    const cb = buildChainWarnings(makeFlowData({ imports: [makeImport("n", "c", "2026-09-20", "Đông", 10)] }), K, "2026-09-20");
    expect(cb.filter((x) => x.loai === "chua-chot-nhap")).toEqual([]);
  });

  it("bán vượt tồn BTP được gọi tên", () => {
    const d = makeFlowData({
      wips: [me("w", "2026-09-02", "Đông", 100)],
      salesInvoices: [makeSalesInvoice("pb", "2026-09-03")],
      salesItems: [ban("b", "pb", "2026-09-03", "mh1", 130, RETAIL_WAREHOUSE)],
    });
    const cb = buildChainWarnings(d, K, "2026-09-20").filter((x) => x.loai === "ban-vuot");
    expect(cb).toHaveLength(1);
    expect(cb[0].tieuDe).toContain("30 kg");
  });

  it("kỳ cân đối định mức lệch bình quân các kỳ cùng loại NL", () => {
    const ky = (id: string, start: string): BalancingPeriod => ({
      id, materialTypeName: "Bạch tuộc", dateRangeDescription: id, startDate: start, endDate: start,
      totalInputKg: null, exchangeRate: 25000, processingCostPerKg: 0, createdAt: start,
    });
    const inputKg = (periodId: string, kg: number) => ({ id: `i${periodId}`, periodId, groupName: "Thủy sản", name: "BT", quantityKg: kg, unitPrice: 1, ratioPercentage: null }) as BalancingInputItem;
    const ra = (periodId: string, kg: number) => ({ id: `o${periodId}`, periodId, productId: "mh1", customerId: "", channel: "Nội địa", quantityKg: kg, unitPrice: 1 }) as BalancingOutputItem;
    const d = makeFlowData({
      periods: [ky("k1", "2026-09-05"), ky("k2", "2026-09-10"), ky("k3", "2026-09-15")],
      balancingInputs: [inputKg("k1", 2000), inputKg("k2", 2000), inputKg("k3", 2400)],
      balancingOutputs: [ra("k1", 1000), ra("k2", 1000), ra("k3", 1000)],
    });
    expect(computeAllPeriodResults(d).map((x) => x.period.id)).toEqual(["k3", "k2", "k1"]);
    const cb = buildChainWarnings(d, K, "2026-09-20").filter((x) => x.loai === "ky-dinh-muc-lech");
    // Bình quân 6400/3000 = 2,133: k3 (2,4) +12,5% · k1/k2 (2,0) −6,25%.
    expect(cb.map((x) => x.id).sort()).toEqual(["kdm|k1", "kdm|k2", "kdm|k3"]);
  });
});

describe("bucketStockByAge", () => {
  it("chia kg tồn theo số ngày nằm kho, bỏ lô hết hàng", () => {
    const ds = bucketStockByAge(
      [
        { ngaySX: "2026-10-01", conLai: 100 }, // 11 ngày
        { ngaySX: "2026-09-12", conLai: 50 }, // 30 ngày ⇒ nhóm 30–60
        { ngaySX: "2026-07-01", conLai: 20 }, // 103 ngày
        { ngaySX: "2026-07-01", conLai: 0 }, // hết hàng
      ],
      "2026-10-12",
    );
    expect(ds.map((x) => [x.khoa, x.kg, x.soLo])).toEqual([
      ["duoi-30", 100, 1],
      ["30-60", 50, 1],
      ["60-90", 0, 0],
      ["tren-90", 20, 1],
    ]);
  });
});

describe("countQcByDay", () => {
  it("đếm theo ngày + xưởng, đủ ngày kể cả ngày trống", () => {
    const r = (date: string, workshop: Workshop, result: "dat" | "tam" | "khong-dat") => ({ date, workshop, result });
    const ds = countQcByDay([r("2026-10-01", "Đông", "dat"), r("2026-10-01", "Đông", "khong-dat"), r("2026-10-01", "Cá", "dat"), r("2026-10-03", "Đông", "tam")], "Đông", "2026-10-01", "2026-10-03");
    expect(ds).toEqual([
      { ngay: "2026-10-01", dat: 1, tam: 0, khongDat: 1 },
      { ngay: "2026-10-02", dat: 0, tam: 0, khongDat: 0 },
      { ngay: "2026-10-03", dat: 0, tam: 1, khongDat: 0 },
    ]);
  });
});
