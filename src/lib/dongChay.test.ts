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
import { KHO_BAN_LE, KHO_TP } from "./inventory";
import {
  bangChuyen,
  cacNgay,
  canhBaoChuoi,
  chuoiTheoNgay,
  dinhMucTheoMatHang,
  dongChayKg,
  ketQuaCacKy,
  phanBoRa,
  tuoiTon,
  qcTheoNgay,
  type DuLieuDongChay,
  type DongChay,
} from "./dongChay";

const chuyen = (id: string, ngay: string, xuong: Workshop, dl = "Hồng Phú", ghiSo = ngay): ImportShipment => ({
  id, deliveryDate: ngay, postingDate: ghiSo, backdateReason: ghiSo > ngay ? "quên ghi" : "", workshop: xuong,
  supplierName: dl, driverName: "", licensePlate: "", note: "",
});
const nhap = (id: string, shipmentId: string, ngay: string, xuong: Workshop, kg: number, dl = "Hồng Phú"): MaterialImportItem => ({
  id, shipmentId, deliveryDate: ngay, workshop: xuong, category: "Mực", supplierName: dl, materialTypeName: "Mực ống",
  quantityKg: kg, unitPrice: 50000, driverName: "", licensePlate: "", note: "",
});
const me = (id: string, ngay: string, xuong: Workshop, kg: number, status: WipProductionItem["status"] = "da-nhap", productId = "mh1"): WipProductionItem => ({
  id, productionDate: ngay, postingDate: ngay, backdateReason: "", workshop: xuong, productId, spec: "",
  quantityKg: kg, blocksCount: 0, warehouse: "", status, note: "",
});
const goi = (id: string, ngay: string, vao: number, ra: number): Packaging => ({
  id, date: ngay, workshop: "Đông", fromProductId: "mh1", fromSpec: "", inputKg: vao, inputBlocks: 0,
  toProductId: "mh2", toSpec: "", outputKg: ra, outputUnits: 1, warehouse: "", note: "",
});
const phieuBan = (id: string, ngay: string): SalesInvoice => ({
  id, deliveryDate: ngay, postingDate: ngay, backdateReason: "", workshop: "Đông", customerId: "k1", channel: "Nội địa", note: "",
});
const ban = (id: string, invoiceId: string, ngay: string, productId: string, kg: number, nguon: string): SalesItem => ({
  id, invoiceId, deliveryDate: ngay, productId, spec: "", quantityKg: kg, unitPrice: 1, sourceWarehouse: nguon,
});
const chot = (ngay: string, xuong: Workshop, kg: number, conDo = 0): DailyLock => ({
  id: `${ngay}|${xuong}`, lockDate: ngay, workshop: xuong, isLocked: true, lockedAt: "", totalKgAtLock: kg,
  reopenReason: "", note: "", leftoverKg: conDo,
});
const gan = (outputId: string, kg: number | null): LotInput => ({
  id: `li-${outputId}`, outputKind: "W", outputId, inputKind: "S", inputId: "n1", inputLabel: "", material: "",
  quantityKg: kg, method: "chon", operator: "", recordedAt: "",
});

function duLieu(p: Partial<DuLieuDongChay> = {}): DuLieuDongChay {
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
function kiemCanBang(dc: DongChay) {
  for (const n of dc.nut) {
    const vao = dc.canh.filter((c) => c.den === n.id).reduce((s, c) => s + c.kg, 0);
    const ra = dc.canh.filter((c) => c.tu === n.id).reduce((s, c) => s + c.kg, 0);
    if (vao > 0 && ra > 0) expect(Math.abs(vao - ra), n.id).toBeLessThan(1e-6);
  }
  for (const c of dc.canh) expect(c.kg).toBeGreaterThan(0);
}

const K = { tu: "2026-09-01", den: "2026-09-30" };

// Kịch bản chuỗi: 1.000 kg NL → 600 kg BTP (500 nhập kho, 100 chờ) + phế 50 + còn dở 100
// → kho: đóng gói 300 (ra 290), xuất đơn 100, bán block 50 → TP: bán 200.
const chuoi = duLieu({
  shipments: [chuyen("c1", "2026-09-02", "Đông")],
  imports: [nhap("n1", "c1", "2026-09-02", "Đông", 1000)],
  wips: [me("w1", "2026-09-02", "Đông", 500), me("w2", "2026-09-03", "Đông", 100, "cho-nhap")],
  scraps: [{ id: "pl1", periodId: "", name: "Nội tạng", quantityKg: 50, sellingPrice: 0, date: "2026-09-02", workshop: "Đông", source: "Nhập hàng" }],
  productionLocks: [chot("2026-09-02", "Đông", 500, 100)],
  dailyLocks: [chot("2026-09-02", "Đông", 1000)],
  packagings: [goi("g1", "2026-09-05", 300, 290)],
  exportOrders: [{ id: "lx1", orderId: "d1", exportDate: "2026-09-06", status: "dong", note: "" } as ExportOrder],
  exportItems: [{ id: "x1", exportId: "lx1", wipId: "w1", productId: "mh1", spec: "", quantityKg: 100, blocksCount: 0 } as ExportItem],
  salesInvoices: [phieuBan("pb1", "2026-09-07")],
  salesItems: [ban("b1", "pb1", "2026-09-07", "mh1", 50, KHO_BAN_LE), ban("b2", "pb1", "2026-09-07", "mh2", 200, KHO_TP)],
});

describe("cacNgay", () => {
  it("liệt kê đủ ngày, qua tháng không lệch múi giờ", () => {
    expect(cacNgay("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(cacNgay("2026-10-02", "2026-10-01")).toEqual([]);
  });
});

describe("dongChayKg", () => {
  it("đi đủ chuỗi, cân bằng kg ở mọi nút, gọi tên phần hụt", () => {
    const dc = dongChayKg(chuoi, K);
    kiemCanBang(dc);
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
    const d = duLieu({
      imports: [nhap("n2", "c2", "2026-10-01", "Cá", 100)],
      wips: [me("w9", "2026-09-20", "Cá", 300), me("w10", "2026-10-01", "Cá", 150)],
      exportOrders: [{ id: "lx", orderId: "d", exportDate: "2026-10-02", status: "dong", note: "" } as ExportOrder],
      exportItems: [{ id: "x", exportId: "lx", wipId: "w9", productId: "mh1", spec: "", quantityKg: 250, blocksCount: 0 } as ExportItem],
    });
    const dc = dongChayKg(d, { tu: "2026-10-01", den: "2026-10-31" });
    kiemCanBang(dc);
    expect(dc.canh.find((c) => c.tu === "nlTruoc")?.kg).toBe(50);
    expect(dc.canh.find((c) => c.tu === "tonBtpDau")?.kg).toBe(100);
  });

  it("đóng gói ra vượt BTP vào ⇒ gọi tên phần dư, vẫn cân bằng", () => {
    const d = duLieu({ wips: [me("w", "2026-09-02", "Đông", 100)], packagings: [goi("g", "2026-09-03", 50, 60)] });
    const dc = dongChayKg(d, K);
    kiemCanBang(dc);
    expect(dc.canh.find((c) => c.tu === "goiDu")?.kg).toBe(10);
    expect(dc.canh.find((c) => c.den === "tonTp")?.kg).toBe(60);
  });

  it("lọc xưởng: chỉ còn số của xưởng đó", () => {
    const d = duLieu({
      imports: [nhap("a", "c", "2026-09-02", "Đông", 100), nhap("b", "c", "2026-09-02", "Khô", 70, "Bê 3")],
    });
    const dc = dongChayKg(d, { ...K, xuong: "Khô" });
    expect(dc.tongNhap).toBe(70);
    expect(dc.nut.some((n) => n.id === "x:Đông")).toBe(false);
  });

  it("gộp đại lý nhỏ thành 'Đại lý khác' khi quá 5", () => {
    const ds = ["A", "B", "C", "D", "E", "F", "G"].map((t, i) => nhap(`n${i}`, "c", "2026-09-02", "Đông", 100 - i, t));
    const dc = dongChayKg(duLieu({ imports: ds }), K);
    expect(dc.nut.filter((n) => n.nhom === "nguon").map((n) => n.nhan)).toEqual(["A", "B", "C", "D", "E", "Đại lý khác"]);
    expect(dc.canh.find((c) => c.tu === "dl:*")?.kg).toBe(94 + 95);
  });
});

describe("phanBoRa", () => {
  it("chia phần ra của các xưởng: cộng đủ 100%, theo thứ tự cho trước", () => {
    const ds = phanBoRa(dongChayKg(chuoi, K), (id) => id.startsWith("x:"), ["btp", "pl", "cd", "hh"]);
    expect(ds.map((x) => [x.id, x.kg])).toEqual([["btp", 600], ["pl", 50], ["cd", 100], ["hh", 250]]);
    expect(ds.reduce((s, x) => s + x.tiLe, 0)).toBeCloseTo(1);
    expect(ds[0].tiLe).toBeCloseTo(0.6);
  });
  it("phần ra của kho: id ngoài thứ tự xếp sau theo kg giảm dần", () => {
    const ds = phanBoRa(dongChayKg(chuoi, K), (id) => id === "kho", ["goi"]);
    expect(ds.map((x) => x.id)).toEqual(["goi", "xd", "bb", "tonBtp"]);
  });
  it("không có dải nào ⇒ rỗng", () => {
    expect(phanBoRa({ nut: [], canh: [], tongNhap: 0 }, () => true)).toEqual([]);
  });
});

describe("bangChuyen", () => {
  it("kg từng khâu, kg chờ duyệt, tỉ lệ chuyển tiếp", () => {
    const bc = bangChuyen(chuoi, K);
    expect(bc.map((x) => x.khoa)).toEqual(["nhap", "san-xuat", "kho", "dong-goi", "xuat-ban"]);
    expect(bc.map((x) => x.kg)).toEqual([1000, 600, 500, 290, 350]);
    expect(bc[2].kgCho).toBe(100);
    expect(bc[0].tiLeChuyen).toBeNull();
    expect(bc[1].tiLeChuyen).toBeCloseTo(0.6);
    // Đóng gói và xuất/bán cùng rút từ kho ⇒ chia cho kg nhập kho, không chia nối tiếp.
    expect(bc[3].tiLeChuyen).toBeCloseTo(290 / 500);
    expect(bc[4].tiLeChuyen).toBeCloseTo(350 / 500);
    // Mẻ chưa gắn lô ⇒ khâu SX có việc thiếu.
    expect(bc[1].viecThieu).toBeGreaterThan(0);
  });
});

describe("chuoiTheoNgay", () => {
  it("tồn BTP + TP cuối ngày theo đúng engine sổ tồn", () => {
    const ds = chuoiTheoNgay(chuoi, { tu: "2026-09-01", den: "2026-09-07" });
    const ngay = (n: string) => ds.find((x) => x.ngay === n)!;
    expect(ds).toHaveLength(7);
    expect(ngay("2026-09-01").tonBtp).toBe(0);
    expect(ngay("2026-09-02")).toMatchObject({ nhap: 1000, sanXuat: 500, tonBtp: 500 });
    expect(ngay("2026-09-03")).toMatchObject({ sanXuat: 100, tonBtp: 500 }); // mẻ chờ duyệt chưa vào kho
    expect(ngay("2026-09-05")).toMatchObject({ tonBtp: 200, tonTp: 290 });
    expect(ngay("2026-09-07")).toMatchObject({ tonBtp: 50, tonTp: 90 });
  });
});

describe("dinhMucTheoMatHang", () => {
  it("chỉ tính mẻ đã gắn lô có kg, bình quân gia quyền, cờ lệch ±5%", () => {
    const d = duLieu({
      wips: [me("a", "2026-09-02", "Đông", 100), me("b", "2026-09-02", "Đông", 100, "da-nhap", "mh2"), me("c", "2026-09-02", "Đông", 100)],
      lotInputs: [gan("a", 110), gan("b", 130), gan("c", null)],
    });
    const { dong, binhQuan } = dinhMucTheoMatHang(d, K);
    expect(binhQuan).toBeCloseTo(240 / 200);
    expect(dong.map((r) => [r.productId, r.dinhMuc, r.vuotNguong])).toEqual([
      ["mh2", 1.3, true],
      ["mh1", 1.1, true],
    ]);
    // Ngưỡng nới 10% ⇒ không còn cờ (lệch ±8,3%).
    expect(dinhMucTheoMatHang(d, K, 0.1).dong.every((r) => !r.vuotNguong)).toBe(true);
  });
  it("chưa mẻ nào gắn lô ⇒ rỗng, không đoán", () => {
    expect(dinhMucTheoMatHang(chuoi, K)).toEqual({ dong: [], binhQuan: null });
  });
});

describe("canhBaoChuoi", () => {
  it("bắt ngày chưa chốt, đổi sau chốt, ghi bù, chờ duyệt lâu, lô chưa gắn", () => {
    const d = duLieu({
      ...chuoi,
      shipments: [...chuoi.shipments, chuyen("c9", "2026-09-10", "Cá", "Bê 3", "2026-09-12")],
      imports: [...chuoi.imports, nhap("n9", "c9", "2026-09-10", "Cá", 80, "Bê 3"), nhap("n10", "c1", "2026-09-02", "Đông", 5)],
    });
    const cb = canhBaoChuoi(d, K, "2026-09-20");
    const loai = (l: string) => cb.filter((x) => x.loai === l);
    expect(loai("doi-sau-chot")).toHaveLength(1); // chốt 1.000, nay 1.005
    expect(loai("chua-chot-nhap").map((x) => x.xuong)).toEqual(["Cá"]);
    expect(loai("chua-chot-sx").map((x) => x.ngay)).toEqual(["2026-09-03"]);
    expect(loai("ghi-bu").map((x) => x.id)).toEqual(["gbn|c9"]);
    expect(loai("cho-duyet-lau").map((x) => x.duongDan)).toEqual(["/warehouse?duyet=W:w2"]);
    expect(loai("lo-chua-gan").length).toBeGreaterThan(0);
    // Lỗi đứng trước nhắc, nhắc trước tin.
    const thuTu = cb.map((x) => x.muc);
    expect(thuTu.indexOf("tin")).toBeGreaterThan(thuTu.lastIndexOf("loi"));
  });

  it("hôm nay chưa chốt thì chưa nhắc", () => {
    const cb = canhBaoChuoi(duLieu({ imports: [nhap("n", "c", "2026-09-20", "Đông", 10)] }), K, "2026-09-20");
    expect(cb.filter((x) => x.loai === "chua-chot-nhap")).toEqual([]);
  });

  it("bán vượt tồn BTP được gọi tên", () => {
    const d = duLieu({
      wips: [me("w", "2026-09-02", "Đông", 100)],
      salesInvoices: [phieuBan("pb", "2026-09-03")],
      salesItems: [ban("b", "pb", "2026-09-03", "mh1", 130, KHO_BAN_LE)],
    });
    const cb = canhBaoChuoi(d, K, "2026-09-20").filter((x) => x.loai === "ban-vuot");
    expect(cb).toHaveLength(1);
    expect(cb[0].tieuDe).toContain("30 kg");
  });

  it("kỳ cân đối định mức lệch bình quân các kỳ cùng loại NL", () => {
    const ky = (id: string, start: string): BalancingPeriod => ({
      id, materialTypeName: "Bạch tuộc", dateRangeDescription: id, startDate: start, endDate: start,
      totalInputKg: null, exchangeRate: 25000, processingCostPerKg: 0, createdAt: start,
    });
    const vao = (periodId: string, kg: number) => ({ id: `i${periodId}`, periodId, groupName: "Thủy sản", name: "BT", quantityKg: kg, unitPrice: 1, ratioPercentage: null }) as BalancingInputItem;
    const ra = (periodId: string, kg: number) => ({ id: `o${periodId}`, periodId, productId: "mh1", customerId: "", channel: "Nội địa", quantityKg: kg, unitPrice: 1 }) as BalancingOutputItem;
    const d = duLieu({
      periods: [ky("k1", "2026-09-05"), ky("k2", "2026-09-10"), ky("k3", "2026-09-15")],
      balancingInputs: [vao("k1", 2000), vao("k2", 2000), vao("k3", 2400)],
      balancingOutputs: [ra("k1", 1000), ra("k2", 1000), ra("k3", 1000)],
    });
    expect(ketQuaCacKy(d).map((x) => x.period.id)).toEqual(["k3", "k2", "k1"]);
    const cb = canhBaoChuoi(d, K, "2026-09-20").filter((x) => x.loai === "ky-dinh-muc-lech");
    // Bình quân 6400/3000 = 2,133: k3 (2,4) +12,5% · k1/k2 (2,0) −6,25%.
    expect(cb.map((x) => x.id).sort()).toEqual(["kdm|k1", "kdm|k2", "kdm|k3"]);
  });
});

describe("tuoiTon", () => {
  it("chia kg tồn theo số ngày nằm kho, bỏ lô hết hàng", () => {
    const ds = tuoiTon(
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

describe("qcTheoNgay", () => {
  it("đếm theo ngày + xưởng, đủ ngày kể cả ngày trống", () => {
    const r = (date: string, workshop: Workshop, result: "dat" | "tam" | "khong-dat") => ({ date, workshop, result });
    const ds = qcTheoNgay([r("2026-10-01", "Đông", "dat"), r("2026-10-01", "Đông", "khong-dat"), r("2026-10-01", "Cá", "dat"), r("2026-10-03", "Đông", "tam")], "Đông", "2026-10-01", "2026-10-03");
    expect(ds).toEqual([
      { ngay: "2026-10-01", dat: 1, tam: 0, khongDat: 1 },
      { ngay: "2026-10-02", dat: 0, tam: 0, khongDat: 0 },
      { ngay: "2026-10-03", dat: 0, tam: 1, khongDat: 0 },
    ]);
  });
});
