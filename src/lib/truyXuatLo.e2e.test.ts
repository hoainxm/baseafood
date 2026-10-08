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
  canBangLo, danhSachThuHoi, docMaQr, doPhuTruyXuat, ganLoChoPhien, nutLo, timLo, tonKhoCuaLo, truyNguoc,
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
  gan("l1", "W", "W1", "S", "S1", 600),
  gan("l2", "W", "W2", "S", "S1", 250),
  gan("l3", "W", "W2", "S", "S2", 150),
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
  ra("d4", "S", "S2", "domestic_sale", "n1", 30),
];
const labelPrints = (["S:S1", "S:S2", "W:W1", "W:W2", "P:P1"] as const).map((k, i): LabelPrint => {
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
    expect(phang(cay)).toEqual(["W:W1", "S:S1"]);
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
    const { hangRa, loTrongXuong } = danhSachThuHoi("S", "S1", dl);
    expect([...new Set(hangRa.map((r) => r.khach))].sort()).toEqual(["Khách X", "Khách Y", "Khách Z"]);
    expect(hangRa.find((r) => r.khach === "Khách Y")).toMatchObject({ loai: "B", kg: 50, tuLo: nutLo("P", "P1", dl).nhan });
    expect(loTrongXuong.map((n) => n.id).sort()).toEqual(["P1", "W1", "W2"]);
  });

  it("thu hồi lô S2 CHỈ tới khách X + chợ (bán nội địa) — không kéo theo Y, Z", () => {
    const khach = danhSachThuHoi("S", "S2", dl).hangRa.map((r) => r.khach).sort();
    expect(khach).toEqual(["Chợ Bà Rịa", "Khách X"]);
  });

  it("quét kiểm lệnh xuất không đẻ thêm ngả ra (không đếm hai lần)", () => {
    expect(phang(truyXuoi("W", "W2", dl))).toEqual(["X:x1"]);
  });

  it("cân bằng kg theo hồ sơ lô", () => {
    expect(canBangLo("S", "S1", dl)).toMatchObject({ vao: 1000, con: 150, chuaCan: 0 });
    expect(canBangLo("S", "S2", dl)).toMatchObject({ vao: 600, con: 420 });
    expect(canBangLo("S", "S2", dl)!.ra).toContainEqual({ nhan: "Bán nội địa", kg: 30 });
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
    expect(timLo(docMaQr("đ-261001-01")!, dl).map((n) => n.id)).toEqual(["S1"]);
  });

  it("độ phủ 29/09–05/10: mẻ cũ W0 là lỗ duy nhất; ghi lý do thì hết thiếu", () => {
    const loc = { tu: "2026-09-29", den: "2026-10-05", xuong: "Đông" as const };
    const m = Object.fromEntries(doPhuTruyXuat(dl, loc).map((x) => [x.khoa, x]));
    expect(m.me).toMatchObject({ tong: 3, co: 2, coLyDo: 0 });
    expect(m.me!.thieu.map((n) => n.id)).toEqual(["W0"]);
    expect(m["dong-goi"]).toMatchObject({ tong: 1, co: 1 });
    expect(m["ban-le"]).toMatchObject({ tong: 2, co: 2 });
    expect(m["ban-nd"]).toMatchObject({ tong: 1, co: 1 });
    expect(m.xuat).toMatchObject({ tong: 1, co: 1 });
    expect(m.tem).toMatchObject({ tong: 7, co: 5 });
    expect(m.tem!.thieu.map((n) => n.id).sort()).toEqual(["S3", "W0"]);

    const lyDo: LotWaiver = { id: "z1", outputKind: "W", outputId: "W0", reason: "Mẻ trước ngày áp dụng QR", operator: "", recordedAt: "" };
    const m2 = Object.fromEntries(doPhuTruyXuat({ ...dl, lotWaivers: [lyDo] }, loc).map((x) => [x.khoa, x]));
    expect(m2.me).toMatchObject({ co: 2, coLyDo: 1, thieu: [] });
  });

  it("gắn lô cả phiên: lô bạch tuộc vào mẻ bạch tuộc, lô mực không dính", () => {
    let i = 0;
    const kq = ganLoChoPhien({
      mes: [{ id: "Wmoi", productId: "mh2da" }, { id: "Wmuc", productId: "mhMuc" }],
      banNoiDia: [{ id: "n2", materialTypeName: "Bạch tuộc" }],
      loNl: [{ nut: nutLo("S", "S1", dl), cach: "quet" }, { nut: nutLo("S", "S3", dl), cach: "chon" }],
      dl, nguoiGhi: "Trúc", luc: "2026-10-06T07:00:00Z", taoId: () => `g${++i}`,
    });
    expect(kq.lotInputs.map((l) => `${l.outputId}<${l.inputId}`)).toEqual(["Wmoi<S1", "Wmuc<S3"]);
    expect(kq.lotInputs.every((l) => l.quantityKg === null)).toBe(true);
    expect(kq.dispatches.map((d) => `${d.docId}<${d.lotId}`)).toEqual(["n2<S1"]);
    expect(kq.khongKhop).toEqual([]);
  });
});
