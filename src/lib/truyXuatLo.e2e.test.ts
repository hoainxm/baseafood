// ============================================================
// KỊCH BẢN MẪU ĐẦU-CUỐI cho truy xuất lô (oracle — docs/spec/qr-truy-xuat-lo.md §9).
// Nhập NL → sản xuất BTP → nhập kho → đóng gói / xuất theo đơn / bán lẻ / bán
// nội địa → hộ chiếu lô. Số liệu dựng tay; mọi con số kỳ vọng tính nhẩm được.
// Đổi luật truy xuất / trừ tồn mà làm đỏ file này ⇒ chuỗi truy xuất đã gãy.
// ============================================================
import { describe, expect, it } from "vitest";
import type {
  Customer, DomesticSaleItem, ExportItem, ExportOrder, ImportShipment, LabelPrint, LotDispatch, LotInput,
  LotWaiver, MaterialImportItem, MaterialType, Packaging, Product, SalesInvoice, SalesItem, SalesOrder,
  WipProductionItem,
} from "@/types";
import { KHO_BAN_LE, KHO_TP, tinhTon, truTonBTP } from "./inventory";
import {
  canBangLo, danhSachThuHoi, danhSachThuHoiNhieu, docMaQr, dsLoDeIn, ganLoChoPhien, loCungChuyen, theoGiaiDoan, nutLo, timLo, tonKhoCuaLo, truyNguoc,
  truyXuoi, type DuLieuTruyXuat, type NhanhCay,
} from "./truyXuatLo";

// ---------- Dữ liệu ----------
const mh = (id: string, name: string, category: string): Product =>
  ({ id, code: "", name, finishedGoodCode: "", category, materialTypeId: "" });
const products = [
  mh("mh2da", "Bạch tuộc 2 da chần", "Bạch tuộc"),
  mh("mhCat", "Bạch tuộc cắt", "Bạch tuộc"),
  mh("tpTui", "Bạch tuộc 2 da chần túi 1 kg", "Bạch tuộc"),
  mh("mhMuc", "Mực ống cắt", "Mực"),
];
const materialTypes: MaterialType[] = [
  { id: "mt1", name: "Bạch tuộc", category: "Bạch tuộc", note: "" },
  { id: "mt2", name: "Mực ống", category: "Mực", note: "" },
];
const customers = [
  { id: "kX", name: "Khách X", market: "Hàn Quốc" },
  { id: "kY", name: "Khách Y" },
  { id: "kZ", name: "Khách Z" },
] as Customer[];

const chuyen = (id: string, dai: string, lotCode: string): ImportShipment => ({
  id, deliveryDate: "2026-10-01", postingDate: "2026-10-01", backdateReason: "", workshop: "Đông",
  supplierName: dai, driverName: "Tài", licensePlate: "72C-123.45", note: "", lotCode,
});
const shipments = [chuyen("S1", "Đại lý A", "Đ-261001-01"), chuyen("S2", "Đại lý B", "Đ-261001-02"), chuyen("S3", "Đại lý C", "Đ-261001-03")];
const dongNhap = (shipmentId: string, kg: number, loai: string, category: string) =>
  ({ id: `${shipmentId}-1`, shipmentId, deliveryDate: "2026-10-01", workshop: "Đông", category, materialTypeName: loai, quantityKg: kg, unitPrice: null }) as MaterialImportItem;
const imports = [dongNhap("S1", 1000, "Bạch tuộc", "Bạch tuộc"), dongNhap("S2", 600, "Bạch tuộc", "Bạch tuộc"), dongNhap("S3", 400, "Mực ống", "Mực")];

const me = (id: string, ngay: string, productId: string, kg: number, block: number): WipProductionItem => ({
  id, productionDate: ngay, postingDate: ngay, backdateReason: "", workshop: "Đông", productId, spec: "",
  quantityKg: kg, blocksCount: block, warehouse: "Kho Baseafood", status: "da-nhap", note: "",
});
const wips = [
  me("W0", "2026-09-29", "mh2da", 100, 10), // mẻ cũ — không ai gắn lô NL
  me("W1", "2026-10-02", "mh2da", 500, 50),
  me("W2", "2026-10-02", "mhCat", 300, 30),
];
const packagings: Packaging[] = [{
  id: "P1", date: "2026-10-03", workshop: "Đông", fromProductId: "mh2da", fromSpec: "", inputKg: 200, inputBlocks: 20,
  toProductId: "tpTui", toSpec: "", outputKg: 190, outputUnits: 190, warehouse: "Kho thành phẩm", note: "",
}];

const gan = (id: string, outputKind: "W" | "P", outputId: string, inputKind: "S" | "W", inputId: string, kg: number | null): LotInput => ({
  id, outputKind, outputId, inputKind, inputId, inputLabel: inputId, material: "", quantityKg: kg, method: "quet", operator: "Trúc", recordedAt: "2026-10-02T08:00:00Z",
});
const lotInputs = [
  gan("l1", "W", "W1", "S", "S1-1", 600),
  gan("l2", "W", "W2", "S", "S1-1", 250),
  gan("l3", "W", "W2", "S", "S2-1", 150),
  gan("l4", "P", "P1", "W", "W1", 200),
];

const salesOrders: SalesOrder[] = [{ id: "o1", customerId: "kX", orderDate: "2026-10-03", status: "dong", note: "" }];
const exportOrders: ExportOrder[] = [{ id: "e1", orderId: "o1", exportDate: "2026-10-04", status: "dong", note: "" }];
const exportItems: ExportItem[] = [{ id: "x1", exportId: "e1", wipId: "W2", productId: "mhCat", spec: "", quantityKg: 200, blocksCount: 20 }];

const phieu = (id: string, customerId: string): SalesInvoice =>
  ({ id, deliveryDate: "2026-10-05", postingDate: "2026-10-05", backdateReason: "", workshop: "Đông", customerId, channel: "Nội địa", note: "" });
const salesInvoices = [phieu("v1", "kY"), phieu("v2", "kZ"), phieu("v3", "kX")];
const salesItems: SalesItem[] = [
  { id: "b1", invoiceId: "v1", deliveryDate: "2026-10-05", productId: "tpTui", spec: "", quantityKg: 50, unitPrice: null, sourceWarehouse: KHO_TP },
  { id: "b2", invoiceId: "v2", deliveryDate: "2026-10-05", productId: "mh2da", spec: "", quantityKg: 100, unitPrice: null, sourceWarehouse: KHO_BAN_LE },
  // handoff của lệnh xuất (Đơn đặt) — đã trừ qua export_items, không phải bán lẻ
  { id: "b3", invoiceId: "v3", deliveryDate: "2026-10-04", productId: "mhCat", spec: "", quantityKg: 200, unitPrice: null, sourceWarehouse: "Đơn đặt" },
];
const domesticSales: DomesticSaleItem[] = [{
  id: "n1", saleDate: "2026-10-02", postingDate: "2026-10-02", backdateReason: "", workshop: "Đông",
  materialTypeName: "Bạch tuộc", quantityKg: 30, unitPrice: 145000, customerName: "Chợ Bà Rịa", note: "", operator: "Trúc",
}];
const ra = (id: string, lotKind: "S" | "W" | "P", lotId: string, docKind: LotDispatch["docKind"], docId: string, kg: number | null): LotDispatch => ({
  id, lotKind, lotId, lotLabel: lotId, docKind, docId, quantityKg: kg, method: "quet", operator: "Trúc", recordedAt: "2026-10-05T08:00:00Z",
});
const lotDispatches = [
  ra("d1", "P", "P1", "sales_item", "b1", 50),
  ra("d2", "W", "W1", "sales_item", "b2", 100),
  ra("d3", "W", "W2", "export_item", "x1", 200), // quét kiểm khi xếp xe — không phải ngả ra thứ hai
  ra("d4", "S", "S2-1", "domestic_sale", "n1", 30),
];
const labelPrints = (["S:S1-1", "S:S2-1", "W:W1", "W:W2", "P:P1"] as const).map((k, i): LabelPrint => {
  const [lotKind, lotId] = k.split(":") as [LabelPrint["lotKind"], string];
  return { id: `t${i}`, lotKind, lotId, label: lotId, copies: 1, operator: "", printedAt: "2026-10-02T09:00:00Z" };
});

const dl: DuLieuTruyXuat = {
  shipments, imports, wips, packagings, lotInputs, exportItems, exportOrders, salesOrders, products, customers,
  salesItems, salesInvoices, domesticSales, lotDispatches, lotWaivers: [], labelPrints, materialTypes,
};

const phang = (cay: NhanhCay[]): string[] => cay.flatMap((n) => [`${n.nut.kind}:${n.nut.id}`, ...phang(n.con)]);

// ---------- Kỳ vọng ----------
describe("kịch bản mẫu: nhập → SX → kho → đóng gói / xuất / bán", () => {
  it("truy ngược thùng TP P1 → mẻ W1 → lô NL S1 → Đại lý A, ngày 01/10", () => {
    const cay = truyNguoc("P", "P1", dl);
    expect(phang(cay)).toEqual(["W:W1", "S:S1-1"]);
    expect(cay[0]!.kg).toBe(200);
    const s1 = cay[0]!.con[0]!.nut;
    expect(s1.chiTiet).toContainEqual({ nhan: "Đại lý", giaTri: "Đại lý A" });
    expect(s1.ngay).toBe("2026-10-01");
  });

  it("truy xuôi lô TP không còn là ngõ cụt: P1 → khách Y", () => {
    expect(phang(truyXuoi("P", "P1", dl))).toEqual(["B:b1"]);
    expect(nutLo("B", "b1", dl).nhan).toBe("Bán 05/10/2026 → Khách Y");
  });

  it("thu hồi lô S1 tới đúng khách X, Y, Z", () => {
    const { hangRa, loTrongXuong } = danhSachThuHoi("S", "S1-1", dl);
    expect([...new Set(hangRa.map((r) => r.khach))].sort()).toEqual(["Khách X", "Khách Y", "Khách Z"]);
    expect(hangRa.find((r) => r.khach === "Khách Y")).toMatchObject({ loai: "B", kg: 50, tuLo: nutLo("P", "P1", dl).nhan });
    expect(loTrongXuong.map((n) => n.id).sort()).toEqual(["P1", "W1", "W2"]);
  });

  it("thu hồi lô S2 CHỈ tới khách X + chợ (bán nội địa) — không kéo theo Y, Z", () => {
    const khach = danhSachThuHoi("S", "S2-1", dl).hangRa.map((r) => r.khach).sort();
    expect(khach).toEqual(["Chợ Bà Rịa", "Khách X"]);
  });

  it("quét kiểm lệnh xuất không đẻ thêm ngả ra (không đếm hai lần)", () => {
    expect(phang(truyXuoi("W", "W2", dl))).toEqual(["X:x1"]);
  });

  it("cân bằng kg theo hồ sơ lô", () => {
    expect(canBangLo("S", "S1-1", dl)).toMatchObject({ vao: 1000, con: 150, chuaCan: 0 });
    expect(canBangLo("S", "S2-1", dl)).toMatchObject({ vao: 600, con: 420 });
    expect(canBangLo("S", "S2-1", dl)!.ra).toContainEqual({ nhan: "Bán nội địa", kg: 30 });
    expect(canBangLo("W", "W1", dl)).toMatchObject({ vao: 500, con: 200 });
    expect(canBangLo("W", "W2", dl)).toMatchObject({ vao: 300, con: 100 });
    expect(canBangLo("P", "P1", dl)).toMatchObject({ vao: 190, con: 140 });
  });

  it("sổ tồn khớp hộ chiếu: trừ đúng lô đã gắn, lô cũ W0 không bị đụng", () => {
    expect(tonKhoCuaLo("W", "W0", dl)).toBe(100);
    expect(tonKhoCuaLo("W", "W1", dl)).toBe(200);
    expect(tonKhoCuaLo("W", "W2", dl)).toBe(100);
    expect(tonKhoCuaLo("P", "P1", dl)).toBe(140);
  });

  it("(đối chứng) trừ FIFO kiểu cũ thì sổ tồn nói lô khác hộ chiếu", () => {
    const cu = tinhTon(wips, exportItems, truTonBTP(salesItems, packagings));
    expect(cu.find((l) => l.wipId === "W0")!.conLai).toBe(0);
    expect(cu.find((l) => l.wipId === "W1")!.conLai).toBe(300);
  });

  it("quét tem: link QR và mã lô in trên tem đều ra đúng lô", () => {
    expect(timLo(docMaQr("https://app.example/#/qr?lo=W:W1")!, dl).map((n) => n.id)).toEqual(["W1"]);
    expect(timLo(docMaQr("đ-261001-01")!, dl).map((n) => n.id)).toEqual(["S1-1"]);
    // QR cũ trỏ cả chuyến (trước khi tách lô theo loại) ⇒ ra các lô loại NL của chuyến
    expect(timLo(docMaQr("S:S1")!, dl).map((n) => n.id)).toEqual(["S1-1"]);
  });

  it("theo giai đoạn 29/09–05/10: mỗi khâu đủ mục, chỉ ra đúng việc còn thiếu", () => {
    const loc = { tu: "2026-09-29", den: "2026-10-05", xuong: "Đông" as const };
    const gd = Object.fromEntries(theoGiaiDoan(dl, loc).map((g) => [g.khoa, g]));
    const thieu = (k: string) => Object.fromEntries(gd[k]!.muc.map((m) => [m.nut.id, m.thieu.join(",")]));
    expect(Object.keys(gd)).toEqual(["nhap", "san-xuat", "kho", "dong-goi", "xuat-ban"]);
    // Nhập NL: S3 chưa in tem; S1 đã vào 2 mẻ, S2 vào 1 mẻ + 1 dòng bán nội địa
    expect(thieu("nhap")).toEqual({ "S1-1": "", "S2-1": "", "S3-1": "tem" });
    expect(gd.nhap!.muc.find((m) => m.nut.id === "S2-1")!.daDung).toBe(2);
    // Sản xuất: mẻ cũ W0 thiếu cả lô NL lẫn tem
    expect(thieu("san-xuat")).toEqual({ W0: "lo,tem", W1: "", W2: "" });
    // Kho: cả 3 đã nhập, tồn theo đúng lô gắn
    expect(gd.kho!.muc.map((m) => [m.nut.id, m.kho, m.ton])).toEqual(
      expect.arrayContaining([["W0", "da-nhap", 100], ["W1", "da-nhap", 200], ["W2", "da-nhap", 100]])
    );
    expect(gd["dong-goi"]!.muc.map((m) => [m.nut.id, m.soLo, m.ton, m.thieu.length])).toEqual([["P1", 1, 140, 0]]);
    // Xuất & bán: lệnh x1 đã quét, b1/b2/n1 đã gắn lô; handoff Đơn đặt (b3) không tính là bán lẻ
    expect(gd["xuat-ban"]!.muc.map((m) => `${m.nut.kind}:${m.nut.id}:${m.thieu.join(",")}`).sort()).toEqual(["B:b1:", "B:b2:", "N:n1:", "X:x1:"]);
    expect(gd["xuat-ban"]!.muc.find((m) => m.nut.id === "x1")).toMatchObject({ daQuet: true, lenhId: "e1", donId: "o1" });
    expect(gd["xuat-ban"]!.muc.find((m) => m.nut.id === "b1")!.loaiLoBan).toBe("P");

    // Ghi lý do cho W0 ⇒ chỉ còn thiếu tem
    const lyDo: LotWaiver = { id: "z1", outputKind: "W", outputId: "W0", reason: "Mẻ trước ngày áp dụng QR", operator: "", recordedAt: "" };
    const w0 = theoGiaiDoan({ ...dl, lotWaivers: [lyDo] }, loc)[1]!.muc.find((m) => m.nut.id === "W0")!;
    expect(w0).toMatchObject({ thieu: ["tem"], lyDo: "Mẻ trước ngày áp dụng QR" });
    // Lọc xưởng khác ⇒ trống
    expect(theoGiaiDoan(dl, { ...loc, xuong: "Cá" }).every((g) => g.muc.length === 0)).toBe(true);
  });

  it("gắn lô cả phiên: lô bạch tuộc vào mẻ bạch tuộc, lô mực không dính", () => {
    let i = 0;
    const kq = ganLoChoPhien({
      mes: [{ id: "Wmoi", productId: "mh2da" }, { id: "Wmuc", productId: "mhMuc" }],
      banNoiDia: [{ id: "n2", materialTypeName: "Bạch tuộc" }],
      loNl: [{ nut: nutLo("S", "S1-1", dl), cach: "quet" }, { nut: nutLo("S", "S3-1", dl), cach: "chon" }],
      dl, nguoiGhi: "Trúc", luc: "2026-10-06T07:00:00Z", taoId: () => `g${++i}`,
    });
    expect(kq.lotInputs.map((l) => `${l.outputId}<${l.inputId}`)).toEqual(["Wmoi<S1-1", "Wmuc<S3-1"]);
    expect(kq.lotInputs.every((l) => l.quantityKg === null)).toBe(true);
    expect(kq.dispatches.map((d) => `${d.docId}<${d.lotId}`)).toEqual(["n2<S1-1"]);
    expect(kq.khongKhop).toEqual([]);
  });
});

// ---------- Lô NL = mỗi loại NL của chuyến (chốt 2026-10-08) ----------
// Đúng ca thật: chuyến Hồng Phú Đ-261002-01 chở 3 loại bạch tuộc, cân riêng từng loại.
describe("lô NL theo loại: một chuyến 3 loại ⇒ 3 lô, 3 tem", () => {
  const hp = { ...chuyen("HP", "Hồng Phú", "Đ-261002-01"), deliveryDate: "2026-10-02", postingDate: "2026-10-02" };
  const dongHP = (id: string, loai: string, kg: number) =>
    ({ id, shipmentId: "HP", deliveryDate: "2026-10-02", workshop: "Đông", category: "Bạch tuộc", materialTypeName: loai, quantityKg: kg, unitPrice: null }) as MaterialImportItem;
  const loaiNL: MaterialType[] = [
    { id: "t1", name: "Bạch tuộc 1 da", category: "Bạch tuộc", note: "" },
    { id: "t2", name: "Bạch tuộc 2 da lớn (80↑)", category: "Bạch tuộc", note: "" },
    { id: "t3", name: "Bạch tuộc 2 da nhỏ (80↓)", category: "Bạch tuộc", note: "" },
  ];
  const d2: DuLieuTruyXuat = {
    ...dl,
    shipments: [hp],
    imports: [dongHP("HP-a", "Bạch tuộc 1 da", 5100), dongHP("HP-b", "Bạch tuộc 2 da lớn (80↑)", 1038), dongHP("HP-c", "Bạch tuộc 2 da nhỏ (80↓)", 1704)],
    products: [
      { ...mh("mhLon", "Bạch tuộc 2 da lớn chần", "Bạch tuộc"), materialTypeId: "t2" }, // đã gắn loại NL ở Danh mục
      mh("mhChung", "Bạch tuộc cắt", "Bạch tuộc"), // chỉ biết loài
    ],
    materialTypes: loaiNL,
    lotInputs: [], lotDispatches: [], labelPrints: [],
  };

  it("in tem chuyến ra 3 tem: cùng mã chuyến, mỗi tem một loại + kg của loại đó (định dạng vi-VN)", () => {
    const ds = dsLoDeIn(d2, { tu: "2026-10-02", den: "2026-10-02", xuong: "", loai: ["S"] });
    expect(ds.map((n) => [n.nhan, n.moTa, n.kg])).toEqual([
      ["Đ-261002-01", "Bạch tuộc 1 da", 5100],
      ["Đ-261002-01", "Bạch tuộc 2 da lớn (80↑)", 1038],
      ["Đ-261002-01", "Bạch tuộc 2 da nhỏ (80↓)", 1704],
    ]);
    expect(ds[0]!.chiTiet).toContainEqual({ nhan: "Khối lượng", giaTri: "5.100 kg" });
    expect(ds[0]!.chiTiet).toContainEqual({ nhan: "Cùng chuyến", giaTri: "3 loại · 7.842 kg" });
  });

  it("gõ mã chuyến hay quét QR cũ theo chuyến ⇒ hiện 3 lô để chọn; QR mới ⇒ đúng 1 lô", () => {
    expect(timLo(docMaQr("Đ-261002-01")!, d2).map((n) => n.id)).toEqual(["HP-a", "HP-b", "HP-c"]);
    expect(timLo(docMaQr("S:HP")!, d2).map((n) => n.id)).toEqual(["HP-a", "HP-b", "HP-c"]);
    expect(timLo(docMaQr("https://app.example/#/qr?lo=S:HP-b")!, d2).map((n) => n.moTa)).toEqual(["Bạch tuộc 2 da lớn (80↑)"]);
    // nút cả chuyến vẫn dựng được cho dây lô ghi trước ngày tách
    expect(nutLo("S", "HP", d2)).toMatchObject({ kg: 7842, nhan: "Đ-261002-01" });
  });

  it("gắn lô cả phiên: mẻ đã gắn loại NL chỉ nhận đúng lô loại đó; mẻ chỉ biết loài nhận cả 3", () => {
    let i = 0;
    const kq = ganLoChoPhien({
      mes: [{ id: "mLon", productId: "mhLon" }, { id: "mChung", productId: "mhChung" }],
      banNoiDia: [{ id: "nd", materialTypeName: "Bạch tuộc 1 da" }],
      loNl: ["HP-a", "HP-b", "HP-c"].map((id) => ({ nut: nutLo("S", id, d2), cach: "quet" as const })),
      dl: d2, nguoiGhi: "", luc: "", taoId: () => `g${++i}`,
    });
    expect(kq.lotInputs.filter((l) => l.outputId === "mLon").map((l) => l.inputId)).toEqual(["HP-b"]);
    expect(kq.lotInputs.filter((l) => l.outputId === "mChung").map((l) => l.inputId)).toEqual(["HP-a", "HP-b", "HP-c"]);
    expect(kq.dispatches.map((d) => d.lotId)).toEqual(["HP-a"]);
    // dây lô ghi rõ loại NL của lô (cột material)
    expect(kq.lotInputs.filter((l) => l.outputId === "mLon").map((l) => l.material)).toEqual(["Bạch tuộc 2 da lớn (80↑)"]);
  });

  it("cân bằng kg theo từng loại, không trộn 3 loại", () => {
    const d3 = { ...d2, lotInputs: [{ id: "x", outputKind: "W", outputId: "w", inputKind: "S", inputId: "HP-b", inputLabel: "", material: "", quantityKg: 1000, method: "chon", operator: "", recordedAt: "" } as LotInput] };
    expect(canBangLo("S", "HP-b", d3)).toMatchObject({ vao: 1038, con: 38 });
    expect(canBangLo("S", "HP-a", d3)).toMatchObject({ vao: 5100, con: 5100 });
  });

  it("thu hồi cả chuyến gộp các loại, mỗi dòng hàng ra một lần", () => {
    const wipChung: WipProductionItem = { ...me("WC", "2026-10-03", "mhChung", 500, 50) };
    const d4: DuLieuTruyXuat = {
      ...d2,
      wips: [wipChung],
      lotInputs: ["HP-a", "HP-c"].map((id, k) => ({ id: `li${k}`, outputKind: "W", outputId: "WC", inputKind: "S", inputId: id, inputLabel: "", material: "", quantityKg: null, method: "chon", operator: "", recordedAt: "" }) as LotInput),
      exportItems: [{ id: "xC", exportId: "e1", wipId: "WC", productId: "mhChung", spec: "", quantityKg: 100, blocksCount: 10 }],
    };
    expect(loCungChuyen("HP-b", d4).map((n) => n.id)).toEqual(["HP-a", "HP-b", "HP-c"]);
    expect(danhSachThuHoi("S", "HP-b", d4).hangRa).toEqual([]); // loại 2 da lớn chưa đi đâu
    const gop = danhSachThuHoiNhieu(loCungChuyen("HP-b", d4), d4);
    expect(gop.hangRa.map((r) => `${r.loai}:${r.id}:${r.khach}`)).toEqual(["X:xC:Khách X"]); // qua 2 loại nhưng chỉ 1 dòng
    expect(gop.loTrongXuong.map((n) => n.id)).toEqual(["WC"]);
  });
});
